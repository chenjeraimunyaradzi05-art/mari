{{-- resources/views/partials/aura-header-inline.blade.php
     Usage examples:

     1) Array-driven (no DB):
        @php
          $menu = [
            ['label' => 'Home', 'link' => url('/')],
            ['label' => 'Jobs', 'link' => url('/jobs'), 'child' => [
                ['label' => 'Tech', 'link' => url('/jobs/tech')],
                ['label' => 'Creative', 'link' => url('/jobs/creative')],
            ]],
            ['label' => 'About', 'link' => url('/about')],
          ];
        @endphp
        @include('partials.aura-header-inline', [
            'menuItems' => $menu,
            'tagline' => 'Guiding purpose-led women toward radiant financial futures and fearless careers.',
            'showShortcuts' => true,
        ])

     2) DB-driven fallback:
        @include('partials.aura-header-inline', ['menuName' => 'Navigation Menu'])
--}}

@php
    use Illuminate\Support\Facades\Schema;
    use Illuminate\Support\Facades\Route as RouteFacade;

    // Defaults (only if not provided)
    $menuName = $menuName ?? 'Navigation Menu';
    $tagline = $tagline ?? 'Guiding purpose-led women toward radiant financial futures and fearless careers.';
    $logo = $logo ?? config('settings.site_logo');
    $siteName = $siteName ?? config('settings.site_name', 'MoneyMan');
    $showShortcuts = isset($showShortcuts) ? (bool) $showShortcuts : true;

    // Normalize a potentially mixed object/array menu structure into a consistent shape.
    $normalizeItem = function ($item) {
        $i = (array) $item;

        $childrenRaw = $i['child'] ?? $i['children'] ?? [];
        if ($childrenRaw instanceof \Illuminate\Support\Collection) {
            $childrenRaw = $childrenRaw->all();
        }

        $children = collect($childrenRaw ?? [])->map(function ($c) {
            $c = (array) $c;
            return [
                'label' => $c['label'] ?? ($c['title'] ?? 'Untitled'),
                'link'  => $c['link'] ?? ($c['url'] ?? '#'),
                'child' => [], // one level deep
            ];
        })->values()->all();

        return [
            'label' => $i['label'] ?? ($i['title'] ?? 'Untitled'),
            'link'  => $i['link'] ?? ($i['url'] ?? '#'),
            'child' => $children,
        ];
    };

    /**
     * Build the navigation:
     * - Prefer $menuItems (passed in)
     * - Else try DB by $menuName (if table exists)
     * - Else empty
     */
    $navigationMenu = collect();
    if (!empty($menuItems)) {
        $navigationMenu = collect($menuItems)->map($normalizeItem)->values();
    } elseif (Schema::hasTable('admin_menus')) {
        $raw = \Menu::getByName($menuName) ?? [];
        $navigationMenu = collect($raw)->map($normalizeItem)->values();
    }

    // Feed route with safe fallback if named route missing
    $feedRoute = RouteFacade::has('feed.index') ? route('feed.index') : url('/feed');

    // URL equality helper
    $equals = function ($a, $b) {
        return rtrim(url($a ?? ''), '/') === rtrim($b ?? '', '/');
    };

    // Avoid duplicate "Feed" if already present in the menu (including children)
    $hasFeedLink = $navigationMenu->contains(function ($menuItem) use ($feedRoute, $equals) {
        if ($equals($menuItem['link'] ?? '', $feedRoute)) {
            return true;
        }
        foreach ($menuItem['child'] ?? [] as $child) {
            if ($equals($child['link'] ?? '', $feedRoute)) {
                return true;
            }
        }
        return false;
    });

    $currentUrl = rtrim(url()->current(), '/');
    $isActive = function ($href) use ($currentUrl) {
        return rtrim(url($href ?? '#'), '/') === $currentUrl;
    };
@endphp

<header class="header sticky-bar aura-header" role="banner">
    <a class="sr-only sr-only-focusable" href="#main">Skip to content</a>

    <span class="aura-header__veil" aria-hidden="true"></span>
    <span class="aura-header__beam aura-header__beam--left" aria-hidden="true"></span>
    <span class="aura-header__beam aura-header__beam--right" aria-hidden="true"></span>

    <div class="container aura-header__container">
        {{-- Brand --}}
        <div class="aura-header__brand">
            <a class="aura-header__logo" href="{{ url('/') }}" aria-label="{{ $siteName }} — home">
                <img
                    src="{{ $logo }}"
                    alt="{{ $siteName }} logo"
                    height="48"
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                />
            </a>
            <div class="aura-header__intro">
                <span class="aura-header__eyebrow">
                    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                    MoneyMan v3 Collective
                </span>
                <p class="aura-header__tagline">{{ $tagline }}</p>
            </div>
        </div>

        {{-- ONE-ROW NAV + ACTIONS --}}
        <div class="aura-header__bar">
            <nav id="primaryNav" class="aura-header__nav aura-inline" aria-label="Primary">
                <ul id="primaryMenu" class="aura-header__menu aura-inline__menu" role="menubar">
                    @forelse ($navigationMenu as $menu)
                        @php
                            $children = $menu['child'] ?? [];
                            $hasChildren = !empty($children);
                            $active = $isActive($menu['link']);
                        @endphp

                        <li class="aura-header__item {{ $hasChildren ? 'aura-header__item--has-children' : '' }}" role="none">
                            <a
                                class="aura-header__link aura-inline__link {{ $active ? 'is-active' : '' }}"
                                href="{{ url($menu['link'] ?? '#') }}"
                                role="menuitem"
                                @if($hasChildren) aria-haspopup="true" aria-expanded="false" @endif
                                @if($active) aria-current="page" @endif
                            >
                                <i class="fas fa-star aura-icon" aria-hidden="true"></i>
                                <span>{{ $menu['label'] }}</span>
                                @if ($hasChildren)
                                    <i class="fas fa-chevron-down aura-caret" aria-hidden="true"></i>
                                @endif
                            </a>

                            @if ($hasChildren)
                                <ul class="aura-header__submenu" role="menu">
                                    @foreach ($children as $childMenu)
                                        @php $childActive = $isActive($childMenu['link']); @endphp
                                        <li role="none">
                                            <a
                                                class="aura-header__sublink {{ $childActive ? 'is-active' : '' }}"
                                                href="{{ url($childMenu['link'] ?? '#') }}"
                                                role="menuitem"
                                                @if($childActive) aria-current="page" @endif
                                            >
                                                <i class="fas fa-circle-notch aura-icon--sm" aria-hidden="true"></i>
                                                <span>{{ $childMenu['label'] }}</span>
                                            </a>
                                        </li>
                                    @endforeach
                                </ul>
                            @endif
                        </li>
                    @empty
                        {{-- Optional: fallback items when no menu exists --}}
                    @endforelse

                    @if (! $hasFeedLink)
                        <li class="aura-header__item" role="none">
                            <a class="aura-header__link aura-inline__link {{ $isActive($feedRoute) ? 'is-active' : '' }}" href="{{ $feedRoute }}" role="menuitem" @if($isActive($feedRoute)) aria-current="page" @endif>
                                <i class="fas fa-rss aura-icon" aria-hidden="true"></i>
                                <span>Feed</span>
                            </a>
                        </li>
                    @endif
                </ul>
            </nav>

            <div class="aura-header__actions aura-inline__actions">
                <div class="aura-header__microcopy aura-inline__micro" aria-live="polite">
                    <span><i class="fas fa-moon-stars aura-icon" aria-hidden="true"></i> Nurture your glow</span>
                </div>

                <div class="aura-header__buttons aura-inline__btns">
                    @guest
                        <a class="aura-header__cta aura-header__cta--primary" href="{{ route('login') }}">
                            <i class="fas fa-door-open aura-icon" aria-hidden="true"></i>
                            <span>Sign in</span>
                        </a>
                    @endguest

                    @auth
                        @if (auth()->user()->role === 'company')
                            <a class="aura-header__cta aura-header__cta--primary" href="{{ route('company.dashboard') }}">
                                <i class="fas fa-gem aura-icon" aria-hidden="true"></i>
                                <span>Company Lounge</span>
                            </a>
                        @elseif(auth()->user()->role === 'candidate')
                            <div class="aura-header__cta-stack aura-inline__stack">
                                <a class="aura-header__cta aura-header__cta--ghost" href="{{ route('member.onboarding.index') }}">
                                    <i class="fas fa-seedling aura-icon" aria-hidden="true"></i>
                                    <span>Onboarding Journey</span>
                                </a>
                                <a class="aura-header__cta aura-header__cta--primary" href="{{ route('member.dashboard') }}">
                                    <i class="fas fa-sun aura-icon" aria-hidden="true"></i>
                                    <span>Member Dashboard</span>
                                </a>
                            </div>
                        @endif
                    @endauth
                </div>

                <button
                    class="aura-header__burger burger-icon burger-icon-white aura-inline__burger"
                    type="button"
                    aria-label="Open navigation"
                    aria-expanded="false"
                    aria-controls="primaryMenu"
                >
                    <span class="aura-header__burger-bar"></span>
                    <span class="aura-header__burger-bar"></span>
                    <span class="aura-header__burger-bar"></span>
                </button>
            </div>
        </div>
        {{-- /ONE-ROW NAV + ACTIONS --}}
    </div>

    @if($showShortcuts)
        <div class="aura-header__shortcuts" role="navigation" aria-label="Opportunity shortcuts">
            <ul class="aura-header__shortcuts-list">
                <li class="aura-header__shortcut">
                    <a class="aura-header__shortcut-link" href="{{ route('business.network') }}">
                        <i class="fas fa-people-arrows" aria-hidden="true"></i>
                        <span class="aura-header__shortcut-label">Business Network</span>
                        <span class="aura-header__shortcut-note">Curated partners &amp; mentors</span>
                    </a>
                </li>
                <li class="aura-header__shortcut">
                    <a class="aura-header__shortcut-link" href="{{ route('company.dashboard') }}">
                        <i class="fas fa-building" aria-hidden="true"></i>
                        <span class="aura-header__shortcut-label">Company</span>
                        <span class="aura-header__shortcut-note">Employer console &amp; briefs</span>
                    </a>
                </li>
                <li class="aura-header__shortcut">
                    <a class="aura-header__shortcut-link" href="{{ url('/government') }}">
                        <i class="fas fa-landmark" aria-hidden="true"></i>
                        <span class="aura-header__shortcut-label">Government</span>
                        <span class="aura-header__shortcut-note">Funding &amp; procurement</span>
                    </a>
                </li>
                <li class="aura-header__shortcut">
                    <a class="aura-header__shortcut-link" href="{{ route('member.dashboard') }}">
                        <i class="fas fa-user-astronaut" aria-hidden="true"></i>
                        <span class="aura-header__shortcut-label">Member</span>
                        <span class="aura-header__shortcut-note">Personalised career hub</span>
                    </a>
                </li>
                <li class="aura-header__shortcut">
                    <a class="aura-header__shortcut-link" href="{{ route('education.tafe.dashboard') }}">
                        <i class="fas fa-graduation-cap" aria-hidden="true"></i>
                        <span class="aura-header__shortcut-label">TAFE &amp; University</span>
                        <span class="aura-header__shortcut-note">Pathways &amp; upskilling</span>
                    </a>
                </li>
                <li class="aura-header__shortcut">
                    <a class="aura-header__shortcut-link" href="{{ url('/trades') }}">
                        <i class="fas fa-hard-hat" aria-hidden="true"></i>
                        <span class="aura-header__shortcut-label">Trades</span>
                        <span class="aura-header__shortcut-note">Licences &amp; traineeships</span>
                    </a>
                </li>
            </ul>
        </div>
    @endif
</header>

@once

@endonce

@once
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            var burger = document.querySelector('.aura-inline__burger');
            var nav = document.querySelector('.aura-header__nav');
            var menu = document.getElementById('primaryMenu');

            if (!burger || !nav || !menu) {
                return;
            }

            function updateState(isOpen){
                burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                burger.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
                if (isOpen) {
                    var firstLink = menu.querySelector('a');
                    if (firstLink) {
                        firstLink.focus({ preventScroll: true });
                    }
                }
            }

            // Toggle open/close
            burger.addEventListener('click', function () {
                var isOpen = nav.classList.toggle('is-open');
                updateState(isOpen);
            });

            // Close on link click (mobile)
            nav.querySelectorAll('a').forEach(function (link) {
                link.addEventListener('click', function () {
                    if (!nav.classList.contains('is-open')) {
                        return;
                    }
                    nav.classList.remove('is-open');
                    updateState(false);
                });
            });

            // Close on outside click
            document.addEventListener('click', function (e) {
                if (!nav.classList.contains('is-open')) {
                    return;
                }
                if (!nav.contains(e.target) && !burger.contains(e.target)) {
                    nav.classList.remove('is-open');
                    updateState(false);
                }
            });

            // Close on Escape
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && nav.classList.contains('is-open')) {
                    nav.classList.remove('is-open');
                    updateState(false);
                    burger.focus();
                }
            });
        });
    </script>
@endonce

