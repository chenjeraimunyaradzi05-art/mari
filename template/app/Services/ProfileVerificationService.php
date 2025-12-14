<?php

namespace App\Services;

use App\Enums\ProfileVerificationStatus;
use App\Jobs\ProfileVerification\GenerateVerificationSummaryJob;
use App\Models\Admin;
use App\Models\Profile;
use App\Models\ProfileVerification;
use App\Models\User;
use App\Models\VerificationAudit;
use App\Models\VerificationQueueAssignment;
use App\Notifications\ProfileVerification\ProfileVerificationSubmittedNotification;
use App\Services\Compliance\AuditTrailLogger;
use App\Services\Compliance\ConsentLogger;
use App\Services\RealTimeAnalyticsEngine;
use App\Support\InAppNotifier;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Exceptions\RoleDoesNotExist;
use Throwable;

class ProfileVerificationService
{

    private ConsentLogger $consentLogger;
    private AuditTrailLogger $auditLogger;
    private RealTimeAnalyticsEngine $analytics;
    private ?string $disk = null;

    public function __construct(
        ?ConsentLogger $consentLogger = null,
        ?AuditTrailLogger $auditLogger = null,
        ?RealTimeAnalyticsEngine $analytics = null,
        ?string $disk = null
    ) {
        $this->consentLogger = $consentLogger ?? new ConsentLogger();
        $this->auditLogger = $auditLogger ?? new AuditTrailLogger();
        $this->analytics = $analytics ?? new RealTimeAnalyticsEngine();
        $this->disk = $disk;
    }


    public function submit(Profile $profile, User $user, array $payload, array $documents = []): ProfileVerification
    {
        return DB::transaction(function () use ($profile, $user, $payload, $documents) {
            $disk = $this->resolveDisk();
            $storedDocuments = $this->storeDocuments($documents, $disk, $profile->getKey());

            $submittedAt = CarbonImmutable::now();
            $licenseExpiry = $this->parseDate($payload['license_expires_at'] ?? null);
            $riskScore = $this->calculateRiskScore($storedDocuments, $payload, $licenseExpiry);
            $fraudFlags = $this->deriveFraudFlags($storedDocuments, $payload, $licenseExpiry);

            $verification = $profile->verificationRequests()->create([
                'user_id' => $user->getKey(),
                'request_type' => $payload['request_type'] ?? 'document_upload',
                'status' => ProfileVerificationStatus::Pending,
                'submitted_data' => [
                    'notes' => $payload['notes'] ?? null,
                    'evidence_urls' => $payload['evidence_urls'] ?? [],
                    'identity' => $payload['identity'] ?? [],
                    'credentials' => $payload['credentials'] ?? [],
                    'consent' => $payload['consent'] ?? [],
                ],
                'attachment_manifest' => $this->buildAttachmentManifest($storedDocuments, $disk),
                'submitted_at' => $submittedAt,
                'license_expires_at' => $licenseExpiry,
                'risk_score' => $riskScore,
                'fraud_flags' => $fraudFlags,
            ]);

            foreach ($storedDocuments as $document) {
                $verification->documents()->create($document);
            }

            VerificationAudit::create([
                'verification_id' => $verification->getKey(),
                'action' => 'submitted',
                'notes' => [
                    'notes' => $payload['notes'] ?? null,
                    'evidence_urls' => $payload['evidence_urls'] ?? [],
                ],
            ]);

            $this->consentLogger->log(
                surface: 'profile_verification',
                action: 'verification_submitted',
                payload: [
                    'profile_id' => $profile->getKey(),
                    'verification_id' => $verification->getKey(),
                    'request_type' => $verification->request_type,
                    'consent_flags' => $payload['consent'] ?? [],
                ],
                subject: $verification,
                user: $user,
                actorName: $user->name,
                actorEmail: $user->email,
            );

            $this->auditLogger->log(
                $verification,
                'verification_submitted',
                [
                    'profile_id' => $profile->getKey(),
                    'request_type' => $verification->request_type,
                    'risk_score' => $verification->risk_score,
                    'document_count' => count($storedDocuments),
                ],
                $user,
            );

            $verification->loadMissing(['documents', 'audits', 'profile.user']);

            $this->recordAnalyticsEvent('persona.verification.submitted', [
                'profile_id' => $profile->getKey(),
                'user_id' => $user->getKey(),
                'verification_id' => $verification->getKey(),
                'request_type' => $verification->request_type,
                'risk_score' => $verification->risk_score,
                'document_count' => count($storedDocuments),
                'fraud_flags' => $verification->fraud_flags,
            ]);

            $this->notifyReviewers($verification);
            $this->notifyApplicantSubmission($verification);
            GenerateVerificationSummaryJob::dispatch($verification->getKey());

            return $verification;
        });
    }

    public function assignReviewer(ProfileVerification $verification, Admin $reviewer): VerificationQueueAssignment
    {
        return DB::transaction(function () use ($verification, $reviewer) {
            $assignment = $verification->queueAssignments()
                ->whereNull('released_at')
                ->latest('assigned_at')
                ->first();

            if ($assignment && $assignment->assigned_reviewer_id === $reviewer->getKey()) {
                return $assignment;
            }

            if ($assignment && $assignment->assigned_reviewer_id !== $reviewer->getKey()) {
                $assignment->update([
                    'status' => 'released',
                    'released_at' => now(),
                ]);
            }

            $newAssignment = $verification->queueAssignments()->create([
                'assigned_reviewer_id' => $reviewer->getKey(),
                'status' => 'active',
                'assigned_at' => now(),
                'metadata' => [
                    'previous_assignment_id' => $assignment?->getKey(),
                ],
            ]);

            $verification->forceFill([
                'assigned_reviewer_id' => $reviewer->getKey(),
            ])->save();

            $this->recordAnalyticsEvent('persona.verification.assigned', [
                'verification_id' => $verification->getKey(),
                'profile_id' => $verification->profile_id,
                'assigned_reviewer_id' => $reviewer->getKey(),
            ]);
            $this->notifyReviewerAssignment($verification->fresh('profile.user'), $reviewer);

            $this->auditLogger->log(
                $verification,
                'verification_assigned',
                [
                    'reviewer_id' => $reviewer->getKey(),
                    'previous_assignment_id' => $assignment?->getKey(),
                ],
                $reviewer,
            );

            return $newAssignment;
        });
    }

    public function recordDecision(ProfileVerification $verification, Admin $reviewer, ProfileVerificationStatus $status, ?string $reason = null, ?string $notes = null): ProfileVerification
    {
        return DB::transaction(function () use ($verification, $reviewer, $status, $reason, $notes) {
            $now = now();

            $verification->forceFill([
                'status' => $status,
                'reviewed_by' => $reviewer->getKey(),
                'assigned_reviewer_id' => $reviewer->getKey(),
                'reviewed_at' => $now,
                'decision_at' => $now,
                'decision_reason' => $reason,
                'notes' => $notes,
            ])->save();

            $verification->queueAssignments()
                ->whereNull('released_at')
                ->update([
                    'status' => 'completed',
                    'released_at' => $now,
                ]);

            VerificationAudit::create([
                'verification_id' => $verification->getKey(),
                'action' => 'decision.'.$status->value,
                'actor_id' => $reviewer->getKey(),
                'notes' => array_filter([
                    'reason' => $reason,
                    'notes' => $notes,
                ]),
            ]);

            $this->auditLogger->log(
                $verification,
                'verification_decision',
                [
                    'status' => $status->value,
                    'reason' => $reason,
                    'notes' => $notes,
                    'reviewer_id' => $reviewer->getKey(),
                ],
                $reviewer,
            );

            $verification->loadMissing(['documents', 'audits.actor', 'assignedReviewer', 'profile.user']);

            $this->recordAnalyticsEvent('persona.verification.decision', [
                'verification_id' => $verification->getKey(),
                'profile_id' => $verification->profile_id,
                'reviewer_id' => $reviewer->getKey(),
                'status' => $status->value,
            ]);

            $this->notifyApplicantDecision($verification);

            return $verification;
        });
    }

    private function resolveDisk(): string
    {
        return $this->disk ?? (config('filesystems.disks.private') ? 'private' : config('filesystems.default', 'local'));
    }

    /**
     * @param array<int, UploadedFile|array|null> $documents
     * @return array<int, array<string, mixed>>
     */
    private function storeDocuments(array $documents, string $disk, int $profileId): array
    {
        $stored = [];

        foreach ($documents as $file) {
            if (! $file instanceof UploadedFile) {
                if (is_array($file) && isset($file['path'])) {
                    $stored[] = $this->hydrateStoredDocument($file, $disk, $profileId);
                }

                continue;
            }

            $path = $file->store('profile-verifications/'.$profileId, $disk);

            $stored[] = [
                'disk' => $disk,
                'path' => $path,
                'mime_type' => $file->getClientMimeType(),
                'size_bytes' => $file->getSize(),
                'checksum' => hash_file('sha256', $file->getRealPath()),
                'metadata' => [
                    'original_name' => $file->getClientOriginalName(),
                ],
            ];
        }

        return $stored;
    }

    /**
     * @return (array[]|int|string)[]
     *
     * @psalm-return array{count: int<0, max>, disk: string, documents: array<array>}
     */
    private function buildAttachmentManifest(array $documents, string $disk): array
    {
        return [
            'count' => count($documents),
            'disk' => $disk,
            'documents' => array_map(function (array $document) {
                return Arr::only($document, ['path', 'mime_type', 'size_bytes', 'checksum', 'metadata']);
            }, $documents),
        ];
    }

    private function calculateRiskScore(array $documents, array $payload, ?CarbonImmutable $licenseExpiry): float
    {
        $score = 0.35;

        if ($documents === []) {
            $score += 0.25;
        }

        if (empty($payload['evidence_urls'])) {
            $score += 0.15;
        }

        if ($licenseExpiry !== null && $licenseExpiry->isPast()) {
            $score += 0.2;
        }

        return round(min($score, 0.95), 2);
    }

    /**
     * @return string[]
     *
     * @psalm-return list<'license_expired'|'missing_documents'|'missing_evidence'>
     */
    private function deriveFraudFlags(array $documents, array $payload, ?CarbonImmutable $licenseExpiry): array
    {
        $flags = [];

        if ($documents === []) {
            $flags[] = 'missing_documents';
        }

        if (empty($payload['evidence_urls'])) {
            $flags[] = 'missing_evidence';
        }

        if ($licenseExpiry !== null && $licenseExpiry->isPast()) {
            $flags[] = 'license_expired';
        }

        return array_values(array_unique($flags));
    }

    private function parseDate(?string $value): ?CarbonImmutable
    {
        if (! $value) {
            return null;
        }

        try {
            return CarbonImmutable::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function notifyReviewers(ProfileVerification $verification): void
    {
        $roles = $this->notificationRoles();
        $query = Admin::query()->whereNotNull('email');

        if ($roles->isNotEmpty()) {
            try {
                $query->role($roles->all());
            } catch (RoleDoesNotExist $exception) {
                Log::notice('Skipping persona verification role filter; role missing.', [
                    'roles' => $roles->all(),
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        $link = $this->verificationQueueUrl($verification);

        $query->chunkById(50, function ($admins) use ($verification, $link) {
            NotificationFacade::send($admins, new ProfileVerificationSubmittedNotification($verification));

            foreach ($admins as $admin) {
                InAppNotifier::notifyAdmin($admin->id, 'persona.verification.incoming', [
                    'title' => 'Persona verification awaiting triage',
                    'persona' => [
                        'id' => $verification->profile_id,
                        'display_name' => $verification->profile?->display_name,
                        'handle' => $verification->profile?->handle,
                    ],
                    'risk_score' => $verification->risk_score,
                    'request_type' => $verification->request_type,
                    'submitted_at' => optional($verification->submitted_at)->toIso8601String(),
                    'action_url' => $link,
                ]);
            }
        });

        foreach ($this->notificationEmails() as $email) {
            NotificationFacade::route('mail', $email)
                ->notify(new ProfileVerificationSubmittedNotification($verification));
        }

        $this->sendSlackAlert($verification);
    }

    private function notifyReviewerAssignment(ProfileVerification $verification, Admin $reviewer): void
    {
        InAppNotifier::notifyAdmin($reviewer->getKey(), 'persona.verification.assignment', [
            'title' => 'You were assigned a persona verification',
            'verification_id' => $verification->getKey(),
            'persona' => [
                'id' => $verification->profile_id,
                'display_name' => $verification->profile?->display_name,
            ],
            'action_url' => $this->verificationQueueUrl($verification),
        ]);
    }

    private function notifyApplicantSubmission(ProfileVerification $verification): void
    {
        if (! $verification->user_id) {
            return;
        }

        InAppNotifier::notifyUser($verification->user_id, 'persona.verification.submitted', [
            'title' => 'Verification received',
            'message' => 'Your documents are queued for reviewer triage.',
            'verification_id' => $verification->getKey(),
            'status' => $verification->status?->value,
            'action_url' => $this->applicantVerificationUrl($verification),
        ]);
    }

    private function notifyApplicantDecision(ProfileVerification $verification): void
    {
        if (! $verification->user_id) {
            return;
        }

        InAppNotifier::notifyUser($verification->user_id, 'persona.verification.decision', [
            'title' => 'Verification decision recorded',
            'message' => 'A reviewer completed your verification request.',
            'verification_id' => $verification->getKey(),
            'status' => $verification->status?->value,
            'decision_reason' => $verification->decision_reason,
            'action_url' => $this->applicantVerificationUrl($verification),
        ]);
    }

    /**
     * @psalm-return Collection<int, string>
     */
    private function notificationRoles(): Collection
    {
        $roles = collect(config('profile_verification.notification_roles', []))
            ->map(static fn ($role) => trim((string) $role))
            ->filter()
            ->values();

        if ($roles->isNotEmpty()) {
            return $roles;
        }

        return collect(config('profile_verification.reviewer_roles', []))
            ->map(static fn ($role) => trim((string) $role))
            ->filter()
            ->values();
    }

    /**
     * @return (mixed|null)[]
     *
     * @psalm-return array<int, mixed|null>
     */
    private function notificationEmails(): array
    {
        return collect(config('profile_verification.notification_emails', []))
            ->map(static fn ($email) => filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null)
            ->filter()
            ->values()
            ->all();
    }

    private function sendSlackAlert(ProfileVerification $verification): void
    {
        $webhook = config('profile_verification.slack_webhook');

        if (! $webhook) {
            return;
        }

        $payload = $this->buildSlackPayload($verification);

        try {
            Http::timeout(5)->post($webhook, $payload);
        } catch (Throwable $exception) {
            Log::warning('Failed to post persona verification alert to Slack', [
                'verification_id' => $verification->getKey(),
                'error' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * @return (((bool|string)[][]|null|string)[][]|string)[]
     *
     * @psalm-return array{text: string, attachments: list{array{color: '#7C3AED', title: 'Open verification queue', title_link: null|string, fields: non-empty-list<array{short: bool, title: 'Persona'|'Request type'|'Risk score', value: string}>}}}
     */
    private function buildSlackPayload(ProfileVerification $verification): array
    {
        $profile = $verification->profile;
        $fields = array_values(array_filter([
            $profile ? [
                'title' => 'Persona',
                'value' => sprintf('%s (@%s)', $profile->display_name, $profile->handle),
                'short' => false,
            ] : null,
            [
                'title' => 'Risk score',
                'value' => number_format((float) $verification->risk_score, 2),
                'short' => true,
            ],
            [
                'title' => 'Request type',
                'value' => ucwords(str_replace('_', ' ', $verification->request_type)),
                'short' => true,
            ],
        ]));

        return [
            'text' => sprintf('Persona verification #%d awaiting review.', $verification->getKey()),
            'attachments' => [[
                'color' => '#7C3AED',
                'title' => 'Open verification queue',
                'title_link' => $this->verificationQueueUrl($verification),
                'fields' => $fields,
            ]],
        ];
    }

    private function verificationQueueUrl(ProfileVerification $verification): ?string
    {
        try {
            return route('admin.profile-verifications.show', $verification);
        } catch (Throwable) {
            return config('app.url');
        }
    }

    private function applicantVerificationUrl(ProfileVerification $verification): ?string
    {
        try {
            return route('account.personas.verification.show', $verification->profile);
        } catch (Throwable) {
            return null;
        }
    }

    private function recordAnalyticsEvent(string $event, array $properties): void
    {
        $this->analytics->record($event, [
            'source' => config('profile_verification.analytics_source', 'persona_verification'),
            'properties' => $properties,
        ]);
    }

    /**
     * @return (array|false|int|mixed|null|string)[]
     *
     * @psalm-return array{disk: mixed|string, path: string, mime_type: false|mixed|null|string, size_bytes: int|mixed|null, checksum: false|mixed|null|string, metadata: array<never, never>|mixed}
     */
    private function hydrateStoredDocument(array $document, string $fallbackDisk, int $profileId): array
    {
        $disk = $document['disk'] ?? $fallbackDisk;
        $path = (string) $document['path'];
        $mime = $document['mime_type'] ?? null;
        $size = $document['size_bytes'] ?? null;
        $checksum = $document['checksum'] ?? null;

        try {
            /** @var \Illuminate\Filesystem\FilesystemAdapter $filesystem */
            $filesystem = Storage::disk($disk);

            if ($mime === null && $filesystem->exists($path)) {
                if (method_exists($filesystem, 'mimeType')) {
                    $mime = $filesystem->mimeType($path);
                } elseif (method_exists($filesystem, 'getMimetype')) {
                    $mime = $filesystem->getMimetype($path);
                }
            }

            if ($size === null && $filesystem->exists($path)) {
                $size = $filesystem->size($path);
            }

            if ($checksum === null && method_exists($filesystem, 'path')) {
                $absolute = $filesystem->path($path);
                if (is_file($absolute)) {
                    $checksum = hash_file('sha256', $absolute);
                }
            }

            if (str_contains($path, '/drafts/')) {
                $targetDirectory = 'profile-verifications/'.$profileId;
                $filename = basename($path);
                $finalPath = $targetDirectory.'/'.$filename;

                if (! $filesystem->exists($targetDirectory)) {
                    $filesystem->makeDirectory($targetDirectory);
                }

                if ($filesystem->exists($path)) {
                    $filesystem->move($path, $finalPath);
                    $path = $finalPath;
                }
            }
        } catch (Throwable $exception) {
            Log::warning('Unable to enrich stored verification document', [
                'path' => $path,
                'disk' => $disk,
                'error' => $exception->getMessage(),
            ]);
        }

        return [
            'disk' => $disk,
            'path' => $path,
            'mime_type' => $mime,
            'size_bytes' => $size,
            'checksum' => $checksum,
            'metadata' => $document['metadata'] ?? [],
        ];
    }
}

