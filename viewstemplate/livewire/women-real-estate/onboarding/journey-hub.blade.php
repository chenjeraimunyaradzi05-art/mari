@once
    @push('styles')
        <link rel="stylesheet" href="{{ asset('css/style.css') }}">
    @endpush
@endonce

<div class="real-estate-onboarding">
    <section class="hub-section hub-section--intro hub-section--signals-right" id="journey-hub-hero">
        <div class="container hub-section__layout">
            <div class="hub-section__content real-estate-onboarding__hero">
                <p class="section-eyebrow">WomenRise real estate</p>
                <h2 class="heading-secondary">Choose how you want to show up</h2>
                <p>
                    Tell us whether you are renting, leasing, buying, or representing clients so we can unlock the right tools, media pipelines, and social shortcuts.
                </p>

                <div class="real-estate-onboarding__hero-pills">
                    <span class="signal-pill">
                        <span class="signal-indicator {{ $path ? 'is-on' : '' }}" aria-hidden="true"></span>
                        {{ $path ? $pathDefinitions[$path]['label'] : 'Pick a pathway to begin' }}
                    </span>

                    @if ($path === 'buy' && $buyerPlan)
                        <span class="signal-pill">
                            <span class="signal-indicator is-on" aria-hidden="true"></span>
                            {{ ucfirst($buyerPlan) }} financing
                        </span>
                    @endif

                    <span class="signal-pill">
                        <span class="signal-indicator {{ $completed ? 'is-on' : '' }}" aria-hidden="true"></span>
                        {{ $completed ? 'Onboarding snapshot saved' : 'Checklist in progress' }}
                    </span>
                </div>

                @if (session()->has('realEstateOnboardingComplete'))
                    <div class="real-estate-onboarding__notice real-estate-onboarding__notice--success">
                        {{ session('realEstateOnboardingComplete') }}
                    </div>
                @endif
            </div>

            <div class="hub-section__meta">
                <div class="hub-intro-card real-estate-onboarding__status-card">
                    <p class="section-eyebrow">Onboarding status</p>
                    <h3 class="heading-tertiary">{{ $completed ? 'Snapshot saved' : 'Complete each stream to unlock the console' }}</h3>
                    <ul class="real-estate-status-list" aria-label="Onboarding checklist">
                        @foreach ($this->progressSteps as $step)
                            <li class="{{ $step['complete'] ? 'is-complete' : 'is-pending' }}">
                                <span>{{ $step['label'] }}</span>
                                <span>{{ $step['complete'] ? 'Ready' : 'In progress' }}</span>
                            </li>
                        @endforeach
                    </ul>

                    <button
                        type="button"
                        class="btn btn--full real-estate-onboarding__save-btn"
                        wire:click="markCompleted"
                        @disabled(! $this->requirementsMet)
                    >
                        @if ($completed)
                            Onboarding saved
                        @else
                            {{ $this->requirementsMet ? 'Save & continue' : 'Finish checklist to save' }}
                        @endif
                    </button>
                    @error('requirements')
                        <p class="form-error real-estate-onboarding__error">{{ $message }}</p>
                    @enderror
                </div>
            </div>
        </div>
    </section>

    <section class="section-shell real-estate-onboarding__pathways" id="real-estate-pathways">
        <div class="section-text">
            <p class="section-eyebrow">Step 1 &middot; Pathway</p>
            <h2 class="heading-secondary">Select your pathway</h2>
            <p>Each option opens the rituals, shortcuts, and AI copilots tuned for your role.</p>
        </div>

        <div class="section-media">
            <div class="real-estate-path-grid" role="list">
                @foreach ($pathDefinitions as $key => $definition)
                    <button
                        type="button"
                        role="listitem"
                        wire:click="selectPath('{{ $key }}'{{ $key === 'buy' ? ", '" . ($buyerPlan ?? 'mortgage') . "'" : '' }})"
                        class="real-estate-path-card {{ $path === $key ? 'is-active' : '' }}"
                        aria-pressed="{{ $path === $key ? 'true' : 'false' }}"
                    >
                        <span class="real-estate-path-card__chip">{{ $definition['chip'] }}</span>
                        <span class="real-estate-path-card__title">{{ $definition['label'] }}</span>
                        <span class="real-estate-path-card__description">{{ $definition['description'] }}</span>
                        <span class="real-estate-path-card__cta">
                            {{ $definition['cta'] }}
                            <svg class="real-estate-path-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </span>

                        @if ($key === 'buy' && $path === 'buy')
                            <div class="real-estate-path-card__options" role="group" aria-label="Financing preference">
                                <span class="real-estate-path-card__options-label">Financing preference:</span>
                                <button type="button" wire:click="selectPath('buy','cash')" class="real-estate-path-card__option {{ $buyerPlan === 'cash' ? 'is-selected' : '' }}">Cash</button>
                                <button type="button" wire:click="selectPath('buy','mortgage')" class="real-estate-path-card__option {{ $buyerPlan === 'mortgage' ? 'is-selected' : '' }}">Mortgage</button>
                            </div>
                        @endif
                    </button>
                @endforeach
            </div>
            @error('path')
                <p class="form-error real-estate-onboarding__error">{{ $message }}</p>
            @enderror
        </div>
    </section>

    @if ($path)
        <section class="section-shell real-estate-onboarding__readiness" id="real-estate-readiness">
            <div class="section-text">
                <p class="section-eyebrow">Checklist</p>
                <h2 class="heading-secondary">Complete these steps to unlock the console</h2>
                <p>Profile, media, and community streams work together to open the WomenRise real estate console.</p>
                <span class="real-estate-onboarding__badge {{ $this->requirementsMet ? 'is-ready' : '' }}">
                    {{ $this->requirementsMet ? 'All requirements met' : 'Checklist in progress' }}
                </span>
            </div>

            <div class="section-media">
                <div class="real-estate-progress-grid">
                    @foreach ($this->progressSteps as $step)
                        <article class="real-estate-progress-card {{ $step['complete'] ? 'is-complete' : '' }}">
                            <div class="real-estate-progress-card__label">{{ $step['label'] }}</div>
                            <p class="real-estate-progress-card__description">{{ $step['description'] }}</p>
                            <p class="real-estate-progress-card__status">{{ $step['complete'] ? 'Ready for console' : 'Needs attention' }}</p>
                        </article>
                    @endforeach
                </div>

                @if (! $this->requirementsMet && count($personaCoachTips))
                    <div class="real-estate-coach-card">
                        <div class="real-estate-coach-card__header">
                            <div>
                                <p class="section-eyebrow">Premium unlock tips</p>
                                <p class="real-estate-coach-card__source">
                                    {{ $personaCoachFromAi ? 'Athena AI via ' . str($personaCoachProvider ?? 'WomenRise')->headline() : 'WomenRise playbook guidance' }}
                                </p>
                            </div>
                            <button
                                type="button"
                                wire:click="refreshPersonaCoachPanel"
                                wire:loading.attr="disabled"
                                class="btn-ghost real-estate-coach-card__refresh"
                            >
                                <span wire:loading.remove wire:target="refreshPersonaCoachPanel">Refresh tips →</span>
                                <span wire:loading wire:target="refreshPersonaCoachPanel">Updating...</span>
                            </button>
                        </div>
                        <ul class="real-estate-coach-card__list">
                            @foreach ($personaCoachTips as $tip)
                                <li class="real-estate-coach-card__tip">
                                    <strong>{{ $tip['title'] ?? 'Coach tip' }}</strong>
                                    <p>{{ $tip['body'] ?? '' }}</p>
                                    @if (! empty($tip['cta']))
                                        <span>{{ $tip['cta'] }}</span>
                                    @endif
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif
            </div>
        </section>

        <section class="section-shell real-estate-onboarding__panels" id="real-estate-panels">
            <div class="section-text real-estate-panel">
                <p class="section-eyebrow">Profile</p>
                <h2 class="heading-tertiary">Complete your {{ $this->pathLabel }}</h2>
                <p>Tailor verification, seeker data, or landlord shortcuts so AI copilots can speak on your behalf.</p>
                <div class="real-estate-panel__body">
                    @if ($this->showSeekerProfile)
                        <div class="real-estate-panel__stack">
                            <div id="journeyhub-persona-wizard" class="real-estate-panel__embed">
                                <livewire:women-real-estate.personas.wizard :persona="$path === 'buy' ? 'investor' : 'househunter'" :key="'journeyhub-persona-wizard-' . ($path ?? 'default')" />
                            </div>
                            <div id="onboarding-househunter-profile" class="real-estate-panel__embed">
                                <livewire:women-real-estate.househunters.seeker-profile :key="'onboarding-househunter-profile'" />
                            </div>
                        </div>
                    @else
                        <div class="real-estate-shortcut-grid">
                            @foreach ($profileShortcuts as $card)
                                @continue(! $card['visible'])
                                <a href="{{ $card['route'] }}" class="real-estate-shortcut-card">
                                    <strong>{{ $card['label'] }}</strong>
                                    <p>{{ $card['description'] }}</p>
                                </a>
                            @endforeach
                        </div>
                    @endif
                </div>
            </div>

            <div class="section-media real-estate-panel-group">
                <article class="real-estate-panel">
                    <div class="real-estate-panel__header">
                        <div>
                            <p class="section-eyebrow">Photos & videos</p>
                            <h3 class="heading-tertiary">Share the visuals behind your story</h3>
                        </div>
                    </div>
                    <p>Upload listing galleries, agent reels, or buyer inspiration reels. Everything stays in your secure media locker until you attach it to a listing or social post.</p>
                    <div class="real-estate-panel__embed">
                        <livewire:women-real-estate.onboarding.user-media-library :key="'onboarding-media-library'" />
                    </div>
                </article>

                <article class="real-estate-panel">
                    <div class="real-estate-panel__header">
                        <div>
                            <p class="section-eyebrow">Community</p>
                            <h3 class="heading-tertiary">Tap into real estate stories</h3>
                        </div>
                        <a href="{{ route('women.real-estate.network.connections') }}" class="btn btn--outline real-estate-panel__cta">Open network</a>
                    </div>
                    <div class="real-estate-panel__embed">
                        <livewire:women-real-estate.onboarding.social-stream :path="$path" :key="'onboarding-social-stream-' . ($path ?? 'default')" />
                    </div>
                </article>
            </div>
        </section>
    @endif
</div>
