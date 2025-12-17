@extends('layouts.master')

@section('title', 'Select your primary purpose')
@section('meta_description', 'Tell Athena your primary purpose so we can unlock the right guardians, dashboards, and protections before you enter the network.')

@section('content')
    @php
        $purposeKeys = array_keys($purposeOptions);
    @endphp

    <section class="section-auth" id="primary-purpose">
        <div class="section-shell auth-shell role-selection-shell">
            <div class="section-text role-selection-intro">
                <div class="role-selection-header">
                    <span class="subheading">Athena onboarding</span>
                    <h1 class="heading-primary">What brings you here?</h1>
                    <p class="hero-description">
                        We protect the network by tailoring access by purpose. Pick the role that best represents
                        why you created this account and layer on your secondary intents—this drives feature flags,
                        privacy defaults, and the guardians assigned to you.
                    </p>

                    <ul class="auth-highlights">
                        <li>Required step before any dashboard unlocks.</li>
                        <li>Purpose drives role-aware feature flags and safety rails.</li>
                        <li>Telemetry is anonymised and reviewed by guardians only.</li>
                    </ul>

                    <div class="auth-meta">
                        <div>
                            <strong>Step 1</strong>
                            <span>Purpose capture</span>
                        </div>
                        <div>
                            <strong>90 sec</strong>
                            <span>average completion</span>
                        </div>
                        <div>
                            <strong>Guarded</strong>
                            <span>Only safety ops can view</span>
                        </div>
                    </div>
                </div>

                <div class="role-progress-card">
                    <div class="role-progress-header">
                        <div>
                            <p class="eyebrow">Onboarding path</p>
                            <strong>Step 1 of 4</strong>
                        </div>
                        <span>Next: Roles &amp; focus</span>
                    </div>
                    <div class="role-progress-bar" role="presentation">
                        <span style="width: 25%"></span>
                    </div>
                    <ul class="role-progress-steps">
                        <li class="is-active">
                            <div>
                                <span>Primary purpose</span>
                                <small>Why you joined</small>
                            </div>
                            <span class="status-dot" aria-hidden="true"></span>
                        </li>
                        <li>
                            <div>
                                <span>Roles &amp; focus</span>
                                <small>Unlock dashboards</small>
                            </div>
                            <small>Next</small>
                        </li>
                        <li>
                            <div>
                                <span>Safety verification</span>
                                <small>Consent + guardians</small>
                            </div>
                        </li>
                        <li>
                            <div>
                                <span>Ritual builder</span>
                                <small>Personalise nudges</small>
                            </div>
                        </li>
                    </ul>
                </div>

                <div class="role-support-card">
                    <p class="eyebrow">Need help?</p>
                    <h3>Guardians can co-pilot</h3>
                    <p>Have a safety or privacy concern? Email onboarding@weareathena.com or ping live chat and we will walk you through this step.</p>
                    <div class="role-support-actions">
                        <a class="btn btn--outline" href="mailto:onboarding@weareathena.com">Email onboarding</a>
                        <button class="btn btn--ghost" type="button" data-guardian-chat>Open guardian chat</button>
                    </div>
                </div>
            </div>

            <div class="section-media">
                <form class="section-media-panel role-selection-card" method="POST" action="{{ route('primary-purpose.store') }}">
                    @csrf

                    <div class="role-panel">
                        <div class="role-panel__header">
                            <div>
                                <p class="eyebrow">Required</p>
                                <h2>Select your primary purpose</h2>
                            </div>
                            <p>Match the option that best reflects why you are registering today. This controls default dashboards and compliance obligations.</p>
                        </div>

                        <div class="role-grid">
                            @foreach ($purposeOptions as $value => $option)
                                <label class="role-card {{ $selectedPurpose === $value ? 'is-active' : '' }}">
                                    <input type="radio" name="primary_purpose" value="{{ $value }}" {{ $selectedPurpose === $value ? 'checked' : '' }} required>
                                    <span class="role-card__icon" style="--role-tint: #f472b6; --role-tint-soft: #fde7f2;">
                                        <i class="{{ $option['icon'] ?? 'fas fa-compass' }}" aria-hidden="true"></i>
                                    </span>
                                    <span class="role-card__title">{{ $option['title'] ?? \Illuminate\Support\Str::headline($value) }}</span>
                                    <span class="role-card__description">{{ $option['summary'] ?? '' }}</span>
                                </label>
                            @endforeach
                        </div>
                        <x-input-error :messages="$errors->get('primary_purpose')" class="form-error" />
                    </div>

                    <div class="role-panel">
                        <div class="role-panel__header">
                            <div>
                                <p class="eyebrow">Secondary intents</p>
                                <h2>What should Athena prioritise?</h2>
                            </div>
                            <p>Choose at least one intent so we can queue the right nudges, alerts, and mentors.</p>
                        </div>

                        <div class="choice-grid choice-grid--compact">
                            @foreach ($intentOptions as $value => $intent)
                                <label class="choice-card choice-card--checkbox {{ in_array($value, $selectedIntents ?? [], true) ? 'is-active' : '' }}">
                                    <input type="checkbox" name="secondary_intents[]" value="{{ $value }}" {{ in_array($value, $selectedIntents ?? [], true) ? 'checked' : '' }}>
                                    <span class="choice-content">
                                        <strong>{{ $intent['title'] ?? \Illuminate\Support\Str::headline($value) }}</strong>
                                        <p>{{ $intent['summary'] ?? '' }}</p>
                                    </span>
                                </label>
                            @endforeach
                        </div>
                        <x-input-error :messages="$errors->get('secondary_intents')" class="form-error" />
                    </div>

                    <div class="role-panel">
                        <div class="role-panel__header">
                            <div>
                                <p class="eyebrow">Identity alignment</p>
                                <h2>Help our male-signal heuristics</h2>
                            </div>
                            <p>Answering this lets our guardians differentiate allies/employers from members joining for personal use.</p>
                        </div>

                        <div class="form-field">
                            @foreach ($identityOptions as $value => $label)
                                <label class="identity-radio {{ $selectedAlignment === $value ? 'is-active' : '' }}">
                                    <input type="radio" name="identity_alignment" value="{{ $value }}" {{ $selectedAlignment === $value ? 'checked' : '' }} required>
                                    <span>{{ $label }}</span>
                                </label>
                            @endforeach
                        </div>
                        <x-input-error :messages="$errors->get('identity_alignment')" class="form-error" />
                    </div>

                    <div class="role-panel" id="public-sector-details" style="display: none;">
                        <div class="role-panel__header">
                            <div>
                                <p class="eyebrow">Public Sector Verification</p>
                                <h2>Agency Details</h2>
                            </div>
                            <p>Please provide your agency or department name to help us verify your public sector status.</p>
                        </div>
                        <div class="form-field">
                            <label for="agency_name">Agency / Department Name</label>
                            <input type="text" id="agency_name" name="agency_name" class="form-input" placeholder="e.g. Department of Education">
                        </div>
                    </div>

                    <div class="role-panel">
                        <div class="form-field">
                            <label for="purpose_story">Anything else we should know? <small>(optional)</small></label>
                            <textarea id="purpose_story" name="purpose_story" rows="4" maxlength="600">{{ $purposeStory }}</textarea>
                            <small class="form-field__hint"><span id="purpose-story-count">{{ strlen($purposeStory ?? '') }}</span>/600</small>
                            <x-input-error :messages="$errors->get('purpose_story')" class="form-error" />
                        </div>
                        <div class="form-field">
                            <label for="male_signal_notes">Ally / employer notes <small>(optional)</small></label>
                            <textarea id="male_signal_notes" name="male_signal_notes" rows="3" maxlength="600">{{ $maleSignalNotes }}</textarea>
                            <small class="form-field__hint">Explain if you are an ally, employer, or using a shared inbox.</small>
                            <x-input-error :messages="$errors->get('male_signal_notes')" class="form-error" />
                        </div>
                    </div>

                    <div class="role-selection-actions">
                        <button type="submit" class="btn btn--full">Continue to role setup</button>
                        <p class="role-selection-note">Your purpose can be updated later via Settings → Purpose &amp; access.</p>
                    </div>
                </form>
            </div>
        </div>
    </section>
@endsection

@push('scripts')
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const story = document.getElementById('purpose_story');
        const storyCount = document.getElementById('purpose-story-count');
        if (story && storyCount) {
            story.addEventListener('input', () => {
                storyCount.textContent = story.value.length;
            });
        }

        const purposeRadios = document.querySelectorAll('input[name="primary_purpose"]');
        const publicSectorDetails = document.getElementById('public-sector-details');
        const agencyInput = document.getElementById('agency_name');

        function togglePublicSectorDetails() {
            const selected = document.querySelector('input[name="primary_purpose"]:checked');
            if (selected && selected.value === 'public_sector') {
                publicSectorDetails.style.display = 'block';
                agencyInput.required = true;
            } else {
                publicSectorDetails.style.display = 'none';
                agencyInput.required = false;
            }
        }

        purposeRadios.forEach(radio => {
            radio.addEventListener('change', togglePublicSectorDetails);
        });

        // Initial check
        togglePublicSectorDetails();
    });
</script>
<script>
    (function(){
        const sendTelemetry = (payload) => {
            try {
                fetch("{{ route('primary-purpose.telemetry') }}", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.getAttribute('content') || ''
                    },
                    body: JSON.stringify(payload),
                    keepalive: true,
                });
            } catch (e) { /* best-effort */ }
        };

        let submitted = false;
        const form = document.querySelector('form[action="{{ route('primary-purpose.store') }}"]');
        if (form) {
            form.addEventListener('submit', () => submitted = true);
        }

        window.addEventListener('beforeunload', function () {
            if (submitted) return;
            sendTelemetry({ event: 'abandoned', step: 'primary-purpose', time_on_page: Math.round(performance.now()/1000), source: 'web' });
        });

        const skipBtn = document.querySelector('.role-selection-actions a, #skip-primary-purpose');
        if (skipBtn) {
            skipBtn.addEventListener('click', function () {
                sendTelemetry({ event: 'abandoned', step: 'skipped', time_on_page: Math.round(performance.now()/1000), source: 'web' });
            });
        }
    })();
</script>
@endpush

