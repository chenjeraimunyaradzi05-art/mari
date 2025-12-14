<?php

use App\Http\Controllers\Admin\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Admin\Auth\Auth0Controller;
use App\Http\Controllers\Admin\Auth\PasswordResetLinkController;
use App\Http\Controllers\Admin\Auth\NewPasswordController;
use Illuminate\Support\Facades\Route;

/**
 * Admin routes
 */

Route::prefix('admin')
    ->name('admin.')
    ->group(function () {

        // Local (Mutiro) login
        Route::get('mutiro/login', [AuthenticatedSessionController::class, 'create'])->name('mutiro.login');
        Route::post('mutiro/login', [AuthenticatedSessionController::class, 'store'])->name('mutiro.login.store');

        // Auth0 SSO (optional)
        Route::get('auth0/login', [Auth0Controller::class, 'redirect'])->name('auth0.login');
        Route::get('auth0/callback', [Auth0Controller::class, 'callback'])->name('auth0.callback');
        Route::get('auth0/challenge', [Auth0Controller::class, 'challenge'])->name('auth0.challenge');
        Route::get('auth0/logout', [Auth0Controller::class, 'logout'])->name('auth0.logout');

        // Password reset for Admins
        Route::get('password/reset', [PasswordResetLinkController::class, 'create'])->name('password.request');
        Route::post('password/email', [PasswordResetLinkController::class, 'store'])->name('password.email');
        Route::get('password/reset/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
        Route::post('password/reset', [NewPasswordController::class, 'store'])->name('password.update');

        // Logout
        Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

        // Protected admin area
        Route::middleware(['auth:admin'])
            ->group(function () {
                Route::get('dashboard', [\App\Http\Controllers\Admin\DashboardController::class, 'index'])->name('dashboard');

                // Admin widgets - example resource
                Route::resource('widgets', \App\Http\Controllers\Admin\AdminWidgetController::class)->names('widgets');

                // Admin jobs resource routes (index/create/edit/store/update/destroy)
                Route::resource('jobs', \App\Http\Controllers\Admin\JobController::class)->names('jobs');

                // Admin orders (index/show/invoice)
                Route::resource('orders', \App\Http\Controllers\Admin\OrderController::class)
                    ->only(['index', 'show'])
                    ->names('orders');
                Route::get('orders/invoice/{id}', [\App\Http\Controllers\Admin\OrderController::class, 'invoice'])->name('orders.invoice');

                // Admin entertainment resource (index/create/store/edit/update/destroy)
                Route::resource('entertainment', \App\Http\Controllers\Admin\EntertainmentController::class)->names('entertainment');

                // Security - session management (view and revoke sessions)
                Route::resource('security/sessions', \App\Http\Controllers\Admin\SessionSecurityController::class)
                    ->only(['index', 'destroy'])
                    ->names('security.sessions');

                // Job categories (admin)
                Route::resource('job-categories', \App\Http\Controllers\Admin\JobCategoryController::class)
                    ->names('job-categories');

                // Job roles (admin)
                Route::resource('job-roles', \App\Http\Controllers\Admin\JobRoleController::class)
                    ->names('job-roles');

                // Attribute resources
                Route::resource('industry-types', \App\Http\Controllers\Admin\IndustryTypeController::class)->names('industry-types');
                Route::resource('organization-types', \App\Http\Controllers\Admin\OrganizationTypeController::class)->names('organization-types');
                Route::resource('languages', \App\Http\Controllers\Admin\LanguageController::class)->names('languages');
                Route::resource('professions', \App\Http\Controllers\Admin\ProfessionController::class)->names('professions');
                Route::resource('skills', \App\Http\Controllers\Admin\SkillController::class)->names('skills');
                Route::resource('educations', \App\Http\Controllers\Admin\EducationController::class)->names('educations');
                Route::resource('job-types', \App\Http\Controllers\Admin\JobTypeController::class)->names('job-types');
                Route::resource('salary-types', \App\Http\Controllers\Admin\SalaryTypeController::class)->names('salary-types');
                Route::resource('tags', \App\Http\Controllers\Admin\TagController::class)->names('tags');
                Route::resource('job-experiences', \App\Http\Controllers\Admin\JobExperienceController::class)->names('job-experiences');

                // Location resources (countries, states, cities)
                Route::resource('countries', \App\Http\Controllers\Admin\CountryController::class)->names('countries');
                Route::resource('states', \App\Http\Controllers\Admin\StateController::class)->names('states');
                Route::resource('cities', \App\Http\Controllers\Admin\CityController::class)->names('cities');

                // Sections (landing / site sections)
                Route::resource('hero', \App\Http\Controllers\Admin\HeroController::class)
                    ->only(['index', 'update'])
                    ->names('hero');
                Route::resource('why-choose-us', \App\Http\Controllers\Admin\WhyChooseUsController::class)
                    ->only(['index', 'update'])
                    ->names('why-choose-us');
                Route::resource('learn-more', \App\Http\Controllers\Admin\LearnMoreController::class)
                    ->only(['index', 'update'])
                    ->names('learn-more');
                Route::resource('counter', \App\Http\Controllers\Admin\CounterController::class)
                    ->only(['index', 'update'])
                    ->names('counter');
                Route::resource('job-location', \App\Http\Controllers\Admin\JobLocationController::class)
                    ->names('job-location');
                Route::resource('reviews', \App\Http\Controllers\Admin\ReviewController::class)
                    ->names('reviews');

                // Pages & footer management
                Route::resource('about-us', \App\Http\Controllers\Admin\AboutController::class)
                    ->only(['index', 'update'])
                    ->names('about-us');
                Route::resource('page-builder', \App\Http\Controllers\Admin\CustomPageBuilderController::class)
                    ->names('page-builder');
                // Pricing / plans
                Route::resource('plans', \App\Http\Controllers\Admin\PlanController::class)->names('plans');
                Route::resource('footer', \App\Http\Controllers\Admin\FooterController::class)
                    ->only(['index', 'update'])
                    ->names('footer');
                Route::resource('social-icon', \App\Http\Controllers\Admin\SocialIconController::class)
                    ->names('social-icon');

                // Admin profile (view / update / password)
                Route::get('profile', [\App\Http\Controllers\Admin\ProfileUpdateController::class, 'index'])->name('profile.index');
                Route::post('profile', [\App\Http\Controllers\Admin\ProfileUpdateController::class, 'update'])->name('profile.update');
                Route::post('profile/password', [\App\Http\Controllers\Admin\ProfileUpdateController::class, 'passwordUpdate'])->name('profile-password.update');

                // Organization pages (admin) - register resource routes
                Route::resource('organization-pages', \App\Http\Controllers\Admin\OrgPageController::class)->names('organization-pages');

                // Site settings (view and update endpoints)
                Route::get('site-settings', [\App\Http\Controllers\Admin\SiteSettingController::class, 'index'])->name('site-settings.index');
                Route::post('site-settings/general', [\App\Http\Controllers\Admin\SiteSettingController::class, 'updateGeneralSetting'])->name('general-settings.update');
                Route::post('site-settings/logo', [\App\Http\Controllers\Admin\SiteSettingController::class, 'updateLogoSetting'])->name('logo-settings.update');

                // Change job status (active/pending) - matches JobController::changeStatus
                Route::post('jobs/{id}/change-status', [\App\Http\Controllers\Admin\JobController::class, 'changeStatus'])
                    ->name('jobs.change-status');

                /**
                 * Auto-added routes to fix missing named admin routes referenced across views/tests.
                 * These were inferred from controller methods and usage in views/tests.
                 * Only safe, verified handlers (existing controller methods) were added.
                 */
                // AI analytics endpoints
                Route::post('ai-analytics/alerts', [\App\Http\Controllers\Admin\AIAnalyticsController::class, 'logClientAlert'])->name('ai-analytics.alerts');
                Route::post('ai-analytics/alerts/{alert}/acknowledge', [\App\Http\Controllers\Admin\AIAnalyticsController::class, 'acknowledgeClientAlert'])->name('ai-analytics.alerts.acknowledge');
                Route::get('ai-analytics/alerts/history', [\App\Http\Controllers\Admin\AIAnalyticsController::class, 'listClientAlerts'])->name('ai-analytics.alerts.history');
                Route::get('ai-analytics/export/excel', [\App\Http\Controllers\Admin\AIAnalyticsController::class, 'exportExcel'])->name('ai-analytics.export.excel');
                Route::get('ai-analytics/export/pdf', [\App\Http\Controllers\Admin\AIAnalyticsController::class, 'exportPdf'])->name('ai-analytics.export.pdf');
                Route::get('ai-analytics', [\App\Http\Controllers\Admin\AIAnalyticsController::class, 'index'])->name('ai-analytics.index');
                Route::get('ai-analytics/metrics', [\App\Http\Controllers\Admin\AIAnalyticsController::class, 'getRealtimeMetrics'])->name('ai-analytics.metrics');
                Route::get('ai-analytics/realtime', [\App\Http\Controllers\Admin\AIAnalyticsController::class, 'realtimeDashboard'])->name('ai-analytics.realtime');

                // AI stage pages
                Route::get('ai-stage2', [\App\Http\Controllers\Admin\AIStage2Controller::class, 'index'])->name('ai-stage2.index');
                Route::get('ai-stage3', [\App\Http\Controllers\Admin\AIStage3Controller::class, 'index'])->name('ai-stage3.index');
                Route::get('ai-stage4', [\App\Http\Controllers\Admin\AIStage4Controller::class, 'index'])->name('ai-stage4.index');

                // Analytics (overview/chart/export/refresh)
                Route::get('analytics', [\App\Http\Controllers\Admin\AnalyticsController::class, 'index'])->name('analytics');
                Route::get('analytics/chart', [\App\Http\Controllers\Admin\AnalyticsController::class, 'getChartData'])->name('analytics.chart');
                Route::get('analytics/export', [\App\Http\Controllers\Admin\AnalyticsController::class, 'export'])->name('analytics.export');
                Route::get('analytics/refresh', [\App\Http\Controllers\Admin\AnalyticsController::class, 'refreshCache'])->name('analytics.refresh');

                // Candidate pages
                Route::get('candidates', [\App\Http\Controllers\Admin\CandidateController::class, 'index'])->name('candidates.index');
                Route::get('candidates/{candidate}', [\App\Http\Controllers\Admin\CandidateController::class, 'show'])->name('candidates.show');

                // Clear DB utility
                Route::post('clear-database', [\App\Http\Controllers\Admin\ClearDatabaseController::class, 'clearDatabase'])->name('clear-database');
                Route::get('clear-database', [\App\Http\Controllers\Admin\ClearDatabaseController::class, 'index'])->name('clear-database.index');

                // Identity flags
                Route::get('identity-flags', [\App\Http\Controllers\Admin\IdentityFlagController::class, 'index'])->name('identity-flags.index');
                Route::get('identity-flags/{identityFlag}', [\App\Http\Controllers\Admin\IdentityFlagController::class, 'show'])->name('identity-flags.show');
                Route::match(['PUT','PATCH'], 'identity-flags/{id}', [\App\Http\Controllers\Admin\IdentityFlagController::class, 'update'])->name('identity-flags.update');

                // Job experience (alias/compat)
                Route::get('job-experience', [\App\Http\Controllers\Admin\JobExperienceController::class, 'index'])->name('job-experience.index');

                // TurboTax admin area (POC)
                Route::get('turbotax', [\App\Http\Controllers\Admin\TurboTaxController::class, 'index'])->name('turbotax.index');
                Route::post('turbotax/run-projection', [\App\Http\Controllers\Admin\TurboTaxController::class, 'runProjection'])->name('turbotax.runProjection');

                // Menu builder
                Route::get('menu-builder', [\App\Http\Controllers\Admin\MenuBuilderController::class, 'index'])->name('menu-builder.index');

                // Moderation endpoints
                Route::get('moderation/blocks', [\App\Http\Controllers\Admin\SocialModerationController::class, 'blocks'])->name('moderation.blocks');
                Route::get('moderation/dashboard', [\App\Http\Controllers\Admin\SocialModerationController::class, 'dashboard'])->name('moderation.dashboard');
                Route::get('moderation/provider/metrics', [\App\Http\Controllers\Admin\SocialModerationController::class, 'providerMetrics'])->name('moderation.provider.metrics');
                Route::get('moderation/reports', [\App\Http\Controllers\Admin\SocialModerationController::class, 'reports'])->name('moderation.reports');
                // Bulk moderation endpoints (used by admin console / API) -
                // place these before parameterized routes so "bulk" doesn't
                // accidentally match {report} route segments.
                Route::post('moderation/reports/bulk/assign', [\App\Http\Controllers\Admin\SocialModerationController::class, 'bulkAssign'])->name('moderation.reports.bulk.assign');
                Route::post('moderation/reports/bulk/decision', [\App\Http\Controllers\Admin\SocialModerationController::class, 'bulkDecide'])->name('moderation.reports.bulk.decide');

                Route::post('moderation/reports/{report}/assign', [\App\Http\Controllers\Admin\SocialModerationController::class, 'assignReport'])->name('moderation.reports.assign');
                Route::post('moderation/reports/{report}/decide', [\App\Http\Controllers\Admin\SocialModerationController::class, 'decideReport'])->name('moderation.reports.decide');
                // Bulk moderation endpoints (used by admin console / API)
                Route::post('moderation/reports/bulk/assign', [\App\Http\Controllers\Admin\SocialModerationController::class, 'bulkAssign'])->name('moderation.reports.bulk.assign');
                Route::post('moderation/reports/bulk/decision', [\App\Http\Controllers\Admin\SocialModerationController::class, 'bulkDecide'])->name('moderation.reports.bulk.decide');
                Route::get('moderation/reports/events', [\App\Http\Controllers\Admin\SocialModerationController::class, 'reportEvents'])->name('moderation.reports.events');
                Route::get('moderation/reports/{report}', [\App\Http\Controllers\Admin\SocialModerationController::class, 'showReport'])->name('moderation.reports.show');
                Route::get('moderation/terms', [\App\Http\Controllers\Admin\SocialModerationController::class, 'terms'])->name('moderation.terms');
                Route::post('moderation/terms', [\App\Http\Controllers\Admin\SocialModerationController::class, 'storeTerm'])->name('moderation.terms.store');
                Route::delete('moderation/terms/{term}', [\App\Http\Controllers\Admin\SocialModerationController::class, 'destroyTerm'])->name('moderation.terms.destroy');

                // Newsletter
                Route::get('newsletter', [\App\Http\Controllers\Admin\NewsletterController::class, 'index'])->name('newsletter.index');
                Route::delete('newsletter/{id}', [\App\Http\Controllers\Admin\NewsletterController::class, 'destroy'])->name('newsletter.destroy');

                // Notifications (mark read/delete)
                Route::delete('notifications/{notification}', [\App\Http\Controllers\Admin\AdminNotificationController::class, 'destroy'])->name('notifications.destroy');
                Route::post('notifications/{notification}/read', [\App\Http\Controllers\Admin\AdminNotificationController::class, 'markRead'])->name('notifications.read');

                // Omega AI
                Route::get('omega-ai', [\App\Http\Controllers\Admin\OmegaAIController::class, 'index'])->name('omega-ai.index');

                // Operations console (views)
                Route::get('operations/ad-review', [\App\Http\Controllers\Admin\SocialOperationsConsoleController::class, 'adReview'])->name('operations.ad-review');
                Route::get('operations/revenue-ops', [\App\Http\Controllers\Admin\SocialOperationsConsoleController::class, 'revenueOps'])->name('operations.revenue-ops');
                Route::get('operations/trust-safety', [\App\Http\Controllers\Admin\SocialOperationsConsoleController::class, 'trustSafety'])->name('operations.trust-safety');
                Route::get('operations/verification-hub', [\App\Http\Controllers\Admin\SocialOperationsConsoleController::class, 'verificationHub'])->name('operations.verification-hub');

                // Confirmable password (store)
                Route::post('password', [\App\Http\Controllers\Admin\Auth\ConfirmablePasswordController::class, 'store'])->name('password.store');

                // Payment settings
                Route::get('payment-settings', [\App\Http\Controllers\Admin\PaymentSettingController::class, 'index'])->name('payment-settings.index');

                // Profile verifications helpers
                Route::post('profile-verifications/{verification}/assign', [\App\Http\Controllers\Admin\ProfileVerificationQueueController::class, 'assign'])->name('profile-verifications.assign');
                Route::post('profile-verifications/{verification}/decide', [\App\Http\Controllers\Admin\ProfileVerificationQueueController::class, 'decide'])->name('profile-verifications.decide');
                Route::get('profile-verifications/documents/download/{verification}/{document}', [\App\Http\Controllers\Admin\ProfileVerificationQueueController::class, 'downloadDocument'])->name('profile-verifications.documents.download');
                Route::get('profile-verifications', [\App\Http\Controllers\Admin\ProfileVerificationQueueController::class, 'index'])->name('profile-verifications.index');
                Route::get('profile-verifications/{verification}', [\App\Http\Controllers\Admin\ProfileVerificationQueueController::class, 'show'])->name('profile-verifications.show');

                // Role / role-user routes (admin access-management)
                Route::get('role-user', [\App\Http\Controllers\Admin\RoleUserController::class, 'index'])->name('role-user.index');
                Route::get('role-user/create', [\App\Http\Controllers\Admin\RoleUserController::class, 'create'])->name('role-user.create');
                Route::post('role-user', [\App\Http\Controllers\Admin\RoleUserController::class, 'store'])->name('role-user.store');
                Route::get('role-user/{id}/edit', [\App\Http\Controllers\Admin\RoleUserController::class, 'edit'])->name('role-user.edit');
                Route::match(['PUT','PATCH'], 'role-user/{id}', [\App\Http\Controllers\Admin\RoleUserController::class, 'update'])->name('role-user.update');
                Route::delete('role-user/{id}', [\App\Http\Controllers\Admin\RoleUserController::class, 'destroy'])->name('role-user.destroy');

                // Role (aliases for single 'role' namespace used by views)
                Route::get('role', [\App\Http\Controllers\Admin\JobRoleController::class, 'index'])->name('role.index');
                Route::get('role/create', [\App\Http\Controllers\Admin\JobRoleController::class, 'create'])->name('role.create');
                Route::post('role', [\App\Http\Controllers\Admin\JobRoleController::class, 'store'])->name('role.store');
                Route::get('role/{id}/edit', [\App\Http\Controllers\Admin\JobRoleController::class, 'edit'])->name('role.edit');
                Route::match(['PUT','PATCH'], 'role/{id}', [\App\Http\Controllers\Admin\JobRoleController::class, 'update'])->name('role.update');
                Route::delete('role/{id}', [\App\Http\Controllers\Admin\JobRoleController::class, 'destroy'])->name('role.destroy');

                // Social metrics - short links
                Route::get('social-metrics/short-links', [\App\Http\Controllers\Admin\SocialMetricsDashboardController::class, 'index'])->name('social-metrics.short-links.index');
                Route::get('social-metrics/short-links/metrics', [\App\Http\Controllers\Admin\SocialMetricsDashboardController::class, 'index'])->name('social-metrics.short-links.metrics');

                // Additions mapped to existing controller methods (safe)
                // Jobs status change (used by admin.job-status.update in JS)
                Route::post('job-status/{id}', [\App\Http\Controllers\Admin\JobController::class, 'changeStatus'])->name('job-status.update');

                // Newsletter - send mail form
                Route::post('newsletter/send', [\App\Http\Controllers\Admin\NewsletterController::class, 'sendMail'])->name('newsletter-send-mail');

                // Payment gateway setting update endpoints (mapped to explicit update methods)
                Route::post('paypal-settings', [\App\Http\Controllers\Admin\PaymentSettingController::class, 'updatePaypalSetting'])->name('paypal-settings.update');
                Route::post('stripe-settings', [\App\Http\Controllers\Admin\PaymentSettingController::class, 'updateStripeSetting'])->name('stripe-settings.update');
                Route::post('razorpay-settings', [\App\Http\Controllers\Admin\PaymentSettingController::class, 'updateRazorpaySetting'])->name('razorpay-settings.update');

                // Quantum AI overview
                Route::get('quantum-ai', [\App\Http\Controllers\Admin\QuantumAIController::class, 'index'])->name('quantum-ai.index');
                
                // Social verifications (admin review flow)
                Route::get('social-verifications', [\App\Http\Controllers\Admin\SocialProfileVerificationController::class, 'index'])->name('social-verifications.index');
                Route::get('social-verifications/{verification}', [\App\Http\Controllers\Admin\SocialProfileVerificationController::class, 'show'])->name('social-verifications.show');
                Route::match(['PUT','PATCH'], 'social-verifications/{verification}', [\App\Http\Controllers\Admin\SocialProfileVerificationController::class, 'update'])->name('social-verifications.update');

                // Company verifications (index/show/export)
                Route::get('verifications', [\App\Http\Controllers\Admin\CompanyVerificationController::class, 'index'])->name('verifications.index');
                Route::get('verifications/export', [\App\Http\Controllers\Admin\CompanyVerificationController::class, 'export'])->name('verifications.export');
                Route::get('verifications/{verification}', [\App\Http\Controllers\Admin\CompanyVerificationController::class, 'show'])->name('verifications.show');

                // Women verification tools (analytics/dry-run/queue/export)
                Route::get('women/verification/analytics', [\App\Http\Controllers\Admin\WomenVerificationAnalyticsController::class, '__invoke'])->name('women.verification.analytics');
                Route::get('women/verification/audits/export', [\App\Http\Controllers\Admin\WomenVerificationAuditExportController::class, '__invoke'])->name('women.verification.audits.export');
                Route::get('women/verification/dry-run', [\App\Http\Controllers\Admin\WomenVerificationDryRunController::class, 'index'])->name('women.verification.dry-run.index');
                Route::post('women/verification/dry-run', [\App\Http\Controllers\Admin\WomenVerificationDryRunController::class, 'store'])->name('women.verification.dry-run.store');
                Route::get('women/verification/queue', [\App\Http\Controllers\Admin\WomenVerificationQueueController::class, 'index'])->name('women.verification.queue.index');
                Route::get('women/verification/regulator-report', [\App\Http\Controllers\Admin\WomenVerificationRegulatorReportExportController::class, '__invoke'])->name('women.verification.regulator-report');
            });
    });
