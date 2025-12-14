<?php

namespace App\Support;

use App\Models\CareerInterest;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

class AthenaPillarService
{


    /**
     * @return array[]
     *
     * @psalm-return array<array>
     */
    public function microPanels(): array
    {
        return collect(config('athena_pillars.micro_panels', []))
            ->map(fn (array $panel) => $this->normalisePanel($panel))
            ->all();
    }

    /**
     * @return (array|null|string)[][]
     *
     * @psalm-return array<int, array{title: array|null|string, copy: array|null|string, meta: array|null|string}>
     */
    public function charterHighlights(): array
    {
        return collect(config('athena_pillars.charter_highlights', []))
            ->map(function (array $item) {
                return [
                    'title' => __($item['title'] ?? ''),
                    'copy' => __($item['copy'] ?? ''),
                    'meta' => __($item['meta'] ?? ''),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return (array|mixed|null|string)[]
     *
     * @psalm-return array{slug: string, label: array|null|string, stat: mixed|null, summary: array|null|string, cta: array|null}
     */
    public function focusDetails(User $user, Collection $interests): array
    {
        $pillars = $this->pillars();
        $slug = $this->matchPillarSlug($user, $interests, $pillars);
        $pillar = $pillars->get($slug) ?? $pillars->first();

        return [
            'slug' => $slug,
            'label' => __($pillar['label'] ?? ''),
            'stat' => $pillar['stat'] ?? null,
            'summary' => __($pillar['focus_summary'] ?? ($pillar['description'] ?? '')),
            'cta' => $this->buildCta($pillar['focus_cta'] ?? ($pillar['cta'] ?? null)),
        ];
    }

    private function matchPillarSlug(User $user, Collection $interests, Collection $pillars): string
    {
        $tokens = $this->compileInterestTokens($user, $interests);

        return $this->matchTokensToPillar($tokens, $pillars, $this->fallbackPillarSlug($pillars));
    }

    private function matchInterestToPillar(CareerInterest $interest, Collection $pillars, string $fallback): string
    {
        $tokens = collect($this->buildInterestTokenCollection($interest));

        return $this->matchTokensToPillar($tokens, $pillars, $fallback);
    }

    private function matchTokensToPillar(Collection $tokens, Collection $pillars, string $fallback): string
    {
        if ($tokens->isEmpty()) {
            return $fallback;
        }

        foreach ($pillars as $slug => $pillar) {
            $tags = collect($pillar['interest_tags'] ?? [])
                ->map(fn ($tag) => Str::of($tag)->lower()->value())
                ->filter();

            if ($tags->isEmpty()) {
                continue;
            }

            $matched = $tokens->first(function (string $token) use ($tags) {
                return $tags->first(fn (string $tag) => Str::contains($token, $tag)) !== null;
            });

            if ($matched) {
                return $slug;
            }
        }

        return $fallback;
    }

    /**
     * @psalm-return Collection<int, never>
     */
    private function compileInterestTokens(User $user, Collection $interests): Collection
    {
        $tokens = collect();

        $tokens = $tokens->merge($this->normaliseTokenSource($user->interests ?? []));
        $tokens = $tokens->merge($this->normaliseTokenSource($user->preferences ?? []));
        $tokens = $tokens->merge($this->normaliseTokenSource($user->skills ?? []));

        $interestTokens = $interests->flatMap(fn ($interest) => $this->buildInterestTokenCollection($interest));

        return $tokens->merge($this->normaliseTokenSource($interestTokens))
            ->filter()
            ->values();
    }

    private function buildInterestTokenCollection(CareerInterest $interest): array
    {
        return $this->normaliseTokenSource([
            $interest->pathway_type ?? null,
            $interest->field ?? null,
            $interest->industry ?? null,
            $interest->category ?? null,
            $interest->target_roles ?? [],
            $interest->preferred_study_modes ?? [],
            $interest->tags ?? [],
        ])->all();
    }

    /**
     * @param Collection|array $source
     *
     * @psalm-return Collection<array-key, string>
     */
    private function normaliseTokenSource(array|Collection $source): Collection
    {
        return collect(Arr::wrap($source))
            ->flatMap(function ($item) {
                if (is_array($item)) {
                    return $this->normaliseTokenSource($item);
                }

                return [$item];
            })
            ->filter()
            ->map(fn ($value) => Str::of($value)->lower()->value());
    }

    /**
     * @return (array|null|string)[]
     *
     * @psalm-return array{title: array|null|string, body: array|null|string, action: array|null}
     */
    private function normalisePanel(array $panel): array
    {
        return [
            'title' => __($panel['title'] ?? __('What Athena does')),
            'body' => __($panel['body'] ?? ''),
            'action' => $this->buildCta($panel['action'] ?? null),
        ];
    }

    /**
     * @return (\Illuminate\Contracts\Routing\UrlGenerator|array|mixed|null|string)[]|null
     *
     * @psalm-return array{label: array|null|string, url: \Illuminate\Contracts\Routing\UrlGenerator|mixed|string}|null
     */
    private function buildCta(?array $cta): array|null
    {
        if (empty($cta)) {
            return null;
        }

        $url = $cta['url'] ?? null;

        if (! $url && ! empty($cta['route'])) {
            $route = $cta['route'];
            if (Route::has($route)) {
                $url = route($route, $cta['params'] ?? []);
            } else {
                $url = url($cta['fallback'] ?? '/');
            }
        }

        if (! $url) {
            return null;
        }

        if (! empty($cta['anchor'])) {
            $url = rtrim($url, '#') . '#' . ltrim($cta['anchor'], '#');
        }

        return [
            'label' => __($cta['label'] ?? __('Learn more')),
            'url' => $url,
        ];
    }

    private function pillars(): Collection
    {
        return collect(config('athena_pillars.pillars', []));
    }

    private function fallbackPillarSlug(Collection $pillars): string
    {
        $fallback = config('athena_pillars.focus_fallback');

        if ($fallback && $pillars->has($fallback)) {
            return $fallback;
        }

        return (string) $pillars->keys()->first();
    }

    /**
     * @return (int|string)[]|null
     *
     * @psalm-return array{raw: int, value: string, label: string}|null
     */
    private function formatHeroMetric($value): array|null
    {
        if ($value === null) {
            return null;
        }

        $intValue = (int) $value;

        return [
            'raw' => $intValue,
            'value' => number_format($intValue),
            'label' => Str::plural(__('Active waitlist'), max($intValue, 1)),
        ];
    }
}

