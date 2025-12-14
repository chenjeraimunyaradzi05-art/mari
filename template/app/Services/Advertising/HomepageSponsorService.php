<?php

namespace App\Services\Advertising;

use App\Models\AdvertisingCreative;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

final class HomepageSponsorService
{
    private SlotDecisionService $slotDecisionService;

    public function __construct(?SlotDecisionService $slotDecisionService = null)
    {
        $this->slotDecisionService = $slotDecisionService ?? app(SlotDecisionService::class);
    }
    private const CACHE_SECONDS = 600;

    private const SLOT_LIMITS = [
        'hero-main' => 2,
        'feature-strip' => 3,
        'onboarding' => 1,
        'education' => 2,
        'feature-grid' => 2,
        'gallery' => 2,
        'pricing' => 1,
        'cta' => 2,
        'marketplace-hero' => 2,
        'marketplace-sidebar' => 3,
        'marketplace-spotlight' => 2,
    ];

    public function forSlot(string $slot, ?int $limit = null): array
    {
        $limit ??= self::SLOT_LIMITS[$slot] ?? 3;

        if (! $this->hasCreativeTables()) {
            return $this->fallback($slot);
        }

        $cacheKey = sprintf('homepage:sponsors:%s:%d', $slot, $limit);

        return Cache::remember($cacheKey, self::CACHE_SECONDS, function () use ($slot, $limit) {
            $creatives = $this->fetchCreatives($slot, $limit);

            if ($creatives->isEmpty()) {
                return $this->fallback($slot);
            }

            $payload = $creatives
                ->map(/**
                 * @param \App\Models\AdvertisingCreative $creative
                 */
                fn (AdvertisingCreative $creative) => $this->transformCreative($creative, $slot))
                ->filter()
                ->values()
                ->all();

            return empty($payload) ? $this->fallback($slot) : $payload;
        });
    }

    /**
     * @return Collection|\Illuminate\Database\Eloquent\Collection
     *
     * @psalm-return Collection<int, AdvertisingCreative>|\Illuminate\Database\Eloquent\Collection<int, \Illuminate\Database\Eloquent\Model>
     */
    protected function fetchCreatives(string $slot, int $limit): \Illuminate\Database\Eloquent\Collection|Collection
    {
        $decisions = $this->slotDecisionService->creativesForSlot($slot, $limit);

        if ($decisions->isNotEmpty()) {
            return $decisions;
        }

        $targeted = $this->applyPlacementFilter($this->baseQuery(), $slot)
            ->take($limit)
            ->get();

        if ($targeted->isNotEmpty()) {
            return $targeted;
        }

        return $this->baseQuery()
            ->take($limit)
            ->get();
    }

    /**
     * @psalm-return Builder<AdvertisingCreative>
     */
    protected function baseQuery(): Builder
    {
        return AdvertisingCreative::query()
            ->with(['company:id,name,logo', 'campaign:id,name,targeting'])
            ->where('status', AdvertisingCreative::STATUS_ACTIVE)
            ->where('review_status', AdvertisingCreative::REVIEW_APPROVED)
            ->latest('updated_at');
    }

    /**
     * @psalm-return Builder<\Illuminate\Database\Eloquent\Model>
     */
    protected function applyPlacementFilter(Builder $query, string $slot): Builder
    {
        $aliases = $this->slotAliases($slot);

        return $query->where(function (Builder $scoped) use ($aliases) {
            $scoped->where(function (Builder $json) use ($aliases) {
                foreach ($aliases as $alias) {
                    $json->orWhereJsonContains('insights->placements', $alias)
                        ->orWhereJsonContains('insights->slots', $alias)
                        ->orWhereJsonContains('insights->homepage_slots', $alias);
                }
            })->orWhereHas('campaign', function (Builder $campaign) use ($aliases) {
                $campaign->where(function (Builder $targeting) use ($aliases) {
                    foreach ($aliases as $alias) {
                        $targeting->orWhereJsonContains('targeting->placements', $alias)
                            ->orWhereJsonContains('targeting->zones', $alias);
                    }

                    $targeting->orWhereJsonContains('targeting->surface', 'homepage');
                });
            });
        });
    }

    /**
     * @return (array|bool|mixed|null|string)[]|null
     *
     * @psalm-return array{metrics: array, type: 'image'|'video', url: null|string, poster: null|string, label: mixed|string, title: string, description: null|string, cta_url: mixed|string, cta_text: mixed|string, external: bool, alt: null|string}|null
     */
    protected function transformCreative(AdvertisingCreative $creative, string $slot): array|null
    {
        $videoUrl = $this->resolveMediaUrl($creative->preview_video_url);
        $imageUrl = $this->resolveMediaUrl($creative->preview_image_url)
            ?? $this->resolveMediaUrl($creative->company?->logo);

        if (! $videoUrl && ! $imageUrl) {
            return null;
        }

        $insights = $creative->insights ?? [];
        $ctaUrl = $creative->destination_url ?? Arr::get($insights, 'cta_url');
        $ctaText = $creative->cta_label ?? Arr::get($insights, 'cta_text');

        return [
            'metrics' => $this->buildMetricsPayload($creative, $slot),
            'type' => $videoUrl ? 'video' : 'image',
            'url' => $videoUrl ?? $imageUrl,
            'poster' => $videoUrl ? $imageUrl : null,
            'label' => Arr::get($insights, 'label')
                ?? Arr::get($insights, 'badge')
                ?? $this->defaultLabel($creative, $slot),
            'title' => $creative->headline ?: $creative->name,
            'description' => $this->formatDescription($creative, $insights),
            'cta_url' => $ctaUrl,
            'cta_text' => $ctaText,
            'external' => $ctaUrl ? Str::startsWith($ctaUrl, ['http://', 'https://']) : false,
            'alt' => $creative->company?->name,
        ];
    }

    /**
     * @return (int|string)[]
     *
     * @psalm-return array{creative_id: int, campaign_id: int, company_id: int, slot: string, signature: string}
     */
    protected function buildMetricsPayload(AdvertisingCreative $creative, string $slot): array
    {
        return [
            'creative_id' => $creative->id,
            'campaign_id' => $creative->campaign_id,
            'company_id' => $creative->company_id,
            'slot' => $slot,
            'signature' => $this->buildSignature($creative, $slot),
        ];
    }

    protected function formatDescription(AdvertisingCreative $creative, array $insights): ?string
    {
        $text = $creative->primary_text ?? Arr::get($insights, 'summary');

        if (! $text) {
            return null;
        }

        return Str::of(strip_tags($text))
            ->squish()
            ->limit(240)
            ->toString();
    }

    protected function defaultLabel(AdvertisingCreative $creative, string $slot): string
    {
        $company = $creative->company?->name;
        $campaign = $creative->campaign?->name;

        if ($company && $campaign) {
            return sprintf('%s · %s', $company, $campaign);
        }

        if ($company) {
            return sprintf('%s sponsor', $company);
        }

        if ($campaign) {
            return sprintf('%s placement', $campaign);
        }

        return match ($slot) {
            'feature-strip', 'gallery' => 'Community partner',
            'pricing' => 'Impact dashboard demo',
            default => 'Sponsored',
        };
    }

    /**
     * @return string[]
     *
     * @psalm-return non-empty-list<string>
     */
    protected function slotAliases(string $slot): array
    {
        $normalized = str_replace('_', '-', strtolower($slot));

        return array_values(array_unique([
            $slot,
            $normalized,
            str_replace('-', '_', $normalized),
            str_replace('-', '.', $normalized),
            "home.{$normalized}",
            "homepage.{$normalized}",
        ]));
    }

    protected function buildSignature(AdvertisingCreative $creative, string $slot): string
    {
        return hash_hmac('sha256', implode('|', [$creative->id, $creative->campaign_id, $slot]), $this->signingKey());
    }

    protected function signingKey(): string
    {
        $key = (string) config('app.key');

        if (Str::startsWith($key, 'base64:')) {
            return base64_decode(substr($key, 7)) ?: $key;
        }

        return $key;
    }

    protected function resolveMediaUrl(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        if (Str::startsWith($value, ['http://', 'https://'])) {
            return $value;
        }

        return asset(ltrim($value, '/'));
    }

    protected function hasCreativeTables(): bool
    {
        return Schema::hasTable('advertising_creatives') && Schema::hasTable('advertising_campaigns');
    }

    /**
     * @return (string|true)[][]
     *
     * @psalm-return list{0?: array{type?: 'image', url: string, title: string, description: string, cta_url: string, cta_text: string, label?: string}, 1?: array{type?: 'image', url: string, title: string, description: string, cta_url: string, cta_text: string, external?: true, label?: string}, 2?: array{url: string, title: 'Aurora Health'|'CommBank Women in Biz pop-ups', description: 'Funds statewide showcase tours for marketplace founders.'|'Mental health coverage across Athena social events and Circles.', cta_url: string, cta_text: 'Partner with Athena'|'See wellness hub', type?: 'image', label?: 'Events sponsor'}}
     */
    protected function fallback(string $slot): array
    {
        return match ($slot) {
            'hero-main' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage2/img1.png'),
                    'title' => 'FairPay Bank · Athena Safeguard Accounts',
                    'description' => 'Lower fees, quicker PayID access and data-backed impact reports for women rebuilding after financial abuse.',
                    'cta_url' => route('pricing.index'),
                    'cta_text' => 'Explore bank partners',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage2/img4.png'),
                    'title' => 'Telco Ally · Connected Devices',
                    'description' => 'Subsidised data packs so social pods and remote interview kits stay online.',
                    'cta_url' => 'https://example.com/telco-ally',
                    'cta_text' => 'View media kit',
                    'external' => true,
                ],
            ],
            'feature-strip' => [
                [
                    'url' => asset('frontend/assets/imgs/brands/brand-3.png'),
                    'title' => 'WestCo Super · Retirement gap programs',
                    'description' => 'Sponsored calculators + Q&A lounges covering superannuation equality.',
                    'cta_url' => route('contact.index'),
                    'cta_text' => 'Book sponsor slot',
                ],
                [
                    'url' => asset('frontend/assets/imgs/brands/brand-5.png'),
                    'title' => 'UniFuture · Scholarships for carers',
                    'description' => 'Tafes & universities promote short courses with guaranteed interview pools.',
                    'cta_url' => route('education.discovery'),
                    'cta_text' => 'View pathways',
                ],
                [
                    'url' => asset('frontend/assets/imgs/brands/brand-7.png'),
                    'title' => 'Aurora Health',
                    'description' => 'Mental health coverage across Athena social events and Circles.',
                    'cta_url' => route('wellness.hub'),
                    'cta_text' => 'See wellness hub',
                ],
            ],
            'onboarding' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage6/img5.png'),
                    'label' => 'Sponsored social cohort',
                    'title' => 'WomenRise Circles · Career comeback lounge',
                    'description' => 'Athena partners underwrite moderated salons so carers get childcare stipends, captions, and travel support.',
                    'cta_url' => route('social.feed.index'),
                    'cta_text' => 'Join preview',
                ],
            ],
            'education' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage2/img2.png'),
                    'label' => 'AI coach spotlight',
                    'title' => 'Resume doctor powered by Athena AI',
                    'description' => 'Brands underwrite résumé rewrites and interview clinics to keep them free for members.',
                    'cta_url' => route('member.career-insights.index'),
                    'cta_text' => 'View the AI studio',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage2/img6.png'),
                    'label' => 'Learning sponsor',
                    'title' => 'TAFE Digital micro-credentials',
                    'description' => 'Scholarships for carers and regional women to finish digital badges at their pace.',
                    'cta_url' => route('education.discovery'),
                    'cta_text' => 'Browse courses',
                ],
            ],
            'feature-grid' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage5/banner1.png'),
                    'label' => 'Finance ally',
                    'title' => 'Equity Mutual · Salary transparency index',
                    'description' => 'Bank-funded salary intelligence woven into Dream Jobs Hub dashboards.',
                    'cta_url' => route('pricing.index'),
                    'cta_text' => 'Access sponsor brief',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage5/banner2.png'),
                    'label' => 'Housing ally',
                    'title' => 'SafeLease · Women-first landlords',
                    'description' => 'Advertising credits for ethical landlords and builders inside Housing Hub.',
                    'cta_url' => route('housing.index'),
                    'cta_text' => 'See listing criteria',
                ],
            ],
            'gallery' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage4/img-big1.png'),
                    'label' => 'Community partner',
                    'title' => 'Gov Women in STEM grants',
                    'description' => 'Weekly office hours streamed inside Athena Circles.',
                    'cta_url' => route('grants.index'),
                    'cta_text' => 'View grants',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage4/img-big2.png'),
                    'label' => 'Events sponsor',
                    'title' => 'Sisterhood Studios',
                    'description' => 'Wellness pop-ups + livestream packages for hybrid members.',
                    'cta_url' => route('wellness.hub'),
                    'cta_text' => 'Partner with us',
                ],
            ],
            'pricing' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage5/banner3.png'),
                    'label' => 'Impact dashboard demo',
                    'title' => 'See how partner dollars translate to solved problems',
                    'description' => 'Live analytics covering impressions, conversions and member sentiment — aligned to the Problem Map KPIs.',
                    'cta_url' => route('business.dashboard'),
                    'cta_text' => 'Request access',
                ],
            ],
            'cta' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage2/banner.png'),
                    'label' => 'Mentorship network',
                    'title' => 'Telstra Foundation · Digital safety coaches',
                    'description' => '24/7 moderators & guardians in every Athena social space.',
                    'cta_url' => route('social.feed.index'),
                    'cta_text' => 'Preview the social feed',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage3/img-job-search.png'),
                    'label' => 'Wellbeing hero',
                    'title' => 'Black Swan Health · Trauma-informed care',
                    'description' => 'Partner-funded counselling sessions inside the Wellness Marketplace.',
                    'cta_url' => route('wellness.hub'),
                    'cta_text' => 'See programs',
                ],
            ],
            'marketplace-hero' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage5/banner1.png'),
                    'label' => 'Fitness ally',
                    'title' => 'Nike Women · Subsidised memberships',
                    'description' => 'Sponsors 500 free cycle-tracking consults and child-minding credits inside the fitness marketplace.',
                    'cta_url' => route('contact.index'),
                    'cta_text' => 'Book sponsor briefing',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage5/banner2.png'),
                    'label' => 'Beauty partner',
                    'title' => 'Mecca Impact Fund',
                    'description' => 'Funds chemo-care glam kits and menopause-friendly pop-ups for mobile beauty founders.',
                    'cta_url' => route('contact.index'),
                    'cta_text' => 'View partner kit',
                ],
            ],
            'marketplace-sidebar' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage4/img-big1.png'),
                    'label' => 'Pet wellness sponsor',
                    'title' => 'PetSure × Athena roaming clinics',
                    'description' => 'Insurance subsidies covering mobile vet buses for carers and crisis shelters.',
                    'cta_url' => route('contact.index'),
                    'cta_text' => 'Sponsor a clinic',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage4/img-big2.png'),
                    'label' => 'NDIS tech partner',
                    'title' => 'Canva Accessibility Grants',
                    'description' => 'Templates + stipends so women-led salons can stay compliant and inclusive.',
                    'cta_url' => route('education.discovery'),
                    'cta_text' => 'See enablement kit',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage2/img2.png'),
                    'label' => 'Events sponsor',
                    'title' => 'CommBank Women in Biz pop-ups',
                    'description' => 'Funds statewide showcase tours for marketplace founders.',
                    'cta_url' => route('business.network'),
                    'cta_text' => 'Partner with Athena',
                ],
            ],
            'marketplace-spotlight' => [
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage2/img6.png'),
                    'label' => 'Childcare underwriter',
                    'title' => 'Goodstart × After-hours care',
                    'description' => 'Offsets late-night bookings for shift-working mothers using the marketplace.',
                    'cta_url' => route('contact.index'),
                    'cta_text' => 'Unlock brief',
                ],
                [
                    'type' => 'image',
                    'url' => asset('frontend/assets/imgs/page/homepage2/img5.png'),
                    'label' => 'Mobility fund',
                    'title' => 'Uber SheSafe vouchers',
                    'description' => 'Sponsor ride credits so members can reach vetted studios and pet clinics safely.',
                    'cta_url' => route('contact.index'),
                    'cta_text' => 'Discuss activation',
                ],
            ],
            default => [],
        };
    }
}

