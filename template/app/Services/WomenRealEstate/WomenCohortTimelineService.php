<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenCohortTimelineEvent;
use App\Support\InAppNotifier;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use const JSON_THROW_ON_ERROR;

final class WomenCohortTimelineService
{
    public function recordAiGuidanceEvent(WomenCohortProfile $profile, array $insights, array $context = []): WomenCohortTimelineEvent|null
    {
        $summary = trim((string) Arr::get($insights, 'summary', ''));
        $activationSteps = $this->normaliseList(Arr::get($insights, 'activation_steps', []));
        $valuesAlignment = $this->normaliseList(Arr::get($insights, 'values_alignment', []));
        $provider = Arr::get($insights, 'provider');

        if ($summary === '' && $activationSteps === []) {
            return null;
        }

        $fingerprint = $context['fingerprint'] ?? $this->fingerprint(
            $profile->id,
            $context['source'] ?? 'ai_guidance',
            $context['subject'] ?? null,
            $summary,
            $activationSteps
        );

        $event = WomenCohortTimelineEvent::query()->firstOrCreate(
            ['fingerprint' => $fingerprint],
            [
                'profile_id' => $profile->id,
                'event_type' => $context['event_type'] ?? 'ai_guidance',
                'headline' => $this->buildHeadline($context),
                'summary' => $summary !== '' ? $summary : null,
                'metadata' => array_filter([
                    'source' => $context['source'] ?? null,
                    'subject' => $context['subject'] ?? null,
                    'score' => $context['score'] ?? null,
                    'activation_steps' => $activationSteps,
                    'values_alignment' => $valuesAlignment,
                    'ai_provider' => $provider,
                ], fn ($value) => $value !== null && $value !== []),
                'occurred_at' => now(),
            ]
        );

        if ($event->wasRecentlyCreated && $profile->user_id !== null) {
            InAppNotifier::notifyUser((int) $profile->user_id, 'women.cohort.ai_guidance', [
                'headline' => $event->headline,
                'summary' => $event->summary,
                'activation_steps' => $activationSteps,
                'subject' => $context['subject'] ?? null,
            ]);
        }

        return $event;
    }

    private function buildHeadline(array $context): string
    {
        if (! empty($context['headline'])) {
            return (string) $context['headline'];
        }

        if (! empty($context['subject'])) {
            return sprintf('AI recommended action for %s', $context['subject']);
        }

        if (! empty($context['source'])) {
            return Str::headline(sprintf('%s action plan ready', (string) $context['source']));
        }

        return 'AI action plan ready';
    }

    private function fingerprint(int $profileId, string $source, ?string $subject, string $summary, array $activationSteps): string
    {
        $payload = json_encode([
            'profile' => $profileId,
            'source' => $source,
            'subject' => $subject,
            'summary' => $summary,
            'activation_steps' => $activationSteps,
        ], JSON_THROW_ON_ERROR);

        return hash('sha1', $payload);
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0?: string,...}
     */
    private function normaliseList(mixed $value): array
    {
        if (is_string($value)) {
            return $value !== '' ? [$value] : [];
        }

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(array_map(static function ($entry) {
            if (is_string($entry)) {
                return trim($entry);
            }

            if (is_array($entry) && isset($entry['label'])) {
                return trim((string) $entry['label']);
            }

            return null;
        }, $value)));
    }
}

