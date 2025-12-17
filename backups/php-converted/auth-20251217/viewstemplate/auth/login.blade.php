@extends('layouts.master')

@section('title', 'Sign in')
@section('meta_description', 'Sign in to Athena to pick up where you left off across jobs, money, housing, wellbeing and the Athena Lounge.')

@section('content')
    <section class="auth-shell">
        <div class="auth-hero">
            <div class="auth-hero__copy">
                <p class="auth-eyebrow">Member access</p>
                <h1>Welcome back to your Athena dashboard</h1>
                <p>
                    Keep every job lead, financial insight, housing path and wellbeing ritual in one calm surface. Athena remembers your
                    progress, honours your boundaries, and keeps AI Concierge tuned to your goals.
                </p>

                <div class="auth-highlights" role="list">
                    <div class="auth-highlight" role="listitem">
                        <div class="auth-highlight__icon" aria-hidden="true">⚡</div>
                        <div>
                            <p class="auth-highlight__title">Unified updates</p>
                            <p class="auth-highlight__copy">Latest status across jobs, grants, safe housing and AI Concierge briefs.</p>
                        </div>
                    </div>
                    <div class="auth-highlight" role="listitem">
                        <div class="auth-highlight__icon" aria-hidden="true">🔐</div>
                        <div>
                            <p class="auth-highlight__title">Respectful security</p>
                            <p class="auth-highlight__copy">Session health, device alerts and multi-factor ready when you are.</p>
                        </div>
                    </div>
                    <div class="auth-highlight" role="listitem">
                        <div class="auth-highlight__icon" aria-hidden="true">🤝</div>
                        <div>
                            <p class="auth-highlight__title">Athena Lounge</p>
                            <p class="auth-highlight__copy">Drop back into moderated discussions, referrals and AI co-drafts.</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="auth-panel" aria-labelledby="auth-heading">
                <div class="auth-panel__header">
                    <p class="auth-panel__eyebrow">Sign in</p>
                    <h2 id="auth-heading">Continue with your member credentials</h2>
                    <p>Grounded, distraction-free login that mirrors the dashboard surface.</p>
                </div>

                <!-- Session Status -->
                <x-auth-session-status class="auth-alert" :status="session('status')" />

                <form class="auth-form" method="POST" action="{{ route('login') }}">
                    @csrf
                    <input type="hidden" name="timezone" id="login-timezone" value="">
                    <input type="hidden" name="offset_minutes" id="login-offset-minutes" value="">

                    <div class="form-field">
                        <label for="login-email">Email address</label>
                        <input
                            class="auth-input {{ $errors->has('email') ? 'has-error' : '' }}"
                            id="login-email"
                            type="email"
                            name="email"
                            value="{{ old('email') }}"
                            placeholder="you@example.com"
                            required
                            autocomplete="email"
                        >
                        <x-input-error :messages="$errors->get('email')" class="input-error" />
                    </div>

                    <div class="form-field">
                        <div class="field-label-row">
                            <label for="login-password">Password</label>
                            <a class="auth-link" href="{{ route('password.request') }}">Forgot password?</a>
                        </div>
                        <input
                            class="auth-input {{ $errors->has('password') ? 'has-error' : '' }}"
                            id="login-password"
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            required
                            autocomplete="current-password"
                        >
                        <x-input-error :messages="$errors->get('password')" class="input-error" />
                    </div>

                    <label class="auth-checkbox">
                        <input type="checkbox" name="remember">
                        <span>Remember this device</span>
                    </label>

                    <button class="auth-submit" type="submit">Sign in to Athena</button>

                    <p class="auth-switch">
                        New to Athena?
                        <a class="auth-link" href="{{ route('register') }}">Create your membership</a>
                    </p>
                </form>
            </div>
        </div>
    </section>

    @push('scripts')
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                var timezoneInput = document.getElementById('login-timezone');
                var offsetInput = document.getElementById('login-offset-minutes');

                if (timezoneInput) {
                    var zone = null;
                    try {
                        zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    } catch (error) {
                        zone = null;
                    }

                    if (zone) {
                        timezoneInput.value = zone;
                    }
                }

                if (offsetInput) {
                    offsetInput.value = (new Date().getTimezoneOffset() * -1).toString();
                }
            });
        </script>
    @endpush
@endsection
