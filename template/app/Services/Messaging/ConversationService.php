<?php

namespace App\Services\Messaging;

use App\Enums\SocialMessageRequestStatus;
use App\Enums\SocialMessageStatus;
use App\Enums\SocialMessageType;
use App\Enums\SocialThreadParticipantRole;
use App\Enums\SocialThreadParticipantStatus;
use App\Enums\SocialThreadRequestMode;
use App\Enums\SocialThreadStatus;
use App\Enums\SocialThreadType;
use App\Events\ConversationMessageCreated;
use App\Models\Profile;
use App\Models\SocialMessage;
use App\Models\SocialMessageAttachment;
use App\Models\SocialMessageRequest;
use App\Models\SocialMessageRead;
use App\Models\SocialProfile;
use App\Models\SocialThread;
use App\Models\SocialThreadParticipant;
use App\Models\MentorshipCohortMember;
use App\Exceptions\ImageDriverUnavailableException;
use App\Notifications\Messaging\MessageReceivedNotification;
use App\Notifications\Messaging\MessageRequestNotification;
use App\Services\Compliance\AuditTrailLogger;
use App\Services\Compliance\ConsentLogger;
use App\Services\MediaUploadService;
use App\Services\Social\SocialMessagingService;
use App\Support\ActiveSocialProfile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final class ConversationService
{
    private array $menteeProfileCache = [];
    private array $menteeThreadCache = [];

    private MessagingSafetyService $safety;

    private SocialMessagingService $socialMessaging;

    private ConsentLogger $consentLogger;

    private AuditTrailLogger $auditLogger;

    private MediaUploadService $mediaUploads;

    public function __construct(
        ?MessagingSafetyService $safety = null,
        ?SocialMessagingService $socialMessaging = null,
        ?ConsentLogger $consentLogger = null,
        ?AuditTrailLogger $auditLogger = null,
        ?MediaUploadService $mediaUploads = null
    ) {
        $this->safety = $safety ?? app(MessagingSafetyService::class);
        $this->socialMessaging = $socialMessaging ?? app(SocialMessagingService::class);
        $this->consentLogger = $consentLogger ?? app(ConsentLogger::class);
        $this->auditLogger = $auditLogger ?? app(AuditTrailLogger::class);
        $this->mediaUploads = $mediaUploads ?? app(MediaUploadService::class);
    }

    public function startConversation(
        Profile $initiator,
        Collection $participantProfiles,
        string $type,
        bool $requiresApproval,
        ?string $subject,
        ?array $metadata,
        ?array $initialMessage,
        ?string $requestMode = null
    ): SocialThread {
        $threadType = SocialThreadType::tryFrom($type);

        if (!$threadType) {
            throw ValidationException::withMessages([
                'type' => ['Unsupported conversation type.'],
            ]);
        }

        $initiatorSocial = ActiveSocialProfile::forProfile($initiator);

        if (!$initiatorSocial) {
            throw ValidationException::withMessages([
                'message' => ['Select an active persona with a social identity before messaging.'],
            ]);
        }

        $participantSocialProfiles = $this->normalizeSocialProfiles($participantProfiles)
            ->reject(fn (SocialProfile $profile) => (int) $profile->getKey() === (int) $initiatorSocial->getKey())
            ->values();

        if ($threadType->isDirect() && $participantSocialProfiles->count() !== 1) {
            throw ValidationException::withMessages([
                'participant_social_profile_ids' => ['Direct conversations must include exactly one other profile.'],
            ]);
        }

        if ($participantSocialProfiles->isEmpty()) {
            throw ValidationException::withMessages([
                'participant_social_profile_ids' => ['Add at least one participant other than yourself.'],
            ]);
        }

        $this->assertSafety($initiator, $participantSocialProfiles);

        $metadataPayload = !empty($metadata) ? $metadata : null;
        $status = $requiresApproval ? SocialThreadStatus::Pending : SocialThreadStatus::Active;
        $mode = $this->determineRequestMode($requestMode, $requiresApproval);

        if ($threadType->isDirect()) {
            $existing = $this->findExistingDirectThread($initiatorSocial, $participantSocialProfiles->first());

            if ($existing) {
                if ($initialMessage) {
                    $this->sendMessage($existing, $initiator, $initialMessage);
                }

                return $existing->fresh(['participants.profile', 'lastMessage.sender', 'lastMessage.attachments']);
            }
        }

        $thread = DB::transaction(function () use ($initiator, $initiatorSocial, $participantSocialProfiles, $threadType, $status, $subject, $metadataPayload, $mode, $requiresApproval) {
            $thread = SocialThread::create([
                'thread_type' => $threadType,
                'created_by_social_profile_id' => $initiatorSocial->getKey(),
                'status' => $status,
                'message_request_mode' => $mode,
                'subject' => $subject,
                'metadata' => $metadataPayload,
            ]);

            $this->attachParticipant($thread, $initiatorSocial, SocialThreadParticipantRole::Owner, SocialThreadParticipantStatus::Active);

            $participantSocialProfiles->each(function (SocialProfile $profile) use ($thread, $requiresApproval) {
                $status = $requiresApproval ? SocialThreadParticipantStatus::Pending : SocialThreadParticipantStatus::Active;

                $this->attachParticipant($thread, $profile, SocialThreadParticipantRole::Member, $status);
            });

            if ($requiresApproval) {
                $this->createRequests($thread, $initiatorSocial, $participantSocialProfiles);
            }

            if (!$requiresApproval) {
                $thread->activateIfReady();
            }

            return $thread->load(['participants.profile']);
        });

        if ($initialMessage) {
            $this->sendMessage($thread, $initiator, $initialMessage);
        } elseif ($requiresApproval) {
            $this->notifyTargetsOfRequest($thread, $initiatorSocial, $participantSocialProfiles);
        }

        return $thread->fresh(['participants.profile', 'lastMessage.sender', 'lastMessage.attachments']);
    }

    public function sendMessage(SocialThread $conversation, Profile $sender, array $payload): SocialMessage
    {
        $senderSocial = ActiveSocialProfile::forProfile($sender);

        if (!$senderSocial) {
            throw ValidationException::withMessages([
                'message' => ['Select an active persona with a social identity before messaging.'],
            ]);
        }

        $participants = $conversation->participants()->with('profile.profileable')->get();
        $participant = $participants->firstWhere('social_profile_id', $senderSocial->getKey());

        if (!$participant || $participant->status !== SocialThreadParticipantStatus::Active) {
            throw ValidationException::withMessages([
                'message' => ['You are not allowed to send messages in this conversation.'],
            ]);
        }

        $this->ensureMenteeConsent($conversation, $participant);

        $participants
            ->where('social_profile_id', '!=', $senderSocial->getKey())
            ->each(function (SocialThreadParticipant $participant) use ($sender) {
                $persona = $this->resolvePersonaProfile($participant->profile);

                if ($persona) {
                    $this->safety->ensureProfilesCanConnect($sender, $persona);
                }
            });

        $this->guardOutgoingPayload($conversation, $senderSocial, $payload);

        return DB::transaction(function () use ($conversation, $senderSocial, $payload) {
            $message = $this->recordMessage($conversation, $senderSocial, $payload);
            $conversation->activateIfReady();
            $this->notifyParticipantsOfMessage($conversation, $message, $senderSocial);

            return $message->load(['sender', 'attachments']);
        });
    }

    public function approveRequest(SocialMessageRequest $messageRequest, Profile $responder): SocialThread
    {
        $targetSocial = ActiveSocialProfile::forProfile($responder);

        if (!$targetSocial || (int) $messageRequest->target_social_profile_id !== (int) $targetSocial->getKey()) {
            throw ValidationException::withMessages([
                'message_request' => ['You are not allowed to approve this request.'],
            ]);
        }

        if ($messageRequest->status !== SocialMessageRequestStatus::Pending) {
            throw ValidationException::withMessages([
                'message_request' => ['This request was already processed.'],
            ]);
        }

        return DB::transaction(function () use ($messageRequest, $targetSocial) {
            $thread = $messageRequest->thread()->lockForUpdate()->first();

            if (!$thread) {
                throw ValidationException::withMessages([
                    'message_request' => ['The original conversation is no longer available.'],
                ]);
            }

            $messageRequest->forceFill([
                'status' => SocialMessageRequestStatus::Approved,
                'decision_by_social_profile_id' => $targetSocial->getKey(),
            ])->save();

            SocialThreadParticipant::updateOrCreate(
                [
                    'social_thread_id' => $thread->getKey(),
                    'social_profile_id' => $targetSocial->getKey(),
                ],
                [
                    'role' => SocialThreadParticipantRole::Member,
                    'status' => SocialThreadParticipantStatus::Active,
                    'joined_at' => now(),
                    'left_at' => null,
                ]
            );

            $thread->activateIfReady();

            return $thread->load(['participants.profile', 'lastMessage.sender', 'lastMessage.attachments']);
        });
    }

    public function declineRequest(SocialMessageRequest $messageRequest, Profile $responder): void
    {
        $targetSocial = ActiveSocialProfile::forProfile($responder);

        if (!$targetSocial || (int) $messageRequest->target_social_profile_id !== (int) $targetSocial->getKey()) {
            throw ValidationException::withMessages([
                'message_request' => ['You are not allowed to decline this request.'],
            ]);
        }

        if ($messageRequest->status !== SocialMessageRequestStatus::Pending) {
            throw ValidationException::withMessages([
                'message_request' => ['This request was already processed.'],
            ]);
        }

        DB::transaction(function () use ($messageRequest, $targetSocial) {
            $thread = $messageRequest->thread()->lockForUpdate()->first();

            if (!$thread) {
                throw ValidationException::withMessages([
                    'message_request' => ['The original conversation is no longer available.'],
                ]);
            }

            $messageRequest->forceFill([
                'status' => SocialMessageRequestStatus::Declined,
                'decision_by_social_profile_id' => $targetSocial->getKey(),
            ])->save();

            $participant = $thread->participants()
                ->where('social_profile_id', $targetSocial->getKey())
                ->first();

            if ($participant && $participant->status === SocialThreadParticipantStatus::Pending) {
                $participant->forceFill([
                    'status' => SocialThreadParticipantStatus::Removed,
                    'left_at' => now(),
                ])->save();
            }
        });
    }

    /**
     * @psalm-return Collection<int, SocialProfile|null>
     */
    private function normalizeSocialProfiles(Collection $profiles): Collection
    {
        return $profiles
            ->map(function ($profile) {
                if ($profile instanceof SocialProfile) {
                    return $profile;
                }

                if ($profile instanceof Profile) {
                    return ActiveSocialProfile::forProfile($profile);
                }

                throw new InvalidArgumentException('Participants must be persona profiles or social profiles.');
            })
            ->filter()
            ->unique(fn (SocialProfile $profile) => $profile->getKey())
            ->values();
    }

    private function recordSystemNotice(SocialThread $conversation, SocialProfile $sender, string $body, array $flags = []): SocialMessage
    {
        $message = $conversation->messages()->create([
            'sender_social_profile_id' => $sender->getKey(),
            'message_type' => SocialMessageType::System,
            'status' => SocialMessageStatus::Sent,
            'body' => $body,
            'structured_body' => null,
            'is_system' => true,
            'sent_at' => now(),
            'moderation_flags' => $flags ?: null,
        ]);

        $conversation->forceFill([
            'last_message_id' => $message->getKey(),
            'last_message_at' => $message->sent_at,
        ])->save();

        $this->seedDeliveryReceipts($message);

        return $message;
    }

    private function guardOutgoingPayload(SocialThread $conversation, SocialProfile $sender, array $payload): void
    {
        $moderation = $this->socialMessaging->reviewOutgoingMessage($conversation, $sender, $payload);

        if (!$moderation) {
            return;
        }

        $notice = $moderation['auto_response'] ?? 'Message paused by respectful messaging filters.';

        $this->recordSystemNotice($conversation, $sender, $notice, $moderation['violations'] ?? []);

        throw ValidationException::withMessages([
            'message' => $notice,
        ]);
    }

    public function markMessagesRead(SocialThread $conversation, SocialProfile $viewer, iterable $messages = []): void
    {
        if (!$this->conversationRequiresMenteeSafeguards($conversation)) {
            return;
        }

        if (!config('social_messaging.mentee_safeguards.read_receipts_enabled', true)) {
            return;
        }

        $participant = $conversation->participants()
            ->where('social_profile_id', $viewer->getKey())
            ->first();

        if (!$participant) {
            return;
        }

        $messageIds = [];

        foreach ($messages as $message) {
            if ($message instanceof SocialMessage && (int) $message->sender_social_profile_id !== (int) $viewer->getKey()) {
                $messageIds[] = $message->getKey();
            }
        }

        if (empty($messageIds)) {
            $messageIds = $conversation->messages()
                ->where('sender_social_profile_id', '!=', $viewer->getKey())
                ->latest('sent_at')
                ->limit(50)
                ->pluck('id')
                ->all();
        }

        if (empty($messageIds)) {
            return;
        }

        $now = now();

        foreach ($messageIds as $messageId) {
            SocialMessageRead::updateOrCreate(
                [
                    'social_message_id' => $messageId,
                    'social_thread_participant_id' => $participant->getKey(),
                ],
                [
                    'delivered_at' => $now,
                    'read_at' => $now,
                ]
            );
        }

        $participant->forceFill([
            'last_read_at' => $now,
            'last_read_message_id' => max($messageIds),
        ])->save();
    }

    private function ensureMenteeConsent(SocialThread $conversation, SocialThreadParticipant $participant): void
    {
        if (!$this->conversationRequiresMenteeSafeguards($conversation)) {
            return;
        }

        if ($this->participantIsMentee($participant)) {
            return;
        }

        $settings = $participant->settings ?? [];

        if (!empty($settings['mentee_consent_ack_at'])) {
            return;
        }

        $notice = (string) config('social_messaging.mentee_safeguards.consent_notice', 'I agree to honor community guidelines before continuing this mentorship conversation.');

        $profile = $participant->profile;

        if ($profile) {
            $this->recordSystemNotice($conversation, $profile, $notice, ['type' => 'mentee_consent']);
        }

        $actorUser = $profile?->user;

        $this->consentLogger->log(
            surface: 'mentorship_thread',
            action: 'mentee_consent_recorded',
            payload: [
                'thread_id' => $conversation->getKey(),
                'participant_id' => $participant->getKey(),
            ],
            subject: $conversation,
            user: $actorUser,
            actorName: $profile?->display_name,
            actorEmail: $actorUser?->email,
        );

        $this->auditLogger->log(
            $conversation,
            'mentee_consent_recorded',
            [
                'participant_id' => $participant->getKey(),
                'profile_id' => $profile?->getKey(),
            ],
            $actorUser,
        );

        $settings['mentee_consent_ack_at'] = now()->toIso8601String();

        $participant->forceFill(['settings' => $settings])->save();
    }

    private function seedDeliveryReceipts(SocialMessage $message): void
    {
        if (!config('social_messaging.mentee_safeguards.read_receipts_enabled', true)) {
            return;
        }

        $thread = $message->thread()->with('participants')->first();

        if (!$thread || !$this->conversationRequiresMenteeSafeguards($thread)) {
            return;
        }

        foreach ($thread->participants as $participant) {
            if ((int) $participant->social_profile_id === (int) $message->sender_social_profile_id) {
                continue;
            }

            SocialMessageRead::updateOrCreate(
                [
                    'social_message_id' => $message->getKey(),
                    'social_thread_participant_id' => $participant->getKey(),
                ],
                [
                    'delivered_at' => $message->sent_at ?? now(),
                ]
            );
        }
    }

    private function conversationRequiresMenteeSafeguards(SocialThread $conversation): bool
    {
        $id = (int) $conversation->getKey();

        if (!$id) {
            return false;
        }

        if (array_key_exists($id, $this->menteeThreadCache)) {
            return $this->menteeThreadCache[$id];
        }

        $conversation->loadMissing('participants.profile');

        $hasMentee = $conversation->participants->contains(function (SocialThreadParticipant $participant) {
            return $this->participantIsMentee($participant);
        });

        return $this->menteeThreadCache[$id] = $hasMentee;
    }

    private function participantIsMentee(SocialThreadParticipant $participant): bool
    {
        $profile = $participant->profile;

        if (!$profile) {
            return false;
        }

        return $this->socialProfileIsMentee($profile);
    }

    private function socialProfileIsMentee(SocialProfile $profile): bool
    {
        $profileId = (int) $profile->getKey();

        if (!$profileId) {
            return false;
        }

        if (!array_key_exists($profileId, $this->menteeProfileCache)) {
            $this->menteeProfileCache[$profileId] = MentorshipCohortMember::query()
                ->where('social_profile_id', $profileId)
                ->where('role', 'mentee')
                ->where('status', '!=', 'archived')
                ->exists();
        }

        return $this->menteeProfileCache[$profileId];
    }

    private function attachParticipant(SocialThread $thread, SocialProfile $profile, SocialThreadParticipantRole $role, SocialThreadParticipantStatus $status): SocialThreadParticipant
    {
        return SocialThreadParticipant::updateOrCreate(
            [
                'social_thread_id' => $thread->getKey(),
                'social_profile_id' => $profile->getKey(),
            ],
            [
                'role' => $role,
                'status' => $status,
                'joined_at' => now(),
                'left_at' => null,
                'notifications_enabled' => true,
            ]
        );
    }

    private function recordMessage(SocialThread $conversation, SocialProfile $sender, array $payload): SocialMessage
    {
        $messageType = SocialMessageType::tryFrom($payload['message_type'] ?? 'text') ?? SocialMessageType::Text;
        $message = $conversation->messages()->create([
            'sender_social_profile_id' => $sender->getKey(),
            'message_type' => $messageType,
            'status' => SocialMessageStatus::Sent,
            'body' => $payload['body'] ?? null,
            'structured_body' => $payload['structured_body'] ?? null,
            'shareable_type' => $payload['shareable_type'] ?? null,
            'shareable_id' => $payload['shareable_id'] ?? null,
            'reply_to_message_id' => $payload['reply_to_message_id'] ?? null,
            'is_system' => (bool) ($payload['is_system'] ?? false),
            'sent_at' => now(),
        ]);

        $this->persistAttachments($message, $payload['attachments'] ?? [], $sender);

        $conversation->forceFill([
            'last_message_id' => $message->getKey(),
            'last_message_at' => $message->sent_at,
        ])->save();

        $this->seedDeliveryReceipts($message);

        return $message;
    }

    private function persistAttachments(SocialMessage $message, array $attachments, SocialProfile $sender): void
    {
        foreach ($attachments as $attachment) {
            $upload = $attachment['upload'] ?? null;
            $url = $attachment['url'] ?? null;

            $payload = [
                'social_message_id' => $message->getKey(),
                'uploaded_by_social_profile_id' => $sender->getKey(),
                'media_type' => $attachment['type'] ?? 'file',
                'mime_type' => $attachment['mime_type'] ?? null,
                'meta' => $attachment['meta'] ?? null,
            ];

            if ($upload instanceof UploadedFile) {
                try {
                    $stored = $this->mediaUploads->uploadPostMedia($upload);
                } catch (ImageDriverUnavailableException $exception) {
                    throw ValidationException::withMessages([
                        'attachments' => ['Image processing is temporarily unavailable. Please try again later.'],
                    ]);
                }

                $payload = array_merge($payload, [
                    'storage_disk' => config('filesystems.default'),
                    'file_path' => $stored['file_path'] ?? null,
                    'thumbnail_path' => $stored['thumbnail_path'] ?? null,
                    'mime_type' => $stored['mime_type'] ?? $upload->getClientMimeType(),
                    'file_size' => $stored['file_size'] ?? $upload->getSize(),
                    'width' => $stored['width'] ?? null,
                    'height' => $stored['height'] ?? null,
                    'duration' => $stored['duration'] ?? null,
                ]);
            } elseif ($url) {
                $payload = array_merge($payload, [
                    'storage_disk' => 'external',
                    'file_path' => $url,
                    'file_size' => isset($attachment['size_kb']) ? (int) $attachment['size_kb'] * 1024 : null,
                ]);
            } else {
                continue;
            }

            SocialMessageAttachment::create($payload);
        }
    }

    private function findExistingDirectThread(SocialProfile $initiator, SocialProfile $target): SocialThread|null
    {
        $blockedStatuses = [
            SocialThreadParticipantStatus::Left->value,
            SocialThreadParticipantStatus::Blocked->value,
            SocialThreadParticipantStatus::Removed->value,
        ];

        return SocialThread::query()
            ->where('thread_type', SocialThreadType::Direct)
            ->where('status', '!=', SocialThreadStatus::Archived)
            ->whereHas('participants', function ($query) use ($initiator, $blockedStatuses) {
                $query->where('social_profile_id', $initiator->getKey())
                    ->whereNotIn('status', $blockedStatuses);
            })
            ->whereHas('participants', function ($query) use ($target, $blockedStatuses) {
                $query->where('social_profile_id', $target->getKey())
                    ->whereNotIn('status', $blockedStatuses);
            })
            ->whereDoesntHave('participants', function ($query) use ($initiator, $target) {
                $query->whereNotIn('social_profile_id', [$initiator->getKey(), $target->getKey()])
                    ->whereNotIn('status', [SocialThreadParticipantStatus::Left->value]);
            })
            ->with(['participants.profile', 'lastMessage.sender'])
            ->orderByDesc('last_message_at')
            ->first();
    }

    private function determineRequestMode(?string $requestMode, bool $requiresApproval): SocialThreadRequestMode
    {
        if ($requestMode && ($mode = SocialThreadRequestMode::tryFrom($requestMode))) {
            return $mode;
        }

        if ($requiresApproval) {
            return SocialThreadRequestMode::Manual;
        }

        return SocialThreadRequestMode::tryFrom(config('social_messaging.threads.default_request_mode'))
            ?? SocialThreadRequestMode::Auto;
    }

    private function createRequests(SocialThread $thread, SocialProfile $initiator, Collection $targets): void
    {
        $ttl = now()->addDays((int) config('social_messaging.requests.auto_expire_days', 14));

        $targets->each(function (SocialProfile $target) use ($thread, $initiator, $ttl) {
            SocialMessageRequest::create([
                'social_thread_id' => $thread->getKey(),
                'requester_social_profile_id' => $initiator->getKey(),
                'target_social_profile_id' => $target->getKey(),
                'status' => SocialMessageRequestStatus::Pending,
                'expires_at' => $ttl,
                'context' => [
                    'subject' => $thread->subject,
                ],
            ]);
        });
    }

    private function notifyParticipantsOfMessage(SocialThread $thread, SocialMessage $message, SocialProfile $sender): void
    {
        $thread->loadMissing('participants.profile');

        foreach ($thread->participants as $participant) {
            if ((int) $participant->social_profile_id === (int) $sender->getKey()) {
                continue;
            }

            $owner = $participant->profile?->resolveOwnerUser();

            if ($owner) {
                $owner->notify(new MessageReceivedNotification($thread, $message));
                event(new ConversationMessageCreated($thread, $message, $owner));
            }
        }
    }

    private function notifyTargetsOfRequest(SocialThread $thread, SocialProfile $initiator, Collection $targets): void
    {
        $targets->each(function (SocialProfile $target) use ($thread, $initiator) {
            $owner = $target->resolveOwnerUser();

            if ($owner) {
                $owner->notify(new MessageRequestNotification($thread, $initiator, $target));
            }
        });
    }

    private function assertSafety(Profile $initiator, Collection $participants): void
    {
        $participants->each(function (SocialProfile $profile) use ($initiator) {
            $persona = $this->resolvePersonaProfile($profile);

            if ($persona) {
                $this->safety->ensureProfilesCanConnect($initiator, $persona);
            }
        });
    }

    private function resolvePersonaProfile(?SocialProfile $socialProfile): ?Profile
    {
        if (!$socialProfile) {
            return null;
        }

        $owner = $socialProfile->profileable;

        if ($owner instanceof Profile) {
            return $owner;
        }

        $fallback = $socialProfile->profileable()->first();

        return $fallback instanceof Profile ? $fallback : null;
    }
}

