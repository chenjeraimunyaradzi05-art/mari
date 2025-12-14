<?php

namespace App\Services\Advertising;

use App\Models\AdvertisingCreative;
use App\Models\AdvertisingSlot;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class SlotDecisionService
{
    private const CACHE_SECONDS = 90;

    /**
     * Resolve launch-ready creatives that satisfy the slot guardrails.
     *
     * @return Collection<int, AdvertisingCreative>
     */
    public function creativesForSlot(string $slotKey, int $limit = 1, array $context = []): Collection
    {
        $slot = $this->resolveSlot($slotKey);

        if (! $slot) {
            return collect();
        }

        $limit = max(1, min($limit, $slot->max_creatives ?? $limit));
        $cacheKey = sprintf('advertising:slot:%s:%d:%s', $slot->key, $limit, sha1(json_encode($context)));

        return Cache::remember($cacheKey, self::CACHE_SECONDS, function () use ($slot, $limit, $context) {
            $candidates = AdvertisingCreative::query()
                ->live()
                ->with([
                    'company:id,name,logo,foundation_status,foundation_focus_areas',
                    'campaign:id,company_id,name,objective,targeting',
                    'campaign.metrics' => fn ($query) => $query->latest('recorded_at')->limit(30),
                ])
                ->latest('updated_at')
                ->take($limit * 8)
                ->get();

            if ($candidates->isEmpty()) {
                return collect();
            }

            return $this->scoreAndSelect($slot, $candidates, $limit, $context);
        });
    }

    private function resolveSlot(string $slotKey): ?AdvertisingSlot
    {
        return AdvertisingSlot::query()
            ->active()
            ->where(function ($query) use ($slotKey) {
                $query->where('key', $slotKey);

                if (Str::contains($slotKey, ['.', '-'])) {
                    $query->orWhere('key', Str::slug($slotKey, '-'));
                }

                $query->orWhereJsonContains('targeting_rules->aliases', $slotKey);
            })
            ->orderByDesc('priority')
            ->first();
    }

    private function scoreAndSelect(AdvertisingSlot $slot, EloquentCollection $candidates, int $limit, array $context): Collection
    {
        $scored = $candidates
            ->filter(fn (AdvertisingCreative $creative) => $this->passesSlotGuards($slot, $creative))
            ->map(fn (AdvertisingCreative $creative) => [
                'creative' => $creative,
                'score' => $this->scoreCreative($slot, $creative, $context),
            ])
            ->filter(fn (array $row) => $row['score'] > 0)
            ->sortByDesc('score')
            ->take($limit)
            ->values();

        if ($scored->count() < $limit) {
            $fallback = $candidates
                ->reject(fn (AdvertisingCreative $creative) => $scored->contains(fn ($row) => $row['creative']->is($creative)))
                ->filter(fn (AdvertisingCreative $creative) => $this->passesSlotGuards($slot, $creative))
                ->take($limit - $scored->count())
                ->map(fn ($creative) => ['creative' => $creative]);

            $scored = $scored->concat($fallback);
        }

        return $scored->pluck('creative');
    }

    private function passesSlotGuards(AdvertisingSlot $slot, AdvertisingCreative $creative): bool
    {
        if (! $slot->allowsFormat($creative->format)) {
            return false;
        }

        if ($slot->guardrail('requires_guardian_brand') && ! $this->companyHasGuardianStatus($creative)) {
            return false;
        }

        $disallowedCategories = $this->normaliseArray($slot->guardrail('disallowed_categories', []));
        $creativeCategories = $this->normaliseArray(data_get($creative->campaign?->targeting, 'categories', []));
        if ($disallowedCategories && array_intersect($creativeCategories, $disallowedCategories)) {
            return false;
        }

        $flaggedTerms = $this->normaliseArray($slot->guardrail('flagged_terms', []));
        if ($flaggedTerms) {
            $haystack = strtolower(implode(' ', array_filter([
                $creative->headline,
                $creative->primary_text,
                $creative->company?->name,
            ])));

            foreach ($flaggedTerms as $term) {
                if (str_contains($haystack, $term)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @return float|int
     *
     * @psalm-return float|int<0, max>
     */
    private function scoreCreative(AdvertisingSlot $slot, AdvertisingCreative $creative, array $context): int|float
    {
        $score = 0;
        $campaignTargeting = $creative->campaign?->targeting ?? [];

        $slotIntents = $slot->preferredIntents();
        $creativeIntents = $this->normaliseArray(data_get($campaignTargeting, 'intents', []));
        $contextIntents = $this->normaliseArray($context['intents'] ?? []);

        $score += count(array_intersect($slotIntents, $creativeIntents)) * 6;
        $score += count(array_intersect($slotIntents, $contextIntents)) * 4;

        $slotRoles = $slot->preferredRoles();
        $creativeRoles = $this->normaliseArray(data_get($campaignTargeting, 'roles', data_get($campaignTargeting, 'audiences', [])));
        $contextRoles = $this->normaliseArray($context['roles'] ?? []);

        $score += count(array_intersect($slotRoles, $creativeRoles)) * 5;
        $score += count(array_intersect($slotRoles, $contextRoles)) * 2;

        $slotRegions = $slot->preferredRegions();
        $creativeRegions = $this->normaliseArray(data_get($campaignTargeting, 'regions', []));
        $contextRegions = $this->normaliseArray($context['regions'] ?? []);

        if ($slotRegions) {
            $score += count(array_intersect($slotRegions, $creativeRegions ?: $contextRegions)) * 3;
        }

        $formatPreference = $slot->allowsFormat($creative->format) ? 2 : 0;
        $score += $formatPreference;

        $preferredStatuses = $this->normaliseArray((array) $slot->guardrail('preferred_foundation_status', []));
        $companyStatus = strtolower((string) $creative->company?->foundation_status);
        if ($preferredStatuses && in_array($companyStatus, $preferredStatuses, true)) {
            $score += 4;
        }

        $recentMetric = optional($creative->campaign?->metrics->first())->recorded_at;
        if ($recentMetric) {
            $days = now()->diffInDays($recentMetric);
            $score += max(0, 5 - $days);
        }

        return $score;
    }

    private function companyHasGuardianStatus(AdvertisingCreative $creative): bool
    {
        $status = strtolower((string) $creative->company?->foundation_status);

        if ($status === '') {
            return false;
        }

        return in_array($status, ['guardian', 'guardian_plus', 'impact_champion', 'certified_partner'], true);
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function normaliseArray(array $value): array
    {
        if ($value === null) {
            return [];
        }

        $value = is_array($value) ? $value : [$value];

        return collect($value)
            ->filter()
            ->map(fn ($item) => strtolower((string) $item))
            ->unique()
            ->values()
            ->all();
    }
}

