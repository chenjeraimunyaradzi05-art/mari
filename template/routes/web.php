<?php

use App\Http\Controllers\Account\PersonaController;
use App\Http\Controllers\Account\PurposeSettingsController;
use App\Http\Controllers\Account\ProfileSafetyController;
use App\Http\Controllers\Account\ProfileVerificationController;
use App\Http\Controllers\Account\SessionSecurityController;
use App\Http\Controllers\Api\ApiDocumentationController;
use App\Http\Controllers\Business\BusinessAccountingDashboardController;
use App\Http\Controllers\Business\DashboardController as BusinessDashboardController;
use App\Http\Controllers\Business\FormationStudioController;
use App\Http\Controllers\Business\LegalDocumentDownloadController;
use App\Http\Controllers\Business\LegalDocumentLabController;
use App\Http\Controllers\Business\NetworkLandingController;
use App\Http\Controllers\Business\PostController as BusinessPostController;
use App\Http\Controllers\Business\TemplateDownloadController;
use App\Http\Controllers\Careers\CareerWishlistController;
use App\Http\Controllers\DashboardRouterController;
use App\Http\Controllers\Dashboard\RoleDashboardController;
use App\Http\Controllers\Frontend\FrontendJobPageController;
use App\Http\Controllers\Admin\PaymentController;
use App\Http\Controllers\Auth\MFAController;
use App\Http\Controllers\Auth\PrimaryPurposeController;
use App\Http\Controllers\Auth\RoleSelectionController;
use App\Http\Controllers\Fronted\CandidateDashboardController;
use App\Http\Controllers\Frontend\AboutUsPageController;
use App\Http\Controllers\Frontend\AiConciergeController;
use App\Http\Controllers\Frontend\BundleConciergeController;
use App\Http\Controllers\Frontend\AdvancedSearchController;
use App\Http\Controllers\Frontend\CandidateCareerInsightsController;
use App\Http\Controllers\Frontend\CandidateConnectionsController;
use App\Http\Controllers\Frontend\CandidateCvBuilderController;
use App\Http\Controllers\Frontend\CandidateJobAlertController;
use App\Http\Controllers\Frontend\CandidateEductionController;
use App\Http\Controllers\Frontend\CandidateExperienceController;
use App\Http\Controllers\Frontend\CandidateOnboardingController;
use App\Http\Controllers\Frontend\CandidateGroupsController;
use App\Http\Controllers\Frontend\CandidateJobBookmarkController;
use App\Http\Controllers\Frontend\CandidateMyJobController;
use App\Http\Controllers\Frontend\CandidateProfileController;
use App\Http\Controllers\Frontend\CheckoutPageController;
use App\Http\Controllers\Frontend\CompanyDashboardController;
use App\Http\Controllers\Frontend\CompanyLeadController;
use App\Http\Controllers\Frontend\CompanyOrderController;
use App\Http\Controllers\Frontend\CompanyProfileController;
use App\Http\Controllers\Frontend\CompanyApprenticeshipController;
use App\Http\Controllers\Frontend\CompanyVerificationController;
use App\Http\Controllers\Frontend\AdvertisingCampaignController;
use App\Http\Controllers\Frontend\AdvertisingSlotInsightController;
use App\Http\Controllers\Frontend\AdvertisingRevenueDashboardController;
use App\Http\Controllers\Frontend\AdvertisingSlotManagementController;
use App\Http\Controllers\Frontend\AdvertisingAudienceSegmentController;
use App\Http\Controllers\Frontend\AdvertisingCreativeController;
use App\Http\Controllers\Frontend\AdvertisingCampaignMetricController;
use App\Http\Controllers\Frontend\CompnayOrderController;
use App\Http\Controllers\Frontend\ContactController;
use App\Http\Controllers\Frontend\FrontendCandidatePageController;
use App\Http\Controllers\Frontend\FrontendCompanyPageController;
use App\Http\Controllers\Frontend\FinancialWellnessController;
use App\Http\Controllers\Frontend\GamificationController;
use App\Http\Controllers\Money\BudgetDashboardController;
use App\Http\Controllers\Frontend\HomeController;
use App\Http\Controllers\Frontend\GrantExperienceController;
use App\Http\Controllers\Frontend\HousingExperienceController;
use App\Http\Controllers\Frontend\JobMatchController;
use App\Http\Controllers\Frontend\ResumeParserController;
use App\Http\Controllers\Frontend\FeedController as FrontendFeedController;
use App\Http\Controllers\Frontend\WellnessHubController;
use App\Http\Controllers\Frontend\OrganizationLeadController;
use App\Http\Controllers\Frontend\OrgMediaStreamController;
use App\Http\Controllers\Frontend\OrganizationPageController as FrontOrganizationPageController;
use App\Http\Controllers\Frontend\SocialFeedController as FrontendSocialFeedController;
use App\Http\Controllers\Frontend\SkillGapController;
use App\Http\Controllers\Frontend\Social\ProfileController as FrontendSocialProfileController;
use App\Http\Controllers\Frontend\Social\FollowController as FrontendSocialFollowController;
use App\Http\Controllers\Frontend\Social\PostController as FrontendSocialPostController;
use App\Http\Controllers\Frontend\Social\AiAssistController as FrontendSocialAiAssistController;
use App\Http\Controllers\Frontend\Social\AiAssistExtendedController as FrontendSocialAiAssistExtendedController;
use App\Http\Controllers\Frontend\Social\NotificationPreferenceController;
use App\Http\Controllers\Frontend\Social\ProfileVerificationController as FrontendSocialProfileVerificationController;
use App\Http\Controllers\Impact\RoleDashboardImpactController;
use App\Http\Controllers\Frontend\TelemetryDashboardController;
use App\Http\Controllers\Social\MentorModerationController;
use App\Http\Controllers\Frontend\jobController;
use App\Http\Controllers\Frontend\LocationController;
use App\Http\Controllers\Frontend\NewsletterController;
use App\Http\Controllers\Frontend\OrgCourseController;
use App\Http\Controllers\Frontend\PricingPageController;
use App\Http\Controllers\Member\DashboardController as MemberDashboardController;
use App\Http\Controllers\Member\CivicOpportunitiesController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PublicSector\AgencyDashboardController;
use App\Http\Controllers\PublicSector\AgencyFollowController as PublicSectorAgencyFollowController;
use App\Http\Controllers\PublicSector\DashboardController as PublicSectorDashboardController;
use App\Http\Controllers\PublicSector\OpportunityController as PublicSectorOpportunityController;
use App\Http\Controllers\PublicSector\OpportunityEngagementController as PublicSectorOpportunityEngagementController;
use App\Http\Controllers\PublicSector\MissionBriefAiController;
use App\Http\Controllers\PublicSector\ProcurementPipelineController;
use App\Http\Controllers\TafeUniversity\DashboardController as TafeDashboardController;
use App\Http\Controllers\TafeUniversity\InstitutionController as TafeInstitutionController;
use App\Http\Controllers\TafeUniversity\ProfileController as TafeProfileController;
use App\Http\Controllers\TafeUniversity\ProgramController as TafeProgramController;
use App\Http\Controllers\TafeUniversity\ProgramJourneyController as TafeProgramJourneyController;
use App\Http\Controllers\WomenRealEstate\AgentProfileController;
use App\Http\Controllers\WomenRealEstate\AgentPulseController;
use App\Http\Controllers\WomenRealEstate\CohortTimelineController;
use App\Http\Controllers\WomenRealEstate\HousingListingController;
use App\Http\Controllers\WomenRealEstate\ListingPartnershipIntentionController;
use App\Http\Controllers\WomenRealEstate\LearningPathController;
use App\Http\Controllers\WomenRealEstate\MortgageQuoteController;
use App\Http\Controllers\WomenRealEstate\RentalController;
use App\Http\Controllers\Wellbeing\WellbeingDashboardController;
use App\Http\Controllers\Women\MarketplaceController;
use App\Livewire\WomenRealEstate\Onboarding\JourneyHub;
use App\Models\CandidateExperience;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/system-monitor', \App\Livewire\SystemStatusMonitor::class)->name('system.monitor');
Route::get('/impact', \App\Http\Controllers\Frontend\ImpactDashboardController::class)->name('impact.index');
Route::get('/athena/social-ai', [HomeController::class, 'socialOverview'])->name('athena.social');

Route::get('/business-network', NetworkLandingController::class)->name('business.network');

Route::get('api/documentation', [ApiDocumentationController::class, 'index'])->name('api.documentation');

Route::get('feed', FrontendFeedController::class)->name('feed.index');

Route::get('wellness', [WellnessHubController::class, 'show'])->name('wellness.hub');

Route::prefix('health-fitness')->name('health-fitness.')->group(function () {
    Route::get('/', [\App\Http\Controllers\Frontend\HealthFitnessController::class, 'index'])->name('index');
    Route::get('insurance', [\App\Http\Controllers\Frontend\HealthFitnessController::class, 'insurance'])->name('insurance.index');
    Route::get('insurance/compare', [\App\Http\Controllers\Frontend\HealthFitnessController::class, 'compare'])->name('insurance.compare');
});

Route::view('policies/women-only', 'frontend.pages.women-only-policy')->name('policies.women-only');

Route::middleware(['auth', 'verified'])->get('wellbeing', [WellbeingDashboardController::class, 'index'])->name('wellbeing.dashboard');

Route::view('education/discovery', 'frontend.education.discovery')->name('education.discovery');

Route::get('apprenticeships', CompanyApprenticeshipController::class)->name('apprenticeships.index');

Route::middleware(['auth', 'verified'])
    ->prefix('telemetry')
    ->name('telemetry.')
    ->group(function () {
        Route::get('mobility-wellness', [TelemetryDashboardController::class, 'mobilityWellness'])->name('mobility-wellness');
    });

Route::middleware(['auth', 'verified'])
    ->get('impact/role-dashboards', RoleDashboardImpactController::class)
    ->name('impact.role-dashboards');

Route::middleware(['auth', 'verified'])->prefix('ai')->name('ai.')->group(function () {
    Route::get('/', [AiConciergeController::class, 'index'])->name('concierge');
    Route::post('concierge/respond', [AiConciergeController::class, 'respond'])
        ->middleware('throttle:ai-concierge')
        ->name('concierge.respond');
    Route::post('concierge/money-budget', [AiConciergeController::class, 'budgetAdvice'])
        ->middleware('throttle:ai-concierge')
        ->name('concierge.money-budget');
});

Route::prefix('grants')->name('grants.')->group(function () {
    Route::get('/', [GrantExperienceController::class, 'index'])->name('index');

    Route::middleware('auth')->group(function () {
        Route::post('presets', [GrantExperienceController::class, 'storePreset'])->name('presets.store');
        Route::patch('presets/{preset}', [GrantExperienceController::class, 'updatePreset'])->name('presets.update');
        Route::delete('presets/{preset}', [GrantExperienceController::class, 'destroyPreset'])->name('presets.destroy');
        Route::put('applications/{application}', [GrantExperienceController::class, 'updateApplication'])
            ->name('application.update');
        Route::get('{grant}/apply', [GrantExperienceController::class, 'apply'])->name('apply');
    });

    Route::get('{grant}', [GrantExperienceController::class, 'show'])->name('show');
});

Route::prefix('financial')->name('financial.')->group(function () {
    Route::get('budget', [FinancialWellnessController::class, 'budget'])->name('budget');
    Route::get('budgets/create', [FinancialWellnessController::class, 'createBudget'])->name('budgets.create');
    Route::get('debt', [FinancialWellnessController::class, 'debt'])->name('debt');
    Route::post('debt/calculate', [FinancialWellnessController::class, 'calculateDebt'])->name('debt.calculate');
    Route::get('transactions', [FinancialWellnessController::class, 'transactions'])->name('transactions');
    Route::get('money-inbox', [FinancialWellnessController::class, 'moneyInbox'])->name('money-inbox');
    Route::middleware('auth')->group(function () {
        Route::post('money-inbox/import-subscriptions', [FinancialWellnessController::class, 'importSubscriptions'])
            ->name('money-inbox.import');
        Route::get('money-inbox/import-status', [FinancialWellnessController::class, 'importSubscriptionStatus'])
            ->name('money-inbox.import-status');
        Route::get('budget/export/csv', [FinancialWellnessController::class, 'exportBudgetCsv'])->name('budget.export.csv');
        Route::get('budget/export/pdf', [FinancialWellnessController::class, 'exportBudgetPdf'])->name('budget.export.pdf');
        Route::post('budget/import', [FinancialWellnessController::class, 'importBudgetCsv'])->name('budget.import');
    });
});

Route::middleware(['auth', 'verified'])
    ->prefix('finance')
    ->name('finance.')
    ->group(function () {
        Route::get('equipment', [FinancialWellnessController::class, 'equipment'])->name('equipment');

        // New Tax & Logbook Routes
        Route::get('tax', [\App\Http\Controllers\Money\TaxController::class, 'index'])->name('tax.index');
        Route::post('assets', [\App\Http\Controllers\Money\TaxController::class, 'storeAsset'])->name('assets.store');
        Route::post('receipts', [\App\Http\Controllers\Money\TaxController::class, 'storeReceipt'])->name('receipts.store');
        Route::post('logbook', [\App\Http\Controllers\Money\TaxController::class, 'storeLogbook'])->name('logbook.store');
        Route::post('logbook/entry', [\App\Http\Controllers\Money\TaxController::class, 'storeLogbookEntry'])->name('logbook.entry.store');
        // TurboTax POC frontend page
        Route::get('turbotax', [\App\Http\Controllers\Money\TurboTaxController::class, 'index'])->name('turbotax.index');
    });

Route::middleware(['auth', 'verified', 'intent.access:intent:wealth_building|community_support,portal:financial_wellbeing'])
    ->prefix('money')
    ->name('money.')
    ->group(function () {
        Route::get('/', [BudgetDashboardController::class, 'index'])->name('dashboard');
        Route::get('inbox', [FinancialWellnessController::class, 'moneyInbox'])->name('inbox');

        // Bundle Concierge
        Route::get('concierge', [BundleConciergeController::class, 'index'])->name('concierge.index');
        Route::get('concierge/create', [BundleConciergeController::class, 'create'])->name('concierge.create');
        Route::post('concierge', [BundleConciergeController::class, 'store'])->name('concierge.store');
        Route::get('concierge/{offer}', [BundleConciergeController::class, 'show'])->name('concierge.show');
    });

Route::prefix('housing')->name('housing.')->group(function () {
    Route::get('/', [HousingExperienceController::class, 'index'])->name('index');
    Route::get('preferences', [HousingExperienceController::class, 'preferences'])->name('preferences');
    Route::post('preferences', [HousingExperienceController::class, 'storePreferences'])->name('preferences.store');
    Route::get('mortgage-tools', [HousingExperienceController::class, 'mortgage'])->name('mortgage-calculator');
    Route::post('mortgage-tools', [HousingExperienceController::class, 'calculateMortgage'])->name('mortgage-calc');
    Route::get('{listing}', [HousingExperienceController::class, 'show'])->name('show');
});

Route::middleware(['auth', 'verified'])
    ->prefix('social')
    ->name('social.feed.')
    ->group(function () {
        Route::get('feed', [FrontendSocialFeedController::class, '__invoke'])->name('index');
        Route::get('feed/explore', [FrontendSocialFeedController::class, 'explore'])->name('explore');
        Route::get('feed/search', [FrontendSocialFeedController::class, 'search'])->name('search');
        Route::get('feed/recommendations', [FrontendSocialFeedController::class, 'recommendations'])->name('recommendations');
        Route::get('feed-preview', FrontendSocialFeedController::class)->name('preview');
    });

Route::middleware('auth')->group(function () {
    // Dream job alert CRUD for authenticated users
    Route::prefix('dream-job-alerts')->name('dream_job_alerts.')->group(function () {
        Route::get('/', [\App\Http\Controllers\DreamJobAlertController::class, 'index'])->name('index');
        Route::post('/', [\App\Http\Controllers\DreamJobAlertController::class, 'store'])->name('store');
        Route::get('/{dreamJobAlert}', [\App\Http\Controllers\DreamJobAlertController::class, 'show'])->whereNumber('dreamJobAlert')->name('show');
        Route::patch('/{dreamJobAlert}', [\App\Http\Controllers\DreamJobAlertController::class, 'update'])->whereNumber('dreamJobAlert')->name('update');
        Route::delete('/{dreamJobAlert}', [\App\Http\Controllers\DreamJobAlertController::class, 'destroy'])->whereNumber('dreamJobAlert')->name('destroy');
    });

    // UI pages for Dream Job alerts
    Route::prefix('dream-job-alerts')->name('dream_job_alerts.ui.')->group(function () {
        Route::get('/ui', [\App\Http\Controllers\DreamJobAlertPageController::class, 'index'])->name('index');
        Route::get('/ui/create', [\App\Http\Controllers\DreamJobAlertPageController::class, 'create'])->name('create');
        Route::post('/ui', [\App\Http\Controllers\DreamJobAlertPageController::class, 'store'])->name('store');
        Route::get('/ui/{dreamJobAlert}/edit', [\App\Http\Controllers\DreamJobAlertPageController::class, 'edit'])->name('edit');
        Route::patch('/ui/{dreamJobAlert}', [\App\Http\Controllers\DreamJobAlertPageController::class, 'update'])->name('update');
        Route::delete('/ui/{dreamJobAlert}', [\App\Http\Controllers\DreamJobAlertPageController::class, 'destroy'])->name('destroy');
    });
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // MFA Routes
    Route::get('mfa/setup', [MFAController::class, 'showSetup'])->name('auth.mfa.setup');
    Route::post('mfa/setup', [MFAController::class, 'storeSetup'])->name('auth.mfa.setup.store');
    Route::get('mfa/backup-codes', [MFAController::class, 'showBackupCodes'])->name('auth.mfa.backup-codes');
    Route::get('mfa/challenge', [MFAController::class, 'showChallenge'])->name('auth.mfa.challenge');
    Route::post('mfa/challenge', [MFAController::class, 'verifyChallenge'])->name('auth.mfa.challenge.verify');
});

Route::middleware('auth')->group(function () {
    Route::get('/setup/primary-purpose', [PrimaryPurposeController::class, 'show'])->name('primary-purpose.show');
    Route::post('/setup/primary-purpose', [PrimaryPurposeController::class, 'store'])->name('primary-purpose.store');
    Route::post('/setup/primary-purpose/telemetry', [PrimaryPurposeController::class, 'telemetry'])->name('primary-purpose.telemetry');
});

Route::middleware('auth')->group(function () {
    Route::get('/setup/role-selection', [RoleSelectionController::class, 'show'])->name('role-selection.show');
    Route::post('/setup/role-selection', [RoleSelectionController::class, 'store'])->name('role-selection.store');
    Route::patch('/profile/roles', [RoleSelectionController::class, 'update'])->name('profile.roles.update');
});

Route::middleware(['auth', 'verified'])
    ->prefix('notifications')
    ->name('notifications.')
    ->group(function () {
        Route::get('/', [NotificationController::class, 'index'])->name('index');
        Route::post('{notification}/read', [NotificationController::class, 'markRead'])->name('read');
        Route::delete('{notification}', [NotificationController::class, 'destroy'])->name('destroy');
    });

Route::middleware('auth')
    ->prefix('account')
    ->name('account.')
    ->group(function () {
        Route::get('purpose', [PurposeSettingsController::class, 'edit'])->name('purpose.edit');
        Route::put('purpose', [PurposeSettingsController::class, 'update'])->name('purpose.update');

        Route::get('personas', [PersonaController::class, 'index'])->name('personas.index');
        Route::get('personas/active-context', [PersonaController::class, 'activeContext'])->name('personas.active-context');
        Route::post('personas', [PersonaController::class, 'store'])->name('personas.store');
        Route::put('personas/{profile}', [PersonaController::class, 'update'])->name('personas.update');
        Route::post('personas/{profile}/switch', [PersonaController::class, 'switchActive'])
            ->middleware('throttle:persona-switch')
            ->name('personas.switch');
        Route::patch('personas/{profile}/safety', [ProfileSafetyController::class, 'update'])->name('personas.safety.update');
        Route::get('personas/{profile}/verification', [ProfileVerificationController::class, 'show'])->name('personas.verification.show');
        Route::post('personas/{profile}/verification', [ProfileVerificationController::class, 'store'])->name('personas.verification.store');

        Route::get('sessions', [SessionSecurityController::class, 'index'])->name('sessions.index');
        Route::delete('sessions/{sessionExtended}', [SessionSecurityController::class, 'destroy'])->name('sessions.destroy');
    });


require __DIR__.'/auth.php';

Route::middleware(['auth', 'verified'])
    ->post('mission-briefs/{missionBrief}/ai-context', MissionBriefAiController::class)
    ->name('mission-briefs.ai-context');

Route::middleware(['auth', 'verified'])
    ->get('/dashboard', DashboardRouterController::class)
    ->name('dashboard');

Route::middleware(['auth', 'verified'])
    ->prefix('dashboards')
    ->name('dashboards.')
    ->group(function () {
        Route::get('role/{role?}', [RoleDashboardController::class, 'show'])
            ->name('role.show');
    });

Route::middleware(['auth', 'verified', 'user.role:member'])
    ->get('/member/dashboard', MemberDashboardController::class)
    ->name('member.dashboard');

Route::middleware(['auth', 'verified', 'user.role:member'])
    ->prefix('member')
    ->name('member.')
    ->group(function () {
        Route::get('/personal-dashboard', [\App\Http\Controllers\Member\MemberProfileController::class, 'index'])->name('personal.dashboard');
        Route::get('/profile/edit', [\App\Http\Controllers\Member\MemberProfileController::class, 'edit'])->name('profile.edit');
        Route::match(['put', 'post'], '/profile/update', [\App\Http\Controllers\Member\MemberProfileController::class, 'update'])->name('profile.update');
        Route::post('/media/upload', [\App\Http\Controllers\Member\MemberProfileController::class, 'uploadMedia'])->name('media.upload');
    });

Route::middleware(['auth', 'verified', 'user.role:member'])
    ->prefix('member/pathways')
    ->name('member.pathways.')
    ->group(function () {
        Route::get('/', [\App\Http\Controllers\Member\PathwayController::class, 'index'])->name('index');
        Route::get('/create', [\App\Http\Controllers\Member\PathwayController::class, 'create'])->name('create');
        Route::post('/', [\App\Http\Controllers\Member\PathwayController::class, 'store'])->name('store');
        Route::get('/{pathway}', [\App\Http\Controllers\Member\PathwayController::class, 'show'])->name('show');
    });

Route::middleware(['auth', 'verified'])
    ->get('/entertainment', function () {
        return view('entertainment.index');
    })
    ->name('entertainment.dashboard');

Route::middleware(['auth', 'verified'])
    ->get('/careers/wishlist', CareerWishlistController::class)
    ->name('careers.wishlist');

Route::middleware(['auth', 'verified'])
    ->prefix('civic')
    ->name('civic.')
    ->group(function () {
        Route::get('opportunities', CivicOpportunitiesController::class)->name('opportunities');
    });

Route::middleware(['auth', 'verified', 'intent.access:intent:wealth_building|community_support,portal:financial_wellbeing'])
    ->prefix('member/wellness')
    ->name('wellness.')
    ->group(function () {
        Route::get('/', [WellnessHubController::class, 'dashboard'])->name('dashboard');
    });

Route::middleware(['auth', 'verified', 'intent.access:portal:real_estate'])
    ->get('/real-estate', function (Request $request) {
        $user = $request->user();

        if ($user && ! $user->real_estate_onboarded_at) {
            return redirect()->route('women.real-estate.onboarding');
        }

        return redirect()->route('women.real-estate.dashboard');
    })
    ->name('real-estate.shortcut');

Route::middleware(['auth', 'verified', 'intent.access:portal:education'])
    ->prefix('education/tafe-university')
    ->name('education.tafe.')
    ->group(function () {
        Route::get('/', TafeDashboardController::class)->name('dashboard');
        Route::post('profile', [TafeProfileController::class, 'store'])->name('profile.store');
        Route::get('programs', [TafeProgramController::class, 'index'])->name('programs.index');
        Route::get('programs/{program:slug}', [TafeProgramController::class, 'show'])->name('programs.show');
        Route::post('programs/{program:slug}/journeys', [TafeProgramJourneyController::class, 'store'])
            ->name('programs.journeys.store');
        Route::get('institutions/{institution:slug}', [TafeInstitutionController::class, 'show'])->name('institutions.show');
    });

Route::middleware(['auth', 'verified', 'intent.access:intent:launch_business|policy_impact|community_support,portal:business'])
    ->prefix('business')
    ->name('business.')
    ->group(function () {
        Route::get('/', static fn () => redirect()->route('business.dashboard'))
            ->name('index');
        Route::get('dashboard', BusinessDashboardController::class)->name('dashboard');
        Route::get('accounts', BusinessAccountingDashboardController::class)->name('accounts');
        Route::get('formation-studio', FormationStudioController::class)->name('formation-studio');
        Route::get('legal-document-lab', LegalDocumentLabController::class)->name('legal-document-lab');
        Route::get('templates', [TemplateDownloadController::class, 'index'])->name('templates.index');
        Route::get('templates/{slug}', [TemplateDownloadController::class, 'download'])->name('templates.download');
        Route::get('legal-documents/{legalDocument}/{format}', LegalDocumentDownloadController::class)
            ->whereIn('format', ['pdf', 'docx'])
            ->name('legal-documents.download');
        Route::post('updates', [BusinessPostController::class, 'store'])->name('updates.store');
    });

Route::middleware(['auth', 'verified', 'intent.access:intent:policy_impact,portal:public_sector'])
    ->prefix('public-sector')
    ->name('public-sector.')
    ->group(function () {
        Route::get('/', PublicSectorDashboardController::class)->name('dashboard');
        Route::get('pipeline', ProcurementPipelineController::class)->name('pipeline');
        Route::get('opportunities', [PublicSectorOpportunityController::class, 'index'])->name('opportunities.index');
        Route::get('opportunities/{opportunity:slug}', [PublicSectorOpportunityController::class, 'show'])->name('opportunities.show');
        Route::post('opportunities/{opportunity:slug}/interest', [PublicSectorOpportunityEngagementController::class, 'store'])
            ->name('opportunities.interest.store');
        Route::post('agencies/{agency:slug}/follow', PublicSectorAgencyFollowController::class)
            ->name('agencies.follow');

        // Agency Dashboard Routes
        Route::prefix('agency')->name('agency.')->group(function () {
            Route::get('/', [AgencyDashboardController::class, 'index'])->name('dashboard');
            Route::get('create', [AgencyDashboardController::class, 'create'])->name('create');
            Route::post('/', [AgencyDashboardController::class, 'store'])->name('store');
            Route::get('opportunities/create', [AgencyDashboardController::class, 'createOpportunity'])->name('opportunities.create');
            Route::post('opportunities', [AgencyDashboardController::class, 'storeOpportunity'])->name('opportunities.store');
            Route::get('programs/create', [AgencyDashboardController::class, 'createProgram'])->name('programs.create');
            Route::post('programs', [AgencyDashboardController::class, 'storeProgram'])->name('programs.store');
        });
    });

Route::middleware(['auth', 'verified', 'intent.access:portal:real_estate'])
    ->prefix('women/real-estate')
    ->name('women.real-estate.')
    ->group(function () {
        Route::get('onboarding', JourneyHub::class)->name('onboarding');

        Route::middleware('real-estate.onboarded')->group(function () {
            Route::get('/', [HousingListingController::class, 'index'])->name('dashboard');
            Route::get('timeline', CohortTimelineController::class)->name('timeline');
            Route::get('agents/profile', [AgentProfileController::class, 'edit'])->name('agents.profile.edit');
            Route::put('agents/profile', [AgentProfileController::class, 'update'])->name('agents.profile.update');
            Route::get('agents/pulse', AgentPulseController::class)->name('agents.pulse');

            Route::get('listings/index', static fn () => redirect()->route('women.real-estate.listings.index'));

            Route::resource('listings', HousingListingController::class);

            Route::post('listings/{listing}/partnership-intentions', [ListingPartnershipIntentionController::class, 'store'])
                ->name('listings.partnership-intentions.store');
            Route::delete('listings/{listing}/partnership-intentions/{intention}', [ListingPartnershipIntentionController::class, 'destroy'])
                ->name('listings.partnership-intentions.destroy');
            Route::post('listings/{listing}/mortgage-quotes', [MortgageQuoteController::class, 'store'])
                ->name('listings.mortgage-quotes.store');

            // ===== RENTAL LISTINGS ROUTES =====
            Route::get('rentals', [RentalController::class, 'index'])
                ->name('rentals.index');
            Route::get('rentals/{id}', static fn () => view('women.real-estate.rentals.show'))
                ->name('rental-details');

            // ===== HOUSEHUNTER ROUTES =====
            Route::get('househunter/profile', [RentalController::class, 'seekerProfile'])
                ->name('househunter-profile');
            Route::get('househunter/matches', [RentalController::class, 'matches'])
                ->name('househunter-matches');

            // ===== SOCIAL NETWORK ROUTES =====
            Route::get('network/connections', [RentalController::class, 'connections'])
                ->name('network.connections');
        });
    });

Route::middleware(['auth', 'verified', 'intent.access:portal:education'])
    ->prefix('women/learn')
    ->name('women.learn.')
    ->group(function () {
        Route::get('/', [LearningPathController::class, 'index'])->name('index');
        Route::post('{path:slug}/enrol', [LearningPathController::class, 'enrol'])->name('enrol');
        Route::patch('{path:slug}/progress', [LearningPathController::class, 'update'])->name('update');
        Route::delete('{path:slug}/enrol', [LearningPathController::class, 'withdraw'])->name('withdraw');
    });

Route::middleware(['auth', 'verified'])
    ->prefix('women/marketplace')
    ->name('women.marketplace.')
    ->group(function () {
        Route::get('/', MarketplaceController::class)->name('index');
        Route::post('listings/{serviceListing:slug}/lead', [MarketplaceController::class, 'storeLead'])
            ->middleware('throttle:lead-submissions')
            ->name('leads.store');
        Route::post('listings/{serviceListing:slug}/ask', [MarketplaceController::class, 'shareWithAthena'])
            ->middleware('throttle:ai-concierge')
            ->name('ask');
        Route::post('sponsors/redirect', [MarketplaceController::class, 'sponsorRedirect'])
            ->name('sponsor.redirect');
    });

Route::group(['prefix' => 'automotive', 'as' => 'automotive.'], function () {
    Route::view('/mobility-suite', 'frontend.pages.automotive-mobility-info')->name('mobility-suite');
    Route::get('/', [\App\Http\Controllers\Automotive\VehicleMarketplaceController::class, 'index'])->name('index');
    Route::match(['get', 'post'], '/guide', [\App\Http\Controllers\Automotive\VehicleMarketplaceController::class, 'guide'])->name('guide');
    Route::get('/compare', [\App\Http\Controllers\Automotive\VehicleMarketplaceController::class, 'compare'])->name('compare');
    Route::get('/{listing}', [\App\Http\Controllers\Automotive\VehicleMarketplaceController::class, 'show'])->name('show');

    // Finance & Insurance
    Route::get('/{listing}/finance', [\App\Http\Controllers\Automotive\AutomotiveFinanceController::class, 'showFinanceForm'])->name('finance.apply');
    Route::post('/{listing}/finance', [\App\Http\Controllers\Automotive\AutomotiveFinanceController::class, 'submitFinanceApplication'])->name('finance.store');
    Route::get('/finance/success/{application}', [\App\Http\Controllers\Automotive\AutomotiveFinanceController::class, 'financeSuccess'])->name('finance.success');

    Route::get('/{listing}/insurance', [\App\Http\Controllers\Automotive\AutomotiveFinanceController::class, 'showInsuranceForm'])->name('insurance.quote');
    Route::post('/{listing}/insurance', [\App\Http\Controllers\Automotive\AutomotiveFinanceController::class, 'submitInsuranceQuote'])->name('insurance.store');
    Route::get('/insurance/results/{quote}', [\App\Http\Controllers\Automotive\AutomotiveFinanceController::class, 'insuranceResults'])->name('insurance.results');
});

Route::group(['prefix' => 'admin/automotive', 'as' => 'admin.automotive.', 'middleware' => ['auth', 'verified']], function () {
    Route::get('/', [\App\Http\Controllers\Admin\AdminAutomotiveController::class, 'index'])->name('dashboard');
    Route::get('/dealers', [\App\Http\Controllers\Admin\AdminAutomotiveController::class, 'dealers'])->name('dealers');
    Route::post('/dealers/{dealer}/verify', [\App\Http\Controllers\Admin\AdminAutomotiveController::class, 'verifyDealer'])->name('dealers.verify');
    Route::post('/dealers/{dealer}/approve', [\App\Http\Controllers\Admin\AdminAutomotiveController::class, 'approveDealer'])->name('dealers.approve');
});

Route::get('get-state/{country_id}', [LocationController::class, 'getStates'])->name('get-states');
Route::get('get-cities/{state_id}', [LocationController::class, 'getCities'])->name('get-cities');

Route::get('companies', [FrontendCompanyPageController::class, 'index'])->name('companies.index');
Route::get('companies/compare', [FrontendCompanyPageController::class, 'compare'])->name('companies.compare');
Route::get('companies/{slug}', [FrontendCompanyPageController::class, 'show'])->name('companies.show');

Route::get('organizations/{slug}', [FrontOrganizationPageController::class, 'show'])->name('organizations.show');
Route::post('organizations/{slug}/lead', [OrganizationLeadController::class, 'store'])
    ->middleware(['throttle:lead-submissions'])
    ->name('organizations.lead');
Route::get('organizations/{slug}/courses', [OrgCourseController::class, 'index'])->name('organizations.courses.index');
Route::get('organizations/{slug}/courses/{course:slug}', [OrgCourseController::class, 'show'])->name('organizations.courses.show');
Route::get('organizations/media/{media}/stream/{file?}', [OrgMediaStreamController::class, 'stream'])
    ->where('file', '.*')
    ->name('organizations.media.stream');

// Canonical public paths have moved to /members — keep /candidates as a safe public redirect
Route::redirect('/candidates', '/members', 301);
Route::redirect('/candidates/{slug}', '/members/{slug}', 301)->where('slug', '.*');

// Keep legacy named routes in place for backward compatibility (internal/admin use)
Route::get('candidates', [FrontendCandidatePageController::class, 'index'])->name('candidates.index');
Route::get('candidates/{slug}', [FrontendCandidatePageController::class, 'show'])->name('candidates.show');

// Member-friendly aliases for the public talent directory (UI-only route names/paths)
Route::get('members', [FrontendCandidatePageController::class, 'index'])->name('members.index');
Route::get('members/{slug}', [FrontendCandidatePageController::class, 'show'])->name('members.show');

Route::get('pricing', PricingPageController::class)->name('pricing.index');
Route::get('checkout/{plan_id}', CheckoutPageController::class)->name('checkout.index');

/** Find a job route */
Route::get('jobs', [FrontendJobPageController::class, 'index'])->name('jobs.index');
Route::get('jobs/{slug}', [FrontendJobPageController::class, 'show'])->name('jobs.show');
Route::post('apply-job/{id}', [FrontendJobPageController::class, 'applyJob'])->name('apply-job.store');
Route::get('job-bookmark/{id}', [CandidateJobBookmarkController::class, 'save'])->name('job.bookmark');

/** About Routes */
Route::get('about-us', [AboutUsPageController::class, 'index'])->name('about.index');

/** Count Routes */
Route::get('contact', [ContactController::class, 'index'])->name('contact.index');
Route::post('contact', [ContactController::class, 'sendMail'])->name('send-mail');

/** Trust & Safety Route */
Route::view('trust-and-safety', 'frontend.pages.trust-safety')->name('trust-safety.index');

/** Resources Routes */
Route::view('resources/guides', 'frontend.pages.guides')->name('resources.guides.index');
Route::view('resources/research', 'frontend.pages.research')->name('resources.research.index');
Route::view('resources/blog', 'frontend.pages.blog')->name('resources.blog.index');
Route::view('resources/help-center', 'frontend.pages.help-center')->name('resources.help-center.index');

/** Platform Routes */
Route::view('platform/how-it-works', 'frontend.pages.how-it-works')->name('platform.how-it-works.index');
Route::view('platform/modules', 'frontend.pages.modules')->name('platform.modules.index');
Route::view('platform/impact', 'frontend.pages.impact-index')->name('platform.impact.index');

/** Athena Social Marketing Routes */
Route::view('social/lounge', 'frontend.pages.social-lounge')->name('social.lounge.index');
Route::view('social/feed-info', 'frontend.pages.social-feed-info')->name('social.feed-info.index');
Route::view('social/groups-info', 'frontend.pages.social-groups-info')->name('social.groups-info.index');
Route::view('social/mentorship-info', 'frontend.pages.social-mentorship-info')->name('social.mentorship-info.index');

/** Athena AI Marketing Routes */
Route::view('ai/concierge-info', 'frontend.pages.ai-concierge-info')->name('ai.concierge.info');
Route::view('ai/resume-parser-info', 'frontend.pages.ai-resume-parser-info')->name('ai.resume-parser.info');
Route::view('ai/career-insights-info', 'frontend.pages.ai-career-insights-info')->name('ai.career-insights.info');
Route::view('ai/job-match-info', 'frontend.pages.ai-job-match-info')->name('ai.job-match.info');

/** Custom Page Routes */
Route::get('page/{slug}', [HomeController::class, 'customPage'])->name('custom-page');

/** Newsletter Routes */
Route::post('newsletter', [NewsletterController::class, 'store'])->name('newsletter.store');

/** Advanced Search Routes */
Route::prefix('search')->name('search.')->group(function () {
    Route::get('advanced', [AdvancedSearchController::class, 'index'])->name('advanced');
    Route::match(['get', 'post'], 'advanced/results', [AdvancedSearchController::class, 'search'])->name('advanced.results');
    Route::get('advanced/facets', [AdvancedSearchController::class, 'getFacets'])->name('advanced.facets');
    Route::get('advanced/autocomplete', [AdvancedSearchController::class, 'autocomplete'])->name('advanced.autocomplete');
    Route::get('advanced/popular', [AdvancedSearchController::class, 'getPopularSearches'])->name('advanced.popular');

    Route::middleware(['auth', 'verified'])->group(function () {
        Route::get('advanced/saved', [AdvancedSearchController::class, 'getSavedSearches'])->name('advanced.saved');
        Route::post('advanced/save', [AdvancedSearchController::class, 'saveSearch'])->name('advanced.save');
        Route::delete('advanced/saved/{id}', [AdvancedSearchController::class, 'deleteSavedSearch'])->name('advanced.saved.delete');
        Route::get('advanced/history', [AdvancedSearchController::class, 'getSearchHistory'])->name('advanced.history');
        Route::delete('advanced/history', [AdvancedSearchController::class, 'clearHistory'])->name('advanced.history.clear');
    });
});

/** Candidate Dashboard Routes */
// Redirect legacy /candidate URLs to the new /member URLs (GET requests only).
// These are safe, non-breaking redirects for public/shared links. Forms and
// non-GET endpoints remain served from the original candidate group until
// we remove it later.
Route::redirect('/candidate', '/member', 301);
Route::redirect('/candidate/{path}', '/member/{path}', 301)->where('path', '.*');
Route::group(
    [
        'middleware' => ['auth', 'verified', 'intent.access:intent:career_growth', 'user.role:member', 'session.security', 'security.dlp', 'route.security:candidate'],
        'prefix' => 'candidate',
        'as' => 'candidate.'
    ],
    function() {

    // Route::get('/dashboard', [CandidateDashboardController::class, 'index'])->name('dashboard');
    Route::get('/dashboard', [CandidateDashboardController::class, 'index'])->name('dashboard');
    Route::get('/onboarding', CandidateOnboardingController::class)->name('onboarding.index');
    Route::get('/profile', [CandidateProfileController::class, 'index'])->name('profile.index');
    Route::post('/profile/basic-info-update', [CandidateProfileController::class, 'basicInfoUpdate'])->name('profile.basic-info.update');
    Route::post('/profile/profile-info-update', [CandidateProfileController::class, 'profileInfoUpdate'])->name('profile.profile-info.update');

    Route::resource('experience', CandidateExperienceController::class);
    Route::resource('education', CandidateEductionController::class);

    Route::post('/profile/account-info-update', [CandidateProfileController::class, 'AccountInfoUpdate'])->name('profile.account-info.update');
    Route::post('/profile/account-email-update', [CandidateProfileController::class, 'AccountEmailUpdate'])->name('profile.account-email.update');
    Route::post('/profile/account-password-update', [CandidateProfileController::class, 'AccountPasswordUpdate'])->name('profile.account-password.update');

    /** my job routes */
    Route::get('applied-jobs', [CandidateMyJobController::class, 'index'])->name('applied-jobs.index');
    Route::get('bookmarked-jobs', [CandidateJobBookmarkController::class, 'index'])->name('bookmarked-jobs.index');

    Route::get('job-recommendations', [JobMatchController::class, 'index'])->name('job-recommendations');
    Route::get('career-insights', [CandidateCareerInsightsController::class, 'index'])->name('career-insights.index');

    Route::prefix('job-alerts')
        ->name('job-alerts.')
        ->controller(CandidateJobAlertController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('create', 'create')->name('create');
            Route::post('/', 'store')->name('store');
            Route::get('{jobAlert}/edit', 'edit')->name('edit');
            Route::put('{jobAlert}', 'update')->name('update');
            Route::delete('{jobAlert}', 'destroy')->name('destroy');
            Route::patch('{jobAlert}/toggle', 'toggle')->name('toggle');
        });

    Route::prefix('gamification')
        ->name('gamification.')
        ->controller(GamificationController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('leaderboard', 'leaderboard')->name('leaderboard');
            Route::get('achievements', 'achievements')->name('achievements');
            Route::get('challenges', 'challenges')->name('challenges');
            Route::post('challenges/{challenge}/join', 'joinChallenge')->name('challenges.join');
            Route::patch('badges/{badge}/toggle-showcase', 'toggleBadgeShowcase')->name('badges.toggle-showcase');
        });

    Route::prefix('skill-gap')
        ->name('skill-gap.')
        ->controller(SkillGapController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('analyze', 'analyze')->name('analyze');
            Route::get('learning-paths', 'learningPaths')->name('learning-paths');
            Route::get('skills/{skill}/resources', 'resources')->name('resources');
            Route::post('resources/{resource}/start', 'startLearning')->name('resources.start');
            Route::patch('progress/{progress}', 'updateProgress')->name('progress.update');
            Route::post('progress/{progress}/complete', 'completeResource')->name('progress.complete');
            Route::post('progress/{progress}/rate', 'rateResource')->name('progress.rate');
            Route::get('progress', 'progress')->name('progress');
        });

    Route::prefix('resume-parser')
        ->name('resume-parser.')
        ->group(function () {
            Route::get('/', [ResumeParserController::class, 'index'])->name('index');
            Route::post('upload', [ResumeParserController::class, 'upload'])->name('upload');
            Route::get('preview', [ResumeParserController::class, 'preview'])->name('preview');
        });

    Route::prefix('cv-builder')
        ->name('cv-builder.')
        ->controller(CandidateCvBuilderController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('create', 'create')->name('create');
            Route::post('/', 'store')->name('store');
            Route::get('{cv:slug}/edit', 'edit')->name('edit');
            Route::put('{cv:slug}', 'update')->name('update');
            Route::delete('{cv:slug}', 'destroy')->name('destroy');
            Route::post('{cv:slug}/toggle-visibility', 'toggleVisibility')->name('toggle-visibility');
            Route::post('{cv:slug}/create-version', 'createVersion')->name('create-version');
            Route::get('{cv:slug}/preview', 'preview')->name('preview');
            Route::get('{cv:slug}/download', 'download')->name('download');
        });

    Route::prefix('social')
        ->name('social.')
        ->group(function () {
            Route::get('feed', [FrontendSocialPostController::class, 'index'])->name('feed');

            Route::get('connections', [CandidateConnectionsController::class, 'index'])->name('connections');
            Route::get('connections/create', [CandidateConnectionsController::class, 'create'])->name('connections.create');
            Route::post('connections', [CandidateConnectionsController::class, 'store'])->name('connections.store');
            Route::get('connections/search', [CandidateConnectionsController::class, 'search'])->name('connections.search');
            Route::get('connections/discover', [CandidateConnectionsController::class, 'discover'])->name('connections.discover');
            Route::get('connections/spotlight', [CandidateConnectionsController::class, 'spotlight'])->name('connections.spotlight');
            Route::get('connections/explore', [CandidateConnectionsController::class, 'explore'])->name('connections.explore');
            Route::delete('connections/{connection}', [CandidateConnectionsController::class, 'destroy'])->name('connections.destroy');

            Route::get('groups', [CandidateGroupsController::class, 'index'])->name('groups');
            Route::get('groups/create', [CandidateGroupsController::class, 'create'])->name('groups.create');
            Route::post('groups', [CandidateGroupsController::class, 'store'])->name('groups.store');
            Route::get('groups/ai-recommendations', [CandidateGroupsController::class, 'aiRecommendations'])->name('groups.ai-recommendations');
            Route::post('groups/{group}/join', [CandidateGroupsController::class, 'join'])->name('groups.join');
            Route::post('groups/{group}/leave', [CandidateGroupsController::class, 'leave'])->name('groups.leave');
            Route::get('groups/{group}/edit', [CandidateGroupsController::class, 'edit'])->name('groups.edit');
            Route::put('groups/{group}', [CandidateGroupsController::class, 'update'])->name('groups.update');
            Route::get('groups/{group}', [CandidateGroupsController::class, 'show'])->name('groups.show');
        });
});

/** Member Dashboard Routes (new canonical route names/paths) */
Route::group(
    [
        'middleware' => ['auth', 'verified', 'intent.access:intent:career_growth', 'user.role:member', 'session.security', 'security.dlp', 'route.security:member'],
        'prefix' => 'member',
        'as' => 'member.'
    ],
    function() {

    Route::get('/dashboard', [CandidateDashboardController::class, 'index'])->name('dashboard');
    Route::get('/onboarding', CandidateOnboardingController::class)->name('onboarding.index');
    Route::get('/profile', [CandidateProfileController::class, 'index'])->name('profile.index');
    Route::post('/profile/basic-info-update', [CandidateProfileController::class, 'basicInfoUpdate'])->name('profile.basic-info.update');
    Route::post('/profile/profile-info-update', [CandidateProfileController::class, 'profileInfoUpdate'])->name('profile.profile-info.update');

    Route::resource('experience', CandidateExperienceController::class);
    Route::resource('education', CandidateEductionController::class);

    Route::post('/profile/account-info-update', [CandidateProfileController::class, 'AccountInfoUpdate'])->name('profile.account-info.update');
    Route::post('/profile/account-email-update', [CandidateProfileController::class, 'AccountEmailUpdate'])->name('profile.account-email.update');
    Route::post('/profile/account-password-update', [CandidateProfileController::class, 'AccountPasswordUpdate'])->name('profile.account-password.update');

    /** my job routes */
    Route::get('applied-jobs', [CandidateMyJobController::class, 'index'])->name('applied-jobs.index');
    Route::get('bookmarked-jobs', [CandidateJobBookmarkController::class, 'index'])->name('bookmarked-jobs.index');

    Route::get('job-recommendations', [JobMatchController::class, 'index'])->name('job-recommendations');
    Route::get('career-insights', [CandidateCareerInsightsController::class, 'index'])->name('career-insights.index');

    Route::prefix('job-alerts')
        ->name('job-alerts.')
        ->controller(CandidateJobAlertController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('create', 'create')->name('create');
            Route::post('/', 'store')->name('store');
            Route::get('{jobAlert}/edit', 'edit')->name('edit');
            Route::put('{jobAlert}', 'update')->name('update');
            Route::delete('{jobAlert}', 'destroy')->name('destroy');
            Route::patch('{jobAlert}/toggle', 'toggle')->name('toggle');
        });

    Route::prefix('gamification')
        ->name('gamification.')
        ->controller(GamificationController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('leaderboard', 'leaderboard')->name('leaderboard');
            Route::get('achievements', 'achievements')->name('achievements');
            Route::get('challenges', 'challenges')->name('challenges');
            Route::post('challenges/{challenge}/join', 'joinChallenge')->name('challenges.join');
            Route::patch('badges/{badge}/toggle-showcase', 'toggleBadgeShowcase')->name('badges.toggle-showcase');
        });

    Route::prefix('skill-gap')
        ->name('skill-gap.')
        ->controller(SkillGapController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::post('analyze', 'analyze')->name('analyze');
            Route::get('learning-paths', 'learningPaths')->name('learning-paths');
            Route::get('skills/{skill}/resources', 'resources')->name('resources');
            Route::post('resources/{resource}/start', 'startLearning')->name('resources.start');
            Route::patch('progress/{progress}', 'updateProgress')->name('progress.update');
            Route::post('progress/{progress}/complete', 'completeResource')->name('progress.complete');
            Route::post('progress/{progress}/rate', 'rateResource')->name('progress.rate');
            Route::get('progress', 'progress')->name('progress');
        });

    Route::prefix('resume-parser')
        ->name('resume-parser.')
        ->group(function () {
            Route::get('/', [ResumeParserController::class, 'index'])->name('index');
            Route::post('upload', [ResumeParserController::class, 'upload'])->name('upload');
            Route::get('preview', [ResumeParserController::class, 'preview'])->name('preview');
        });

    Route::prefix('cv-builder')
        ->name('cv-builder.')
        ->controller(CandidateCvBuilderController::class)
        ->group(function () {
            Route::get('/', 'index')->name('index');
            Route::get('create', 'create')->name('create');
            Route::post('/', 'store')->name('store');
            Route::get('{cv:slug}/edit', 'edit')->name('edit');
            Route::put('{cv:slug}', 'update')->name('update');
            Route::delete('{cv:slug}', 'destroy')->name('destroy');
            Route::post('{cv:slug}/toggle-visibility', 'toggleVisibility')->name('toggle-visibility');
            Route::post('{cv:slug}/create-version', 'createVersion')->name('create-version');
            Route::get('{cv:slug}/preview', 'preview')->name('preview');
            Route::get('{cv:slug}/download', 'download')->name('download');
        });

    Route::prefix('social')
        ->name('social.')
        ->group(function () {
            Route::get('feed', [FrontendSocialPostController::class, 'index'])->name('feed');

            Route::get('connections', [CandidateConnectionsController::class, 'index'])->name('connections');
            Route::get('connections/create', [CandidateConnectionsController::class, 'create'])->name('connections.create');
            Route::post('connections', [CandidateConnectionsController::class, 'store'])->name('connections.store');
            Route::get('connections/search', [CandidateConnectionsController::class, 'search'])->name('connections.search');
            Route::get('connections/discover', [CandidateConnectionsController::class, 'discover'])->name('connections.discover');
            Route::get('connections/spotlight', [CandidateConnectionsController::class, 'spotlight'])->name('connections.spotlight');
            Route::get('connections/explore', [CandidateConnectionsController::class, 'explore'])->name('connections.explore');
            Route::delete('connections/{connection}', [CandidateConnectionsController::class, 'destroy'])->name('connections.destroy');

            Route::get('groups', [CandidateGroupsController::class, 'index'])->name('groups');
            Route::get('groups/create', [CandidateGroupsController::class, 'create'])->name('groups.create');
            Route::post('groups', [CandidateGroupsController::class, 'store'])->name('groups.store');
            Route::get('groups/ai-recommendations', [CandidateGroupsController::class, 'aiRecommendations'])->name('groups.ai-recommendations');
            Route::post('groups/{group}/join', [CandidateGroupsController::class, 'join'])->name('groups.join');
            Route::post('groups/{group}/leave', [CandidateGroupsController::class, 'leave'])->name('groups.leave');
            Route::get('groups/{group}/edit', [CandidateGroupsController::class, 'edit'])->name('groups.edit');
            Route::put('groups/{group}', [CandidateGroupsController::class, 'update'])->name('groups.update');
            Route::get('groups/{group}', [CandidateGroupsController::class, 'show'])->name('groups.show');
        });
});

Route::get('job-alerts/{jobAlert}/unsubscribe', [CandidateJobAlertController::class, 'unsubscribe'])
    ->name('job-alerts.unsubscribe');

Route::post('job-alerts/track-click', [CandidateJobAlertController::class, 'trackClick'])
    ->name('job-alerts.track-click');

Route::middleware(['auth', 'verified'])
    ->prefix('social')
    ->name('social.')
    ->group(function () {
        Route::get('posts', [FrontendSocialPostController::class, 'index'])->name('posts.index');
        Route::post('posts', [FrontendSocialPostController::class, 'store'])->name('posts.store');
        Route::delete('posts/{post}', [FrontendSocialPostController::class, 'destroy'])->name('posts.destroy');
        Route::post('posts/{post}/like', [FrontendSocialPostController::class, 'like'])->name('posts.like');
        Route::post('posts/{post}/save', [FrontendSocialPostController::class, 'save'])->name('posts.save');
        Route::post('posts/{post}/share', [FrontendSocialPostController::class, 'share'])->name('posts.share');
        Route::post('posts/{post}/repost', [FrontendSocialPostController::class, 'repost'])->name('posts.repost');
        Route::post('posts/{post}/comments', [FrontendSocialPostController::class, 'comment'])->name('posts.comment');
        Route::get('posts/{post}/comments', [FrontendSocialPostController::class, 'commentsIndex'])->name('posts.comments.index');
        Route::get('posts/{post}/comments/{comment}/replies', [FrontendSocialPostController::class, 'replies'])->name('posts.comments.replies');
        Route::get('posts/load-more', [FrontendSocialPostController::class, 'loadMore'])->name('posts.load-more');
        Route::get('posts/{post}', [FrontendSocialPostController::class, 'show'])->name('posts.show');
        Route::get('posts/{post}/preview', [FrontendSocialPostController::class, 'preview'])->name('posts.preview');
        Route::post('posts/{post}/comments/{comment}/like', [FrontendSocialPostController::class, 'likeComment'])->name('posts.comments.like');

        Route::prefix('ai')->name('ai.')->middleware('throttle:social-ai')->group(function () {
            Route::post('caption', [FrontendSocialAiAssistController::class, 'caption'])->name('caption');
            Route::post('tags', [FrontendSocialAiAssistController::class, 'tags'])->name('tags');
            Route::post('moderate', [FrontendSocialAiAssistController::class, 'moderate'])->name('moderate');

            // Extended AI features
            Route::post('poll/suggestions', [FrontendSocialAiAssistExtendedController::class, 'pollSuggestions'])->name('poll.suggestions');
            Route::post('live/talking-points', [FrontendSocialAiAssistExtendedController::class, 'liveStreamTalkingPoints'])->name('live.talking-points');
            Route::post('live/follow-up', [FrontendSocialAiAssistExtendedController::class, 'liveStreamFollowUp'])->name('live.follow-up');
            Route::post('poll/analyze', [FrontendSocialAiAssistExtendedController::class, 'analyzePollResults'])->name('poll.analyze');
            Route::post('video/captions', [FrontendSocialAiAssistExtendedController::class, 'generateVideoCaptions'])->name('video.captions');
            Route::get('mentor/recommendations', [FrontendSocialAiAssistExtendedController::class, 'mentorRecommendations'])->name('mentor.recommendations');
            Route::get('health', [FrontendSocialAiAssistExtendedController::class, 'healthCheck'])->name('health');
        });

        Route::prefix('profiles')->name('profiles.')->group(function () {
            Route::get('{username}', [FrontendSocialProfileController::class, 'show'])->name('show');
            Route::get('{username}/edit', [FrontendSocialProfileController::class, 'edit'])->name('edit');
            Route::put('{username}', [FrontendSocialProfileController::class, 'update'])->name('update');
            Route::post('{username}/avatar', [FrontendSocialProfileController::class, 'uploadAvatar'])->name('avatar');
            Route::post('{username}/cover', [FrontendSocialProfileController::class, 'uploadCover'])->name('cover');
            Route::post('{username}/follow', [FrontendSocialFollowController::class, 'store'])->name('follow');
            Route::delete('{username}/follow', [FrontendSocialFollowController::class, 'destroy'])->name('unfollow');
            Route::post('{username}/follow/toggle', [FrontendSocialFollowController::class, 'toggle'])->name('follow.toggle');
            Route::get('{username}/followers', [FrontendSocialProfileController::class, 'followers'])->name('followers');
            Route::get('{username}/following', [FrontendSocialProfileController::class, 'following'])->name('following');
            Route::get('{username}/verification', [FrontendSocialProfileVerificationController::class, 'show'])->name('verification.show');
            Route::post('{username}/verification', [FrontendSocialProfileVerificationController::class, 'store'])->name('verification.store');
        });

        Route::prefix('notifications')->name('notifications.')->group(function () {
            Route::get('preferences', [NotificationPreferenceController::class, 'show'])->name('preferences.show');
            Route::put('preferences', [NotificationPreferenceController::class, 'update'])->name('preferences.update');
        });
    });

$mentorRoleNames = array_filter(config('social.moderation.mentor_roles', []));
$mentorRoleMiddleware = $mentorRoleNames ? 'role:'.implode('|', $mentorRoleNames) : null;

Route::middleware(array_values(array_filter([
    'auth',
    'verified',
    $mentorRoleMiddleware,
])))
    ->prefix('mentor')
    ->name('mentor.')
    ->group(function () {
        Route::get('moderation', [MentorModerationController::class, 'index'])->name('moderation.dashboard');
    });

Route::get('cv/share/{token}', [CandidateCvBuilderController::class, 'share'])->name('cv.share');

/** Company Routes */
Route::group(
    [
        'middleware' => ['auth', 'verified', 'user.role:company', 'session.security', 'security.dlp', 'route.security:company'],
        'prefix' => 'company',
        'as' => 'company.'
    ],
    function() {
    /** dashboard */
    Route::get('/dashboard', [CompanyDashboardController::class, 'index'])->name('dashboard');

    /** Company Profile Routes */
    Route::get('/profile', [CompanyProfileController::class, 'index'])->name('profile');
    Route::post('/profile/company-info', [CompanyProfileController::class, 'updateCompanyInfo'])->name('profile.company-info');
    Route::post('/profile/founding-info', [CompanyProfileController::class, 'updateFoundingInfo'])->name('profile.founding-info');
    Route::post('/profile/account-info', [CompanyProfileController::class, 'updateAccountInfo'])->name('profile.account-info');
    Route::post('/profile/password-update', [CompanyProfileController::class, 'updatePassword'])->name('profile.password-update');

    /** Order Routes */
    Route::get('orders', [CompanyOrderController::class, 'index'])->name('orders.index');
    Route::get('orders/{id}', [CompanyOrderController::class, 'show'])->name('orders.show');
    Route::get('orders/invoice/{id}', [CompanyOrderController::class, 'invoice'])->name('orders.invoice');

    Route::prefix('leads')->name('leads.')->group(function () {
        Route::get('/', [CompanyLeadController::class, 'index'])->name('index');
        Route::get('{lead}', [CompanyLeadController::class, 'show'])->name('show');
        Route::patch('{lead}', [CompanyLeadController::class, 'update'])->name('update');
        Route::post('{lead}/notes', [CompanyLeadController::class, 'storeNote'])->name('notes.store');
        Route::patch('{lead}/notes/{note}', [CompanyLeadController::class, 'updateNote'])->name('notes.update');
        Route::delete('{lead}/notes/{note}', [CompanyLeadController::class, 'destroyNote'])->name('notes.destroy');
    });

    Route::prefix('verification')->name('verification.')->group(function () {
        Route::get('/', [CompanyVerificationController::class, 'index'])->name('index');
        Route::post('/', [CompanyVerificationController::class, 'store'])->name('store');
    });

    /** Job Routes */
    Route::get('applications/{id}', [JobController::class, 'applications'])->name('job.applications');
    Route::resource('jobs', JobController::class);

    /**Payment Routes */
    Route::get('payment/success', [PaymentController::class, 'paymentSuccess'])->name('payment.success');
    Route::get('payment/error', [PaymentController::class, 'paymentError'])->name('payment.error');

    Route::get('paypal/payment', [PaymentController::class, 'payWithPaypal'])->name('paypal.payment');
    Route::get('paypal/success', [PaymentController::class, 'paypalSuccess'])->name('paypal.success');
    Route::get('paypal/cancel', [PaymentController::class, 'paypalCancel'])->name('paypal.cancel');

    Route::get('stripe/payment', [PaymentController::class, 'payWithStripe'])->name('stripe.payment');
    Route::get('stripe/success', [PaymentController::class, 'stripeSuccess'])->name('stripe.success');
    Route::get('stripe/cancel', [PaymentController::class, 'stripeCancel'])->name('stripe.cancel');

    Route::get('razorpay-redirect', [PaymentController::class, 'razorpayRedirect'])->name('razorpay-redirect');
    Route::post('razorpay/payment', [PaymentController::class, 'payWithRazorpay'])->name('razorpay.payment');

    // Advertising platform routes (campaigns & audience segments)
    Route::prefix('advertising')->name('advertising.')->group(function () {
        Route::get('revenue', [AdvertisingRevenueDashboardController::class, 'index'])->name('revenue.index');
        Route::get('slots', [AdvertisingSlotManagementController::class, 'index'])->name('slots.index');
        Route::get('campaigns', [AdvertisingCampaignController::class, 'index'])->name('campaigns.index');
        Route::get('campaigns/create', [AdvertisingCampaignController::class, 'create'])->name('campaigns.create');
        Route::post('campaigns', [AdvertisingCampaignController::class, 'store'])->name('campaigns.store');
        Route::get('campaigns/{campaign}', [AdvertisingCampaignController::class, 'show'])->name('campaigns.show');
        Route::get('campaigns/{campaign}/edit', [AdvertisingCampaignController::class, 'edit'])->name('campaigns.edit');
        Route::put('campaigns/{campaign}', [AdvertisingCampaignController::class, 'update'])->name('campaigns.update');
        Route::delete('campaigns/{campaign}', [AdvertisingCampaignController::class, 'destroy'])->name('campaigns.destroy');
        Route::post('campaigns/{campaign}/status', [AdvertisingCampaignController::class, 'changeStatus'])->name('campaigns.change-status');

        Route::prefix('campaigns/{campaign}/creatives')->name('campaigns.creatives.')->group(function () {
            Route::get('create', [AdvertisingCreativeController::class, 'create'])->name('create');
            Route::post('/', [AdvertisingCreativeController::class, 'store'])->name('store');
            Route::get('{creative}/edit', [AdvertisingCreativeController::class, 'edit'])->name('edit');
            Route::put('{creative}', [AdvertisingCreativeController::class, 'update'])->name('update');
            Route::delete('{creative}', [AdvertisingCreativeController::class, 'destroy'])->name('destroy');
        });

        Route::prefix('campaigns/{campaign}/metrics')->name('campaigns.metrics.')->group(function () {
            Route::get('/', [AdvertisingCampaignMetricController::class, 'index'])->name('index');
            Route::get('create', [AdvertisingCampaignMetricController::class, 'create'])->name('create');
            Route::post('/', [AdvertisingCampaignMetricController::class, 'store'])->name('store');
            Route::get('{metric}/edit', [AdvertisingCampaignMetricController::class, 'edit'])->name('edit');
            Route::put('{metric}', [AdvertisingCampaignMetricController::class, 'update'])->name('update');
            Route::delete('{metric}', [AdvertisingCampaignMetricController::class, 'destroy'])->name('destroy');
        });

        Route::get('segments', [AdvertisingAudienceSegmentController::class, 'index'])->name('segments.index');
        Route::get('segments/create', [AdvertisingAudienceSegmentController::class, 'create'])->name('segments.create');
        Route::post('segments', [AdvertisingAudienceSegmentController::class, 'store'])->name('segments.store');
        Route::get('segments/{segment}/edit', [AdvertisingAudienceSegmentController::class, 'edit'])->name('segments.edit');
        Route::put('segments/{segment}', [AdvertisingAudienceSegmentController::class, 'update'])->name('segments.update');
        Route::delete('segments/{segment}', [AdvertisingAudienceSegmentController::class, 'destroy'])->name('segments.destroy');

        Route::get('slot-insights', AdvertisingSlotInsightController::class)->name('slot-insights.index');
    });
});

Route::middleware(['auth', 'verified'])->group(function () {
        Route::get('identity/appeal', [\App\Http\Controllers\Frontend\IdentityAppealController::class, 'create'])->name('identity.appeal.create');
        Route::post('identity/appeal', [\App\Http\Controllers\Frontend\IdentityAppealController::class, 'store'])->name('identity.appeal.store');
    });

Route::group(['prefix' => 'partner', 'as' => 'partner.', 'middleware' => ['auth']], function () {
    Route::get('/dashboard', [\App\Http\Controllers\Partner\PartnerDashboardController::class, 'index'])->name('dashboard');
    Route::get('/campaigns/create', function() { return "Create Campaign Placeholder"; })->name('campaigns.create');
});

Route::middleware(['auth', 'verified'])->prefix('growth')->name('growth.')->group(function () {
    Route::get('referrals', [\App\Http\Controllers\Growth\ReferralController::class, 'index'])->name('referrals.index');
    Route::post('referrals/send', [\App\Http\Controllers\Growth\ReferralController::class, 'send'])->name('referrals.send');
});

Route::middleware(['auth', 'verified'])
    ->prefix('trades')
    ->name('trades.')
    ->group(function () {
        Route::get('/', [\App\Http\Controllers\Trades\DashboardController::class, 'index'])->name('dashboard');

        Route::prefix('apprenticeships')->name('apprenticeships.')->group(function () {
            Route::get('/', [\App\Http\Controllers\Trades\ApprenticeshipController::class, 'index'])->name('index');
            Route::get('/{program}', [\App\Http\Controllers\Trades\ApprenticeshipController::class, 'show'])->name('show');
            Route::post('/{program}/apply', [\App\Http\Controllers\Trades\ApprenticeshipController::class, 'apply'])->name('apply');
            Route::put('/{program}/progress', [\App\Http\Controllers\Trades\ApprenticeshipController::class, 'updateProgress'])->name('update-progress');
        });
    });








