@extends('layouts.master')

@section('title', 'Complete your Athena setup')
@section('meta_description', 'Tell Athena how you plan to use the platform so we can tailor dashboards, nudges, and support loops to your intent.')

@section('content')
    @php
        $selectedPrimary = old('primary_role', $user->primary_role ?? 'member');
        $selectedSecondary = collect(old('secondary_roles', $user->secondary_roles ?? []))->all();
        $selectedInterests = collect(old('interests', $user->interests ?? []))->all();
        $pronounValue = old('pronouns', $user->pronouns);
        $locationValue = old('location', $user->location);
    @endphp

    <section class="section-auth" id="role-selection">
        <div class="section-shell auth-shell role-selection-shell">
            <div class="section-text role-selection-intro">
                <div class="role-selection-header">
                    <span class="subheading">Athena onboarding</span>
                    <h1 class="heading-primary">Welcome, {{ $user->preferred_name ?? $user->name }}.</h1>
                    <p class="hero-description">
                        Tell us how you plan to use Athena so we can unlock the most relevant portals, partners, and guardians.
                        Your answers guide dashboards, care rituals, and the nudges we send.
                    </p>

                    <ul class="auth-highlights">
                        <li>Role-aware dashboards with respectful defaults baked in.</li>
                        <li>Pronoun, location, and intent signals remembered everywhere.</li>
                        <li>Interests map directly to curated feeds, mentors, and grants.</li>
                    </ul>

                    <div class="auth-meta">
                        <div>
                            <strong>Step 2</strong>
                            <span>of your onboarding</span>
                        </div>
                        <div>
                            <strong>4 mins</strong>
                            <span>to tailor experiences</span>
                        </div>
                        <div>
                            <strong>Private</strong>
                            <span>Only your guardians see this</span>
                        </div>
                    </div>
                </div>

                <div class="role-progress-card">
                    <div class="role-progress-header">
                        <div>
                            <p class="eyebrow">Your onboarding path</p>
                            <strong>Step 2 of 4</strong>
                        </div>
                        <span>Next: Safety verification</span>
                    </div>
                    <div class="role-progress-bar" role="presentation">
                        <span style="width: 50%"></span>
                    </div>
                    <ul class="role-progress-steps">
                        <li class="is-complete">
                            <div>
                                <span>Account basics</span>
                                <small>Email, password, pronouns</small>
                            </div>
                            <i class="fas fa-check" aria-hidden="true"></i>
                        </li>
                        <li class="is-active">
                            <div>
                                <span>Roles &amp; focus</span>
                                <small>Tell us how you show up</small>
                            </div>
                            <span class="status-dot" aria-hidden="true"></span>
                        </li>
                        <li>
                            <div>
                                <span>Safety verification</span>
                                <small>Guardian-approved badges</small>
                            </div>
                            <small>Next</small>
                        </li>
                        <li>
                            <div>
                                <span>Ritual builder</span>
                                <small>Personalise nudges + perks</small>
                            </div>
                            <small>Finalise</small>
                        </li>
                    </ul>
                </div>

                <div class="role-support-card">
                    <p class="eyebrow">Guardian support</p>
                    <h3>Need a hand?</h3>
                    <p>Our trauma-informed guardians can co-pilot this step with you or keep sensitive info private.</p>

                    <ul class="role-support-list">
                        <li>
                            <span class="role-support-icon" aria-hidden="true">
                                <ion-icon name="shield-checkmark-outline"></ion-icon>
                            </span>
                            Confidential, trauma-informed support
                        </li>
                        <li>
                            <span class="role-support-icon" aria-hidden="true">
                                <ion-icon name="chatbubbles-outline"></ion-icon>
                            </span>
                            Live chat, SMS or quick calls
                        </li>
                        <li>
                            <span class="role-support-icon" aria-hidden="true">
                                <ion-icon name="lock-closed-outline"></ion-icon>
                            </span>
                            We only share what you approve
                        </li>
                    </ul>

                    <div class="role-support-actions">
                        <a class="btn btn--full" href="mailto:onboarding@weareathena.com">Email onboarding</a>
                        <button class="btn btn--outline" type="button" data-guardian-chat>Chat with a guardian</button>
                    </div>
                    <p class="role-support-tip">Average response time under 10 minutes, daily 9am–10pm AEST.</p>
                </div>

                <div class="role-panel role-selection-optional">
                    <div class="role-panel__header">
                        <div>
                            <p class="eyebrow">Optional roles</p>
                            <h2>Layer on additional roles</h2>
                        </div>
                        <p>Adding roles unlocks extra navigation hubs and partner tools.</p>
                    </div>

                    <div class="secondary-grid">
                        @foreach ($roles as $key => $role)
                            <label class="secondary-role {{ in_array($key, $selectedSecondary, true) ? 'is-active' : '' }}">
                                <input form="role-selection-form" type="checkbox" name="secondary_roles[]" value="{{ $key }}" {{ in_array($key, $selectedSecondary, true) ? 'checked' : '' }}>
                                <span class="secondary-role__icon"><i class="{{ $role['icon'] }}" aria-hidden="true"></i></span>
                                <span>{{ $role['name'] }}</span>
                            </label>
                        @endforeach
                    </div>
                </div>
            </div>

            <div class="section-media">
                <form id="role-selection-form" class="section-media-panel role-selection-card" method="POST" action="{{ route('role-selection.store') }}">
                    @csrf

                    <div class="role-panel">
                        <div class="role-panel__header">
                            <div>
                                <p class="eyebrow">Primary lens</p>
                                <h2>Choose your primary role</h2>
                            </div>
                            <p>This is the lens we default to across dashboards. You can still add more roles below.</p>
                        </div>

                        <div class="role-grid">
                            @foreach ($roles as $key => $role)
                                <label class="role-card {{ $selectedPrimary === $key ? 'is-active' : '' }}">
                                    <input type="radio" name="primary_role" value="{{ $key }}" {{ $selectedPrimary === $key ? 'checked' : '' }} required>
                                    <span class="role-card__icon" style="--role-tint: {{ $role['color'] }}; --role-tint-soft: {{ $role['color'] }}1a;">
                                        <i class="{{ $role['icon'] }}" aria-hidden="true"></i>
                                    </span>
                                    <span class="role-card__title">{{ $role['name'] }}</span>
                                    <span class="role-card__description">{{ $role['description'] }}</span>
                                    <ul class="role-card__features">
                                        @foreach (array_slice($role['features'], 0, 3) as $feature)
                                            <li>{{ $feature }}</li>
                                        @endforeach
                                    </ul>
                                </label>
                            @endforeach
                        </div>
                        @error('primary_role')
                            <p class="form-error">{{ $message }}</p>
                        @enderror
                    </div>

                    <div class="role-panel">
                        <div class="role-panel__header">
                            <div>
                                <p class="eyebrow">About you</p>
                                <h2>Tell us about you</h2>
                            </div>
                            <p>We keep this private and use it to personalise greetings, support, and insights.</p>
                        </div>

                        <div class="form-grid role-form-grid">
                            <div class="form-field">
                                <label for="role-pronouns">Pronouns</label>
                                <select id="role-pronouns" name="pronouns">
                                    <option value="">Select pronouns</option>
                                    @foreach ($pronouns as $option)
                                        <option value="{{ $option }}" {{ $pronounValue === $option ? 'selected' : '' }}>{{ ucfirst($option) }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="form-field">
                                <label for="role-location">Location</label>
                                <select id="role-location" name="location">
                                    <option value="">Select location</option>
                                    @foreach ($locations as $code => $label)
                                        <option value="{{ $code }}" {{ $locationValue === $code ? 'selected' : '' }}>{{ $label }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="form-field">
                                <label for="role-phone">Phone (optional)</label>
                                <input id="role-phone" type="tel" name="phone" value="{{ old('phone', $user->phone) }}" maxlength="20">
                            </div>
                        </div>

                        <div class="form-field">
                            <label for="role-selection-bio">Short bio</label>
                            <textarea id="role-selection-bio" name="bio" rows="3" maxlength="500">{{ old('bio', $user->bio) }}</textarea>
                            <small class="form-field__hint"><span id="role-selection-bio-count">{{ strlen(old('bio', $user->bio ?? '')) }}</span>/500 characters</small>
                        </div>
                    </div>

                    <div class="role-panel">
                        <div class="role-panel__header">
                            <div>
                                <p class="eyebrow">Focus areas</p>
                                <h2>What are you focused on?</h2>
                            </div>
                            <p>Select every topic you actively care about—we will tailor feeds, matches, and nudges.</p>
                        </div>

                        <div class="interest-grid">
                            @foreach ($interests as $key => $label)
                                <label class="interest-chip {{ in_array($key, $selectedInterests, true) ? 'is-active' : '' }}">
                                    <input type="checkbox" name="interests[]" value="{{ $key }}" {{ in_array($key, $selectedInterests, true) ? 'checked' : '' }}>
                                    <span>{{ $label }}</span>
                                    <i class="fas fa-check" aria-hidden="true"></i>
                                </label>
                            @endforeach
                        </div>
                    </div>

                    <div class="role-selection-actions">
                        <button type="submit" class="btn btn--full">Complete setup</button>
                        <p class="role-selection-note">You can revisit this anytime via Settings → Roles.</p>
                    </div>
                </form>
            </div>
        </div>
    </section>
@endsection



@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
    const bioField = document.getElementById('role-selection-bio');
    const bioCount = document.getElementById('role-selection-bio-count');
    if (bioField && bioCount) {
        bioField.addEventListener('input', () => {
            bioCount.textContent = bioField.value.length;
        });
    }

    const primaryInputs = document.querySelectorAll('input[name="primary_role"]');
    const secondaryInputs = document.querySelectorAll('input[name="secondary_roles[]"]');
    const syncSecondary = () => {
        const primary = document.querySelector('input[name="primary_role"]:checked');
        secondaryInputs.forEach((checkbox) => {
            const parent = checkbox.parentElement;
            if (!primary) {
                checkbox.disabled = false;
                parent?.classList.remove('secondary-role--disabled');
                return;
            }
            if (checkbox.value === primary.value) {
                checkbox.checked = false;
                checkbox.disabled = true;
                parent?.classList.add('secondary-role--disabled');
            } else {
                checkbox.disabled = false;
                parent?.classList.remove('secondary-role--disabled');
            }
        });
    };

    primaryInputs.forEach((radio) => radio.addEventListener('change', syncSecondary));
    syncSecondary();
});
</script>
@endpush

