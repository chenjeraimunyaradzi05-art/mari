@extends('layouts.master')

@section('title', 'Create your Athena account')
@section('meta_description', 'Join Athena to access respectful jobs, housing, grants, wellness tools and a guided onboarding experience tailored to your goals.')

@push('styles')
    <style>
        .header.is-hidden {
            display: none !important;
        }
    </style>
@endpush

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            var header = document.querySelector('.header');
            if (header) {
                header.classList.add('is-hidden');
            }
        });
    </script>
@endpush

@section('content')
    @php
        $focusIntentMap = [
            'career' => 'career_growth',
            'business' => 'launch_business',
            'money' => 'wealth_building',
            'wellbeing' => 'community_support',
            'community' => 'community_support',
            'housing' => 'policy_impact',
        ];

        $focusPortalMap = [
            'career' => 'education',
            'business' => 'business',
            'money' => 'financial_wellbeing',
            'wellbeing' => 'financial_wellbeing',
            'community' => 'social_feed',
            'housing' => 'real_estate',
        ];

        $focusQuery = strtolower(request('focus', ''));
        $prefillIntent = $focusIntentMap[$focusQuery] ?? null;
        $prefillPortal = $focusPortalMap[$focusQuery] ?? null;

        $selectedAccountType = old('account_type', 'candidate');
        $selectedPronouns = old('pronouns');
        $selectedIntent = old('intent', $prefillIntent);
        $selectedPortals = collect(old('desired_portals', $prefillPortal ? [$prefillPortal] : []))->filter();
        $selectedWellness = collect(old('wellness_preferences', []));
    @endphp

    <section class="section-auth" id="register">
        <div class="register-shell">
            <div class="register-hero-block">
                <span class="subheading">Join Athena</span>
                <h1 class="heading-primary">Craft your safer work, money, housing and wellbeing plan.</h1>
                <p class="hero-description">
                    A single onboarding flow unlocks AI copilots, human mentors, and respectful sponsorship data. Tell us your
                    focus, pick the portals that matter most, and we will tailor rituals, perks and accountability loops.
                </p>

                <ul class="auth-highlights">
                    <li>Women-first verification across jobs, housing, grants &amp; wellbeing.</li>
                    <li>Pronoun, privacy and intent preferences honoured in every touchpoint.</li>
                    <li>Community guardians, trauma-informed playbooks and calm nudges built in.</li>
                </ul>

                <div class="auth-meta">
                    <div>
                        <strong>3 mins</strong>
                        <span>to complete onboarding</span>
                    </div>
                    <div>
                        <strong>7 hubs</strong>
                        <span>unlocked on day one</span>
                    </div>
                    <div>
                        <strong>24/7</strong>
                        <span>guardian team coverage</span>
                    </div>
                </div>
            </div>

            <div class="register-grid">
                <div class="register-column register-column--form">
                    <div class="auth-form-card">
                        <h2 class="heading-tertiary">Create your Athena account</h2>
                        <p class="hero-description">Already onboarded? <a href="{{ route('login') }}">Sign in</a>.</p>

                        <form class="auth-form" method="POST" action="{{ route('register') }}">
                            @csrf

                            <div class="form-grid">
                                <div class="form-field">
                                    <label for="full-name">Full name *</label>
                                    <input id="full-name" type="text" name="name" placeholder="Your name"
                                        value="{{ old('name', request('name')) }}" required>
                                    <x-input-error :messages="$errors->get('name')" class="form-error" />
                                </div>

                                <div class="form-field">
                                    <label for="email">Email *</label>
                                    <input id="email" type="email" name="email" placeholder="you@example.com"
                                        value="{{ old('email', request('email')) }}" required>
                                    <x-input-error :messages="$errors->get('email')" class="form-error" />
                                </div>

                                <div class="form-field">
                                    <label for="password">Password *</label>
                                    <input id="password" type="password" name="password" placeholder="Enter a secure password" required>
                                    <x-input-error :messages="$errors->get('password')" class="form-error" />
                                </div>

                                <div class="form-field">
                                    <label for="password_confirmation">Confirm password *</label>
                                    <input id="password_confirmation" type="password" name="password_confirmation"
                                        placeholder="Repeat your password" required>
                                    <x-input-error :messages="$errors->get('password_confirmation')" class="form-error" />
                                </div>
                            </div>

                            <div class="form-field">
                                <label for="pronouns">Pronouns *</label>
                                <select id="pronouns" name="pronouns" required>
                                    <option value="" disabled {{ $selectedPronouns ? '' : 'selected' }}>Select pronouns</option>
                                    @foreach ($pronounOptions as $value => $option)
                                        <option value="{{ $value }}" {{ $selectedPronouns === $value ? 'selected' : '' }}>
                                            {{ $option['label'] ?? \Illuminate\Support\Str::headline($value) }}
                                        </option>
                                    @endforeach
                                </select>
                                <x-input-error :messages="$errors->get('pronouns')" class="form-error" />

                                <div id="pronouns-custom-field" class="form-field"
                                    style="{{ $selectedPronouns === 'self_described' ? '' : 'display: none;' }}">
                                    <label for="pronouns_custom">Self-described pronouns *</label>
                                    <input id="pronouns_custom" type="text" name="pronouns_custom" placeholder="e.g. Ze / Zir"
                                        value="{{ old('pronouns_custom') }}">
                                    <x-input-error :messages="$errors->get('pronouns_custom')" class="form-error" />
                                </div>
                            </div>

                            <div class="form-field">
                                <span class="field-label">Create account for *</span>
                                <div class="choice-grid">
                                    @foreach ($accountOptions as $value => $option)
                                        <label class="choice-card">
                                            <input type="radio" name="account_type" value="{{ $value }}"
                                                {{ $selectedAccountType === $value ? 'checked' : '' }}>
                                            <span class="choice-content">
                                                @if (!empty($option['icon']))
                                                    <span class="choice-icon"><i class="{{ $option['icon'] }}" aria-hidden="true"></i></span>
                                                @endif
                                                <span>
                                                    <strong>{{ $option['title'] }}</strong>
                                                    <p>{{ $option['summary'] }}</p>
                                                </span>
                                            </span>
                                        </label>
                                    @endforeach
                                </div>
                                <x-input-error :messages="$errors->get('account_type')" class="form-error" />
                            </div>

                            <div class="form-field">
                                <span class="field-label">What brings you to Athena? *</span>
                                <div class="choice-grid">
                                    @foreach ($intentOptions as $value => $intent)
                                        <label class="choice-card">
                                            <input type="radio" name="intent" value="{{ $value }}"
                                                {{ $selectedIntent === $value ? 'checked' : '' }}>
                                            <span class="choice-content">
                                                <strong>{{ $intent['title'] }}</strong>
                                                <p>{{ $intent['summary'] }}</p>
                                            </span>
                                        </label>
                                    @endforeach
                                </div>
                                <x-input-error :messages="$errors->get('intent')" class="form-error" />
                            </div>

                            <div class="form-field">
                                <span class="field-label">Which portals do you want to explore first? *</span>
                                <div class="choice-grid choice-grid--compact">
                                    @foreach ($portalOptions as $value => $portal)
                                        <label class="choice-card choice-card--checkbox">
                                            <input type="checkbox" name="desired_portals[]" value="{{ $value }}"
                                                {{ $selectedPortals->contains($value) ? 'checked' : '' }}>
                                            <span class="choice-content">
                                                <strong>{{ $portal['label'] }}</strong>
                                                <p>{{ $portal['description'] }}</p>
                                            </span>
                                        </label>
                                    @endforeach
                                </div>
                                <x-input-error :messages="$errors->get('desired_portals')" class="form-error" />
                            </div>

                            <div class="form-field">
                                <span class="field-label">Add any wellness preferences (optional)</span>
                                <div class="wellness-grid">
                                    @foreach ($wellnessOptions as $value => $option)
                                        <label class="wellness-toggle">
                                            <input type="checkbox" name="wellness_preferences[]" value="{{ $value }}"
                                                {{ $selectedWellness->contains($value) ? 'checked' : '' }}>
                                            <span>{{ $option['label'] }}</span>
                                        </label>
                                    @endforeach
                                </div>
                                <x-input-error :messages="$errors->get('wellness_preferences')" class="form-error" />
                            </div>

                            <button class="btn btn--full" type="submit">Submit &amp; register</button>
                        </form>
                    </div>
                </div>

                <div class="register-column register-column--support">
                    <div class="auth-support-card">
                        <h3>What brings you to Athena?</h3>
                        <ul>
                            <li>
                                <strong>Career momentum</strong><br>
                                Unlock sponsors, roles, and rituals that advance your next leap.
                            </li>
                            <li>
                                <strong>Launch or grow a venture</strong><br>
                                Match with mentors, capital allies, and distribution partners.
                            </li>
                            <li>
                                <strong>Build wealth &amp; money confidence</strong><br>
                                Tap into financial wellbeing hubs, coaches, and literacy labs.
                            </li>
                            <li>
                                <strong>Find community &amp; support</strong><br>
                                Curate safe spaces, masterminds, and accountability circles.
                            </li>
                            <li>
                                <strong>Shape policy &amp; public impact</strong><br>
                                Collaborate with civic partners and public sector coalitions.
                            </li>
                        </ul>
                    </div>
                    <div class="auth-support-card">
                        <h3>Which portals do you want first?</h3>
                        <ul>
                            <li>
                                <strong>Women Real Estate</strong><br>
                                Listings, relocation support, verified agents, and housing pathways.
                            </li>
                            <li>
                                <strong>Emergency Housing</strong><br>
                                Support for women escaping domestic abuse or violence.
                            </li>
                            <li>
                                <strong>Business Network</strong><br>
                                Founder hubs, supplier showcases, and capital matchmaking.
                            </li>
                            <li>
                                <strong>Social &amp; Community Feed</strong><br>
                                Story-driven community spaces with curated introductions.
                            </li>
                            <li>
                                <strong>Public Sector &amp; Policy</strong><br>
                                Civic labs, procurement journeys, and policy programs.
                            </li>
                            <li>
                                <strong>Education &amp; TAFE</strong><br>
                                Learning pathways, upskilling programs, and institution partners.
                            </li>
                            <li>
                                <strong>Financial Wellbeing</strong><br>
                                Money circles, literacy resources, and wellness challenges.
                            </li>
                        </ul>
                    </div>

                    <div class="auth-support-card">
                        <h3>Partners &amp; Opportunities</h3>
                        <p>Connect with leading organizations committed to your growth.</p>
                        <ul class="promo-list">
                            <li>
                                <strong>Featured Partner</strong><br>
                                Exclusive grants, roles, and mentorships available for members.
                            </li>
                            <li>
                                <strong>Sponsor Showcase</strong><br>
                                Discover brands and institutions supporting women's success.
                            </li>
                            <li>
                                <strong>Advertising Space</strong><br>
                                Promote your services to our growing community of professionals.
                            </li>
                        </ul>
                    </div>

                    <div class="auth-support-card">
                        <h3>Platform Sponsors</h3>
                        <p>Proudly supported by industry leaders.</p>
                        <div class="sponsor-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-top: 0.75rem;">
                            <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; min-height: 100px;">
                                <img src="{{ asset('img/logos/cba.svg') }}" alt="Commonwealth Bank" style="max-height: 40px; max-width: 100%; object-fit: contain;">
                            </div>
                            <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; min-height: 100px;">
                                <img src="{{ asset('img/logos/atlassian.svg') }}" alt="Atlassian" style="max-height: 30px; max-width: 100%; object-fit: contain;">
                            </div>
                            <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; min-height: 100px;">
                                <img src="{{ asset('img/logos/lendlease.svg') }}" alt="Lendlease" style="max-height: 35px; max-width: 100%; object-fit: contain;">
                            </div>
                            <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; min-height: 100px;">
                                <img src="{{ asset('img/logos/canva.svg') }}" alt="Canva" style="max-height: 45px; max-width: 100%; object-fit: contain;">
                            </div>
                        </div>
                    </div>

                    <div class="auth-support-card" style="padding: 0; border: none; background: transparent; box-shadow: none; overflow: hidden;">
                        <div id="ad-container" style="position: relative; width: 100%; height: 320px; border-radius: 24px; overflow: hidden; background: #0f172a; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);">
                            <!-- Ad content will be injected here -->
                            <div class="ad-loader" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: white;">
                                Loading opportunities...
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="register-partners-block" style="margin-top: 4rem; padding-top: 3rem; border-top: 1px solid #e2e8f0;">
                <h3 style="text-align: center; color: #64748b; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 2.5rem;">
                    Education &amp; Training Partners
                </h3>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 3rem; opacity: 0.8;">
                    <!-- TAFE NSW -->
                    <img src="{{ asset('img/logos/tafe-nsw.svg') }}" alt="TAFE NSW" style="height: 45px; width: auto; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s ease;" onmouseover="this.style.filter='grayscale(0%)'" onmouseout="this.style.filter='grayscale(100%)'">

                    <!-- RMIT -->
                    <img src="{{ asset('img/logos/rmit.svg') }}" alt="RMIT University" style="height: 40px; width: auto; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s ease;" onmouseover="this.style.filter='grayscale(0%)'" onmouseout="this.style.filter='grayscale(100%)'">

                    <!-- Monash -->
                    <img src="{{ asset('img/logos/monash.svg') }}" alt="Monash University" style="height: 35px; width: auto; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s ease;" onmouseover="this.style.filter='grayscale(0%)'" onmouseout="this.style.filter='grayscale(100%)'">

                    <!-- Swinburne -->
                    <img src="{{ asset('img/logos/swinburne.svg') }}" alt="Swinburne University" style="height: 40px; width: auto; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s ease;" onmouseover="this.style.filter='grayscale(0%)'" onmouseout="this.style.filter='grayscale(100%)'">

                    <!-- University of Sydney -->
                    <img src="{{ asset('img/logos/usyd.svg') }}" alt="University of Sydney" style="height: 45px; width: auto; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s ease;" onmouseover="this.style.filter='grayscale(0%)'" onmouseout="this.style.filter='grayscale(100%)'">

                    <!-- University of Melbourne -->
                    <img src="{{ asset('img/logos/unimelb.svg') }}" alt="University of Melbourne" style="height: 45px; width: auto; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s ease;" onmouseover="this.style.filter='grayscale(0%)'" onmouseout="this.style.filter='grayscale(100%)'">

                    <!-- UNSW -->
                    <img src="{{ asset('img/logos/unsw.svg') }}" alt="UNSW Sydney" style="height: 40px; width: auto; object-fit: contain; filter: grayscale(100%); transition: filter 0.3s ease;" onmouseover="this.style.filter='grayscale(0%)'" onmouseout="this.style.filter='grayscale(100%)'">
                </div>
            </div>
        </div>
    </section>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // Pronoun toggle logic
            const select = document.getElementById('pronouns');
            const customField = document.getElementById('pronouns-custom-field');

            if (select && customField) {
                const toggleField = () => {
                    customField.style.display = select.value === 'self_described' ? 'block' : 'none';
                };
                select.addEventListener('change', toggleField);
                toggleField();
            }

            // Ad Rotator Logic
            const adContainer = document.getElementById('ad-container');
            if (!adContainer) return;

            const ads = [
                {
                    type: 'image',
                    src: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                    title: 'Empowering Women in Business',
                    cta: 'Apply for Grant'
                },
                {
                    type: 'video',
                    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', // Sample video
                    title: 'Future of Housing',
                    cta: 'View Listings'
                },
                {
                    type: 'image',
                    src: 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                    title: 'Leadership Summit 2025',
                    cta: 'Register Now'
                }
            ];

            let currentIndex = 0;
            let intervalId;

            function renderAd(index) {
                const ad = ads[index];

                // Create new wrapper
                const wrapper = document.createElement('div');
                wrapper.style.position = 'absolute';
                wrapper.style.inset = '0';
                wrapper.style.opacity = '0';
                wrapper.style.transition = 'opacity 0.8s ease';
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.justifyContent = 'flex-end';

                let mediaEl;
                if (ad.type === 'video') {
                    mediaEl = document.createElement('video');
                    mediaEl.src = ad.src;
                    mediaEl.autoplay = true;
                    mediaEl.muted = true;
                    mediaEl.loop = true;
                    mediaEl.playsInline = true;
                    mediaEl.style.objectFit = 'cover';
                } else {
                    mediaEl = document.createElement('img');
                    mediaEl.src = ad.src;
                    mediaEl.style.objectFit = 'cover';
                }

                mediaEl.style.position = 'absolute';
                mediaEl.style.inset = '0';
                mediaEl.style.width = '100%';
                mediaEl.style.height = '100%';
                mediaEl.style.zIndex = '0';

                const overlay = document.createElement('div');
                overlay.style.position = 'absolute';
                overlay.style.inset = '0';
                overlay.style.background = 'linear-gradient(to top, rgba(15,23,42,0.9) 0%, transparent 60%)';
                overlay.style.zIndex = '1';

                const content = document.createElement('div');
                content.style.position = 'relative';
                content.style.zIndex = '2';
                content.style.padding = '1.5rem';
                content.style.color = 'white';

                const title = document.createElement('h4');
                title.textContent = ad.title;
                title.style.margin = '0 0 0.5rem 0';
                title.style.fontSize = '1.25rem';
                title.style.fontWeight = '600';

                const btn = document.createElement('button');
                btn.textContent = ad.cta;
                btn.style.padding = '0.5rem 1rem';
                btn.style.borderRadius = '999px';
                btn.style.border = 'none';
                btn.style.background = '#ec4899';
                btn.style.color = 'white';
                btn.style.fontWeight = '600';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '0.85rem';
                btn.style.transition = 'transform 0.2s ease';

                btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
                btn.onmouseout = () => btn.style.transform = 'scale(1)';

                content.appendChild(title);
                content.appendChild(btn);

                wrapper.appendChild(mediaEl);
                wrapper.appendChild(overlay);
                wrapper.appendChild(content);

                // Clear previous content and append new
                adContainer.innerHTML = '';
                adContainer.appendChild(wrapper);

                // Trigger reflow for transition
                void wrapper.offsetWidth;
                wrapper.style.opacity = '1';
            }

            function startRotation() {
                renderAd(currentIndex);
                intervalId = setInterval(() => {
                    currentIndex = (currentIndex + 1) % ads.length;
                    renderAd(currentIndex);
                }, 10000);
            }

            startRotation();
        });
    </script>
@endsection

