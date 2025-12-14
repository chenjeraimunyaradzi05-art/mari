<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Job;
use App\Models\Post;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\Wellbeing\AiWellnessCoachService;
use App\Support\IntentEvaluator;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class WellnessHubController extends Controller
{
    private ?Collection $cachedWellnessPosts = null;

    public function __construct(private readonly RealTimeAnalyticsEngine $analytics)
    {
    }

    public function show(Request $request, AiWellnessCoachService $coach): View
    {
        $rituals = $this->resolveRitualCards();
        $stories = $this->resolveStoryDrops();
        $isAuthenticated = $request->user() !== null;
        $aiPlaylists = $this->aiPlaylists();
        $financialEducationTracks = $this->financialEducationTracks();
        $wellnessFinanceSignals = $this->wellnessFinanceSignals();

        $aiPlan = null;
        if ($isAuthenticated && $request->user()->wellbeingProfile) {
            $aiPlan = $coach->generatePlan($request->user());
        }

        $this->recordWellnessHubView($request->user(), $aiPlaylists, $financialEducationTracks, $wellnessFinanceSignals);

        return view('frontend.wellness.hub', [
            'rituals' => $rituals,
            'stories' => $stories,
            'isAuthenticated' => $isAuthenticated,
            'aiPlaylists' => $aiPlaylists,
            'financialEducationTracks' => $financialEducationTracks,
            'wellnessFinanceSignals' => $wellnessFinanceSignals,
            'aiPlan' => $aiPlan,
        ]);
    }

    public function dashboard(Request $request): View
    {
        $user = $request->user();
        $intentEvaluator = $user ? IntentEvaluator::for($user) : null;

        return view('frontend.wellness.dashboard', [
            'user' => $user,
            'focusCards' => $this->buildFocusCards(),
            'allowedContexts' => $intentEvaluator ? $intentEvaluator->allowedContexts()->all() : [],
            'touchpoints' => $this->buildTouchpoints(),
        ]);
    }

    private function resolveRitualCards(): array
    {
        $cards = $this->wellnessPosts()
            ->map(function (Post $post) {
                $metadata = $post->metadata ?? [];
                $views = $this->resolveViewCount($metadata);
                $likes = (int) ($post->likes_count ?? 0);

                return [
                    'length' => data_get($metadata, 'ritual_length', 'Community drop'),
                    'title' => data_get($metadata, 'ritual_title', Str::limit(strip_tags($post->content ?? 'Wellness share'), 60)),
                    'description' => Str::limit(strip_tags(data_get($metadata, 'summary', $post->content ?? '')), 120),
                    'cta' => [
                        'label' => data_get($metadata, 'cta_label', 'Open thread'),
                        'url' => route('social.posts.show', ['post' => $post->getKey()]),
                        'requires_auth' => true,
                    ],
                    'analytics' => [
                        'views' => max($views, 0),
                        'likes' => max($likes, 0),
                    ],
                ];
            });

        if ($cards->isEmpty()) {
            return $this->fallbackRitualCards();
        }

        return $cards->all();
    }

    private function resolveStoryDrops(): array
    {
        $stories = $this->wellnessPosts()
            ->take(3)
            ->map(function (Post $post) {
                $metadata = $post->metadata ?? [];

                return [
                    'title' => data_get($metadata, 'story_title', Str::limit(strip_tags($post->content ?? 'Wellness insight'), 60)),
                    'excerpt' => Str::limit(strip_tags(data_get($metadata, 'summary', $post->content ?? '')), 140),
                    'url' => route('social.posts.show', ['post' => $post->getKey()]),
                    'requires_auth' => true,
                ];
            });

        if ($stories->isEmpty()) {
            return $this->fallbackStoryDrops();
        }

        return $stories->all();
    }

    private function buildFocusCards(): array
    {
        $cards = collect();

        if ($post = $this->wellnessPosts()->first()) {
            $cards->push([
                'title' => 'Community pulse',
                'description' => Str::limit(strip_tags(data_get($post->metadata, 'summary', $post->content ?? '')), 140),
                'url' => route('social.posts.show', ['post' => $post->getKey()]),
                'requires_auth' => true,
            ]);
        }

        $cards->push([
            'title' => 'Grant navigator',
            'description' => 'Structure funding targets, eligibility filters, and compliance checklists in one flow.',
            'url' => route('grants.index'),
            'requires_auth' => false,
        ]);

        if ($job = $this->latestActiveJob()) {
            $cards->push([
                'title' => 'Partner opportunity',
                'description' => Str::limit($job->title.' — '.strip_tags($job->description ?? ''), 140),
                'url' => route('jobs.show', ['slug' => $job->slug ?? $job->getKey()]),
                'requires_auth' => false,
            ]);
        }

        if ($cards->isEmpty()) {
            return $this->fallbackFocusCards();
        }

        return $cards->take(3)->values()->all();
    }

    private function buildTouchpoints(): array
    {
        $touchpoints = $this->wellnessPosts()
            ->take(3)
            ->map(function (Post $post) {
                $summary = Str::limit(strip_tags(data_get($post->metadata, 'summary', $post->content ?? '')), 160);
                $label = optional($post->created_at)->format('l') ?? 'Weekly';

                return [
                    'label' => $label,
                    'description' => $summary,
                ];
            });

        if ($touchpoints->isEmpty()) {
            return $this->fallbackTouchpoints();
        }

        return $touchpoints->all();
    }

    private function latestActiveJob(): ?Job
    {
        if (! Schema::hasTable('jobs')) {
            return null;
        }

        return Job::query()
            ->when(Schema::hasColumn('jobs', 'status'), fn ($query) => $query->where('status', 'active'))
            ->when(Schema::hasColumn('jobs', 'deadline'), fn ($query) => $query->whereDate('deadline', '>=', now()->toDateString()))
            ->latest('created_at')
            ->first();
    }

    private function wellnessPosts(): Collection
    {
        if ($this->cachedWellnessPosts !== null) {
            return $this->cachedWellnessPosts;
        }

        if (! Schema::hasTable('posts')) {
            return $this->cachedWellnessPosts = collect();
        }

        $query = Post::query()
            ->withCount('likes')
            ->when(Schema::hasColumn('posts', 'visibility'), fn ($q) => $q->where('visibility', 'public'))
            ->latest('created_at');

        $hasTags = Schema::hasColumn('posts', 'tags');
        $hasSector = Schema::hasColumn('posts', 'audience_sector');
        $hasSkills = Schema::hasColumn('posts', 'audience_skills');

        if ($hasTags || $hasSector || $hasSkills) {
            $query->where(function ($sub) use ($hasTags, $hasSector, $hasSkills) {
                if ($hasTags) {
                    $sub->orWhere('tags', 'like', '%wellness%');
                }

                if ($hasSector) {
                    $sub->orWhere('audience_sector', 'wellness');
                }

                if ($hasSkills) {
                    $sub->orWhereJsonContains('audience_skills', 'wellness');
                }
            });
        }

        return $this->cachedWellnessPosts = $query
            ->limit(6)
            ->get();
    }

    /**
     * @return ((bool|int|string)[]|string)[][]
     *
     * @psalm-return list{array{length: '5 min audio', title: 'Calm Money Ritual', description: 'Five-minute audio ritual to reset nervous systems before reviewing budgets.', cta: array{label: 'Listen now', url: string, requires_auth: true}, analytics: array{views: 0, likes: 0}}, array{length: '15 min social', title: 'Community Check-in', description: 'Weekly prompt to share wins, asks, and gratitude with the women-first network.', cta: array{label: 'Post to feed', url: string, requires_auth: true}, analytics: array{views: 0, likes: 0}}, array{length: '20 min live', title: 'Capital Confidence Lab', description: 'Micro-workshop on pricing, funding, and deal support from the Business Network.', cta: array{label: 'Meet partners', url: string, requires_auth: false}, analytics: array{views: 0, likes: 0}}}
     */
    private function fallbackRitualCards(): array
    {
        return [
            [
                'length' => '5 min audio',
                'title' => 'Calm Money Ritual',
                'description' => 'Five-minute audio ritual to reset nervous systems before reviewing budgets.',
                'cta' => [
                    'label' => 'Listen now',
                    'url' => route('wellness.dashboard'),
                    'requires_auth' => true,
                ],
                'analytics' => [
                    'views' => 0,
                    'likes' => 0,
                ],
            ],
            [
                'length' => '15 min social',
                'title' => 'Community Check-in',
                'description' => 'Weekly prompt to share wins, asks, and gratitude with the women-first network.',
                'cta' => [
                    'label' => 'Post to feed',
                    'url' => route('social.feed.index'),
                    'requires_auth' => true,
                ],
                'analytics' => [
                    'views' => 0,
                    'likes' => 0,
                ],
            ],
            [
                'length' => '20 min live',
                'title' => 'Capital Confidence Lab',
                'description' => 'Micro-workshop on pricing, funding, and deal support from the Business Network.',
                'cta' => [
                    'label' => 'Meet partners',
                    'url' => route('business.network'),
                    'requires_auth' => false,
                ],
                'analytics' => [
                    'views' => 0,
                    'likes' => 0,
                ],
            ],
        ];
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{array{title: 'Rituals for calmer cashflow', excerpt: 'How three founders use Athena wellness prompts to unstick team anxiety.', url: string}, array{title: 'Design your care circle', excerpt: 'Template for setting community commitments that actually feel nourishing.', url: string}}
     */
    private function fallbackStoryDrops(): array
    {
        return [
            [
                'title' => 'Rituals for calmer cashflow',
                'excerpt' => 'How three founders use Athena wellness prompts to unstick team anxiety.',
                'url' => route('wellness.dashboard'),
            ],
            [
                'title' => 'Design your care circle',
                'excerpt' => 'Template for setting community commitments that actually feel nourishing.',
                'url' => route('business.network'),
            ],
        ];
    }

    /**
     * @return (bool|string)[][]
     *
     * @psalm-return list{array{title: 'Wellness feed', description: 'Drop into curated conversations across community care circles.', url: string, requires_auth: true}, array{title: 'Money rituals', description: 'Step through AI assisted prompts to plan and reflect on capital.', url: string, requires_auth: false}, array{title: 'Partner handoffs', description: 'Surface business, education, and housing partners you can introduce today.', url: string, requires_auth: false}}
     */
    private function fallbackFocusCards(): array
    {
        return [
            [
                'title' => 'Wellness feed',
                'description' => 'Drop into curated conversations across community care circles.',
                'url' => route('social.feed.index'),
                'requires_auth' => true,
            ],
            [
                'title' => 'Money rituals',
                'description' => 'Step through AI assisted prompts to plan and reflect on capital.',
                'url' => route('wellness.hub'),
                'requires_auth' => false,
            ],
            [
                'title' => 'Partner handoffs',
                'description' => 'Surface business, education, and housing partners you can introduce today.',
                'url' => route('business.network'),
                'requires_auth' => false,
            ],
        ];
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{array{label: 'Thursday', description: 'AI concierge briefing for financial calm.'}, array{label: 'Saturday', description: 'Founder gratitude circle and partner updates.'}, array{label: 'Monday', description: 'Guided policy impact review and education pathways.'}}
     */
    private function fallbackTouchpoints(): array
    {
        return [
            [
                'label' => 'Thursday',
                'description' => 'AI concierge briefing for financial calm.',
            ],
            [
                'label' => 'Saturday',
                'description' => 'Founder gratitude circle and partner updates.',
            ],
            [
                'label' => 'Monday',
                'description' => 'Guided policy impact review and education pathways.',
            ],
        ];
    }

    private function resolveViewCount(array $metadata): int
    {
        $candidates = [
            'views',
            'metrics.views',
            'engagement.views',
            'analytics.views',
            'insights.views',
        ];

        foreach ($candidates as $path) {
            $value = data_get($metadata, $path);
            if ($value !== null) {
                return (int) $value;
            }
        }

        return 0;
    }

    /**
     * @return ((string|true)[]|string)[][]
     *
     * @psalm-return list{array{title: 'Nervous system resets', focus: 'Breathwork + debt calm scripts', summary: 'AI pairs somatic prompts with Money Inbox reflections so you can check statements without spiralling.', cta: array{label: 'Open AI wellness coach', url: string, requires_auth: true}, badges: list{'5 min audio', 'Trauma aware'}}, array{title: 'Care collective briefs', focus: 'Shareable rituals for teams', summary: 'Generate circles, accountability prompts, and stipend-ready plans for friends, founders, or care pods.', cta: array{label: 'Draft a ritual brief', url: string, requires_auth: true}, badges: list{'Groups', 'Mentor ready'}}, array{title: 'Mobility recovery stack', focus: 'Physio + transport planning', summary: 'Connect physio progress, rest rosters, and the mobility concierge so financial plans reflect healing time.', cta: array{label: 'Sync care + mobility', url: string, requires_auth: true}, badges: list{'Hybrid care', 'Links to car guide'}}}
     */
    private function aiPlaylists(): array
    {
        return [
            [
                'title' => 'Nervous system resets',
                'focus' => 'Breathwork + debt calm scripts',
                'summary' => 'AI pairs somatic prompts with Money Inbox reflections so you can check statements without spiralling.',
                'cta' => [
                    'label' => 'Open AI wellness coach',
                    'url' => route('ai.concierge', ['context' => 'wellness-money-calm']),
                    'requires_auth' => true,
                ],
                'badges' => ['5 min audio', 'Trauma aware'],
            ],
            [
                'title' => 'Care collective briefs',
                'focus' => 'Shareable rituals for teams',
                'summary' => 'Generate circles, accountability prompts, and stipend-ready plans for friends, founders, or care pods.',
                'cta' => [
                    'label' => 'Draft a ritual brief',
                    'url' => route('ai.concierge', ['context' => 'wellness-circle-plans']),
                    'requires_auth' => true,
                ],
                'badges' => ['Groups', 'Mentor ready'],
            ],
            [
                'title' => 'Mobility recovery stack',
                'focus' => 'Physio + transport planning',
                'summary' => 'Connect physio progress, rest rosters, and the mobility concierge so financial plans reflect healing time.',
                'cta' => [
                    'label' => 'Sync care + mobility',
                    'url' => route('ai.concierge', ['context' => 'wellness-mobility-support']),
                    'requires_auth' => true,
                ],
                'badges' => ['Hybrid care', 'Links to car guide'],
            ],
        ];
    }

    /**
     * @return ((false|string)[]|string)[][]
     *
     * @psalm-return list{array{title: 'Money inbox walkthrough', description: 'Surface recurring leaks, childcare subsidies, or rego relief before wellness expenses hit.', cta: array{label: 'Visit money inbox', url: string, requires_auth: false}}, array{title: 'Debt & care timelines', description: 'Run consolidation scenarios that respect rest days, NDIS work caps, or study loads.', cta: array{label: 'Simulate repayments', url: string, requires_auth: false}}, array{title: 'Operating runway planner', description: 'Budget dashboards now include care stipends, physio passes, and mindfulness subscriptions.', cta: array{label: 'Open budget desk', url: string, requires_auth: false}}}
     */
    private function financialEducationTracks(): array
    {
        return [
            [
                'title' => 'Money inbox walkthrough',
                'description' => 'Surface recurring leaks, childcare subsidies, or rego relief before wellness expenses hit.',
                'cta' => [
                    'label' => 'Visit money inbox',
                    'url' => route('financial.money-inbox'),
                    'requires_auth' => false,
                ],
            ],
            [
                'title' => 'Debt & care timelines',
                'description' => 'Run consolidation scenarios that respect rest days, NDIS work caps, or study loads.',
                'cta' => [
                    'label' => 'Simulate repayments',
                    'url' => route('financial.debt'),
                    'requires_auth' => false,
                ],
            ],
            [
                'title' => 'Operating runway planner',
                'description' => 'Budget dashboards now include care stipends, physio passes, and mindfulness subscriptions.',
                'cta' => [
                    'label' => 'Open budget desk',
                    'url' => route('financial.budget'),
                    'requires_auth' => false,
                ],
            ],
        ];
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{array{label: 'Care rituals logged', value: '1,280', description: 'AI playlists saved to Money Inbox in the last 30 days.'}, array{label: 'Relief unlocked', value: '$310k', description: 'Wellness + mobility vouchers routed via finance partners.'}, array{label: 'Average runway', value: '21 weeks', description: 'Members projecting calm budgets after syncing care costs.'}}
     */
    private function wellnessFinanceSignals(): array
    {
        return [
            [
                'label' => 'Care rituals logged',
                'value' => '1,280',
                'description' => 'AI playlists saved to Money Inbox in the last 30 days.',
            ],
            [
                'label' => 'Relief unlocked',
                'value' => '$310k',
                'description' => 'Wellness + mobility vouchers routed via finance partners.',
            ],
            [
                'label' => 'Average runway',
                'value' => '21 weeks',
                'description' => 'Members projecting calm budgets after syncing care costs.',
            ],
        ];
    }

    private function recordWellnessHubView($user, array $aiPlaylists, array $financialEducationTracks, array $signals): void
    {
        $signalLabels = collect($signals)
            ->pluck('label')
            ->filter()
            ->values()
            ->all();

        $this->analytics->record('wellness.hub_finance_section_rendered', [
            'properties' => array_filter([
                'user_id' => $user?->id,
                'is_authenticated' => $user !== null,
                'ai_playlist_count' => count($aiPlaylists),
                'financial_track_count' => count($financialEducationTracks),
                'signal_labels' => $signalLabels,
            ], static fn ($value) => $value !== null && $value !== []),
            'metadata' => [
                'surface' => 'wellness_hub',
                'component' => 'ai_finance_section',
            ],
        ]);
    }
}

