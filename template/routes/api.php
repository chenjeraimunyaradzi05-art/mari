<?php

use App\Http\Controllers\Api\Business\BusinessBudgetController;
use App\Http\Controllers\Api\Business\BusinessCashbookAiController;
use App\Http\Controllers\Api\Business\BusinessCashbookController;
use App\Http\Controllers\Api\Business\BusinessCashbookEntryController;
use App\Http\Controllers\Api\Business\BusinessCashbookExportController;
use App\Http\Controllers\Api\Business\BusinessCashbookExportStatusController;
use App\Http\Controllers\Api\AiContextHistoryController;
use App\Http\Controllers\Api\Business\BusinessDocumentAiController;
use App\Http\Controllers\Api\Money\BankAccountController;
use App\Http\Controllers\Api\Money\BundleOfferController;
use App\Http\Controllers\Api\Money\BankTransactionImportController;
use App\Http\Controllers\Api\Money\BankTransactionController;
use App\Http\Controllers\Api\Money\BudgetController;
use App\Http\Controllers\Api\Money\DebtController;
use App\Http\Controllers\Api\Wellbeing\WellbeingArticleController;
use App\Http\Controllers\Api\Wellbeing\WellbeingEventController;
use App\Http\Controllers\Api\Wellbeing\WellbeingPartnerOfferController;
use App\Http\Controllers\Api\Wellbeing\WellbeingProfileController;
use App\Http\Controllers\Api\Wellbeing\WellbeingTelemetryController;
use App\Http\Controllers\Api\V1\AnalyticsEventController;
use App\Http\Controllers\Api\V1\AdvertisingBeaconController;
use App\Http\Controllers\Api\V1\AuthController as ApiAuthController;
use App\Http\Controllers\Api\V1\AnalyticsEventSummaryController;
use App\Http\Controllers\Api\V1\Community\CommunityEventController;
use App\Http\Controllers\Api\V1\Community\CommunityGroupController;
use App\Http\Controllers\Api\V1\Community\CommunityImportController;
use App\Http\Controllers\Api\V1\Community\CommunityInviteController;
use App\Http\Controllers\Api\V1\Community\CommunityListController;
use App\Http\Controllers\Api\V1\Community\CommunityLiveRoomController;
use App\Http\Controllers\Api\V1\Community\CommunityMembershipController;
use App\Http\Controllers\Api\V1\Community\CommunityResourceController;
use App\Http\Controllers\Api\Integrations\TurboTaxProxyController;
use App\Http\Controllers\Api\Integrations\TurboTaxOAuthController;
use App\Http\Controllers\Api\V1\Community\MentorshipCohortController;
use App\Http\Controllers\Api\V1\FeedController as ApiFeedController;
use App\Http\Controllers\Api\V1\Impact\PublicImpactController;
use App\Http\Controllers\Api\V1\Messaging\ConversationController;
use App\Http\Controllers\Api\V1\Messaging\ConversationMessageController;
use App\Http\Controllers\Api\V1\Messaging\ConversationReactionController;
use App\Http\Controllers\Api\V1\Messaging\ConversationShareController;
use App\Http\Controllers\Api\V1\Messaging\MessageReportController;
use App\Http\Controllers\Api\V1\Messaging\MessageRequestController;
use App\Http\Controllers\Api\V1\Messaging\MessagingMetaController;
use App\Http\Controllers\Api\V1\MediaUploadController;
use App\Http\Controllers\Api\V1\Messaging\WellnessBuddyInviteController;
use App\Http\Controllers\Api\V1\MortgagePropertyController;
use App\Http\Controllers\Api\V1\PrimaryPurposeApiController;
use App\Http\Controllers\Api\V1\PropertyMortgageShareController;
use App\Http\Controllers\Api\V1\RentalListingController;
use App\Http\Controllers\Api\V1\PropertySeekerController;
use App\Http\Controllers\Api\V1\RentalInquiryController;
use App\Http\Controllers\Api\V1\RentalSocialNetworkController;
use App\Http\Controllers\Api\V1\OnboardingController;
use App\Http\Controllers\Api\V1\OnboardingInsightsController;
use App\Http\Controllers\Api\V1\OnboardingSupportEventController;
use App\Http\Controllers\Api\V1\PersonalizedFeedController;
use App\Http\Controllers\Api\V1\PropertySocialController;
use App\Http\Controllers\Api\V1\SocialInviteController;
use App\Http\Controllers\Api\V1\ContactSyncController;
use App\Http\Controllers\Api\V1\SocialApiController;
use App\Http\Controllers\Api\V1\DeviceCaptureConsentController;
use App\Http\Controllers\Api\V1\ProfilePrivacyController;
use App\Http\Controllers\Api\V1\SocialFeedController;
use App\Http\Controllers\Api\V1\SocialDataBackboneController;
use App\Http\Controllers\Api\V1\SocialImportController;
use App\Http\Controllers\Api\V1\SocialIntegrationController;
use App\Http\Controllers\Api\V1\SocialShareController;
use App\Http\Controllers\Api\V1\CircleDiscoveryController;
use App\Http\Controllers\Api\V1\RoleDashboardTelemetryController;
use App\Http\Controllers\Api\V1\EntertainmentController;
use App\Http\Controllers\Api\PathwayController;
use App\Http\Controllers\Social\ConnectionsController as SocialConnectionsController;
use App\Http\Controllers\Social\IncidentReportController;
use App\Http\Controllers\Api\Money\UserSubscriptionController;
use App\Http\Controllers\Api\Careers\CareerInterestController;
use App\Http\Controllers\Api\WomenRealEstate\MortgageQuoteApiController;
use App\Http\Controllers\Api\WomenRealEstate\WomenListingController;
use App\Http\Controllers\Api\WomenRealEstate\WomenListingMediaController;
use App\Http\Controllers\Api\WomenRealEstate\WomenListingPartnerIntentionController;
use App\Http\Controllers\Api\WomenRealEstate\WomenListingSocialShareController;
use App\Http\Controllers\Api\WomenRealEstate\WomenRentalListingController;
use App\Http\Controllers\Api\WomenRealEstate\WomenPropertySeekerController;
use App\Http\Controllers\Api\WomenRealEstate\WomenRentalInquiryController;
use App\Http\Controllers\Api\WomenRealEstate\WomenSocialNetworkController;
use App\Http\Controllers\Api\WomenRealEstate\WomenPersonaProfileController;
use App\Http\Controllers\Api\WomenRealEstate\WomenAgentProfileController;
use App\Http\Controllers\Org\AdCampaignController;
use App\Http\Controllers\Org\AdCreativeController;
use App\Http\Controllers\Org\CourseController;
use App\Http\Controllers\Org\OrgMediaController;
use App\Http\Controllers\Org\OrgPostController;
use App\Http\Controllers\Org\OrganizationPageController as OrgOrganizationPageController;
use App\Http\Controllers\SocialGraphController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('register', [ApiAuthController::class, 'register'])->name('api.v1.auth.register');
        Route::post('login', [ApiAuthController::class, 'login'])->name('api.v1.auth.login');

        Route::middleware('auth:sanctum')->group(function () {
            Route::get('me', [ApiAuthController::class, 'user'])->name('api.v1.auth.me');
            Route::post('logout', [ApiAuthController::class, 'logout'])->name('api.v1.auth.logout');
            Route::post('logout-all', [ApiAuthController::class, 'logoutAll'])->name('api.v1.auth.logout-all');
            Route::post('refresh', [ApiAuthController::class, 'refresh'])->name('api.v1.auth.refresh');
        });
    });

    Route::get('feed', [ApiFeedController::class, 'index']);
    Route::post('analytics/events', [AnalyticsEventController::class, 'store'])
        ->middleware('throttle:60,1')
        ->name('api.v1.analytics.events.store');
    // TurboTax Integration POC endpoint (Projection)
    Route::post('turbotax/projection', [TurboTaxProxyController::class, 'projection'])
        ->name('api.v1.turbotax.projection');

    // Lightweight OAuth POC (start + callback) — return redirect and receive callback
    Route::post('turbotax/oauth/start', [TurboTaxOAuthController::class, 'start'])
        ->name('api.v1.turbotax.oauth.start');

    Route::get('turbotax/oauth/callback', [TurboTaxOAuthController::class, 'callback'])
        ->name('api.v1.turbotax.oauth.callback');
    Route::post('ads/beacon', AdvertisingBeaconController::class)
        ->middleware('throttle:120,1')
        ->name('api.v1.ads.beacon');

    Route::prefix('messaging')->name('api.v1.messaging.')->group(function () {
        Route::get('meta', MessagingMetaController::class)->name('meta.show');
    });

    Route::get('impact', PublicImpactController::class)->name('api.v1.impact.index');
});

Route::middleware('auth:sanctum')->prefix('v1')->group(function () {
    Route::prefix('pathways')->name('api.v1.pathways.')->group(function () {
        Route::get('/', [PathwayController::class, 'index'])->name('index');
        Route::post('/', [PathwayController::class, 'store'])->name('store');
    });

    Route::prefix('money')->name('api.v1.money.')->group(function () {
        Route::get('budget', [BudgetController::class, 'show'])->name('budget.show');
        Route::post('budget', [BudgetController::class, 'store'])->name('budget.store');
        Route::delete('debts/{debt}', [DebtController::class, 'destroy'])->name('debts.destroy');
        Route::get('subscriptions', [UserSubscriptionController::class, 'index'])->name('subscriptions.index');
        Route::post('subscriptions', [UserSubscriptionController::class, 'store'])->name('subscriptions.store');
        Route::delete('subscriptions/{subscription}', [UserSubscriptionController::class, 'destroy'])->name('subscriptions.destroy');
        Route::get('bank-accounts', [BankAccountController::class, 'index'])->name('bank-accounts.index');
        Route::get('bank-transactions', [BankTransactionController::class, 'index'])->name('bank-transactions.index');
        Route::post('bank-transactions/bulk', [BankTransactionController::class, 'bulkUpdate'])->name('bank-transactions.bulk');
        Route::post('bank-transactions/import', BankTransactionImportController::class)->name('bank-transactions.import');
        Route::post('bank-transactions/ai-context', [BankTransactionController::class, 'createAiContext'])->name('bank-transactions.ai-context');
        Route::get('bank-transactions/ai-contexts', AiContextHistoryController::class)->name('bank-transactions.ai-contexts');
        Route::get('bundles/offers', [BundleOfferController::class, 'index'])->name('bundles.offers.index');
        Route::post('bundles/offers', [BundleOfferController::class, 'store'])->name('bundles.offers.store');
        Route::get('bundles/offers/{bundleOffer}', [BundleOfferController::class, 'show'])->name('bundles.offers.show');
    });

    Route::get('ai/context-history', AiContextHistoryController::class)->name('api.v1.ai.context-history.index');

    Route::prefix('wellbeing')->name('api.v1.wellbeing.')->group(function () {
        Route::get('profile', [WellbeingProfileController::class, 'show'])->name('profile.show');
        Route::post('profile', [WellbeingProfileController::class, 'store'])->name('profile.store');
        Route::get('events', [WellbeingEventController::class, 'index'])->name('events.index');
        Route::get('offers', [WellbeingPartnerOfferController::class, 'index'])->name('offers.index');
        Route::get('articles', [WellbeingArticleController::class, 'index'])->name('articles.index');
        Route::post('telemetry', [WellbeingTelemetryController::class, 'store'])->name('telemetry.store');
        Route::get('telemetry/adoption', [WellbeingTelemetryController::class, 'adoption'])->name('telemetry.adoption');
    });

    Route::prefix('account')->name('api.v1.account.')->group(function () {
        Route::patch('personas/{profile}/privacy', [ProfilePrivacyController::class, 'update'])
            ->name('personas.privacy.update');
    });

    Route::prefix('business')->name('api.v1.business.')->group(function () {
        Route::get('cashbook', [BusinessCashbookController::class, 'showOrCreateDefault'])
            ->name('cashbook.show');
        Route::match(['put', 'patch'], 'cashbook', [BusinessCashbookController::class, 'update'])
            ->name('cashbook.update');

        Route::get('entries', [BusinessCashbookEntryController::class, 'index'])
            ->name('entries.index');
        Route::post('entries', [BusinessCashbookEntryController::class, 'store'])
            ->name('entries.store');
        Route::match(['put', 'patch'], 'entries/{entry}', [BusinessCashbookEntryController::class, 'update'])
            ->name('entries.update');
        Route::delete('entries/{entry}', [BusinessCashbookEntryController::class, 'destroy'])
            ->name('entries.destroy');
        Route::post('entries/bulk', [BusinessCashbookEntryController::class, 'bulk'])
            ->name('entries.bulk');
        Route::get('entries/summary', [BusinessCashbookEntryController::class, 'summary'])
            ->name('entries.summary');

        Route::get('budgets', [BusinessBudgetController::class, 'index'])
            ->name('budgets.index');
        Route::post('budgets', [BusinessBudgetController::class, 'store'])
            ->name('budgets.store');

        Route::post('ai/context', [BusinessCashbookAiController::class, 'context'])
            ->name('ai.context');
        Route::post('ai/suggest', [BusinessCashbookAiController::class, 'suggest'])
            ->name('ai.suggest');

        Route::post('exports', BusinessCashbookExportController::class)
            ->name('exports.store');
        Route::get('exports/{job}', BusinessCashbookExportStatusController::class)
            ->name('exports.show');
    });

    Route::prefix('ai')->name('api.v1.ai.')->group(function () {
        Route::post('business-documents', BusinessDocumentAiController::class)
            ->name('business-documents.store');
    });

    Route::prefix('media-uploads')->name('api.v1.media-uploads.')->group(function () {
        Route::post('/', [MediaUploadController::class, 'store'])->name('store');
        Route::get('{mediaUploadSession:uuid}', [MediaUploadController::class, 'show'])->name('show');
        Route::post('{mediaUploadSession:uuid}/chunks', [MediaUploadController::class, 'storeChunk'])->name('chunks.store');
        Route::post('{mediaUploadSession:uuid}/complete', [MediaUploadController::class, 'complete'])->name('complete');
    });

    Route::get('analytics/events/summary', AnalyticsEventSummaryController::class)
        ->name('api.v1.analytics.events.summary');
    Route::get('analytics/role-dashboards', RoleDashboardTelemetryController::class)
        ->withoutMiddleware('auth:sanctum')
        ->middleware('auth.role-dashboard-telemetry:sanctum')
        ->name('api.v1.analytics.role-dashboards.show');
    Route::get('onboarding', [OnboardingController::class, 'show'])->name('api.v1.onboarding.show');
    Route::post('onboarding/profile', [OnboardingController::class, 'updateProfile'])->name('api.v1.onboarding.profile');
    Route::post('onboarding/personas', [OnboardingController::class, 'updatePersonas'])->name('api.v1.onboarding.personas');
    Route::post('onboarding/complete', [OnboardingController::class, 'complete'])->name('api.v1.onboarding.complete');
    Route::post('onboarding/support-engagements', [OnboardingController::class, 'recordSupportEngagement'])
        ->name('api.v1.onboarding.support-engagements.store');
    Route::get('onboarding/support-insights', OnboardingInsightsController::class)
        ->name('api.v1.onboarding.support-insights');
    Route::get('onboarding/support-insights/events', OnboardingSupportEventController::class)
        ->name('api.v1.onboarding.support-insights.events');
    Route::get('onboarding/purpose', [PrimaryPurposeApiController::class, 'show'])
        ->name('api.v1.onboarding.purpose.show');
    Route::match(['put', 'patch'], 'onboarding/purpose', [PrimaryPurposeApiController::class, 'update'])
        ->name('api.v1.onboarding.purpose.update');

    Route::get('social/feed', [SocialFeedController::class, 'index']);
    Route::post('social/feed/impressions', [SocialFeedController::class, 'recordImpression']);
    Route::get('social/personalized-feed', PersonalizedFeedController::class);
    Route::get('social/backbone', SocialDataBackboneController::class)
        ->name('api.v1.social.backbone');
    Route::post('social/incidents', [IncidentReportController::class, 'store'])
        ->name('api.v1.social.incidents.store');

    Route::post('social/capture/consent', [DeviceCaptureConsentController::class, 'store'])
        ->name('api.v1.social.capture.consent');

    Route::get('social/integrations', [SocialIntegrationController::class, 'index'])
        ->name('api.v1.social.integrations.index');
    Route::post('social/integrations/{provider}/connect', [SocialIntegrationController::class, 'connect'])
        ->name('api.v1.social.integrations.connect');
    Route::delete('social/integrations/{provider}', [SocialIntegrationController::class, 'disconnect'])
        ->name('api.v1.social.integrations.disconnect');

    Route::post('social/imports/links', [SocialImportController::class, 'store'])
        ->name('api.v1.social.imports.links');

    Route::prefix('social/connections')->name('api.v1.social.connections.')->group(function () {
        Route::get('/', [SocialConnectionsController::class, 'index'])->name('index');
        Route::post('/', [SocialConnectionsController::class, 'store'])->name('store');
        Route::match(['put', 'patch'], '{connection}', [SocialConnectionsController::class, 'update'])->name('update');
        Route::get('recommendations/mutual', [SocialConnectionsController::class, 'recommendations'])
            ->name('recommendations.mutual');
    });

    Route::get('social/connections/recommendations', [SocialApiController::class, 'connectionRecommendations']);
    Route::get('social/connections/suggestions', [SocialApiController::class, 'suggestedConnections']);
    Route::get('social/connections/clusters', [SocialApiController::class, 'networkClusters']);
    Route::get('social/connections/pulse', [SocialApiController::class, 'connectionPulse']);
    Route::get('social/connections/momentum', [SocialApiController::class, 'connectionMomentum']);
    Route::get('social/connections/status-breakdown', [SocialApiController::class, 'connectionStatusBreakdown']);
    Route::get('social/profile/strength-analysis', [SocialApiController::class, 'profileStrength']);
    Route::get('social/profile/job-match', [SocialApiController::class, 'jobMatch']);
    Route::get('social/posts/best-time', [SocialApiController::class, 'bestPostingTime']);
    Route::get('social/analytics/summary', [SocialApiController::class, 'analyticsSummary']);
    Route::get('social/analytics/heatmap', [SocialApiController::class, 'analyticsHeatmap']);
    Route::get('social/analytics/engagement-timeline', [SocialApiController::class, 'engagementTimeline']);
    Route::get('social/analytics/content-highlights', [SocialApiController::class, 'contentHighlights']);
    Route::post('social/posts/hashtag-suggestions', [SocialApiController::class, 'hashtagSuggestions']);

    Route::post('social/posts/{post}/share', [SocialShareController::class, 'store'])
        ->name('api.v1.social.posts.share');

    Route::post('social/discovery/contacts', [CircleDiscoveryController::class, 'discover'])
        ->name('api.v1.social.discovery.contacts');

    Route::post('social/invites', [SocialInviteController::class, 'store'])
        ->name('api.v1.social.invites.store');
    Route::post('social/invites/{token}/accept', [SocialInviteController::class, 'accept'])
        ->name('api.v1.social.invites.accept');

    // Entertainment & Content Hub
    Route::prefix('entertainment')->name('api.v1.entertainment.')->group(function () {
        Route::get('feed', [EntertainmentController::class, 'feed'])->name('feed'); // TikTok style
        Route::get('dashboard', [EntertainmentController::class, 'dashboard'])->name('dashboard'); // YouTube/Netflix style
        Route::get('browse', [EntertainmentController::class, 'browse'])->name('browse');
        Route::get('trending', [EntertainmentController::class, 'trending'])->name('trending');
        Route::get('continue-watching', [EntertainmentController::class, 'continueWatching'])->name('continue-watching');
        Route::post('/', [EntertainmentController::class, 'store'])->name('store');
        Route::get('{id}', [EntertainmentController::class, 'show'])->name('show');
        Route::post('{id}/progress', [EntertainmentController::class, 'updateProgress'])->name('progress.update');
        Route::post('{id}/like', [EntertainmentController::class, 'like'])->name('like');
        Route::post('profiles/{creatorId}/follow', [EntertainmentController::class, 'follow'])->name('follow');
    });

    Route::prefix('social/graph')->name('api.v1.social.graph.')->group(function () {
        Route::get('contacts', [SocialGraphController::class, 'index'])->name('contacts.index');
        Route::post('contacts', [SocialGraphController::class, 'store'])->name('contacts.store');
        Route::get('recommendations', [SocialGraphController::class, 'recommendations'])->name('recommendations');
        Route::post('contacts/{contact}/invite', [SocialGraphController::class, 'invite'])->name('contacts.invite');
    });

    Route::post('social/contacts/sync', [ContactSyncController::class, 'store'])
        ->name('api.v1.social.contacts.sync');
    Route::post('social/contacts/sync/{session}/callback', [ContactSyncController::class, 'callback'])
        ->name('api.v1.social.contacts.callback');
    Route::get('social/contacts/suggestions', [ContactSyncController::class, 'suggestions'])
        ->name('api.v1.social.contacts.suggestions');

    Route::prefix('community')->name('api.v1.community.')->group(function () {
        Route::get('groups', [CommunityGroupController::class, 'index'])->name('groups.index');
        Route::post('groups', [CommunityGroupController::class, 'store'])->name('groups.store');
        Route::get('groups/{community}', [CommunityGroupController::class, 'show'])->name('groups.show');

        Route::post('groups/{community}/memberships', [CommunityMembershipController::class, 'store'])
            ->name('memberships.store');
        Route::patch('memberships/{membership}/role', [CommunityMembershipController::class, 'updateRole'])
            ->name('memberships.role');

        Route::post('groups/{community}/invites', [CommunityInviteController::class, 'store'])
            ->name('invites.store');
        Route::post('invites/{token}/accept', [CommunityInviteController::class, 'accept'])
            ->name('invites.accept');

        Route::post('groups/{community}/imports/follows', [CommunityImportController::class, 'importFromFollows'])
            ->name('imports.follows');
        Route::post('groups/{community}/imports/contacts', [CommunityImportController::class, 'importFromContacts'])
            ->name('imports.contacts');

        Route::post('groups/{community}/resources', [CommunityResourceController::class, 'store'])
            ->name('resources.store');
        Route::post('groups/{community}/events', [CommunityEventController::class, 'store'])
            ->name('events.store');
        Route::post('groups/{community}/live-rooms', [CommunityLiveRoomController::class, 'store'])
            ->name('live-rooms.store');

        Route::post('groups/{community}/mentorship-cohorts', [MentorshipCohortController::class, 'store'])
            ->name('cohorts.store');
        Route::post('mentorship-cohorts/{cohort}/members', [MentorshipCohortController::class, 'addMember'])
            ->name('cohorts.members.store');

        Route::post('groups/{community}/lists', [CommunityListController::class, 'store'])
            ->name('lists.store');
        Route::get('groups/{community}/lists/close-friends', [CommunityListController::class, 'closeFriends'])
            ->name('lists.close-friends');
    });

    Route::prefix('messaging')->name('api.v1.messaging.')->group(function () {
        Route::get('conversations', [ConversationController::class, 'index'])->name('conversations.index');
        Route::post('conversations', [ConversationController::class, 'store'])
            ->middleware('throttle:social-messaging-send')
            ->name('conversations.store');
        Route::get('conversations/{conversation}', [ConversationController::class, 'show'])->name('conversations.show');
        Route::get('conversations/{conversation}/messages', [ConversationMessageController::class, 'index'])
            ->name('conversations.messages.index');
        Route::post('conversations/{conversation}/messages', [ConversationMessageController::class, 'store'])
            ->middleware('throttle:social-messaging-send')
            ->name('conversations.messages.store');
        Route::post('conversations/{conversation}/shares', [ConversationShareController::class, 'store'])
            ->middleware(['throttle:social-messaging-send', 'throttle:social-messaging-attachments'])
            ->name('conversations.shares.store');

        Route::post('messages/{message}/reactions', [ConversationReactionController::class, 'store'])
            ->name('messages.reactions.store');
        Route::delete('messages/{message}/reactions', [ConversationReactionController::class, 'destroy'])
            ->name('messages.reactions.destroy');
        Route::post('messages/{message}/reports', [MessageReportController::class, 'store'])
            ->middleware('throttle:social-messaging-requests')
            ->name('messages.reports.store');

        Route::get('requests', [MessageRequestController::class, 'index'])
            ->name('requests.index');
        Route::post('requests/{messageRequest}/approve', [MessageRequestController::class, 'approve'])
            ->middleware('throttle:social-messaging-request-accepts')
            ->name('requests.approve');
        Route::post('requests/{messageRequest}/decline', [MessageRequestController::class, 'decline'])
            ->middleware('throttle:social-messaging-request-accepts')
            ->name('requests.decline');

        Route::get('buddy-invites', [WellnessBuddyInviteController::class, 'index'])
            ->name('buddy-invites.index');
        Route::post('buddy-invites', [WellnessBuddyInviteController::class, 'store'])
            ->name('buddy-invites.store');
        Route::post('buddy-invites/{wellnessBuddyInvite}/respond', [WellnessBuddyInviteController::class, 'respond'])
            ->name('buddy-invites.respond');
    });

    Route::prefix('careers')->name('api.v1.careers.')->group(function () {
        Route::get('interests', [CareerInterestController::class, 'index'])->name('interests.index');
        Route::post('interests', [CareerInterestController::class, 'store'])->name('interests.store');
        Route::put('interests/{interest}', [CareerInterestController::class, 'update'])->name('interests.update');
        Route::delete('interests/{interest}', [CareerInterestController::class, 'destroy'])->name('interests.destroy');
    });
});

Route::prefix('org')->group(function () {
    Route::get('{slug}', [OrgOrganizationPageController::class, 'show']);
    Route::get('{slug}/videos', [OrgOrganizationPageController::class, 'videos']);
    Route::get('{slug}/apprenticeships', [OrgOrganizationPageController::class, 'apprenticeships']);
    Route::post('{slug}/lead', [OrgOrganizationPageController::class, 'lead']);

    Route::get('{slug}/courses', [CourseController::class, 'index']);
    Route::get('{slug}/courses/{course:slug}', [CourseController::class, 'show']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('{slug}/follow', [OrgOrganizationPageController::class, 'follow']);
        Route::post('{slug}/invite', [OrgOrganizationPageController::class, 'invite']);
        Route::post('{slug}/media', [OrgMediaController::class, 'store']);
        Route::post('{slug}/posts', [OrgPostController::class, 'store']);
    });
});

Route::middleware('auth:sanctum')
    ->prefix('ads')
    ->name('api.ads.')
    ->group(function () {
        Route::get('campaigns', [AdCampaignController::class, 'index'])
            ->name('campaigns.index');
        Route::post('campaigns', [AdCampaignController::class, 'store'])
            ->name('campaigns.store');
        Route::get('campaigns/{campaign}', [AdCampaignController::class, 'show'])
            ->name('campaigns.show');
        Route::match(['put', 'patch'], 'campaigns/{campaign}', [AdCampaignController::class, 'update'])
            ->name('campaigns.update');
        Route::get('campaigns/{campaign}/metrics', [AdCampaignController::class, 'metrics'])
            ->name('campaigns.metrics');
        Route::post('campaigns/{campaign}/actions', [AdCampaignController::class, 'action'])
            ->name('campaigns.action');
        Route::get('org-pages/{organizationPage}/overview', [AdCampaignController::class, 'overview'])
            ->name('org-pages.overview');
        Route::get('creatives', [AdCreativeController::class, 'index'])
            ->name('creatives.index');
        Route::post('creatives', [AdCreativeController::class, 'store'])
            ->name('creatives.store');
        Route::match(['put', 'patch'], 'creatives/{creative}', [AdCreativeController::class, 'update'])
            ->name('creatives.update');
    });

Route::middleware(['auth:sanctum', 'real-estate.onboarded'])
    ->prefix('women/real-estate')
    ->name('api.women.real-estate.')
    ->group(function () {
        Route::get('listings', [WomenListingController::class, 'index'])
            ->name('listings.index');
        Route::get('listings/metrics', [WomenListingController::class, 'metrics'])
            ->name('listings.metrics');
        Route::get('listings/{listing}', [WomenListingController::class, 'show'])
            ->name('listings.show');
        Route::post('listings', [WomenListingController::class, 'store'])
            ->name('listings.store');
        Route::match(['put', 'patch'], 'listings/{listing}', [WomenListingController::class, 'update'])
            ->name('listings.update');
        Route::post('listings/{listing}/publish', [WomenListingController::class, 'publish'])
            ->name('listings.publish');
        Route::delete('listings/{listing}/publish', [WomenListingController::class, 'unpublish'])
            ->name('listings.unpublish');
        Route::post('listings/{listing}/media', [WomenListingMediaController::class, 'store'])
            ->name('listings.media.store');
        Route::patch('listings/{listing}/media/{media}', [WomenListingMediaController::class, 'update'])
            ->name('listings.media.update');
        Route::delete('listings/{listing}/media/{media}', [WomenListingMediaController::class, 'destroy'])
            ->name('listings.media.destroy');
        Route::post('listings/{listing}/media/reorder', [WomenListingMediaController::class, 'reorder'])
            ->name('listings.media.reorder');

        Route::get('listings/{listing}/partner-intents', [WomenListingPartnerIntentionController::class, 'index'])
            ->name('listings.partner-intents.index');
        Route::post('listings/{listing}/partner-intents', [WomenListingPartnerIntentionController::class, 'store'])
            ->name('listings.partner-intents.store');
        Route::patch('listings/{listing}/partner-intents/{intention}', [WomenListingPartnerIntentionController::class, 'update'])
            ->name('listings.partner-intents.update');
        Route::delete('listings/{listing}/partner-intents/{intention}', [WomenListingPartnerIntentionController::class, 'destroy'])
            ->name('listings.partner-intents.destroy');

        Route::post('listings/{listing}/social-shares', [WomenListingSocialShareController::class, 'store'])
            ->name('listings.social-shares.store');

        Route::middleware('throttle:women-mortgage-quotes')->group(function () {
            Route::get('listings/{listing}/mortgage-quotes', [MortgageQuoteApiController::class, 'index'])
                ->name('listings.mortgage-quotes.index');
            Route::get('listings/{listing}/mortgage-quotes/stats', [MortgageQuoteApiController::class, 'stats'])
                ->name('listings.mortgage-quotes.stats');
        });

        // ===== WOMEN RENTAL LISTINGS =====
        Route::get('rentals/search', [WomenRentalListingController::class, 'searchRentals'])
            ->name('rentals.search');
        Route::get('rentals/trending', [WomenRentalListingController::class, 'getTrendingRentals'])
            ->name('rentals.trending');
        Route::get('rentals/{rentalPropertyId}', [WomenRentalListingController::class, 'getRentalListing'])
            ->name('rentals.show');
        Route::post('rentals/{rentalPropertyId}/view', [WomenRentalListingController::class, 'recordRentalView'])
            ->name('rentals.view');
        Route::post('listings/{listingId}/create-rental', [WomenRentalListingController::class, 'createRentalListing'])
            ->name('rentals.store');
        Route::get('my-rental-listings', [WomenRentalListingController::class, 'getLandlordListings'])
            ->name('rentals.landlord');
        Route::delete('rentals/{rentalPropertyId}', [WomenRentalListingController::class, 'deleteRentalListing'])
            ->name('rentals.destroy');

        // ===== WOMEN PROPERTY SEEKERS (HOUSEHUNTERS) =====
        Route::post('seeker-profile', [WomenPropertySeekerController::class, 'createOrUpdateProfile'])
            ->name('seeker.store');
        Route::get('seeker-profile', [WomenPropertySeekerController::class, 'getProfile'])
            ->name('seeker.show');
        Route::get('seeker-matches', [WomenPropertySeekerController::class, 'getAIMatches'])
            ->name('seeker.matches');
        Route::get('seeker-recommendations', [WomenPropertySeekerController::class, 'getRecommendations'])
            ->name('seeker.recommendations');
        Route::post('matches/{matchId}/view', [WomenPropertySeekerController::class, 'viewMatch'])
            ->name('matches.view');
        Route::post('matches/{matchId}/reject', [WomenPropertySeekerController::class, 'rejectMatch'])
            ->name('matches.reject');

        // ===== WOMEN PERSONA PROFILES =====
        Route::get('persona-profiles', [WomenPersonaProfileController::class, 'show'])
            ->name('persona-profiles.show');
        Route::post('persona-profiles', [WomenPersonaProfileController::class, 'store'])
            ->name('persona-profiles.store');

        // ===== WOMEN AGENT PROFILES =====
        Route::get('agent-profiles/me', [WomenAgentProfileController::class, 'show'])
            ->name('agent-profiles.show');
        Route::post('agent-profiles/me', [WomenAgentProfileController::class, 'store'])
            ->name('agent-profiles.store');

        // ===== WOMEN RENTAL INQUIRIES =====
        Route::post('rentals/{rentalPropertyId}/inquire', [WomenRentalInquiryController::class, 'sendInquiry'])
            ->name('inquiries.store');
        Route::get('my-inquiries', [WomenRentalInquiryController::class, 'getSeekerInquiries'])
            ->name('inquiries.seeker');
        Route::get('landlord-inquiries', [WomenRentalInquiryController::class, 'getLandlordInquiries'])
            ->name('inquiries.landlord');
        Route::get('inquiries/{inquiryId}', [WomenRentalInquiryController::class, 'getInquiryDetails'])
            ->name('inquiries.show');
        Route::post('inquiries/{inquiryId}/status', [WomenRentalInquiryController::class, 'updateInquiryStatus'])
            ->name('inquiries.update');

        // ===== WOMEN SOCIAL NETWORK =====
        Route::post('connections/request/{userId}', [WomenSocialNetworkController::class, 'sendConnectionRequest'])
            ->name('connections.store');
        Route::post('connections/{connectionId}/accept', [WomenSocialNetworkController::class, 'acceptConnection'])
            ->name('connections.accept');
        Route::post('connections/{connectionId}/reject', [WomenSocialNetworkController::class, 'rejectConnection'])
            ->name('connections.reject');
        Route::get('my-connections', [WomenSocialNetworkController::class, 'getConnections'])
            ->name('connections.index');
        Route::get('pending-connection-requests', [WomenSocialNetworkController::class, 'getPendingRequests'])
            ->name('connections.pending');
        Route::get('network-stats', [WomenSocialNetworkController::class, 'getNetworkStats'])
            ->name('connections.stats');
        Route::post('block-user/{userId}', [WomenSocialNetworkController::class, 'blockUser'])
            ->name('connections.block');
    });

// Property Social Media Integration Routes
Route::prefix('v1')->group(function () {
    // Public endpoints
    Route::get('properties/{propertyId}/social-posts', [PropertySocialController::class, 'getPropertyPosts']);
    Route::get('properties/trending/social', [PropertySocialController::class, 'getTrending']);
    Route::get('users/{userId}/property-shares', [PropertySocialController::class, 'getUserShares']);

    // Record interactions (public - no auth required)
    Route::post('property-social-posts/{postId}/view', [PropertySocialController::class, 'recordView']);
    Route::post('property-social-posts/{postId}/share', [PropertySocialController::class, 'recordShare']);

    // Authenticated endpoints
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('properties/{propertyId}/share', [PropertySocialController::class, 'share']);
        Route::delete('property-social-posts/{postId}', [PropertySocialController::class, 'destroy']);
    });
});

// Mortgage-Property Integration Routes
Route::prefix('v1')->group(function () {
    // Property mortgage valuation (public)
    Route::get('properties/{propertyId}/mortgage-valuation', [MortgagePropertyController::class, 'propertyMortgageValuation']);
    Route::get('properties/mortgage-readiness', [MortgagePropertyController::class, 'propertiesMortgageReadiness']);

    // Mortgage analytics by property type (public)
    Route::get('mortgage/analytics/by-property-type', [MortgagePropertyController::class, 'mortgageAnalyticsByPropertyType']);
});

// Property + Mortgage Social Sharing Routes (OPTION C)
Route::prefix('v1')->group(function () {
    // Public endpoints - trending mortgaged properties
    Route::get('properties/mortgage-featured/trending', [PropertyMortgageShareController::class, 'getTrendingMortgagedProperties']);
    Route::get('properties/mortgage-shares/perspective/{perspective}', [PropertyMortgageShareController::class, 'getMortgageSharesByPerspective']);
    Route::get('properties/{propertyId}/mortgage-social-context', [PropertyMortgageShareController::class, 'getPropertyMortgageSocialContext']);

    // Authenticated endpoints - share properties with mortgage analysis
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('properties/{propertyId}/share-with-mortgage', [PropertyMortgageShareController::class, 'shareMortgagedProperty']);
    });
});

// RENTAL & HOUSE HUNTER FEATURES (NEW - OPTIONS FOR RENTERS & BUYERS)
Route::prefix('v1')->group(function () {

    // ===== RENTAL LISTINGS (Public) =====
    Route::get('rentals/search', [RentalListingController::class, 'searchRentals']);
    Route::get('rentals/trending', [RentalListingController::class, 'getTrendingRentals']);
    Route::get('rentals/{rentalPropertyId}', [RentalListingController::class, 'getRentalListing']);
    Route::post('rentals/{rentalPropertyId}/view', [RentalListingController::class, 'recordRentalView']);

    // ===== RENTAL LISTINGS (Authenticated - Landlords) =====
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('properties/{propertyId}/create-rental-listing', [RentalListingController::class, 'createRentalListing']);
        Route::get('my-rental-listings', [RentalListingController::class, 'getLandlordListings']);
        Route::delete('rentals/{rentalPropertyId}', [RentalListingController::class, 'deleteRentalListing']);
    });

    // ===== PROPERTY SEEKER / HOUSE HUNTER PROFILES =====
    Route::middleware(['auth:sanctum'])->group(function () {
        // Profile management
        Route::post('seeker-profile', [PropertySeekerController::class, 'createOrUpdateProfile']);
        Route::get('seeker-profile', [PropertySeekerController::class, 'getProfile']);

        // AI-powered matching
        Route::get('seeker-matches', [PropertySeekerController::class, 'getAIMatches']);
        Route::get('seeker-recommendations', [PropertySeekerController::class, 'getRecommendations']);

        // Match interactions
        Route::post('matches/{matchId}/view', [PropertySeekerController::class, 'viewMatch']);
        Route::post('matches/{matchId}/reject', [PropertySeekerController::class, 'rejectMatch']);
    });

    // ===== RENTAL INQUIRIES =====
    Route::middleware(['auth:sanctum'])->group(function () {
        // Seeker sending inquiries
        Route::post('rentals/{rentalPropertyId}/inquire', [RentalInquiryController::class, 'sendInquiry']);
        Route::get('my-inquiries', [RentalInquiryController::class, 'getSeekerInquiries']);

        // Landlord managing inquiries
        Route::get('landlord-inquiries', [RentalInquiryController::class, 'getLandlordInquiries']);
        Route::post('inquiries/{inquiryId}/status', [RentalInquiryController::class, 'updateInquiryStatus']);

        // Inquiry details
        Route::get('inquiries/{inquiryId}', [RentalInquiryController::class, 'getInquiryDetails']);
    });

    // ===== RENTAL SOCIAL NETWORK =====
    Route::middleware(['auth:sanctum'])->group(function () {
        // Connection management
        Route::post('connections/request/{userId}', [RentalSocialNetworkController::class, 'sendConnectionRequest']);
        Route::post('connections/{connectionId}/accept', [RentalSocialNetworkController::class, 'acceptConnection']);
        Route::post('connections/{connectionId}/reject', [RentalSocialNetworkController::class, 'rejectConnection']);

        // View connections
        Route::get('my-connections', [RentalSocialNetworkController::class, 'getConnections']);
        Route::get('pending-connection-requests', [RentalSocialNetworkController::class, 'getPendingRequests']);
        Route::get('network-stats', [RentalSocialNetworkController::class, 'getNetworkStats']);

        // Block user
        Route::post('block-user/{userId}', [RentalSocialNetworkController::class, 'blockUser']);
    });
});
