@php
    $isHome = request()->routeIs('home');
    $isAthenaSocial = request()->routeIs('athena.social');
    $ctaTarget = $isAthenaSocial ? '#cta' : route('athena.social') . '#cta';
@endphp

<footer class="footer">
    <div class="footer__inner">
        <div class="footer__brand">
            <a href="{{ route('home') }}" class="logo-link footer-logo-link" aria-label="Athena home">
                <img class="logo" src="{{ asset('default-uploads/logo.svg') }}" alt="Athena logo" />
            </a>
            <p class="footer-text">
                &copy; <span class="year">{{ date('Y') }}</span> {{ config('app.name', 'Athena') }}. Crafted with care by
                <strong>Munyaradzi Chenjerai</strong>.
            </p>
            <ul class="footer-meta">
                <li>Respectful AI copilots</li>
                <li>Community verified partners</li>
            </ul>
        </div>

        <nav class="footer__nav" aria-label="Footer navigation">
            <p class="footer-nav__title">Explore Athena</p>
            <ul class="footer-links">
                <li><a href="{{ $isHome ? '#how' : route('home') . '#how' }}">How it works</a></li>
                <li><a href="{{ $isHome ? '#features' : route('home') . '#features' }}">Modules</a></li>
                <li><a href="{{ $isHome ? '#impact' : route('home') . '#impact' }}">Impact</a></li>
                <li><a href="{{ $isHome ? '#pricing' : route('home') . '#pricing' }}">Pricing</a></li>
                <li><a href="{{ route('athena.social') }}">Athena social + AI</a></li>
                <li><a href="{{ $ctaTarget }}">Get started</a></li>
            </ul>
            <a class="footer-cta" href="{{ $ctaTarget }}">
                Join Athena
                <span aria-hidden="true">→</span>
            </a>
        </nav>
    </div>
</footer>

