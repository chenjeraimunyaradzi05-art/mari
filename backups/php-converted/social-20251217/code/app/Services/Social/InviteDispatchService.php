<?php

namespace App\Services\Social;

use App\Jobs\Social\SendInviteNudgeJob;
use App\Mail\SocialInviteMail;
use App\Models\Invite;
use App\Models\MentorshipCohort;
use App\Models\MentorshipCohortMember;
use App\Models\MentorshipMatch;
use App\Models\Profile;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\CommunityMembershipService;
use App\Services\RealTimeAnalyticsEngine;
use App\Support\ActiveProfile;
use App\Support\InAppNotifier;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class InviteDispatchService
{
    private CommunityMembershipService $communityMemberships;
    private RealTimeAnalyticsEngine $analytics;

    public function __construct(?CommunityMembershipService $communityMemberships = null, ?RealTimeAnalyticsEngine $analytics = null)
    {
        $this->communityMemberships = $communityMemberships ?? app(CommunityMembershipService::class);
        $this->analytics = $analytics ?? app(RealTimeAnalyticsEngine::class);
    }


    /**
     * @param array<int, array<string, string>>  $recipients
     *
     * @return (((null|string)[][]|int|mixed|string)[]|Collection)[]
     *
     * @psalm-return array{invites: Collection<int, Invite>, summary: array{count: int, channel: mixed|string, recipients: array<int, array{email: null|string, phone: null|string, token: null|string}>}}
     */
    public function send(User $sender, ?Profile $profile, array $recipients, array $options = []): array
    {
        $profile ??= ActiveProfile::forUser($sender);

        if (! $profile) {
            throw new InvalidArgumentException('An active persona profile is required to send invites.');
        }

        $this->assertThrottle($sender);

        $channel = $options['channel'] ?? config('social_invites.default_channel', 'email');
        $messageOverride = trim((string) ($options['message'] ?? '')) ?: null;
        $templateKey = $options['template_key'] ?? null;
        $templateDefinition = $this->resolveTemplate($templateKey);
        $message = $this->determineMessage($templateDefinition, $messageOverride);
        $orgSlug = $options['org_slug'] ?? null;
        $tags = array_values(array_filter((array) ($options['tags'] ?? [])));
        $defaultCohortSlug = $this->sanitizeCohortSlug($options['cohort_slug'] ?? null);
        $defaultReferralCode = $this->sanitizeReferralCode($options['referral_code'] ?? null);

        /** @var Collection<int, Invite> $collection */
        $collection = collect();

        foreach ($recipients as $recipient) {
            $invite = DB::transaction(function () use ($sender, $profile, $recipient, $channel, $message, $orgSlug, $tags, $templateKey, $templateDefinition, $options, $defaultCohortSlug, $defaultReferralCode) {
                $email = Arr::get($recipient, 'email');
                $phone = Arr::get($recipient, 'phone');

                if (! $email && ! $phone) {
                    throw new InvalidArgumentException('Each recipient must include an email or phone number.');
                }

                $mentorshipContext = array_filter([
                    'cohort_id' => $options['mentorship_cohort_id'] ?? Arr::get($recipient, 'mentorship_cohort_id'),
                    'match_context' => Arr::get($recipient, 'match_context'),
                ], fn ($value) => $value !== null && $value !== '');

                $recipientCohortSlug = $this->sanitizeCohortSlug(Arr::get($recipient, 'cohort_slug') ?? null);
                $cohortSlug = $recipientCohortSlug ?? $defaultCohortSlug;

                $recipientReferralCode = $this->sanitizeReferralCode(Arr::get($recipient, 'referral_code') ?? null);
                $referralCode = $this->determineReferralCode($recipientReferralCode ?? $defaultReferralCode);

                return Invite::create([
                    'sender_id' => $sender->getKey(),
                    'sender_profile_id' => $profile->getKey(),
                    'graph_contact_id' => Arr::get($recipient, 'graph_contact_id'),
                    'recipient_email' => $email,
                    'recipient_phone' => $phone,
                    'channel' => $channel,
                    'status' => 'pending',
                    'token' => Str::uuid()->toString(),
                    'referral_code' => $referralCode,
                    'cohort_slug' => $cohortSlug,
                    'type' => Arr::get($recipient, 'type', 'social'),
                    'message' => $message,
                    'consent_snapshot' => Arr::get($recipient, 'consent_snapshot'),
                    'payload' => $this->buildPayload([
                        'org_slug' => $orgSlug,
                        'tags' => $tags,
                        'note' => Arr::get($recipient, 'note'),
                        'context' => Arr::get($recipient, 'context'),
                        'cohort_slug' => $cohortSlug,
                        'referral_code' => $referralCode,
                    ], $templateKey, $templateDefinition, $mentorshipContext),
                ]);
            });

            $collection->push($invite);
            $this->dispatchChannel($invite, $sender, $profile, $message);
            $this->scheduleNudges($invite, $templateKey, $templateDefinition, $message);
            $this->recordAnalytics($invite, $profile, $channel, $templateKey);
        }

        $this->notifySender($sender, $collection->count());

        return [
            'invites' => $collection,
            'summary' => [
                'count' => $collection->count(),
                'channel' => $channel,
                'recipients' => $collection->map(fn (Invite $invite) => [
                    'email' => $invite->recipient_email,
                    'phone' => $invite->recipient_phone,
                    'token' => $invite->token,
                ])->all(),
            ],
        ];
    }

    public function accept(string $token, User $user): Invite
    {
        $invite = Invite::query()
            ->where('token', $token)
            ->firstOrFail();

        if ($invite->accepted_at) {
            return $invite;
        }

        $now = CarbonImmutable::now();

        DB::transaction(function () use ($invite, $user, $now) {
            $invite->forceFill([
                'accepted_at' => $now,
                'accepted_user_id' => $user->getKey(),
                'status' => 'accepted',
            ])->save();
        });

        InAppNotifier::notifyUser($invite->sender_id, 'social.invite.accepted', [
            'invite_id' => $invite->getKey(),
            'accepted_by' => $user->only(['id', 'name', 'email']),
            'token' => $invite->token,
            'channel' => $invite->channel,
        ]);

        $this->analytics->record('persona.invite.accepted', [
            'properties' => [
                'invite_id' => $invite->getKey(),
                'sender_id' => $invite->sender_id,
                'sender_profile_id' => $invite->sender_profile_id,
                'accepted_user_id' => $user->getKey(),
                'channel' => $invite->channel,
            ],
        ]);

        $invite = $invite->fresh();
        $this->handleTemplateAcceptance($invite, $user);

        return $invite;
    }

    protected function assertThrottle(User $sender): void
    {
        $perDay = (int) config('social_invites.throttle.per_day', 50);
        $perMonth = (int) config('social_invites.throttle.per_month', 200);

        $todayCount = Invite::query()
            ->where('sender_id', $sender->getKey())
            ->whereDate('created_at', now()->toDateString())
            ->count();

        if ($todayCount >= $perDay) {
            throw new InvalidArgumentException('Daily invite limit reached.');
        }

        $monthCount = Invite::query()
            ->where('sender_id', $sender->getKey())
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();

        if ($monthCount >= $perMonth) {
            throw new InvalidArgumentException('Monthly invite limit reached.');
        }
    }

    protected function dispatchChannel(Invite $invite, User $sender, Profile $profile, ?string $message): void
    {
        if ($invite->channel !== 'email' || ! $invite->recipient_email) {
            return;
        }

        Mail::to($invite->recipient_email)->queue(new SocialInviteMail($invite, $sender, $profile, $message));
    }

    protected function recordAnalytics(Invite $invite, Profile $profile, string $channel, ?string $templateKey = null): void
    {
        $this->analytics->record('persona.invite.sent', [
            'properties' => [
                'invite_id' => $invite->getKey(),
                'profile_id' => $profile->getKey(),
                'sender_id' => $invite->sender_id,
                'channel' => $channel,
                'has_org_context' => filled(data_get($invite->payload, 'org_slug')),
                'template_key' => $templateKey,
            ],
        ]);
    }

    protected function notifySender(User $sender, int $count): void
    {
        InAppNotifier::notifyUser($sender->getKey(), 'social.invite.sent', [
            'count' => $count,
            'message' => $count === 1
                ? 'Your invite is on the way.'
                : sprintf('%d invites are on their way.', $count),
        ]);
    }

    protected function resolveTemplate(?string $templateKey): ?array
    {
        if (! $templateKey) {
            return null;
        }

        return config("social_invites.templates.{$templateKey}");
    }

    protected function determineMessage(?array $template, ?string $messageOverride): ?string
    {
        if ($messageOverride) {
            return $messageOverride;
        }

        if ($template) {
            return $template['default_message'] ?? null;
        }

        return null;
    }

    protected function buildPayload(array $base, ?string $templateKey, ?array $templateDefinition, array $mentorshipContext = []): array
    {
        $payload = array_filter($base, fn ($value) => $value !== null && $value !== '');

        if ($templateKey && $templateDefinition) {
            $payload['template'] = array_filter([
                'key' => $templateKey,
                'label' => $templateDefinition['label'] ?? null,
                'type' => $templateDefinition['type'] ?? null,
                'onboarding' => $templateDefinition['onboarding'] ?? null,
                'nudge_offsets' => $templateDefinition['nudge_offsets'] ?? [],
            ]);
        }

        if (! empty(array_filter($mentorshipContext, fn ($value) => $value !== null && $value !== ''))) {
            $payload['mentorship'] = $mentorshipContext;
        }

        return $payload;
    }

    protected function sanitizeCohortSlug(?string $slug): string|null
    {
        if ($slug === null) {
            return null;
        }

        $normalized = Str::of($slug)
            ->lower()
            ->replace(' ', '-')
            ->replaceMatches('/[^a-z0-9_-]+/', '')
            ->trim('-_')
            ->value();

        if ($normalized === '') {
            return null;
        }

        $length = strlen($normalized);

        if ($length < 3 || $length > 100) {
            throw new InvalidArgumentException('Cohort slug must be between 3 and 100 characters.');
        }

        if (! preg_match('/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/', $normalized)) {
            throw new InvalidArgumentException('Cohort slug may only contain letters, numbers, dashes, or underscores.');
        }

        return $normalized;
    }

    protected function sanitizeReferralCode(?string $code): string|null
    {
        if ($code === null) {
            return null;
        }

        $trimmed = trim($code);

        if ($trimmed === '') {
            return null;
        }

        if (! preg_match('/^[A-Za-z0-9_-]+$/', $trimmed)) {
            throw new InvalidArgumentException('Referral codes may only contain letters, numbers, dashes, or underscores.');
        }

        $normalized = strtoupper($trimmed);
        $length = strlen($normalized);

        if ($length < 6 || $length > 32) {
            throw new InvalidArgumentException('Referral codes must be between 6 and 32 characters.');
        }

        return $normalized;
    }

    protected function determineReferralCode(?string $referralCode): string
    {
        return $referralCode ?: $this->generateReferralCode();
    }

    protected function generateReferralCode(): string
    {
        return 'INV-'.Str::upper(Str::random(10));
    }

    protected function scheduleNudges(Invite $invite, ?string $templateKey, ?array $templateDefinition, ?string $message): void
    {
        if (! $templateKey || ! $templateDefinition) {
            return;
        }

        $rawOffsets = $templateDefinition['nudge_offsets'] ?? [];
        $validOffsets = [];
        foreach ((array) $rawOffsets as $v) {
            if (is_numeric($v) && (int) $v > 0) {
                $validOffsets[] = (int) $v;
            }
        }

        $offsets = collect($validOffsets)->unique()->values();

        foreach ($offsets as $offset) {
            SendInviteNudgeJob::dispatch($invite->getKey(), $templateKey, $message)
                ->delay(now()->addHours((int) $offset));
        }
    }

    protected function handleTemplateAcceptance(Invite $invite, User $acceptedUser): void
    {
        $templateKey = data_get($invite->payload, 'template.key');

        if (! $templateKey) {
            return;
        }

        if (data_get($invite->payload, 'mentorship.match_id')) {
            return;
        }

        $templateDefinition = $this->resolveTemplate($templateKey);

        if (! $templateDefinition || ! in_array($templateDefinition['type'] ?? null, ['mentor_connection', 'cohort_invite', 'office_hours'], true)) {
            return;
        }

        $mentor = $invite->sender;

        if (! $mentor) {
            return;
        }

        $cohortId = data_get($invite->payload, 'mentorship.cohort_id');
        $cohort = $cohortId ? MentorshipCohort::with('group')->find($cohortId) : null;

        $mentorProfile = $this->resolveSocialProfileForUser($mentor);
        $menteeProfile = $this->resolveSocialProfileForUser($acceptedUser);

        if ($cohort && ! $cohort->relationLoaded('group')) {
            $cohort->loadMissing('group');
        }

        $this->addMenteeToCohort($cohort, $menteeProfile);

        $match = MentorshipMatch::create([
            'mentorship_cohort_id' => $cohort?->getKey(),
            'mentorship_program_id' => $cohort?->mentorship_program_id,
            'mentor_user_id' => $mentor->getKey(),
            'mentee_user_id' => $acceptedUser->getKey(),
            'mentor_profile_id' => $mentorProfile?->getKey(),
            'mentee_profile_id' => $menteeProfile?->getKey(),
            'status' => 'active',
            'started_at' => now(),
            'next_check_in_at' => $this->calculateNextCheckIn($templateDefinition),
            'context' => array_filter([
                'template_key' => $templateKey,
                'template_label' => $templateDefinition['label'] ?? null,
                'resource_bundle' => data_get($templateDefinition, 'onboarding.resource_bundle'),
                'original_invite_id' => $invite->getKey(),
                'notes' => data_get($invite->payload, 'mentorship.match_context'),
            ]),
        ]);

        $payload = $invite->payload ?? [];
        Arr::set($payload, 'mentorship.match_id', $match->getKey());

        $invite->forceFill(['payload' => $payload])->save();

        InAppNotifier::notifyUser($mentor->getKey(), 'mentorship.match.accepted', [
            'match_id' => $match->getKey(),
            'mentee' => $acceptedUser->only(['id', 'name', 'email']),
            'template_key' => $templateKey,
        ]);

        InAppNotifier::notifyUser($acceptedUser->getKey(), 'mentorship.match.confirmed', [
            'match_id' => $match->getKey(),
            'mentor' => $mentor->only(['id', 'name', 'email']),
            'cohort' => $cohort ? $cohort->only(['id', 'name', 'cohort_code']) : null,
            'resource_bundle' => data_get($templateDefinition, 'onboarding.resource_bundle'),
        ]);

        if ($resourceBundle = data_get($templateDefinition, 'onboarding.resource_bundle')) {
            InAppNotifier::notifyUser($acceptedUser->getKey(), 'mentorship.onboarding.resources', [
                'match_id' => $match->getKey(),
                'bundle' => $resourceBundle,
                'mentor' => $mentor->only(['id', 'name']),
            ]);
        }

        $this->analytics->record('mentorship.match.created', [
            'properties' => [
                'match_id' => $match->getKey(),
                'mentor_user_id' => $mentor->getKey(),
                'mentee_user_id' => $acceptedUser->getKey(),
                'template_key' => $templateKey,
                'cohort_id' => $cohort?->getKey(),
            ],
        ]);
    }

    protected function resolveSocialProfileForUser(User $user): SocialProfile|null
    {
        if ($user->relationLoaded('socialProfile') && $user->socialProfile) {
            return $user->socialProfile;
        }

        return SocialProfile::query()
            ->where('user_id', $user->getKey())
            ->latest('id')
            ->first();
    }

    protected function addMenteeToCohort(?MentorshipCohort $cohort, ?SocialProfile $profile): ?MentorshipCohortMember
    {
        if (! $cohort || ! $profile || ! $cohort->group) {
            return null;
        }

        $membership = $this->communityMemberships->addMember($cohort->group, $profile, [
            'community_chapter_id' => $cohort->community_chapter_id,
            'status' => 'active',
            'approved_at' => now(),
            'joined_via' => 'invite',
        ]);

        return MentorshipCohortMember::updateOrCreate(
            [
                'mentorship_cohort_id' => $cohort->getKey(),
                'social_profile_id' => $profile->getKey(),
            ],
            [
                'community_membership_id' => $membership->getKey(),
                'role' => 'mentee',
                'status' => 'active',
                'joined_at' => now(),
            ]
        );
    }

    protected function calculateNextCheckIn(?array $templateDefinition): ?CarbonImmutable
    {
        $days = (int) data_get($templateDefinition, 'onboarding.check_in_days', 0);

        if ($days <= 0) {
            return null;
        }

        return CarbonImmutable::now()->addDays($days);
    }
}

