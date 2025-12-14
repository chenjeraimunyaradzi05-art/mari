<?php

namespace App\Providers;

use App\Contracts\AI\TextModel;
use App\Contracts\Social\FeedRanker;
use App\Models\SocialLiveStream;
use App\Models\SocialPostPoll;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Observers\SocialLiveStreamObserver;
use App\Observers\SocialPostPollObserver;
use App\Observers\WomenRealEstate\WomenListingObserver;
use App\Observers\WomenRealEstate\WomenVerifiedAgentObserver;
use App\Services\Ai\Providers\AnthropicTextModel;
use App\Services\Ai\Providers\OpenAITextModel;
use App\Services\Ai\Ai as AiContract;
use App\Services\Ai\DefaultAiService;
use App\Services\Ops\FeatureFlagService;
use App\Services\Social\Ranking\DefaultFeedRanker;
use App\View\Components\Blade\Bundle as BladeBundleComponent;
use App\View\Composers\Frontend\DashboardAnalyticsComposer;
use App\View\Composers\Frontend\HomeAnalyticsComposer;
use App\View\Composers\Frontend\HomepageSponsorComposer;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Gate;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    #[\Override]
    public function register(): void
    {
        $this->app->singleton(FeedRanker::class, DefaultFeedRanker::class);
        $this->app->singleton(AiContract::class, DefaultAiService::class);
        // Women listing analytics: bind contract to concrete implementation so tests
        // and other consumers can depend on the interface and swap fakes easily.
        $this->app->singleton(
            \App\Services\WomenRealEstate\Contracts\WomenListingAnalyticsServiceContract::class,
            \App\Services\WomenRealEstate\WomenListingAnalyticsService::class
        );

        $this->app->singleton(TextModel::class, function ($app) {
            $config = $app['config']->get('ai', []);
            $providers = $config['providers'] ?? [];
            $default = $config['default_provider'] ?? 'openai';

            return match ($default) {
                'anthropic' => new AnthropicTextModel(
                    $providers['anthropic']['api_key'] ?? null,
                    $providers['anthropic']['chat_model'] ?? null,
                ),
                default => new OpenAITextModel(
                    $providers['openai']['api_key'] ?? null,
                    $providers['openai']['organization'] ?? null,
                    $providers['openai']['chat_model'] ?? null,
                    $providers['openai']['embedding_model'] ?? null,
                ),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Paginator::useBootstrap();

        Blade::component('blade-bundle', BladeBundleComponent::class);

        Blade::if('feature', function (string $feature) {
            /** @var \App\Models\User|null $user */
            $user = Auth::user();
            return app(FeatureFlagService::class)->isEnabled($feature, $user);
        });

        Gate::before(function ($user, $ability) {
            return $user->hasRole('Super Admin') ? true : null;
        });

        View::composer('frontend.home.index', HomeAnalyticsComposer::class);
        View::composer(['frontend.home.index', 'frontend.home.sections.*'], HomepageSponsorComposer::class);
        View::composer('frontend.candidate-dashboard.dashboard', DashboardAnalyticsComposer::class);

        View::composer(['frontend.layouts.header', 'frontend.layouts.master'], function ($view) {
            $user = Auth::user();

            if (! $user) {
                $view->with('layoutIntentions', null);
                return;
            }

            $intentions = $user->user_intentions ?? [];
            $firstName = (string) Str::of($user->name ?? 'Friend')->trim()->before(' ');
            $firstName = $firstName !== '' ? $firstName : ($user->name ?? 'Friend');
            $portalCollection = collect(data_get($intentions, 'desired_portals', []));
            $wellnessCollection = collect(data_get($intentions, 'wellness_preferences', []));
            $intentValue = data_get($intentions, 'intent.value');
            $intentValueNormalized = $intentValue ? Str::of($intentValue)->lower()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_') : null;
            $portalValues = $portalCollection
                ->map(fn ($portal) => data_get($portal, 'value') ?? data_get($portal, 'label'))
                ->filter()
                ->map(fn ($value) => (string) Str::of($value)->lower()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_'))
                ->values();
            $wellnessValues = $wellnessCollection
                ->map(fn ($preference) => data_get($preference, 'value') ?? data_get($preference, 'label'))
                ->filter()
                ->map(fn ($value) => (string) Str::of($value)->lower()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_'))
                ->values();

            $intentLabel = data_get($intentions, 'intent.label');
            $greeting = $intentLabel
                ? sprintf('%s, your %s focus awaits.', $firstName, Str::lower($intentLabel))
                : sprintf('Hi %s, how can we champion you today?', $firstName);

            $portalHighlight = $portalCollection->pluck('label')->filter()->values()->take(2)->implode(' + ');
            $wellnessBadges = $wellnessCollection->pluck('label')->filter()->values();

            $view->with('layoutIntentions', [
                'raw' => $intentions,
                'first_name' => $firstName,
                'pronouns' => data_get($intentions, 'pronouns', $user->pronouns),
                'intent_label' => $intentLabel,
                'intent_summary' => data_get($intentions, 'intent.summary'),
                'intent_value' => $intentValue,
                'intent_value_normalized' => $intentValueNormalized,
                'greeting' => $greeting,
                'portal_labels' => $portalCollection->pluck('label')->filter()->values(),
                'portal_values' => $portalValues,
                'portal_highlight' => $portalHighlight,
                'wellness_labels' => $wellnessBadges,
                'wellness_values' => $wellnessValues,
            ]);
        });

        WomenListing::observe(WomenListingObserver::class);
        \App\Models\JobAlertMatch::observe(\App\Observers\JobAlertMatchObserver::class);
        WomenVerifiedAgent::observe(WomenVerifiedAgentObserver::class);
        SocialPostPoll::observe(SocialPostPollObserver::class);
        SocialLiveStream::observe(SocialLiveStreamObserver::class);
        // Ensure permission records created during tests or runtime without 'group'
        // are given a safe default value so DB insertion does not fail.
        SpatiePermission::creating(function ($perm) {
            if (empty($perm->group)) {
                $perm->group = 'General';
            }
        });
    }
}

