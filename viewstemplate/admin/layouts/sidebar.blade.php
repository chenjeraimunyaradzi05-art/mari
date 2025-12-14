<div class="main-sidebar sidebar-style-2">
    <aside id="sidebar-wrapper">
        <div class="sidebar-brand">
            <a href="index.html">Stisla</a>
        </div>
        <div class="sidebar-brand sidebar-brand-sm">
            <a href="index.html">St</a>
        </div>
        <ul class="sidebar-menu">
            <li class="menu-header">Dashboard</li>

            <li class="{{ setSidebarActive(['admin.dashboard']) }}">
                <a href="{{ route('admin.dashboard') }}" class="nav-link"><i class="fas fa-fire"></i><span>Dashboard</span></a>

            </li>
            <li class="menu-header">Starter</li>
            @if (canAccess(['order index']))
            <li class="{{ setSidebarActive(['admin.orders.*']) }}"><a class="nav-link" href="{{ route('admin.orders.index') }}"><i class="fas fa-cart-plus"></i> <span>Orders</span></a></li>
            @endif

            @if (canAccess(['verifications']) && Route::has('admin.verifications.index'))
            <li class="{{ setSidebarActive(['admin.verifications.*']) }}"><a class="nav-link" href="{{ route('admin.verifications.index') }}"><i class="fas fa-check-circle"></i> <span>Verifications</span></a></li>
            @endif

            @if (canAccess(['verifications']) && Route::has('admin.profile-verifications.index'))
            <li class="{{ setSidebarActive(['admin.profile-verifications.*']) }}"><a class="nav-link" href="{{ route('admin.profile-verifications.index') }}"><i class="fas fa-id-card"></i> <span>Persona Verifications</span></a></li>
            @endif

            @if (canAccess(['verifications']) && Route::has('admin.women.verification.dry-run.index'))
            <li class="{{ setSidebarActive(['admin.women.verification.dry-run.*']) }}"><a class="nav-link" href="{{ route('admin.women.verification.dry-run.index') }}"><i class="fas fa-user-check"></i> <span>Women Verification Dry Run</span></a></li>
            <li class="{{ setSidebarActive(['admin.women.verification.queue.*']) }}"><a class="nav-link" href="{{ route('admin.women.verification.queue.index') }}"><i class="fas fa-stream"></i> <span>Women Verification Queue</span></a></li>
            <li class="{{ setSidebarActive(['admin.women.verification.analytics']) }}"><a class="nav-link" href="{{ route('admin.women.verification.analytics') }}"><i class="fas fa-chart-line"></i> <span>Women Verification Analytics</span></a></li>
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
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-robot"></i>
                    <span>AI Roadmap</span></a>
                <ul class="dropdown-menu">
                    @if ($hasAiStage2)
                    <li class="{{ setSidebarActive(['admin.ai-stage2.*']) }}"><a class="nav-link" href="{{ route('admin.ai-stage2.index') }}">Stage 2 · Stabilisation</a></li>
                    @endif
                    @if ($hasAiStage3)
                    <li class="{{ setSidebarActive(['admin.ai-stage3.*']) }}"><a class="nav-link" href="{{ route('admin.ai-stage3.index') }}">Stage 3 · Personalisation</a></li>
                    @endif
                    @if ($hasAiStage4)
                    <li class="{{ setSidebarActive(['admin.ai-stage4.*']) }}"><a class="nav-link" href="{{ route('admin.ai-stage4.index') }}">Stage 4 · Autonomy</a></li>
                    @endif
                    @if ($hasOmegaAi)
                    <li class="{{ setSidebarActive(['admin.omega-ai.*']) }}"><a class="nav-link" href="{{ route('admin.omega-ai.index') }}">Omega AI Control</a></li>
                    @endif
                    @if ($hasQuantumAi)
                    <li class="{{ setSidebarActive(['admin.quantum-ai.*']) }}"><a class="nav-link" href="{{ route('admin.quantum-ai.index') }}">Quantum Lab</a></li>
                    @endif
                </ul>
            </li>
            @endif

            @if (canAccess(['ai analytics']) && Route::has('admin.ai-analytics.index'))
            <li class="{{ setSidebarActive(['admin.ai-analytics.*']) }}"><a class="nav-link" href="{{ route('admin.ai-analytics.index') }}"><i class="fas fa-chart-line"></i> <span>AI Analytics</span></a></li>
            @endif

            @if (canAccess(['dashboard analytics']) && Route::has('admin.analytics'))
            <li class="{{ setSidebarActive(['admin.analytics', 'admin.analytics.*']) }}"><a class="nav-link" href="{{ route('admin.analytics') }}"><i class="fas fa-chart-pie"></i> <span>Analytics Overview</span></a></li>
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
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-shield-alt"></i>
                    <span>Moderation</span></a>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.moderation.dashboard']) }}"><a class="nav-link" href="{{ route('admin.moderation.dashboard') }}">Overview</a></li>
                    <li class="{{ setSidebarActive(['admin.moderation.reports', 'admin.moderation.reports.*']) }}"><a class="nav-link" href="{{ route('admin.moderation.reports') }}">Reports Queue</a></li>
                    <li class="{{ setSidebarActive(['admin.moderation.blocks']) }}"><a class="nav-link" href="{{ route('admin.moderation.blocks') }}">Active Blocks</a></li>
                    <li class="{{ setSidebarActive(['admin.moderation.terms']) }}"><a class="nav-link" href="{{ route('admin.moderation.terms') }}">Sensitive Terms</a></li>
                </ul>
            </li>
            @endif

            <li class="menu-header">Entertainment</li>
            <li class="{{ setSidebarActive(['admin.entertainment.*']) }}">
                <a href="{{ route('admin.entertainment.index') }}" class="nav-link"><i class="fas fa-film"></i><span>Entertainment</span></a>
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
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-users-cog"></i>
                    <span>Operations Consoles</span></a>
                <ul class="dropdown-menu">
                    @if (Route::has('admin.operations.trust-safety'))
                    <li class="{{ setSidebarActive(['admin.operations.trust-safety']) }}"><a class="nav-link" href="{{ route('admin.operations.trust-safety') }}">Trust &amp; Safety</a></li>
                    @endif
                    @if (Route::has('admin.operations.verification-hub'))
                    <li class="{{ setSidebarActive(['admin.operations.verification-hub']) }}"><a class="nav-link" href="{{ route('admin.operations.verification-hub') }}">Verification Hub</a></li>
                    @endif
                    @if (Route::has('admin.operations.ad-review'))
                    <li class="{{ setSidebarActive(['admin.operations.ad-review']) }}"><a class="nav-link" href="{{ route('admin.operations.ad-review') }}">Ad Review</a></li>
                    @endif
                    @if (Route::has('admin.operations.revenue-ops'))
                    <li class="{{ setSidebarActive(['admin.operations.revenue-ops']) }}"><a class="nav-link" href="{{ route('admin.operations.revenue-ops') }}">Revenue Ops</a></li>
                    @endif
                </ul>
            </li>
            @endif

            <li class="menu-header">Security</li>
            <li class="{{ setSidebarActive(['admin.security.sessions.*']) }}">
                <a class="nav-link" href="{{ route('admin.security.sessions.index') }}">
                    <i class="fas fa-user-shield"></i> <span>Session Security</span>
                </a>
            </li>

            @if (canAccess(['job category create', 'job category update', 'job category delete']))
            <li class="{{ setSidebarActive(['admin.job-categories.*']) }}"><a class="nav-link" href="{{ route('admin.job-categories.index') }}"><i class="fas fa-list"></i> <span>Job Category</span></a></li>
            @endif

            @if (canAccess(['job create', 'job update', 'job delete']))
            <li class="{{ setSidebarActive(['admin.jobs.*']) }}"><a class="nav-link" href="{{ route('admin.jobs.index') }}"><i class="fas fa-briefcase"></i> <span>Job Post</span></a></li>
            @endif

            @if (canAccess(['job role']))
            <li class="{{ setSidebarActive(['admin.job-roles.*']) }}"><a class="nav-link" href="{{ route('admin.job-roles.index') }}"><i class="fas fa-user-md"></i> <span>Job Roles</span></a></li>
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
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-columns"></i>
                    <span>Attributes</span></a>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.industry-types.*']) }}"><a class="nav-link" href="{{ route('admin.industry-types.index') }}">Industry Type</a></li>
                    <li class="{{ setSidebarActive(['admin.organization-types.*']) }}"><a class="nav-link" href="{{ route('admin.organization-types.index') }}">Orginization Type</a></li>

                    <li class="{{ setSidebarActive(['admin.languages.*']) }}"><a class="nav-link" href="{{ route('admin.languages.index') }}">Languages</a></li>

                    <li class="{{ setSidebarActive(['admin.professions.*']) }}"><a class="nav-link" href="{{ route('admin.professions.index') }}">Professions</a></li>

                    <li class="{{ setSidebarActive(['admin.skills.*']) }}"><a class="nav-link" href="{{ route('admin.skills.index') }}">Skills</a></li>
                    <li class="{{ setSidebarActive(['admin.educations.*']) }}"><a class="nav-link" href="{{ route('admin.educations.index') }}">Educations</a></li>
                    <li class="{{ setSidebarActive(['admin.job-types.*']) }}"><a class="nav-link" href="{{ route('admin.job-types.index') }}">Job Types</a></li>
                    <li class="{{ setSidebarActive(['admin.salary-types.*']) }}"><a class="nav-link" href="{{ route('admin.salary-types.index') }}">Salary Types</a></li>
                    <li class="{{ setSidebarActive(['admin.tags.*']) }}"><a class="nav-link" href="{{ route('admin.tags.index') }}">Tags</a></li>
                    <li class="{{ setSidebarActive(['admin.job-experiences.*']) }}"><a class="nav-link" href="{{ route('admin.job-experiences.index') }}">Experiences</a></li>
                </ul>
            </li>
            @endif

            @if (canAccess(['job locations']))
            <li class="dropdown {{ setSidebarActive(['admin.countries.*', 'admin.states.*', 'admin.cities.*']) }}">
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="far fa-map"></i>
                    <span>Locations</span></a>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.countries.*']) }}"><a class="nav-link" href="{{ route('admin.countries.index') }}">Countries</a></li>
                    <li class="{{ setSidebarActive(['admin.states.*']) }}"><a class="nav-link" href="{{ route('admin.states.index') }}">States</a></li>
                    <li class="{{ setSidebarActive(['admin.cities.*']) }}"><a class="nav-link" href="{{ route('admin.cities.index') }}">Cities</a></li>


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
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-puzzle-piece"></i>
                    <span>Sections</span></a>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.hero.index']) }}"><a class="nav-link" href="{{ route('admin.hero.index') }}">Hero</a></li>
                    <li class="{{ setSidebarActive(['admin.why-choose-us.*']) }}"><a class="nav-link" href="{{ route('admin.why-choose-us.index') }}">Why Choose Us</a></li>
                    <li class="{{ setSidebarActive(['admin.learn-more.*']) }}"><a class="nav-link" href="{{ route('admin.learn-more.index') }}">Learn More</a></li>
                    <li class="{{ setSidebarActive(['admin.counter.*']) }}"><a class="nav-link" href="{{ route('admin.counter.index') }}">Counter</a></li>
                    <li class="{{ setSidebarActive(['admin.job-location.*']) }}"><a class="nav-link" href="{{ route('admin.job-location.index') }}">Job Locations</a></li>
                    <li class="{{ setSidebarActive(['admin.reviews.*']) }}"><a class="nav-link" href="{{ route('admin.reviews.index') }}">Reviews</a></li>
                </ul>
            </li>
            @endif

            @if (canAccess(['site pages']))
            <li class="dropdown {{ setSidebarActive(['admin.about-us.*', 'admin.page-builder.*']) }}">
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-file"></i>
                    <span>Pages</span></a>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.about-us.*']) }}"><a class="nav-link" href="{{ route('admin.about-us.index') }}">About us</a></li>
                    <li class="{{ setSidebarActive(['admin.page-builder.*']) }}"><a class="nav-link" href="{{ route('admin.page-builder.index') }}">Page Builder</a></li>

                </ul>
            </li>
            @endif

            @if (canAccess(['site footer']))
            <li class="dropdown {{ setSidebarActive(['admin.footer.*', 'admin.social-icon.*']) }}">
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-shoe-prints"></i>
                    <span>Footer</span></a>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.footer.*']) }}"><a class="nav-link" href="{{ route('admin.footer.index') }}">Footer Details</a></li>

                    <li class="{{ setSidebarActive(['admin.social-icon.*']) }}"><a class="nav-link" href="{{ route('admin.social-icon.index') }}">Social Icons</a></li>
                </ul>
            </li>
            @endif

            @if (canAccess(['price plan']))
            <li class="{{ setSidebarActive(['admin.plans.*']) }}"><a class="nav-link" href="{{ route('admin.plans.index') }}"><i class="fas fa-box"></i> <span>Price Plan</span></a></li>
            @endif

            @if (canAccess(['news letter']))
            <li class="{{ setSidebarActive(['admin.newsletter.*']) }}"><a class="nav-link" href="{{ route('admin.newsletter.index') }}"><i class="fas fa-mail-bulk"></i> <span>Newsletter</span></a></li>
            @endif

            @if (canAccess(['menu builder']))
            <li class="{{ setSidebarActive(['admin.menu-builder.*']) }}"><a class="nav-link" href="{{ route('admin.menu-builder.index') }}"><i class="fas fa-shapes"></i> <span>Menu Builder</span></a></li>
            @endif

            @if (canAccess(['access management']))
            <li class="dropdown {{ setSidebarActive(['admin.role-user.*', 'admin.role.*']) }}">
                <a href="#" class="nav-link has-dropdown" data-toggle="dropdown"><i class="fas fa-user-shield"></i>
                    <span>Access Management</span></a>
                <ul class="dropdown-menu">
                    <li class="{{ setSidebarActive(['admin.role-user.*']) }}"><a class="nav-link" href="{{ route('admin.role-user.index') }}">Role Users</a></li>
                    <li class="{{ setSidebarActive(['admin.role.*']) }}"><a class="nav-link" href="{{ route('admin.role.index') }}">Roles</a></li>
                </ul>
            </li>
            @endif

            @if (canAccess(['payment settings']))
            <li class="{{ setSidebarActive(['admin.payment-settings.index']) }}"><a class="nav-link" href="{{ route('admin.payment-settings.index') }}"><i class="fas fa-wrench"></i> <span>Payment Settings</span></a></li>
            @endif

            @if (canAccess(['site settings']))

            <li class="{{ setSidebarActive(['admin.payment-settings.index']) }}"><a class="nav-link" href="{{ route('admin.site-settings.index') }}"><i class="fas fa-cog"></i> <span>Site Settings</span></a></li>
            @endif

            @if (canAccess(['database clear']))
            <li class="{{ setSidebarActive(['admin.clear-database.index']) }}"><a class="nav-link" href="{{ route('admin.clear-database.index') }}"><i class="fas fa-skull-crossbones"></i> <span>Clear Database</span></a></li>
            @endif

        </ul>
    </aside>
</div>
