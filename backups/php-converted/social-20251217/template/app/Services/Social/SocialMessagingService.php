<?php

namespace App\Services\Social;

use App\Models\IncidentEvent;
use App\Models\IncidentReport;
use App\Models\SocialProfile;
use App\Models\SocialThread;
use App\Models\User;
use Illuminate\Support\Str;

final class SocialMessagingService
{
    /**
     * @return ((bool|float|mixed|string)[][]|IncidentReport|null|string)[]|null
     *
     * @psalm-return array{auto_response: string, violations: list{0: array{type: 'banned_pattern'|'tone', reason: 'aggressive_tone'|'language_violation'|mixed, score?: float, escalate: bool, pattern?: string}, 1?: array{type: 'banned_pattern'|'tone', reason: 'aggressive_tone'|'language_violation'|mixed, pattern: string, escalate: bool, score?: float},...}, incident: IncidentReport|null}|null
     */
    public function reviewOutgoingMessage(SocialThread $thread, SocialProfile $sender, array $payload): array|null
    {
        $config = config('social_messaging.respectful_messaging', []);

        if (empty($config)) {
            return null;
        }

        $text = $this->extractPlainText($payload);

        if ($text === '') {
            return null;
        }

        $violations = [];
        $tone = $this->scoreTone($text, $config['tone'] ?? []);
        $blockScore = (float) ($config['tone']['block_score'] ?? 45);

        if ($tone < $blockScore) {
            $violations[] = [
                'type' => 'tone',
                'reason' => 'aggressive_tone',
                'score' => round($tone, 2),
                'escalate' => false,
            ];
        }

        foreach ($config['banned_patterns'] ?? [] as $patternConfig) {
            $pattern = $patternConfig['pattern'] ?? null;

            if (!$pattern || !is_string($pattern)) {
                continue;
            }

            if (@preg_match($pattern, '') === false) {
                continue;
            }

            if (preg_match($pattern, $text)) {
                $violations[] = [
                    'type' => 'banned_pattern',
                    'reason' => $patternConfig['reason'] ?? 'language_violation',
                    'pattern' => $pattern,
                    'escalate' => (bool) ($patternConfig['escalate'] ?? false),
                ];
            }
        }

        if (empty($violations)) {
            return null;
        }

        $incident = null;

        if ($this->shouldEscalate($violations)) {
            $incident = $this->createIncident($thread, $sender, $text, $violations, $config);
        }

        return [
            'auto_response' => $this->formatAutoResponse($violations, $config),
            'violations' => $violations,
            'incident' => $incident,
        ];
    }

    private function extractPlainText(array $payload): string
    {
        $body = trim((string) ($payload['body'] ?? ''));

        if ($body !== '') {
            return $body;
        }

        $structured = $payload['structured_body'] ?? null;

        if (is_array($structured)) {
            $text = trim((string) ($structured['text'] ?? ''));

            if ($text !== '') {
                return $text;
            }

            $summary = trim(strip_tags(json_encode($structured)));

            if ($summary !== '') {
                return $summary;
            }
        }

        return '';
    }

    private function scoreTone(string $text, array $config): float
    {
        $score = 100.0;
        $keywords = $config['negative_keywords'] ?? [];

        foreach ($keywords as $entry) {
            $term = is_array($entry) ? ($entry['term'] ?? null) : $entry;
            $weight = is_array($entry) ? (float) ($entry['weight'] ?? 10) : 8.0;
            $term = is_string($term) ? trim($term) : null;

            if (!$term) {
                continue;
            }

            if (stripos($text, $term) !== false) {
                $score -= max(2.0, $weight);
            }
        }

        if (preg_match_all('/!{2,}/', $text, $matches)) {
            $score -= min(12.0, count($matches[0]) * 2.5);
        }

        if (preg_match_all('/\b[A-Z]{4,}\b/u', $text, $shouts)) {
            $score -= min(15.0, count($shouts[0]) * 3.0);
        }

        return max(0.0, min(100.0, $score));
    }

    private function shouldEscalate(array $violations): bool
    {
        foreach ($violations as $violation) {
            if (!empty($violation['escalate'])) {
                return true;
            }
        }

        return false;
    }

    private function createIncident(SocialThread $thread, SocialProfile $sender, string $preview, array $violations, array $config): ?IncidentReport
    {
        $reporterId = (int) ($config['auto_report_user_id'] ?? 0);

        if ($reporterId <= 0 || !User::query()->whereKey($reporterId)->exists()) {
            return null;
        }

        $subjectUser = $sender->resolveOwnerUser();

        $incident = IncidentReport::create([
            'reporter_user_id' => $reporterId,
            'subject_user_id' => $subjectUser?->getKey(),
            'category' => $config['incident_category'] ?? 'messaging',
            'severity' => $this->determineSeverity($violations),
            'description' => 'Automated respectful messaging filter intercepted a note before delivery.',
            'status' => 'open',
            'metadata' => [
                'thread_id' => $thread->getKey(),
                'sender_social_profile_id' => $sender->getKey(),
                'violations' => $violations,
            ],
            'occurred_at' => now(),
        ]);

        IncidentEvent::create([
            'incident_id' => $incident->getKey(),
            'author_user_id' => $reporterId,
            'action' => 'auto_flagged',
            'notes' => Str::limit($preview, 240),
        ]);

        return $incident;
    }

    private function determineSeverity(array $violations): string
    {
        foreach ($violations as $violation) {
            if (($violation['reason'] ?? null) === 'self_harm_language' || ($violation['reason'] ?? null) === 'violent_threat') {
                return 'high';
            }
        }

        return 'medium';
    }

    private function formatAutoResponse(array $violations, array $config): string
    {
        $template = (string) ($config['auto_response_template'] ?? 'We paused your note because it triggered our respectful messaging filters. Nothing was delivered.');
        $details = collect($violations)
            ->map(fn ($violation) => $violation['reason'] ?? $violation['type'] ?? 'policy_violation')
            ->unique()
            ->implode(', ');

        return sprintf('%s (%s)', $template, $details ?: 'policy_violation');
    }
}

