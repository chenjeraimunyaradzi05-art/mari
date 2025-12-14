<div class="main-sidebar sidebar-style-2">
    <aside id="sidebar-wrapper">
        <div class="sidebar-brand">
            <button type="button" class="nav-link nav-brand" data-href="index.html">Athena</button>
        </div>
        <div class="sidebar-brand sidebar-brand-sm">
            <button type="button" class="nav-link nav-brand" data-href="index.html">At</button>
        </div>
        <ul class="sidebar-menu">
            <li class="menu-header">Dashboard</li>

            <li class="{{ setSidebarActive(['admin.dashboard']) }}">
                <button type="button" class="nav-link nav-btn" data-href="{{ route('admin.dashboard') }}"><i class="fas fa-fire"></i><span>Dashboard</span></button>

            </li>
            <li class="menu-header">Starter</li>
            @if (canAccess(['order index']))
            <li class="{{ setSidebarActive(['admin.orders.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.orders.index') }}"><i class="fas fa-cart-plus"></i> <span>Orders</span></button></li>
            @endif

            @if (canAccess(['verifications']) && Route::has('admin.verifications.index'))
            <li class="{{ setSidebarActive(['admin.verifications.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.verifications.index') }}"><i class="fas fa-check-circle"></i> <span>Verifications</span></button></li>
            @endif

            @if (canAccess(['verifications']) && Route::has('admin.profile-verifications.index'))
            <li class="{{ setSidebarActive(['admin.profile-verifications.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.profile-verifications.index') }}"><i class="fas fa-id-card"></i> <span>Persona Verifications</span></button></li>
            @endif

            @if (canAccess(['verifications']) && Route::has('admin.women.verification.dry-run.index'))
            <li class="{{ setSidebarActive(['admin.women.verification.dry-run.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.women.verification.dry-run.index') }}"><i class="fas fa-user-check"></i> <span>Women Verification Dry Run</span></button></li>
            <li class="{{ setSidebarActive(['admin.women.verification.queue.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.women.verification.queue.index') }}"><i class="fas fa-stream"></i> <span>Women Verification Queue</span></button></li>
            <li class="{{ setSidebarActive(['admin.women.verification.analytics']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.women.verification.analytics') }}"><i class="fas fa-chart-line"></i> <span>Women Verification Analytics</span></button></li>
            @endif

            @php
                $hasAiStage2 = Route::has('admin.ai-stage2.index');
                $hasAiStage3 = Route::has('admin.ai-stage3.index');
                $hasAiStage4 = Route::has('admin.ai-stage4.index');
                $hasOmegaAi = Route::has('admin.omega-ai.index');
                $hasQuantumAi = Route::has('admin.quantum-ai.index');
            @endphp
            @if (canAccess(['ai dashboards']) && ($hasAiStage2 || $hasAiStage3 || $hasAiStage4 || $hasOmegaAi || $hasQuantumAi))
            <li class="dropdown {{ setSidebarActive([
                'admin.ai-stage2.*',
                'admin.ai-stage3.*',
                'admin.ai-stage4.*',
                'admin.omega-ai.*',
                'admin.quantum-ai.*',
            ]) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-robot"></i>
                    <span>AI Roadmap</span></button>
                <ul class="dropdown-menu">
                    @if ($hasAiStage2)
                    <li class="{{ setSidebarActive(['admin.ai-stage2.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.ai-stage2.index') }}">Stage 2 · Stabilisation</button></li>
                    @endif
                    @if ($hasAiStage3)
                    <li class="{{ setSidebarActive(['admin.ai-stage3.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.ai-stage3.index') }}">Stage 3 · Personalisation</button></li>
                    @endif
                    @if ($hasAiStage4)
                    <li class="{{ setSidebarActive(['admin.ai-stage4.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.ai-stage4.index') }}">Stage 4 · Autonomy</button></li>
                    @endif
                    @if ($hasOmegaAi)
                    <li class="{{ setSidebarActive(['admin.omega-ai.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.omega-ai.index') }}">Omega AI Control</button></li>
                    @endif
                    @if ($hasQuantumAi)
                    <li class="{{ setSidebarActive(['admin.quantum-ai.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.quantum-ai.index') }}">Quantum Lab</button></li>
                    @endif
                </ul>
            </li>
            @endif

            @if (canAccess(['ai analytics']) && Route::has('admin.ai-analytics.index'))
            <li class="{{ setSidebarActive(['admin.ai-analytics.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.ai-analytics.index') }}"><i class="fas fa-chart-line"></i> <span>AI Analytics</span></button></li>
            @endif

            @if (canAccess(['dashboard analytics']) && Route::has('admin.analytics'))
            <li class="{{ setSidebarActive(['admin.analytics', 'admin.analytics.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.analytics') }}"><i class="fas fa-chart-pie"></i> <span>Analytics Overview</span></button></li>
            @endif

            @if (canAccess(['moderation access']) && Route::has('admin.moderation.dashboard'))
            <li class="menu-header">Social Moderation</li>
            <li class="dropdown {{ setSidebarActive([
                'admin.moderation.dashboard',
                'admin.moderation.reports',
                'admin.moderation.reports.*',
                'admin.moderation.blocks',
                'admin.moderation.terms',
            ]) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-shield-alt"></i>
                    <span>Moderation</span></button>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.moderation.dashboard']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.moderation.dashboard') }}">Overview</button></li>
                    <li class="{{ setSidebarActive(['admin.moderation.reports', 'admin.moderation.reports.*']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.moderation.reports') }}">Reports Queue</button></li>
                    <li class="{{ setSidebarActive(['admin.moderation.blocks']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.moderation.blocks') }}">Active Blocks</button></li>
                    <li class="{{ setSidebarActive(['admin.moderation.terms']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.moderation.terms') }}">Sensitive Terms</button></li>
                </ul>
            </li>
            @endif

            <li class="menu-header">Entertainment</li>
            <li class="{{ setSidebarActive(['admin.entertainment.*']) }}">
                <button type="button" class="nav-link nav-btn" data-href="{{ route('admin.entertainment.index') }}"><i class="fas fa-film"></i><span>Entertainment</span></button>
            </li>

            @php
                $opsPermissions = [
                    'operations.trust-safety',
                    'operations.verification-hub',
                    'operations.ad-review',
                    'operations.revenue-ops',
                ];
            @endphp
            @if (canAccess($opsPermissions))
            <li class="menu-header">Social Ops</li>
            <li class="dropdown {{ setSidebarActive([
                'admin.operations.trust-safety',
                'admin.operations.verification-hub',
                'admin.operations.ad-review',
                'admin.operations.revenue-ops',
            ]) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-users-cog"></i>
                    <span>Operations Consoles</span></button>
                <ul class="dropdown-menu">
                    @if (Route::has('admin.operations.trust-safety'))
                    <li class="{{ setSidebarActive(['admin.operations.trust-safety']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.operations.trust-safety') }}">Trust &amp; Safety</button></li>
                    @endif
                    @if (Route::has('admin.operations.verification-hub'))
                    <li class="{{ setSidebarActive(['admin.operations.verification-hub']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.operations.verification-hub') }}">Verification Hub</button></li>
                    @endif
                    @if (Route::has('admin.operations.ad-review'))
                    <li class="{{ setSidebarActive(['admin.operations.ad-review']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.operations.ad-review') }}">Ad Review</button></li>
                    @endif
                    @if (Route::has('admin.operations.revenue-ops'))
                    <li class="{{ setSidebarActive(['admin.operations.revenue-ops']) }}"><button type="button" class="nav-link nav-btn" data-href="{{ route('admin.operations.revenue-ops') }}">Revenue Ops</button></li>
                    @endif
                </ul>
            </li>
            @endif

            <li class="menu-header">Security</li>
            <li class="{{ setSidebarActive(['admin.security.sessions.*']) }}">
                <button class="nav-link nav-btn" type="button" data-href="{{ route('admin.security.sessions.index') }}">
                    <i class="fas fa-user-shield"></i> <span>Session Security</span>
                </button>
            </li>

            @if (canAccess(['job category create', 'job category update', 'job category delete']))
            <li class="{{ setSidebarActive(['admin.job-categories.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.job-categories.index') }}"><i class="fas fa-list"></i> <span>Job Category</span></button></li>
            @endif

            @if (canAccess(['job create', 'job update', 'job delete']))
            <li class="{{ setSidebarActive(['admin.jobs.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.jobs.index') }}"><i class="fas fa-briefcase"></i> <span>Job Post</span></button></li>
            @endif

            @if (canAccess(['job role']))
            <li class="{{ setSidebarActive(['admin.job-roles.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.job-roles.index') }}"><i class="fas fa-user-md"></i> <span>Job Roles</span></button></li>
            @endif

            @if (canAccess(['job attributes']))

            <li class="dropdown {{ setSidebarActive(
                ['admin.industry-types.*',
                'admin.organization-types.*',
                'admin.languages.*',
                'admin.professions.*',
                'admin.skills.*',
                'admin.educations.*',
                'admin.job-types.*',
                'admin.salary-types.*',
                'admin.tags.*',
                'admin.job-experiences.*'] ) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-columns"></i>
                    <span>Attributes</span></button>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.industry-types.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.industry-types.index') }}">Industry Type</button></li>
                    <li class="{{ setSidebarActive(['admin.organization-types.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.organization-types.index') }}">Orginization Type</button></li>

                    <li class="{{ setSidebarActive(['admin.languages.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.languages.index') }}">Languages</button></li>

                    <li class="{{ setSidebarActive(['admin.professions.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.professions.index') }}">Professions</button></li>

                    <li class="{{ setSidebarActive(['admin.skills.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.skills.index') }}">Skills</button></li>
                    <li class="{{ setSidebarActive(['admin.educations.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.educations.index') }}">Educations</button></li>
                    <li class="{{ setSidebarActive(['admin.job-types.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.job-types.index') }}">Job Types</button></li>
                    <li class="{{ setSidebarActive(['admin.salary-types.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.salary-types.index') }}">Salary Types</button></li>
                    <li class="{{ setSidebarActive(['admin.tags.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.tags.index') }}">Tags</button></li>
                    <li class="{{ setSidebarActive(['admin.job-experiences.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.job-experiences.index') }}">Experiences</button></li>
                </ul>
            </li>
            @endif

            @if (canAccess(['job locations']))
            <li class="dropdown {{ setSidebarActive(['admin.countries.*', 'admin.states.*', 'admin.cities.*']) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="far fa-map"></i>
                    <span>Locations</span></button>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.countries.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.countries.index') }}">Countries</button></li>
                    <li class="{{ setSidebarActive(['admin.states.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.states.index') }}">States</button></li>
                    <li class="{{ setSidebarActive(['admin.cities.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.cities.index') }}">Cities</button></li>


                </ul>
            </li>
            @endif

            @if (canAccess(['sections']))
            <li class="dropdown {{ setSidebarActive([
                'admin.hero.index',
                'admin.why-choose-us.index',
                'admin.learn-more.*',
                'admin.counter.*',
                'admin.job-location.*',
                'admin.reviews.*',
                ]) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-puzzle-piece"></i>
                    <span>Sections</span></button>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.hero.index']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.hero.index') }}">Hero</button></li>
                    <li class="{{ setSidebarActive(['admin.why-choose-us.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.why-choose-us.index') }}">Why Choose Us</button></li>
                    <li class="{{ setSidebarActive(['admin.learn-more.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.learn-more.index') }}">Learn More</button></li>
                    <li class="{{ setSidebarActive(['admin.counter.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.counter.index') }}">Counter</button></li>
                    <li class="{{ setSidebarActive(['admin.job-location.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.job-location.index') }}">Job Locations</button></li>
                    <li class="{{ setSidebarActive(['admin.reviews.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.reviews.index') }}">Reviews</button></li>
                </ul>
            </li>
            @endif

            @if (canAccess(['site pages']))
            <li class="dropdown {{ setSidebarActive(['admin.about-us.*', 'admin.page-builder.*']) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-file"></i>
                    <span>Pages</span></button>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.about-us.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.about-us.index') }}">About us</button></li>
                    <li class="{{ setSidebarActive(['admin.page-builder.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.page-builder.index') }}">Page Builder</button></li>

                </ul>
            </li>
            @endif

            @if (canAccess(['site footer']))
            <li class="dropdown {{ setSidebarActive(['admin.footer.*', 'admin.social-icon.*']) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-shoe-prints"></i>
                    <span>Footer</span></button>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.footer.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.footer.index') }}">Footer Details</button></li>

                    <li class="{{ setSidebarActive(['admin.social-icon.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.social-icon.index') }}">Social Icons</button></li>
                </ul>
            </li>
            @endif

            @if (canAccess(['price plan']))
            <li class="{{ setSidebarActive(['admin.plans.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.plans.index') }}"><i class="fas fa-box"></i> <span>Price Plan</span></button></li>
            @endif

            @if (canAccess(['news letter']))
            <li class="{{ setSidebarActive(['admin.newsletter.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.newsletter.index') }}"><i class="fas fa-mail-bulk"></i> <span>Newsletter</span></button></li>
            @endif

            @if (canAccess(['menu builder']))
            <li class="{{ setSidebarActive(['admin.menu-builder.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.menu-builder.index') }}"><i class="fas fa-shapes"></i> <span>Menu Builder</span></button></li>
            @endif

            @if (canAccess(['access management']))
            <li class="dropdown {{ setSidebarActive(['admin.role-user.*', 'admin.role.*']) }}">
                <button type="button" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-user-shield"></i>
                    <span>Access Management</span></button>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.role-user.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.role-user.index') }}">Role Users</button></li>
                    <li class="{{ setSidebarActive(['admin.role.*']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.role.index') }}">Roles</button></li>
                </ul>
            </li>
            @endif

            @if (canAccess(['payment settings']))
            <li class="{{ setSidebarActive(['admin.payment-settings.index']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.payment-settings.index') }}"><i class="fas fa-wrench"></i> <span>Payment Settings</span></button></li>
            @endif

            @if (canAccess(['site settings']))

            <li class="{{ setSidebarActive(['admin.payment-settings.index']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.site-settings.index') }}"><i class="fas fa-cog"></i> <span>Site Settings</span></button></li>
            @endif

            @if (canAccess(['database clear']))
            <li class="{{ setSidebarActive(['admin.clear-database.index']) }}"><button class="nav-link nav-btn" type="button" data-href="{{ route('admin.clear-database.index') }}"><i class="fas fa-skull-crossbones"></i> <span>Clear Database</span></button></li>
            @endif

        </ul>
    </aside>
</div>
