@extends('frontend.layouts.master')

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/candidate-onboarding.css') }}">
@endpush

@php
    $currentUser = auth()->user();
    $preferredName = $currentUser?->preferred_name ?: $currentUser?->name;
@endphp

@section('contents')
    <div class="candidate-onboarding"
         x-data="onboardingApp({
            endpoint: '{{ route('api.v1.onboarding.show') }}',
            profileEndpoint: '{{ route('api.v1.onboarding.profile') }}',
            personaEndpoint: '{{ route('api.v1.onboarding.personas') }}',
            completeEndpoint: '{{ route('api.v1.onboarding.complete') }}',
            engagementEndpoint: '{{ route('api.v1.onboarding.support-engagements.store') }}',
            backboneEndpoint: '{{ route('api.v1.social.backbone') }}',
            personas: @js($personaCatalog),
            supports: @js($supportCatalog),
         })"
         x-init="init()">
        <section class="hub-section hub-section--intro hub-section--signals-right candidate-onboarding__hero">
            <div class="container hub-section__layout">
                <div class="hub-section__content candidate-onboarding__hero-copy">
                    <p class="section-eyebrow">WomenRise onboarding</p>
                    <h1 class="candidate-onboarding__hero-title">Tailor Athena to you{{ $preferredName ? ', '.$preferredName : '' }}</h1>
                    <p class="candidate-onboarding__hero-subtitle">
                        Spend a few minutes capturing your goals and Athena tunes jobs, courses, housing, and mentors around what matters most.
                    </p>
                    <div class="candidate-onboarding__hero-actions">
                        <a href="{{ route('member.dashboard') }}" class="candidate-onboarding__cta candidate-onboarding__cta--primary">
                            <i class="fas fa-home" aria-hidden="true"></i>
                            <span>Back to dashboard</span>
                        </a>
                        <button type="button" class="candidate-onboarding__cta candidate-onboarding__cta--ghost"
                                @click="refreshBackbone" :disabled="backboneLoading">
                            <span class="spinner-border spinner-border-sm" x-show="backboneLoading" aria-hidden="true"></span>
                            <span x-text="backboneLoading ? 'Refreshing...' : 'Refresh community data'">Refresh community data</span>
                        </button>
                    </div>
                </div>
                <div class="candidate-onboarding__hero-metrics">
                    <div class="candidate-onboarding__stat">
                        <span class="candidate-onboarding__stat-label">Progress</span>
                        <strong class="candidate-onboarding__stat-value" x-text="`${checklist.progress || 0}%`">0%</strong>
                    </div>
                    <div class="candidate-onboarding__stat">
                        <span class="candidate-onboarding__stat-label">Steps completed</span>
                        <strong class="candidate-onboarding__stat-value"
                                x-text="checklist.total ? `${checklist.completed}/${checklist.total}` : '—'">—</strong>
                    </div>
                    <div class="candidate-onboarding__stat">
                        <span class="candidate-onboarding__stat-label">Personas saved</span>
                        <strong class="candidate-onboarding__stat-value" x-text="selectedPersonas.length">0</strong>
                    </div>
                </div>
            </div>
        </section>

        <div class="candidate-onboarding__body container">
            <aside class="candidate-onboarding__sidebar">
                <section class="candidate-onboarding__card candidate-onboarding__card--progress">
                    <header class="candidate-onboarding__card-header">
                        <div>
                            <p class="candidate-onboarding__pill">Live progress</p>
                            <h2>WomenRise onboarding</h2>
                        </div>
                        <span class="candidate-onboarding__badge" x-text="`${checklist.progress || 0}%`">0%</span>
                    </header>
                    <p class="candidate-onboarding__card-copy">
                        Complete the steps so Athena can fine-tune work, housing, money, and wellbeing guidance.
                    </p>

                    <template x-if="loading">
                        <div class="candidate-onboarding__loading">
                            <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
                            <p>Loading your onboarding progress...</p>
                        </div>
                    </template>

                    <div x-show="!loading" x-cloak>
                        <progress class="candidate-onboarding__progress-meter" max="100" :value="checklist.progress || 0"></progress>

                        <ul class="candidate-onboarding__checklist">
                            <template x-for="item in checklist.items" :key="item.id">
                                <li :class="item.completed && justCompletedChecklistItem === item.id ? 'just-completed' : ''">
                                    <span class="candidate-onboarding__check-icon"
                                          :class="item.completed ? 'is-complete' : ''"
                                          aria-hidden="true"></span>
                                    <div>
                                        <p class="candidate-onboarding__check-label" x-text="item.label"></p>
                                        <p class="candidate-onboarding__check-copy" x-text="item.description"></p>
                                    </div>
                                </li>
                            </template>
                        </ul>
                    </div>
                </section>

                <section class="candidate-onboarding__card candidate-onboarding__card--accent">
                    <h3>Ready to finish?</h3>
                    <p>We'll unlock AI recommendations once every required step is complete.</p>
                    <button type="button" class="candidate-onboarding__finish"
                            :disabled="completing || !canCompleteOnboarding()"
                            @click="completeOnboarding">
                        <span class="spinner-border spinner-border-sm me-2" x-show="completing" aria-hidden="true"></span>
                        {{ __('Finish onboarding') }}
                    </button>
                </section>
            </aside>

            <div class="candidate-onboarding__panels">
                <div class="candidate-onboarding__alert candidate-onboarding__alert--danger" x-show="error" role="alert">
                    <span x-text="error"></span>
                    <template x-if="lastFailedAction">
                        <button type="button" class="candidate-onboarding__button" style="margin-left:1rem;" @click="retryLastFailedAction">Retry</button>
                    </template>
                </div>
                <div class="candidate-onboarding__alert" x-show="notice" :class="`candidate-onboarding__alert--${noticeType}`" role="alert" x-text="notice"></div>

                <section class="candidate-onboarding__panel" x-show="!loading" x-cloak>
                    <header class="candidate-onboarding__panel-header">
                        <div>
                            <p class="candidate-onboarding__panel-eyebrow">Step 1</p>
                            <h2>Profile basics</h2>
                        </div>
                        <p>Update how we address you and the timezone you prefer.</p>
                    </header>

                    <form class="candidate-onboarding__form" @submit.prevent="saveProfile">
                        <label class="candidate-onboarding__field">
                            <span>Full name</span>
                            <input id="onboarding-name" type="text" x-model="profileForm.name" autocomplete="name">
                        </label>
                        <div class="candidate-onboarding__field-grid">
                            <label class="candidate-onboarding__field">
                                <span>Preferred name</span>
                                <input id="onboarding-preferred" type="text" x-model="profileForm.preferred_name" autocomplete="nickname">
                            </label>
                            <label class="candidate-onboarding__field">
                                <span>Pronouns</span>
                                <input id="onboarding-pronouns" type="text" x-model="profileForm.pronouns" placeholder="she/her, they/them">
                            </label>
                        </div>
                        <label class="candidate-onboarding__field">
                            <span>Timezone</span>
                            <input id="onboarding-timezone" type="text" x-model="profileForm.timezone" placeholder="Australia/Sydney">
                        </label>
                        <div class="candidate-onboarding__actions">
                            <button type="submit" class="candidate-onboarding__button" :disabled="savingProfile">
                                <span class="spinner-border spinner-border-sm me-2" x-show="savingProfile" aria-hidden="true"></span>
                                Save profile details
                            </button>
                        </div>
                    </form>
                </section>

                <section class="candidate-onboarding__panel" x-show="!loading && personaOptions.length" x-cloak>
                    <header class="candidate-onboarding__panel-header">
                        <div>
                            <p class="candidate-onboarding__panel-eyebrow">Step 2</p>
                            <h2>Choose your personas</h2>
                        </div>
                        <span class="candidate-onboarding__panel-pill" x-text="`${selectedPersonas.length}/5 selected`">0/5 selected</span>
                    </header>
                    <p class="candidate-onboarding__panel-copy">Pick up to five journeys that best describe the support you need.</p>

                    <div class="candidate-onboarding__persona-grid">
                        <template x-for="option in personaOptions" :key="option.value">
                            <button type="button"
                                    class="candidate-onboarding__persona"
                                    :class="personaSelected(option.value) ? 'is-selected' : ''"
                                    :aria-pressed="personaSelected(option.value)"
                                    @click="togglePersona(option.value)">
                                <div class="candidate-onboarding__persona-header">
                                    <span x-show="option.icon" class="candidate-onboarding__persona-icon" x-text="option.icon"></span>
                                    <div>
                                        <h3 x-text="option.label"></h3>
                                        <p x-show="option.tagline" x-text="option.tagline"></p>
                                    </div>
                                </div>
                                <p class="candidate-onboarding__persona-copy" x-text="option.description"></p>
                            </button>
                        </template>
                    </div>

                    <div class="candidate-onboarding__actions">
                        <button type="button" class="candidate-onboarding__button" @click="savePersonas" :disabled="savingPersonas">
                            <span class="spinner-border spinner-border-sm me-2" x-show="savingPersonas" aria-hidden="true"></span>
                            Save persona choices
                        </button>
                    </div>
                </section>

                <section class="candidate-onboarding__panel" x-show="!loading && personaGuidance.length" x-cloak>
                    <header class="candidate-onboarding__panel-header">
                        <div>
                            <p class="candidate-onboarding__panel-eyebrow">Step 3</p>
                            <h2>Guidance tailored to you</h2>
                        </div>
                        <p>We surface the top things to prioritise for each persona.</p>
                    </header>
                    <div class="candidate-onboarding__guidance-grid">
                        <template x-for="persona in personaGuidance" :key="persona.value">
                            <article class="candidate-onboarding__guidance">
                                <header>
                                    <div>
                                        <span x-show="persona.icon" class="candidate-onboarding__guidance-icon" x-text="persona.icon"></span>
                                        <h3 x-text="persona.label"></h3>
                                    </div>
                                    <span class="candidate-onboarding__badge candidate-onboarding__badge--soft">Focus</span>
                                </header>
                                <p>{{ __('What to prioritise:') }}</p>
                                <ul>
                                    <template x-for="prompt in persona.journey_prompts" :key="prompt">
                                        <li x-text="prompt"></li>
                                    </template>
                                </ul>
                            </article>
                        </template>
                    </div>
                </section>

                <section class="candidate-onboarding__panel" x-show="!loading && supports.length" x-cloak>
                    <header class="candidate-onboarding__panel-header">
                        <div>
                            <p class="candidate-onboarding__panel-eyebrow">Step 4</p>
                            <h2>Recommended supports</h2>
                        </div>
                        <p>Courses, housing options, mentors, and jobs that align with your personas.</p>
                    </header>
                    <template x-for="section in supports" :key="section.type">
                        <article class="candidate-onboarding__support" :class="section.highlighted ? 'is-highlighted' : ''">
                            <div class="candidate-onboarding__support-head">
                                <div>
                                    <span x-show="section.icon" class="candidate-onboarding__support-icon" x-text="section.icon"></span>
                                    <h3 x-text="section.title"></h3>
                                    <p x-text="section.description"></p>
                                </div>
                                <span class="candidate-onboarding__badge" x-show="section.highlighted">Matches your personas</span>
                            </div>

                            <template x-if="section.nudges && section.nudges.length">
                                <div class="candidate-onboarding__support-nudges">
                                    <p>Why this matters for you</p>
                                    <ul>
                                        <template x-for="nudge in section.nudges" :key="nudge">
                                            <li>
                                                <span x-text="nudge"></span>
                                                <button type="button" class="candidate-onboarding__link"
                                                        @click.prevent="dismissNudge(section, nudge)">
                                                    Hide
                                                </button>
                                            </li>
                                        </template>
                                    </ul>
                                </div>
                            </template>

                            <div class="candidate-onboarding__support-items">
                                <template x-for="item in section.items" :key="`${section.type}-${item.id}`">
                                    <article>
                                        <h4 x-text="item.title || item.name"></h4>
                                        <p x-text="supportDescription(section.type, item)"></p>

                                        <template x-if="section.type === 'courses'">
                                            <div class="candidate-onboarding__support-meta">
                                                <span x-text="item.mode"></span>
                                                <span x-text="item.provider"></span>
                                            </div>
                                        </template>

                                        <template x-if="section.type === 'housing'">
                                            <p class="candidate-onboarding__support-note">
                                                <strong>Amenities:</strong>
                                                <span x-text="(item.amenities || []).slice(0, 3).join(', ') || 'See more details inside WomenRise.'"></span>
                                            </p>
                                        </template>

                                        <template x-if="section.type === 'mentorship'">
                                            <p class="candidate-onboarding__support-note">
                                                <strong>Delivery:</strong>
                                                <span x-text="item.delivery_mode"></span>
                                            </p>
                                        </template>

                                        <template x-if="section.type === 'jobs'">
                                            <p class="candidate-onboarding__support-note">
                                                <strong>Company:</strong>
                                                <span x-text="item.company_name"></span>
                                            </p>
                                        </template>

                                        <template x-if="supportLink(section.type, item)">
                                            <a class="candidate-onboarding__link" :href="supportLink(section.type, item)" target="_blank" rel="noopener"
                                               @click="handleSupportCta(section, item)">
                                                <span x-text="supportCta(section)"></span>
                                            </a>
                                        </template>
                                    </article>
                                </template>
                            </div>
                        </article>
                    </template>
                </section>

                <section class="candidate-onboarding__panel candidate-onboarding__panel--backbone" x-cloak x-show="backboneLoading || backbone || backboneError">
                    <header class="candidate-onboarding__panel-header">
                        <div>
                            <p class="candidate-onboarding__panel-eyebrow">Signal boost</p>
                            <h2>Community footprint</h2>
                        </div>
                        <p>Pulled live from the social data backbone.</p>
                    </header>

                    <template x-if="backboneLoading">
                        <div class="candidate-onboarding__loading">
                            <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
                            <p>Gathering your community data...</p>
                        </div>
                    </template>

                    <div class="candidate-onboarding__backbone-grid" x-show="!backboneLoading && backbone" x-cloak>
                        <article>
                            <span>Followers</span>
                            <strong x-text="formatNumber(backbone?.graph?.followers?.stored ?? 0)"></strong>
                        </article>
                        <article>
                            <span>Following</span>
                            <strong x-text="formatNumber(backbone?.graph?.following?.stored ?? 0)"></strong>
                        </article>
                        <article>
                            <span>Close friends</span>
                            <strong x-text="formatNumber(backbone?.graph?.close_friends?.count ?? 0)"></strong>
                        </article>
                        <article>
                            <span>Pending invites</span>
                            <strong x-text="formatNumber(backbone?.invites?.pending_count ?? 0)"></strong>
                        </article>
                    </div>

                    <div class="candidate-onboarding__backbone-details" x-show="!backboneLoading && backbone" x-cloak>
                        <div>
                            <h3>Owned communities</h3>
                            <template x-if="backboneItems('communities.owned', 2).length">
                                <ul>
                                    <template x-for="group in backboneItems('communities.owned', 2)" :key="group.id">
                                        <li>
                                            <strong x-text="group.name"></strong>
                                            <span x-text="`${formatNumber(group?.stats?.members ?? 0)} members`"></span>
                                        </li>
                                    </template>
                                </ul>
                            </template>
                            <p x-show="!backboneItems('communities.owned', 2).length">
                                Launch a group to unlock invites and programming.
                            </p>
                        </div>
                        <div>
                            <h3>Invites & events</h3>
                            <template x-if="backboneItems('invites.items', 3).length">
                                <ul>
                                    <template x-for="invite in backboneItems('invites.items', 3)" :key="invite.id">
                                        <li>
                                            <strong x-text="invite.recipient_email || 'Private link'"></strong>
                                            <span x-text="invite.group?.name || 'Group invite'"></span>
                                        </li>
                                    </template>
                                </ul>
                            </template>
                            <p x-show="!backboneItems('invites.items', 3).length">No pending invites right now.</p>

                            <template x-if="backboneItems('events.upcoming', 2).length">
                                <ul>
                                    <template x-for="event in backboneItems('events.upcoming', 2)" :key="event.id">
                                        <li>
                                            <strong x-text="event.title"></strong>
                                            <span x-text="formatDate(event.starts_at) || 'TBC'"></span>
                                        </li>
                                    </template>
                                </ul>
                            </template>
                            <p x-show="!backboneItems('events.upcoming', 2).length">No upcoming events scheduled.</p>
                        </div>
                    </div>

                    <div class="candidate-onboarding__backbone-meta" x-show="!backboneLoading && backbone">
                        <span x-text="backboneMeta?.stored_at ? `Cached ${formatDate(backboneMeta.stored_at)}` : 'Fresh snapshot'"></span>
                        <span x-show="backboneMeta?.hit"> • Served from cache</span>
                    </div>

                    <div class="candidate-onboarding__alert candidate-onboarding__alert--warning" x-show="!backboneLoading && backboneError" x-text="backboneError"></div>
                </section>

                <noscript>
                    <div class="candidate-onboarding__alert candidate-onboarding__alert--warning" role="alert">
                        Enable JavaScript to use the interactive onboarding experience.
                    </div>
                </noscript>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    @vite('resources/js/app.js')
@endpush
