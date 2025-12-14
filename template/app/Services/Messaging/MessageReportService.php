<?php

namespace App\Services\Messaging;

use App\Enums\SocialMessageReportStatus;
use App\Models\IncidentEvent;
use App\Models\IncidentReport;
use App\Models\Profile;
use App\Models\SocialMessage;
use App\Models\SocialMessageReport;
use App\Models\SocialProfile;
use App\Notifications\Messaging\MessageReportFiledNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class MessageReportService
{
    public function report(
        SocialMessage $message,
        Profile $reporterPersona,
        SocialProfile $reporterSocial,
        string $reason,
        ?string $notes = null,
        ?array $metadata = null
    ): SocialMessageReport {
        $message->loadMissing(['sender']);

        return DB::transaction(function () use ($message, $reporterPersona, $reporterSocial, $reason, $notes, $metadata) {
            $existingReport = SocialMessageReport::query()
                ->where('social_message_id', $message->getKey())
                ->where('reporter_social_profile_id', $reporterSocial->getKey())
                ->first();

            $incident = $existingReport?->incident;
            $reportIsNew = false;

            if (!$existingReport) {
                $incident = $this->createIncident($message, $reporterPersona, $reason, $notes, $metadata);
                $existingReport = new SocialMessageReport([
                    'social_message_id' => $message->getKey(),
                    'reporter_social_profile_id' => $reporterSocial->getKey(),
                    'incident_report_id' => $incident?->getKey(),
                    'status' => SocialMessageReportStatus::Open,
                ]);
                $reportIsNew = true;
            }

            $reportMetadata = $this->buildReportMetadata($message, $reason, $metadata ?? []);

            $existingReport->fill([
                'reason' => $reason,
                'notes' => $notes,
                'metadata' => $reportMetadata,
                'status' => $existingReport->status ?? SocialMessageReportStatus::Open,
            ]);
            $existingReport->save();

            if ($reportIsNew && $incident) {
                $this->createIncidentEvent($incident, $reporterPersona, $reason, $notes);
                $this->queueReporterAcknowledgement($reporterPersona, $existingReport->fresh(['message.sender', 'reporter']));
            }

            return $existingReport->load(['message.sender', 'reporter', 'incident']);
        });
    }

    private function createIncident(
        SocialMessage $message,
        Profile $reporterPersona,
        string $reason,
        ?string $notes,
        ?array $metadata
    ): ?IncidentReport {
        $reporterUser = $reporterPersona->user;
        $subjectUser = $message->sender?->resolveOwnerUser();

        return IncidentReport::create([
            'reporter_user_id' => $reporterUser?->getKey(),
            'subject_user_id' => $subjectUser?->getKey(),
            'category' => 'messaging',
            'severity' => $this->determineSeverity($reason),
            'description' => $notes ?: sprintf('Direct message reported for %s.', $reason),
            'status' => 'open',
            'metadata' => array_merge($metadata ?? [], [
                'reason' => $reason,
                'message_id' => $message->getKey(),
                'thread_id' => $message->social_thread_id,
                'preview' => Str::limit((string) $message->body, 240),
                'message_type' => $this->resolveMessageType($message),
            ]),
            'occurred_at' => $message->sent_at ?? now(),
        ]);
    }

    private function createIncidentEvent(IncidentReport $incident, Profile $reporterPersona, string $reason, ?string $notes): void
    {
        IncidentEvent::create([
            'incident_id' => $incident->getKey(),
            'author_user_id' => $reporterPersona->user?->getKey(),
            'action' => 'message_reported',
            'notes' => $notes ?: sprintf('Report submitted for %s.', $reason),
        ]);
    }

    private function queueReporterAcknowledgement(Profile $reporterPersona, SocialMessageReport $report): void
    {
        $user = $reporterPersona->user;

        if (!$user) {
            return;
        }

        DB::afterCommit(function () use ($user, $report) {
            $user->notify(new MessageReportFiledNotification($report));
        });
    }

    private function determineSeverity(string $reason): string
    {
        return match ($reason) {
            'harassment', 'discrimination', 'threat' => 'high',
            'spam', 'scam' => 'medium',
            default => 'low',
        };
    }

    private function resolveMessageType(SocialMessage $message): string
    {
        $type = $message->message_type;

        if ($type instanceof \UnitEnum) {
            return $type->value;
        }

        return $type;
    }

    private function buildReportMetadata(SocialMessage $message, string $reason, array $metadata): array
    {
        $system = [
            'reason' => $reason,
            'thread_id' => $message->social_thread_id,
            'message_id' => $message->getKey(),
            'sender_social_profile_id' => $message->sender_social_profile_id,
            'preview' => Str::limit((string) $message->body, 240),
            'message_type' => $this->resolveMessageType($message),
            'shareable_type' => $message->shareable_type,
            'shareable_id' => $message->shareable_id,
        ];

        return array_merge($metadata, array_filter($system, static fn ($value) => $value !== null));
    }
}

