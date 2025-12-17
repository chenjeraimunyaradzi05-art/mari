<?php
/**
 * AuthServiceProvider
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Providers;

use App\Auth\Auth0UserProvider;
use App\Models\Admin;
use App\Models\AgentProfile;
use App\Models\BusinessCashbook;
use App\Models\BusinessCashbookEntry;
use App\Models\GrantApplication;
use App\Models\SocialThread;
use App\Models\ListingPartnershipIntention;
use App\Models\SocialPost;
use App\Models\ServiceListing;
use App\Models\SocialProfileVerification;
use App\Models\SocialProfile;
use App\Models\WomenHousingListing;
use App\Models\User;
use App\Models\WomenRealEstate\WomenCohortEnrolment;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenDashboardPreference;
use App\Models\WomenRealEstate\WomenDashboardWidget;
use App\Models\WomenRealEstate\WomenGoalTracker;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenPartnerMatch;
use App\Models\WomenRealEstate\WomenPartnerProject;
use App\Models\WomenRealEstate\WomenListingPartnerIntention;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Policies\AgentProfilePolicy;
use App\Policies\BusinessCashbookEntryPolicy;
use App\Policies\BusinessCashbookPolicy;
use App\Policies\ConversationPolicy;
use App\Policies\GrantApplicationPolicy;
use App\Policies\ListingPartnershipIntentionPolicy;
use App\Policies\RoleDashboardPolicy;
use App\Policies\ServiceListingPolicy;
use App\Policies\SocialPostPolicy;
use App\Policies\SocialProfileVerificationPolicy;
use App\Policies\SocialProfilePolicy;
use App\Policies\WomenHousingListingPolicy;
use App\Policies\WomenRealEstate\WomenCohortEnrolmentPolicy;
use App\Policies\WomenRealEstate\WomenCohortProfilePolicy;
use App\Policies\WomenRealEstate\WomenDashboardPreferencePolicy;
use App\Policies\WomenRealEstate\WomenDashboardWidgetPolicy;
use App\Policies\WomenRealEstate\WomenGoalTrackerPolicy;
use App\Policies\WomenRealEstate\WomenListingPolicy;
use App\Policies\WomenRealEstate\WomenListingPartnerIntentionPolicy;
use App\Policies\WomenRealEstate\WomenPartnerMatchPolicy;
use App\Policies\WomenRealEstate\WomenPartnerProjectPolicy;
use App\Policies\WomenRealEstate\WomenVerifiedAgentPolicy;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use App\Support\IntentEvaluator;

final class AuthServiceProvider extends ServiceProvider
{
    /**
     * The model to policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        BusinessCashbook::class => BusinessCashbookPolicy::class,
        BusinessCashbookEntry::class => BusinessCashbookEntryPolicy::class,
        WomenHousingListing::class => WomenHousingListingPolicy::class,
        SocialThread::class => ConversationPolicy::class,
        AgentProfile::class => AgentProfilePolicy::class,
        ListingPartnershipIntention::class => ListingPartnershipIntentionPolicy::class,
        WomenListing::class => WomenListingPolicy::class,
        SocialProfile::class => SocialProfilePolicy::class,
        SocialPost::class => SocialPostPolicy::class,
        SocialProfileVerification::class => SocialProfileVerificationPolicy::class,
        WomenListingPartnerIntention::class => WomenListingPartnerIntentionPolicy::class,
        WomenVerifiedAgent::class => WomenVerifiedAgentPolicy::class,
        WomenCohortProfile::class => WomenCohortProfilePolicy::class,
        WomenCohortEnrolment::class => WomenCohortEnrolmentPolicy::class,
        WomenPartnerProject::class => WomenPartnerProjectPolicy::class,
        WomenPartnerMatch::class => WomenPartnerMatchPolicy::class,
        WomenGoalTracker::class => WomenGoalTrackerPolicy::class,
        WomenDashboardPreference::class => WomenDashboardPreferencePolicy::class,
        WomenDashboardWidget::class => WomenDashboardWidgetPolicy::class,
        GrantApplication::class => GrantApplicationPolicy::class,
        ServiceListing::class => ServiceListingPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
        Auth::provider('auth0-admins', function ($app, array $config) {
            return new Auth0UserProvider($app->make(Admin::class));
        });

        Gate::before(function ($user, $ability) {
            return $user->hasRole('Super Admin') ? true : null;
        });

        Gate::define('womenRealEstate.reviewVerification', function ($user) {
            $roles = collect(config('women_real_estate.verification.reviewer_roles', []))
                ->map(static fn ($role) => trim((string) $role))
                ->filter()
                ->values();

            if ($roles->isEmpty()) {
                return true;
            }

            if (method_exists($user, 'hasAnyRole') && $user->hasAnyRole($roles->all())) {
                return true;
            }

            return false;
        });

        Gate::define('operations.trust-safety', function (Admin $admin): bool {
            return $admin->can('operations.trust-safety');
        });

        Gate::define('operations.verification-hub', function (Admin $admin): bool {
            return $admin->can('operations.verification-hub');
        });

        Gate::define('operations.ad-review', function (Admin $admin): bool {
            return $admin->can('operations.ad-review');
        });

        Gate::define('operations.revenue-ops', function (Admin $admin): bool {
            return $admin->can('operations.revenue-ops');
        });

        Gate::define('dashboard.role.view', [RoleDashboardPolicy::class, 'view']);

        Gate::define('intent.requirement', static function (User $user, string $requirement): bool {
            return IntentEvaluator::for($user)->allowsRequirement($requirement);
        });

        Gate::define('intent.context', static function (User $user, string $context): bool {
            return IntentEvaluator::for($user)->allowsContext($context);
        });

        Gate::define('viewSocialGraph', /**
         * @return true
         */
        static fn (User $user): bool => true);
        Gate::define('manageSocialGraph', /**
         * @return true
         */
        static fn (User $user): bool => true);
    }
}

