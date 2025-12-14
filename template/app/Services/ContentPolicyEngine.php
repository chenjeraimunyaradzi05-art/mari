<?php

namespace App\Services;

use App\Models\SocialSensitiveTerm;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class ContentPolicyEngine
{
    /**
     * @return (((int|string)|mixed|null)[][]|bool|string)[]
     *
     * @psalm-return array{matches: list{0?: array{term: array-key|mixed, severity: mixed, replacement: mixed|null, contexts: mixed|null},...}, severity: string, action: string, should_block: bool, should_queue_review: bool}
     */
    public function scan(?string $text, array $context = []): array
    {
        $text = $text ?? '';
        $matches = [];
        $normalized = Str::lower($text);

        foreach ($this->activeTerms() as $term) {
            if ($term->is_active !== true) {
                continue;
            }

            $candidate = Str::lower($term->term);
            if ($candidate === '') {
                continue;
            }

            if (Str::contains($normalized, $candidate)) {
                $matches[] = [
                    'term' => $term->term,
                    'severity' => $term->severity,
                    'replacement' => $term->replacement,
                    'contexts' => $term->contexts,
                ];
            }
        }

        $dictionary = collect(config('moderation.dictionaries.block', []));
        foreach ($dictionary as $term => $severity) {
            if (Str::contains($normalized, Str::lower($term))) {
                $matches[] = [
                    'term' => $term,
                    'severity' => $severity,
                    'replacement' => null,
                    'contexts' => null,
                ];
            }
        }

        $severity = $this->resolveSeverity($matches);
        $action = $this->recommendedAction($severity, $context);

        return [
            'matches' => $matches,
            'severity' => $severity,
            'action' => $action,
            'should_block' => $action === 'block',
            'should_queue_review' => in_array($action, ['queue_review', 'block'], true),
        ];
    }

    protected function activeTerms(): Collection
    {
        return Cache::remember('moderation:sensitive_terms', now()->addMinutes(15), function () {
            return SocialSensitiveTerm::query()
                ->where('is_active', true)
                ->orderByDesc('severity')
                ->get();
        });
    }

    protected function resolveSeverity(array $matches): string
    {
        if (empty($matches)) {
            return 'none';
        }

        $weights = config('moderation.severity_weights', [
            'none' => 0,
            'low' => 1,
            'medium' => 2,
            'high' => 3,
            'critical' => 4,
        ]);

        $score = collect($matches)
            ->map(fn ($match) => $weights[$match['severity']] ?? 0)
            ->max();

        return array_search($score, $weights, true) ?: 'medium';
    }

    protected function recommendedAction(string $severity, array $context): string
    {
        $map = config('moderation.severity_actions', [
            'none' => 'allow',
            'low' => 'allow',
            'medium' => 'queue_review',
            'high' => 'block',
            'critical' => 'block',
        ]);

        $override = Arr::get($context, 'override_action');
        if ($override) {
            return $override;
        }

        return $map[$severity] ?? 'queue_review';
    }
}

