<?php

namespace App\Services\Advertising;

use App\Models\AdvertisingCreative;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

final class MemberDashboardPlacementService
{
    private const CACHE_SECONDS = 300;

    private const CONTEXTS = [
        'charter' => [
            'label' => 'Guardian partner',
            'intent_tags' => ['safety', 'justice', 'community'],
            'default_badges' => ['Guardian pledge'],
            'preferred_formats' => ['single_image', 'carousel'],
        ],
        'dream-pathways' => [
            'label' => 'Career sponsor',
            'intent_tags' => ['career', 'jobs', 'study'],
            'default_badges' => ['Career accelerator'],
            'preferred_formats' => ['carousel', 'video', 'single_image'],
        ],
        'member-dashboard' => [
            'label' => 'Waitlist partner',
            'intent_tags' => ['career', 'talent', 'upskilling'],
            'preferred_formats' => ['single_image', 'video'],
        ],
        'grant-tracker' => [
            'label' => 'Grant ally',
            'intent_tags' => ['funding', 'business', 'community'],
            'default_badges' => ['Grant partner'],
            'preferred_formats' => ['single_image', 'carousel'],
        ],
        'waitlists' => [
            'label' => 'Warm lead sponsor',
            'intent_tags' => ['hiring', 'recruitment', 'talent'],
            'preferred_formats' => ['single_image', 'carousel'],
        ],
        'helper-banner' => [
            'label' => 'Media pulse',
            'intent_tags' => ['wellbeing', 'finance', 'coaching'],
            'preferred_formats' => ['audio', 'video', 'single_image'],
        ],
    ];

    public function placementsFor(User $user, array $signals = [], ?array $contextKeys = null): array
    {
        $contexts = $this->resolveContexts($contextKeys);

        if (empty($contexts)) {
            return [];
        }

        if (! $this->hasCreativeTables()) {
            return $this->fallbackPlacements($contexts);
        }

        $cacheKey = $this->cacheKey($user->getKey(), $signals, array_keys($contexts));

        return Cache::remember($cacheKey, self::CACHE_SECONDS, function () use ($contexts, $signals) {
            $creatives = $this->fetchCreatives(count($contexts) * 2);

            if ($creatives->isEmpty()) {
                return $this->fallbackPlacements($contexts);
            }

            return $this->mapCreativesToContexts($creatives, $contexts, $signals);
        });
    }

    /**
     * @return (string|string[])[][]
     *
     * @psalm-return array{charter: array{label: string, intent_tags: list{string, string, string}, preferred_formats: list{0: 'audio'|'carousel'|'single_image', 1: 'carousel'|'video', 2?: 'single_image'}, default_badges?: list{'Career accelerator'|'Grant partner'|'Guardian pledge'}}, 'dream-pathways': array{label: string, intent_tags: list{string, string, string}, preferred_formats: list{0: 'audio'|'carousel'|'single_image', 1: 'carousel'|'video', 2?: 'single_image'}, default_badges?: list{'Career accelerator'|'Grant partner'|'Guardian pledge'}}, 'member-dashboard': array{label: string, intent_tags: list{string, string, string}, preferred_formats: list{0: 'audio'|'carousel'|'single_image', 1: 'carousel'|'video', 2?: 'single_image'}, default_badges?: list{'Career accelerator'|'Grant partner'|'Guardian pledge'}}, 'grant-tracker': array{label: string, intent_tags: list{string, string, string}, preferred_formats: list{0: 'audio'|'carousel'|'single_image', 1: 'carousel'|'video', 2?: 'single_image'}, default_badges?: list{'Career accelerator'|'Grant partner'|'Guardian pledge'}}, waitlists: array{label: string, intent_tags: list{string, string, string}, preferred_formats: list{0: 'audio'|'carousel'|'single_image', 1: 'carousel'|'video', 2?: 'single_image'}, default_badges?: list{'Career accelerator'|'Grant partner'|'Guardian pledge'}}, 'helper-banner': array{label: string, intent_tags: list{string, string, string}, preferred_formats: list{0: 'audio'|'carousel'|'single_image', 1: 'carousel'|'video', 2?: 'single_image'}, default_badges?: list{'Career accelerator'|'Grant partner'|'Guardian pledge'}}}
     */
    protected function resolveContexts(?array $contextKeys): array
    {
        if (empty($contextKeys)) {
            return self::CONTEXTS;
        }

        $contextKeys = array_unique(array_filter($contextKeys));

        $contexts = array_intersect_key(self::CONTEXTS, array_flip($contextKeys));

        return empty($contexts) ? self::CONTEXTS : $contexts;
    }

    protected function hasCreativeTables(): bool
    {
        return Schema::hasTable('advertising_creatives') && Schema::hasTable('advertising_campaigns');
    }

    protected function cacheKey(int|string $userId, array $signals, array $contexts): string
    {
        return sprintf('member-dashboard:placements:%s:%s', $userId, sha1(json_encode([$signals, $contexts])));
    }

    protected function fetchCreatives(int $limit): Collection
    {
        $limit = max($limit, 9);

        return AdvertisingCreative::query()
            ->live()
            ->with([
                'company:id,name,logo,foundation_status,foundation_focus_areas',
                'campaign:id,company_id,name,objective,targeting',
                'campaign.metrics' => fn ($query) => $query->latest('recorded_at')->limit(45),
            ])
            ->latest('updated_at')
            ->limit($limit)
            ->get();
    }

    /**
     * @return array[]
     *
     * @psalm-return array<array>
     */
    protected function mapCreativesToContexts(Collection $creatives, array $contexts, array $signals): array
    {
        $placements = [];
        $usedIds = [];

        foreach ($contexts as $key => $context) {
            $decisionCreative = $this->slotDecisionService->creativesForSlot($key, 1, $signals)->first();

            if ($decisionCreative) {
                $placements[$key] = $this->transformCreative($decisionCreative, $context, $signals);
                $usedIds[] = $decisionCreative->id;
                continue;
            }

            $creative = $this->pickCreativeForContext($creatives, $context, $signals, $usedIds);

            if ($creative) {
                $placements[$key] = $this->transformCreative($creative, $context, $signals);
                $usedIds[] = $creative->id;
            } else {
                $placements[$key] = $this->fallbackForContext($key, $context);
            }
        }

        return $placements;
    }

    protected function pickCreativeForContext(Collection $creatives, array $context, array $signals, array $usedIds): ?AdvertisingCreative
    {
        $scored = $creatives
            ->filter(fn (AdvertisingCreative $creative) => ! in_array($creative->id, $usedIds, true))
            ->map(fn (AdvertisingCreative $creative) => [
                'creative' => $creative,
                'score' => $this->scoreCreative($creative, $context, $signals),
            ])
            ->sortByDesc('score')
            ->values();

        $match = $scored->firstWhere('score', '>', 0) ?? $scored->first();

        return $match['creative'] ?? null;
    }

    /**
     * @psalm-return int<0, max>
     */
    protected function scoreCreative(AdvertisingCreative $creative, array $context, array $signals): int
    {
        $score = 0;
        $targeting = $creative->campaign?->targeting ?? [];

        $intentOverlap = count(array_intersect(
            $this->normaliseArray(data_get($targeting, 'intents', [])),
            $this->normaliseArray($context['intent_tags'] ?? [])
        ));

        $regionOverlap = count(array_intersect(
            $this->normaliseArray(data_get($targeting, 'regions', [])),
            $this->normaliseArray($signals['preferred_locations'] ?? [])
        ));

        $pathwayOverlap = count(array_intersect(
            $this->normaliseArray(data_get($targeting, 'segments', [])),
            $this->normaliseArray($signals['pathway_types'] ?? [])
        ));

        $formatPreference = in_array($creative->format, $context['preferred_formats'] ?? [], true) ? 1 : 0;

        $score += $intentOverlap * 8;
        $score += $regionOverlap * 4;
        $score += $pathwayOverlap * 3;
        $score += $formatPreference * 2;

        $recentMetric = $creative->campaign?->metrics?->first()?->recorded_at;
        if ($recentMetric) {
            $score += 1;
        }

        return $score;
    }

    /**
     * @return (array|mixed|null|string)[]
     *
     * @psalm-return array{slot: 'partner'|mixed, label: 'Partner spotlight'|mixed, headline: string, copy: null|string, brand: null|string, brand_logo: null|string, format: string, objective: null|string, cta: array{label: mixed|string, url: mixed|string, external: bool}, badges: array, targeting: array, media: array, analytics: array, sponsor_statement: mixed|null|string}
     */
    protected function transformCreative(AdvertisingCreative $creative, array $context, array $signals): array
    {
        $insights = $creative->insights ?? [];
        $campaign = $creative->campaign;
        $company = $creative->company;
        $ctaUrl = $creative->destination_url ?? Arr::get($insights, 'cta_url');

        return [
            'slot' => $context['label'] ?? 'partner',
            'label' => $context['label'] ?? 'Partner spotlight',
            'headline' => $creative->headline ?? $creative->name,
            'copy' => $this->cleanCopy($creative->primary_text ?? Arr::get($insights, 'summary')),
            'brand' => $company?->name,
            'brand_logo' => $this->normaliseUrl($company?->logo),
            'format' => $creative->format,
            'objective' => $campaign?->objective_label ?? $campaign?->objective,
            'cta' => [
                'label' => $creative->cta_label ?? Arr::get($insights, 'cta_text') ?? 'Learn more',
                'url' => $ctaUrl,
                'external' => $this->isExternalUrl($ctaUrl),
            ],
            'badges' => $this->buildBadges($creative, $context),
            'targeting' => $this->buildTargetingSummary($creative, $signals, $context),
            'media' => $this->buildMediaPayload($creative),
            'analytics' => $this->buildAnalytics($creative),
            'sponsor_statement' => Arr::get($insights, 'sponsor_statement') ?? $creative->notes,
        ];
    }

    /**
     * @psalm-return array<int, mixed>
     */
    protected function buildBadges(AdvertisingCreative $creative, array $context): array
    {
        $badges = collect($context['default_badges'] ?? []);

        if ($objective = $creative->campaign?->objective_label) {
            $badges->push($objective);
        }

        if ($status = $creative->company?->foundation_status) {
            $badges->push(Str::headline(str_replace('_', ' ', $status)));
        }

        return $badges->filter()->unique()->values()->all();
    }

    /**
     * @return array[]
     *
     * @psalm-return array{intents: array, audiences: array, regions: array, matched_signals: array{pathway_types: array, industries: array}}
     */
    protected function buildTargetingSummary(AdvertisingCreative $creative, array $signals, array $context): array
    {
        $targeting = $creative->campaign?->targeting ?? [];

        return [
            'intents' => $this->titleArray(data_get($targeting, 'intents', $context['intent_tags'] ?? [])),
            'audiences' => $this->titleArray(data_get($targeting, 'audiences', [])),
            'regions' => $this->titleArray(data_get($targeting, 'regions', [])),
            'matched_signals' => [
                'pathway_types' => $this->titleArray(array_intersect(
                    $this->normaliseArray($signals['pathway_types'] ?? []),
                    $this->normaliseArray(data_get($targeting, 'segments', []))
                )),
                'industries' => $this->titleArray(array_intersect(
                    $this->normaliseArray($signals['industries'] ?? []),
                    $this->normaliseArray(data_get($targeting, 'industries', []))
                )),
            ],
        ];
    }

    /**
     * @return (((mixed|null|string)[]|mixed|null|string)[]|null|string)[]
     *
     * @psalm-return array{type: string, slides: array<int, array{src: null|string, alt: mixed|string, caption: mixed}>, video: array{src: null|string, poster: null|string, caption: mixed|null}|null, audio: array{src: null|string, title: mixed|string, duration: mixed|null}|null}
     */
    protected function buildMediaPayload(AdvertisingCreative $creative): array
    {
        $insights = collect($creative->insights ?? []);

        $slides = $insights->get('slides');
        $slides = is_array($slides) ? $slides : [];

        $slidePayload = collect($slides)
            ->map(function ($slide) use ($creative) {
                $src = Arr::get($slide, 'src') ?? Arr::get($slide, 'url') ?? Arr::get($slide, 'image');

                return [
                    'src' => $this->normaliseUrl($src ?? $creative->preview_image_url),
                    'alt' => Arr::get($slide, 'alt') ?? $creative->headline ?? $creative->name,
                    'caption' => Arr::get($slide, 'caption'),
                ];
            })
            ->filter(fn ($slide) => filled($slide['src']))
            ->values();

        if ($slidePayload->isEmpty() && $creative->preview_image_url) {
            $slidePayload->push([
                'src' => $this->normaliseUrl($creative->preview_image_url),
                'alt' => $creative->headline ?? $creative->name,
                'caption' => $insights->get('image_caption'),
            ]);
        }

        $video = null;
        if ($creative->preview_video_url) {
            $video = [
                'src' => $this->normaliseUrl($creative->preview_video_url),
                'poster' => $this->normaliseUrl($creative->preview_image_url),
                'caption' => $insights->get('video_caption'),
            ];
        }

        $audioInsight = $insights->get('audio');
        $audio = null;
        if (is_array($audioInsight)) {
            $audio = [
                'src' => $this->normaliseUrl($audioInsight['src'] ?? $audioInsight['url'] ?? null),
                'title' => $audioInsight['title'] ?? ($creative->company?->name.' audio spotlight'),
                'duration' => $audioInsight['duration'] ?? null,
            ];
        }

        return [
            'type' => $creative->format,
            'slides' => $slidePayload->all(),
            'video' => $video,
            'audio' => $audio,
        ];
    }

    /**
     * @return (\Illuminate\Support\Carbon|float|int|mixed|null)[]
     *
     * @psalm-return array{impressions: mixed, clicks: mixed, qualified_leads: mixed, ctr: 0|float, spend: float, last_recorded_at: \Illuminate\Support\Carbon|null}
     */
    protected function buildAnalytics(AdvertisingCreative $creative): array
    {
        $metrics = $creative->campaign?->metrics;

        if (! $metrics instanceof Collection) {
            $metrics = collect($metrics);
        }

        $recent = $metrics->sortByDesc('recorded_at')->take(30);

        $impressions = $recent->sum('impressions');
        $clicks = $recent->sum('clicks');
        $leads = $recent->sum('qualified_leads');
        $spendCents = $recent->sum('spend_cents');

        $ctr = $impressions > 0 ? round(($clicks / max($impressions, 1)) * 100, 2) : 0;

        return [
            'impressions' => $impressions,
            'clicks' => $clicks,
            'qualified_leads' => $leads,
            'ctr' => $ctr,
            'spend' => round($spendCents / 100, 2),
            'last_recorded_at' => optional($recent->first())->recorded_at,
        ];
    }

    /**
     * @return array[]
     *
     * @psalm-return array<array>
     */
    protected function fallbackPlacements(array $contexts): array
    {
        $payload = [];

        foreach ($contexts as $key => $context) {
            $payload[$key] = $this->fallbackForContext($key, $context);
        }

        return $payload;
    }

    /**
     * @return ((((null|string)[]|string)[]|\Illuminate\Support\Carbon|false|float|int|null|string)[]|mixed|null|string)[]
     *
     * @psalm-return array{slot: string, label: 'Partner spotlight'|mixed, headline: string, copy: string, brand: string, brand_logo: string, format: 'audio'|'carousel'|'single_image', badges: list{0: string, 1?: string}, targeting: array{intents: list{0: string, 1?: string}, audiences: list{0: string, 1?: string}, regions: list{0: 'NSW'|'National'|'VIC', 1?: 'ACT'|'NSW', 2?: 'QLD'}}, media: array{type: 'audio'|'carousel'|'single_image', slides: list{0?: array{src: string, alt: string, caption: null|string}, 1?: array{src: string, alt: 'Apprentice cohort', caption: 'TAFE blocks + employer pods lock in before intake windows.'}}, video: null, audio: array{src: 'https://cdn.pixabay.com/download/audio/2022/08/15/audio_f2a6b4d2f1.mp3?filename=inspiring-cinematic-ambient-11770.mp3', title: 'Episode 12 · Salary repair sprint', duration: '03:12'}|null}, analytics: array{impressions: int, clicks: int, qualified_leads: int, ctr: 0|float, spend: 0|float, last_recorded_at: \Illuminate\Support\Carbon}, cta: array{label: string, url: string, external: false}|null, sponsor_statement: string}
     */
    protected function fallbackForContext(string $key, array $context): array
    {
        return match ($key) {
            'charter' => [
                'slot' => 'charter',
                'label' => $context['label'],
                'headline' => 'SafeWork NSW funds digital guardianship hours',
                'copy' => 'After-hours moderators, legal drop-ins, and social guardians stay funded so Athena spaces remain trauma informed.',
                'brand' => 'NSW Government · SafeWork',
                'brand_logo' => asset('frontend/assets/imgs/brands/brand-5.png'),
                'format' => 'single_image',
                'badges' => ['Guardian pledge', 'Safety & justice'],
                'targeting' => [
                    'intents' => ['Community safety', 'Justice pathways'],
                    'audiences' => ['Shift workers', 'Essential carers'],
                    'regions' => ['NSW', 'ACT'],
                ],
                'media' => [
                    'type' => 'single_image',
                    'slides' => [[
                        'src' => asset('frontend/assets/imgs/page/homepage4/img-big1.png'),
                        'alt' => 'Guardian partners covering moderation and justice clinics',
                        'caption' => 'Guardian hours now cover late-night communities + legal office hours.',
                    ]],
                    'video' => null,
                    'audio' => null,
                ],
                'analytics' => [
                    'impressions' => 18240,
                    'clicks' => 612,
                    'qualified_leads' => 74,
                    'ctr' => 3.35,
                    'spend' => 0,
                    'last_recorded_at' => now()->subDays(3),
                ],
                'cta' => [
                    'label' => 'See guardian pledges',
                    'url' => route('careers.wishlist'),
                    'external' => false,
                ],
                'sponsor_statement' => 'Guardian stipends fund moderators, justice clinics, and trauma-informed training.',
            ],
            'dream-pathways' => [
                'slot' => 'dream-pathways',
                'label' => $context['label'],
                'headline' => 'National Skills Pact: 220 climate-tech apprenticeships',
                'copy' => 'Apprenticeships in energy, rail, and circular manufacturing opening quarterly. Sponsors cover relocation grants and childcare credits.',
                'brand' => 'National Skills Pact',
                'brand_logo' => asset('frontend/assets/imgs/brands/brand-7.png'),
                'format' => 'carousel',
                'badges' => ['Career accelerator', 'Clean economy'],
                'targeting' => [
                    'intents' => ['Career restart', 'Green jobs'],
                    'audiences' => ['Women in trades', 'STEM returners'],
                    'regions' => ['National'],
                ],
                'media' => [
                    'type' => 'carousel',
                    'slides' => [
                        [
                            'src' => asset('frontend/assets/imgs/page/homepage2/img1.png'),
                            'alt' => 'Women on renewable site',
                            'caption' => 'Fast-tracked coaching + relocation grants for climate apprenticeships.',
                        ],
                        [
                            'src' => asset('frontend/assets/imgs/page/homepage2/img4.png'),
                            'alt' => 'Apprentice cohort',
                            'caption' => 'TAFE blocks + employer pods lock in before intake windows.',
                        ],
                    ],
                    'video' => null,
                    'audio' => null,
                ],
                'analytics' => [
                    'impressions' => 58210,
                    'clicks' => 940,
                    'qualified_leads' => 138,
                    'ctr' => 1.61,
                    'spend' => 2150.0,
                    'last_recorded_at' => now()->subDay(),
                ],
                'cta' => [
                    'label' => 'Register interest',
                    'url' => route('careers.wishlist'),
                    'external' => false,
                ],
                'sponsor_statement' => 'TAFE NSW, Downer Rail, and Atlassian Foundation co-fund these intakes.',
            ],
            'member-dashboard' => [
                'slot' => 'member-dashboard',
                'label' => $context['label'],
                'headline' => 'Athena Learning Guild funds waitlist readiness kits',
                'copy' => 'Micro-credential credits plus CV rewrites unlock the moment you activate a pathway.',
                'brand' => 'Athena Learning Guild',
                'brand_logo' => asset('frontend/assets/imgs/brands/brand-3.png'),
                'format' => 'single_image',
                'badges' => ['Learning partner', 'Career accelerator'],
                'targeting' => [
                    'intents' => ['Job readiness'],
                    'audiences' => ['Career returners', 'Graduates'],
                    'regions' => ['National'],
                ],
                'media' => [
                    'type' => 'single_image',
                    'slides' => [[
                        'src' => asset('frontend/assets/imgs/page/homepage2/img6.png'),
                        'alt' => 'Learning sponsor preview',
                        'caption' => 'Three-course bundles drop into your queue once a pathway unlocks.',
                    ]],
                    'video' => null,
                    'audio' => null,
                ],
                'analytics' => [
                    'impressions' => 33120,
                    'clicks' => 402,
                    'qualified_leads' => 66,
                    'ctr' => 1.21,
                    'spend' => 980.0,
                    'last_recorded_at' => now()->subDays(2),
                ],
                'cta' => [
                    'label' => 'Open waitlist toolkit',
                    'url' => route('careers.wishlist'),
                    'external' => false,
                ],
                'sponsor_statement' => 'Every active waitlist unlocks three premium learning seats.',
            ],
            'grant-tracker' => [
                'slot' => 'grant-tracker',
                'label' => $context['label'],
                'headline' => 'ImpactBridge pays for grant strategists',
                'copy' => 'Matched strategists review your drafts and attach community impact letters before submission.',
                'brand' => 'ImpactBridge Grants',
                'brand_logo' => asset('frontend/assets/imgs/brands/brand-2.png'),
                'format' => 'single_image',
                'badges' => ['Grant partner', 'Impact verified'],
                'targeting' => [
                    'intents' => ['Funding readiness'],
                    'audiences' => ['Founders', 'Community orgs'],
                    'regions' => ['VIC', 'NSW', 'QLD'],
                ],
                'media' => [
                    'type' => 'single_image',
                    'slides' => [[
                        'src' => asset('frontend/assets/imgs/page/homepage5/banner3.png'),
                        'alt' => 'Grant sponsors boost submissions',
                        'caption' => 'Strategists, writers, and compliance reviewers stay on retainer.',
                    ]],
                    'video' => null,
                    'audio' => null,
                ],
                'analytics' => [
                    'impressions' => 12980,
                    'clicks' => 284,
                    'qualified_leads' => 41,
                    'ctr' => 2.19,
                    'spend' => 640.0,
                    'last_recorded_at' => now()->subDays(4),
                ],
                'cta' => [
                    'label' => 'Book strategist review',
                    'url' => route('grants.index'),
                    'external' => false,
                ],
                'sponsor_statement' => 'ImpactBridge underwrites strategist hours for priority members.',
            ],
            'waitlists' => [
                'slot' => 'waitlists',
                'label' => $context['label'],
                'headline' => 'Public Sector Talent Pool opens 480 roles',
                'copy' => 'APS agencies push curated roles directly into Athena waitlists with guaranteed feedback windows.',
                'brand' => 'Australian Public Service',
                'brand_logo' => asset('frontend/assets/imgs/brands/brand-4.png'),
                'format' => 'carousel',
                'badges' => ['Government partner', 'Priority hiring'],
                'targeting' => [
                    'intents' => ['Public sector', 'Career change'],
                    'audiences' => ['Policy, admin, digital'],
                    'regions' => ['National'],
                ],
                'media' => [
                    'type' => 'carousel',
                    'slides' => [[
                        'src' => asset('frontend/assets/imgs/page/homepage3/img-job-search.png'),
                        'alt' => 'Public sector jobs',
                        'caption' => 'Roles come bundled with coaching pods and interview scripts.',
                    ]],
                    'video' => null,
                    'audio' => null,
                ],
                'analytics' => [
                    'impressions' => 42110,
                    'clicks' => 712,
                    'qualified_leads' => 102,
                    'ctr' => 1.69,
                    'spend' => 0,
                    'last_recorded_at' => now()->subDays(1),
                ],
                'cta' => [
                    'label' => 'See public sector queue',
                    'url' => route('careers.wishlist'),
                    'external' => false,
                ],
                'sponsor_statement' => 'APS agencies reserve slots for Athena members first.',
            ],
            'helper-banner' => [
                'slot' => 'helper-banner',
                'label' => $context['label'],
                'headline' => 'MoneyGirl x Athena audio resets',
                'copy' => 'Three-minute audio prompts before you edit pathways. Sponsors cover transcripts and AUSLAN notes.',
                'brand' => 'MoneyGirl Studio',
                'brand_logo' => asset('frontend/assets/imgs/brands/brand-6.png'),
                'format' => 'audio',
                'badges' => ['Wellbeing', 'Finance ally'],
                'targeting' => [
                    'intents' => ['Money confidence', 'Wellbeing'],
                    'audiences' => ['Parents', 'Job changers'],
                    'regions' => ['National'],
                ],
                'media' => [
                    'type' => 'audio',
                    'slides' => [],
                    'video' => null,
                    'audio' => [
                        'src' => 'https://cdn.pixabay.com/download/audio/2022/08/15/audio_f2a6b4d2f1.mp3?filename=inspiring-cinematic-ambient-11770.mp3',
                        'title' => 'Episode 12 · Salary repair sprint',
                        'duration' => '03:12',
                    ],
                ],
                'analytics' => [
                    'impressions' => 1870,
                    'clicks' => 210,
                    'qualified_leads' => 28,
                    'ctr' => 11.23,
                    'spend' => 140.0,
                    'last_recorded_at' => now()->subHours(6),
                ],
                'cta' => [
                    'label' => 'Listen & take notes',
                    'url' => route('careers.wishlist'),
                    'external' => false,
                ],
                'sponsor_statement' => 'Audio partners fund transcripts, AUSLAN notes, and childcare micro-grants.',
            ],
            default => [
                'slot' => $key,
                'label' => $context['label'] ?? 'Partner spotlight',
                'headline' => 'Partner spotlight',
                'copy' => 'Athena partners reserve this slot for upcoming campaigns.',
                'brand' => 'Athena Partners',
                'brand_logo' => asset('frontend/assets/imgs/brands/brand-1.png'),
                'format' => 'single_image',
                'badges' => ['Partner'],
                'targeting' => [
                    'intents' => ['Community'],
                    'audiences' => ['Members'],
                    'regions' => ['National'],
                ],
                'media' => [
                    'type' => 'single_image',
                    'slides' => [[
                        'src' => asset('frontend/assets/imgs/page/homepage2/banner.png'),
                        'alt' => 'Athena partner placeholder',
                        'caption' => null,
                    ]],
                    'video' => null,
                    'audio' => null,
                ],
                'analytics' => [
                    'impressions' => 0,
                    'clicks' => 0,
                    'qualified_leads' => 0,
                    'ctr' => 0,
                    'spend' => 0,
                    'last_recorded_at' => now(),
                ],
                'cta' => null,
                'sponsor_statement' => 'Upcoming campaign.',
            ],
        };
    }

    protected function cleanCopy(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        return Str::of(strip_tags($value))->squish()->limit(280)->toString();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    protected function normaliseArray(array|string|null $value): array
    {
        if (is_string($value)) {
            $value = [$value];
        }

        return collect($value)
            ->filter()
            ->map(fn ($item) => Str::lower(Str::slug($item, ' ')))
            ->values()
            ->all();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    protected function titleArray(array|string|null $value): array
    {
        if (is_string($value)) {
            $value = [$value];
        }

        if ($value === null) {
            $value = [];
        }

        return collect($value)
            ->filter()
            ->map(fn ($item) => Str::title(str_replace(['-', '_'], ' ', (string) $item)))
            ->values()
            ->all();
    }

    protected function normaliseUrl(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        if (Str::startsWith($value, ['http://', 'https://', '//'])) {
            return $value;
        }

        return url(ltrim($value, '/'));
    }

    protected function isExternalUrl(?string $url): bool
    {
        if (! $url) {
            return false;
        }

        if (! Str::startsWith($url, ['http://', 'https://'])) {
            return false;
        }

        $appUrl = (string) config('app.url');

        if (! $appUrl) {
            return true;
        }

        return ! Str::startsWith($url, $appUrl);
    }
}

