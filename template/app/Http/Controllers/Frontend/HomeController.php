<?php
/**
 * HomeController
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CustomPageBuilder;
use App\Models\Job;
use App\Models\Post;
use App\Models\User;
use App\Services\Advertising\HomepageSponsorService;
use App\Services\Growth\ExperimentService;
use App\Services\RealTimeAnalyticsEngine;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class HomeController extends Controller
{
    public function __construct(
        private readonly HomepageSponsorService $homepageSponsors,
        private readonly RealTimeAnalyticsEngine $analytics,
        private readonly ExperimentService $experimentService,
    )
    {
    }

    public function index(): View
    {
        // A/B Testing: Get variants
        $headlineVariant = $this->experimentService->getVariant('landing_page_headline');
        $buttonColorVariant = $this->experimentService->getVariant('signup_button_color');

        $stats = $this->buildHomepageStats();

        $featuredLogos = $this->buildFeaturedLogos();

        $hubLabels = $this->homeHubLabels();

        $journeyTiles = [
            [
                'title' => 'Career Rituals Studio',
                'tagline' => 'Jobs & mentors',
                'description' => 'AI-matched roles pair with live mentor rooms, interview labs and sponsor-funded boosts every week.',
                'stat' => '47 live sessions this week',
                'image' => asset('photo-uploads/athena_pillars_10.png'),
            ],
            [
                'title' => 'Money & Micro Grants Desk',
                'tagline' => 'Money & everyday life',
                'description' => 'Budget diagnostics, debt triage and rapid micro grants sourced from the Athena Problem Map partners.',
                'stat' => '$1.2M in relief unlocked',
                'image' => asset('photo-uploads/athena_pillars_05.png'),
            ],
            [
                'title' => 'Housing Safety Lab',
                'tagline' => 'Housing & mortgages',
                'description' => 'Verified rentals, women-first brokers and safety briefings keep every relocation transparent and funded.',
                'stat' => '312 vetted listings today',
                'image' => asset('photo-uploads/athena_pillars_01.png'),
            ],
            [
                'title' => 'Wellness & Circles Commons',
                'tagline' => 'Community & wellbeing',
                'description' => 'Moderated social feeds, trauma-informed clinicians and pop-up childcare swaps fight isolation in every suburb.',
                'stat' => '89 neighbourhood pods live',
                'image' => asset('photo-uploads/athena_pillars_12.png'),
            ],
        ];

        $testimonials = [
            [
                'name' => 'Sara',
                'role' => 'Single mum & cyber apprentice',
                'quote' => 'The social feed kept me accountable while the AI coach rebuilt my confidence. I moved from casual shifts to a sponsored cyber apprenticeship with flexible hours.',
            ],
            [
                'name' => 'Anika',
                'role' => 'Community housing advocate',
                'quote' => 'Housing Hub surfaced a women-friendly landlord and a mortgage ally who understood my cultural needs. Sponsors covered the coaching fee.',
            ],
            [
                'name' => 'Lani',
                'role' => 'Founder, wellness collective',
                'quote' => 'Athena Grants Lab paired me with a mentor, a bank sponsor and three micro grants. Our collective now advertises in-platform and keeps the loop going.',
            ],
        ];

        $partnerStripAds = $this->homepageSponsors->forSlot('feature-strip');
        $onboardingAds = $this->homepageSponsors->forSlot('onboarding');
        $educationAds = $this->homepageSponsors->forSlot('education');
        $featureAds = $this->homepageSponsors->forSlot('feature-grid');
        $galleryAds = $this->homepageSponsors->forSlot('gallery');
        $pricingAds = $this->homepageSponsors->forSlot('pricing');
        $ctaAds = $this->homepageSponsors->forSlot('cta');

        $pricingPlans = [
            [
                'name' => 'Member',
                'price' => '0',
                'interval' => 'month',
                'features' => [
                    'Access to all seven hubs + Athena AI copilot',
                    'Peer circles, mentorship matches &amp; emergency broadcasts',
                    'Ethically funded perks (childcare, data packs, travel vouchers)',
                ],
            ],
            [
                'name' => 'Impact Partner / Sponsor',
                'price' => 'Custom',
                'interval' => 'quarter',
                'features' => [
                    'Exclusive formats in every section for ads-to-action journeys',
                    'Impact dashboard + attribution to Problem Map KPIs',
                    'Co-designed pilots with Athena product, research &amp; social teams',
                ],
            ],
        ];

        return view('home', [
            'stats' => $stats,
            'featuredLogos' => $featuredLogos,
            'hubLabels' => $hubLabels,
            'journeyTiles' => $journeyTiles,
            'testimonials' => $testimonials,
            'partnerStripAds' => $partnerStripAds,
            'onboardingAds' => $onboardingAds,
            'educationAds' => $educationAds,
            'featureAds' => $featureAds,
            'galleryAds' => $galleryAds,
            'pricingAds' => $pricingAds,
            'ctaAds' => $ctaAds,
            'pricingPlans' => $pricingPlans,
            'headlineVariant' => $headlineVariant,
            'buttonColorVariant' => $buttonColorVariant,
        ]);
    }

    public function socialOverview(): View
    {
        return view('pages.athena-social', [
            'stats' => $this->buildHomepageStats(),
            'hubLabels' => $this->homeHubLabels(),
        ]);
    }

    public function customPage(string $slug): View
    {
        $page = CustomPageBuilder::where('slug', $slug)->firstOrFail();

        return view('frontend.pages.custom-page', compact('page'));
    }

    protected function buildFeaturedLogos(): array
    {
        $dynamic = $this->whenTablesExist(['companies'], function () {
            return Company::select(['name', 'logo'])
                ->whereNotNull('logo')
                ->when(Schema::hasColumn('companies', 'visibility'), fn ($query) => $query->where('visibility', 1))
                ->when(Schema::hasColumn('companies', 'profile_completion'), fn ($query) => $query->where('profile_completion', 1))
                ->take(6)
                ->get()
                ->map(function ($company) {
                    $url = $this->resolveMediaUrl($company->logo);
                    return $url ? ['name' => $company->name, 'url' => $url] : null;
                })
                ->filter()
                ->values()
                ->all();
        }, []);

        if (!empty($dynamic)) {
            return $dynamic;
        }

        return [
            ['name' => 'FairPay Bank', 'url' => asset('frontend/assets/imgs/brands/brand-1.png')],
            ['name' => 'Matilda Tech', 'url' => asset('frontend/assets/imgs/brands/brand-2.png')],
            ['name' => 'WGEA Research', 'url' => asset('frontend/assets/imgs/brands/brand-4.png')],
            ['name' => 'Care Collective', 'url' => asset('frontend/assets/imgs/brands/brand-6.png')],
            ['name' => 'UniFuture', 'url' => asset('frontend/assets/imgs/brands/brand-8.png')],
            ['name' => 'Aurora Health', 'url' => asset('frontend/assets/imgs/brands/brand-9.png')],
        ];
    }

    protected function resolveMediaUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        $cleanPath = ltrim($path, '/');

        if (Str::startsWith($cleanPath, ['storage/', 'uploads/', 'frontend/'])) {
            return asset($cleanPath);
        }

        return asset('storage/' . $cleanPath);
    }

    protected function whenTablesExist(array $tables, callable $callback, array|int|null $default = null)
    {
        if ($this->tablesExist($tables)) {
            return $callback();
        }

        return $default;
    }

    protected function tablesExist(array $tables): bool
    {
        foreach ($tables as $table) {
            if (!Schema::hasTable($table)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @psalm-return array{women_supported: mixed, active_jobs: mixed, placements: mixed, community_stories: mixed}
     */
    protected function buildHomepageStats(): array
    {
        return [
            'women_supported' => $this->whenTablesExist(['users'], fn () => User::count(), 12500),
            'active_jobs' => $this->whenTablesExist(['jobs'], fn () => Job::where('status', 'active')->count(), 780),
            'placements' => $this->whenTablesExist(['jobs'], fn () => Job::where('status', 'hired')->count(), 1850),
            'community_stories' => $this->whenTablesExist(['posts'], fn () => Post::count(), 4200),
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return list{'Dream Jobs Hub', 'Housing & Mortgages', 'Money & Everyday Life', 'Business & Grants Lab', 'Wellness Marketplace', 'Athena Circles & Mentorship', 'Athena AI Copilot'}
     */
    protected function homeHubLabels(): array
    {
        return [
            'Dream Jobs Hub',
            'Housing & Mortgages',
            'Money & Everyday Life',
            'Business & Grants Lab',
            'Wellness Marketplace',
            'Athena Circles & Mentorship',
            'Athena AI Copilot',
        ];
    }
}

