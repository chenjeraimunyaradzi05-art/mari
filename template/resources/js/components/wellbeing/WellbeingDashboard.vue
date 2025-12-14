<template>
    <div class="flex flex-col gap-8 lg:flex-row">
        <section class="flex-1 space-y-6">
            <header class="space-y-3 rounded-3xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 p-6 text-white shadow-xl">
                <p class="text-[11px] uppercase tracking-[0.4em] text-white/70">Athena wellbeing hub</p>
                <div class="space-y-1">
                    <h1 class="text-3xl font-semibold">Caring for your body & mind, {{ displayName }}</h1>
                    <p class="text-sm text-white/80">Events, partner perks, and Vipassana-friendly reflections tailored to what you told Athena you care about.</p>
                </div>
                <p class="text-xs text-white/80">
                    Educational reflections only. Please listen to your body and follow advice from qualified health professionals.
                </p>
            </header>

            <section class="space-y-5 rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900">Your wellbeing profile</h2>
                        <p class="text-sm text-slate-500">Share the movement, meditation, and Vipassana preferences you want Athena to remember.</p>
                    </div>
                    <button
                        type="button"
                        class="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow"
                        :disabled="saving"
                        @click="saveProfile"
                    >
                        <span v-if="!saving">Save profile</span>
                        <span v-else>Saving…</span>
                    </button>
                </div>

                <div class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Synced interests</p>
                    <div v-if="interestTags && interestTags.length" class="mt-3 flex flex-wrap gap-2">
                        <span
                            v-for="tag in interestTags"
                            :key="tag"
                            class="inline-flex items-center rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600"
                        >
                            {{ formatInterestTag(tag) }}
                        </span>
                    </div>
                    <p v-else class="mt-3 text-sm text-slate-500">Save a few movement or Vipassana preferences and we’ll surface the linked tags here.</p>
                </div>

                <div class="grid gap-4 md:grid-cols-3">
                    <label class="text-sm font-semibold text-slate-700">
                        Movement level today
                        <select v-model="profile.movement_level" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                            <option value="">Not sure / varies</option>
                            <option value="gentle">Gentle / low impact</option>
                            <option value="moderate">Moderate / mixed</option>
                            <option value="intense">Higher intensity / athletic</option>
                        </select>
                    </label>
                    <label class="text-sm font-semibold text-slate-700">
                        Energy pattern
                        <select v-model="profile.energy_pattern" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                            <option value="">Varies</option>
                            <option value="mornings">Mornings</option>
                            <option value="afternoons">Afternoons</option>
                            <option value="evenings">Evenings</option>
                            <option value="weekends">Weekends</option>
                        </select>
                    </label>
                    <label class="text-sm font-semibold text-slate-700">
                        Availability snapshot
                        <input type="text" v-model="profile.availability" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. 2x evenings + 1 weekend" />
                    </label>
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Movement you enjoy</p>
                        <div class="mt-2 grid gap-2">
                            <label class="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" v-model="profile.pref_yoga" class="rounded border-slate-300 text-rose-500" />
                                <span>Yoga / stretching</span>
                            </label>
                            <label class="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" v-model="profile.pref_running" class="rounded border-slate-300 text-rose-500" />
                                <span>Walking or run clubs (Nike / Asics style)</span>
                            </label>
                            <label class="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" v-model="profile.pref_strength" class="rounded border-slate-300 text-rose-500" />
                                <span>Strength / gym / home weights</span>
                            </label>
                            <label class="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" v-model="profile.pref_team_sport" class="rounded border-slate-300 text-rose-500" />
                                <span>Group or team sports</span>
                            </label>
                            <label class="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" v-model="profile.pref_outdoors" class="rounded border-slate-300 text-rose-500" />
                                <span>Outdoors / ocean / trails</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Mind & Vipassana care</p>
                        <div class="mt-2 grid gap-2">
                            <label class="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" v-model="profile.pref_meditation" class="rounded border-slate-300 text-rose-500" />
                                <span>Meditation or nervous-system rest</span>
                            </label>
                            <label class="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" v-model="profile.pref_vipassana" class="rounded border-slate-300 text-rose-500" />
                                <span>Vipassana Dharma style retreats (non-sectarian)</span>
                            </label>
                            <p class="text-[11px] text-slate-500">
                                Athena can describe Vipassana in broad terms only. Always check with teachers or health professionals before and after intensive retreats.
                            </p>
                        </div>
                    </div>
                </div>

                <div class="rounded-2xl border border-indigo-50 bg-indigo-50/50 p-4">
                    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Inclusivity & Safety</p>
                    <div class="mt-2 grid gap-2 md:grid-cols-2">
                        <label class="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" v-model="profile.pref_body_positive" class="rounded border-slate-300 text-rose-500" />
                            <span>Body positive / neutral focus</span>
                        </label>
                        <label class="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" v-model="profile.pref_adaptive" class="rounded border-slate-300 text-rose-500" />
                            <span>Adaptive / disability friendly</span>
                        </label>
                        <label class="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" v-model="profile.pref_dv_safe" class="rounded border-slate-300 text-rose-500" />
                            <span>Domestic violence safe (discreet)</span>
                        </label>
                        <label class="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" v-model="profile.pref_prenatal_postnatal" class="rounded border-slate-300 text-rose-500" />
                            <span>Prenatal / Postnatal safe</span>
                        </label>
                    </div>
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <label class="text-sm font-semibold text-slate-700">
                        Your goals
                        <textarea v-model="profile.goals" rows="3" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. gently rebuild fitness, prepare for a 5km, ease anxiety"></textarea>
                    </label>
                    <label class="text-sm font-semibold text-slate-700">
                        Constraints Athena should respect
                        <textarea v-model="profile.constraints" rows="3" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. knee injury, fasting, pregnancy, carer duties"></textarea>
                        <p class="mt-1 text-[11px] text-slate-500">Athena is not a doctor or therapist. Follow personalised care plans if you have injuries or mental health needs.</p>
                    </label>
                </div>

                <label class="text-sm font-semibold text-slate-700">
                    Women’s health topics on your mind
                    <textarea v-model="profile.health_topics" rows="2" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. menstrual health, perimenopause, pelvic floor, sleep"></textarea>
                </label>

                <p v-if="saveMessage" class="text-sm text-emerald-600">{{ saveMessage }}</p>
                <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
            </section>

            <!-- Generated Plan -->
            <div v-if="plan" class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
                <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-slate-900">Your Wellness Plan</h2>
                    <span class="text-xs text-slate-500">AI-Generated</span>
                </div>

                <div v-if="plan.safety_note" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div class="flex gap-2">
                        <svg class="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <div>
                            <p class="font-medium">Safety Note</p>
                            <p>{{ plan.safety_note }}</p>
                        </div>
                    </div>
                </div>

                <div class="prose prose-sm prose-slate max-w-none">
                    <div class="whitespace-pre-wrap">{{ plan.summary }}</div>
                </div>

                <div v-if="plan.schedule" class="mt-6">
                    <h3 class="mb-3 text-sm font-medium text-slate-900">Suggested Schedule</h3>
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div v-for="(activity, day) in plan.schedule" :key="day" class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">{{ day }}</div>
                            <div class="text-sm font-medium text-slate-900">{{ activity }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <section class="space-y-4 rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900">Events & circles</h2>
                        <p class="text-sm text-slate-500">Women-first runs, yoga, strength, meditation, and Vipassana-friendly gatherings.</p>
                    </div>
                    <div class="flex flex-col gap-2 text-sm sm:flex-row">
                        <select v-model="filters.type" class="rounded-2xl border border-slate-200 px-3 py-2" @change="fetchEvents">
                            <option value="">All types</option>
                            <option value="yoga">Yoga / stretch</option>
                            <option value="run">Walk / run</option>
                            <option value="strength">Strength</option>
                            <option value="meditation">Meditation</option>
                            <option value="vipassana">Vipassana retreats</option>
                            <option value="public_speaking">Public speaking</option>
                        </select>
                        <select v-model="filters.mode" class="rounded-2xl border border-slate-200 px-3 py-2" @change="fetchEvents">
                            <option value="">Online & in-person</option>
                            <option value="in_person">In-person</option>
                            <option value="online">Online</option>
                            <option value="hybrid">Hybrid</option>
                        </select>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2">
                    <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors" :class="filters.body_positive ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'">
                        <input type="checkbox" v-model="filters.body_positive" class="hidden" @change="fetchEvents">
                        Body Positive
                    </label>
                    <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors" :class="filters.adaptive ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'">
                        <input type="checkbox" v-model="filters.adaptive" class="hidden" @change="fetchEvents">
                        Adaptive
                    </label>
                    <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors" :class="filters.dv_safe ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'">
                        <input type="checkbox" v-model="filters.dv_safe" class="hidden" @change="fetchEvents">
                        DV Safe
                    </label>
                    <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors" :class="filters.prenatal_postnatal ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'">
                        <input type="checkbox" v-model="filters.prenatal_postnatal" class="hidden" @change="fetchEvents">
                        Pre/Postnatal
                    </label>
                </div>

                <div v-if="groupedEvents.length === 0" class="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    No events match those filters yet. You can still ask Athena how to approach training safely with your current constraints.
                </div>

                <div v-else class="space-y-5">
                    <div v-for="day in groupedEvents" :key="day.date" class="space-y-3">
                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">{{ day.label }}</p>
                        <div class="space-y-3">
                            <article
                                v-for="event in day.items"
                                :key="event.id"
                                class="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm"
                            >
                                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div class="space-y-1">
                                        <p class="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                                            {{ labelForEvent(event.type) }}
                                            <span v-if="event.women_only" class="ml-2 text-rose-600">• Women only</span>
                                            <span v-if="event.mode === 'online'" class="ml-2 text-slate-600">• Online</span>
                                        </p>
                                        <h3 class="text-lg font-semibold text-slate-900">{{ event.title }}</h3>
                                        <p class="text-sm text-slate-600">
                                            <span v-if="event.location_region">{{ event.location_region }}</span>
                                            <span v-if="event.location_venue"> · {{ event.location_venue }}</span>
                                        </p>
                                        <p v-if="event.starts_at_human" class="text-sm text-slate-500">Starts {{ event.starts_at_human }}</p>
                                        <p v-if="event.summary" class="text-sm text-slate-600">{{ event.summary }}</p>
                                        <p v-if="event.sponsor_name" class="text-xs text-slate-500">Partner: {{ event.sponsor_name }}</p>
                                    </div>
                                    <div class="flex flex-col gap-2 text-sm">
                                        <a
                                            v-if="event.registration_url"
                                            :href="event.registration_url"
                                            target="_blank"
                                            rel="noopener"
                                            class="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-indigo-500 px-4 py-2 font-semibold text-white"
                                            @click="trackEventRsvp(event)"
                                        >
                                            RSVP ↗
                                        </a>
                                        <button
                                            type="button"
                                            class="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 font-semibold text-slate-700"
                                            @click="openAiConcierge(event)"
                                        >
                                            Ask Athena about fit
                                        </button>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
            </section>

            <section class="space-y-4 rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm">
                <div class="flex flex-col gap-2">
                    <h2 class="text-lg font-semibold text-slate-900">Health & Vipassana reading list</h2>
                    <p class="text-sm text-slate-500">Short, respectful cards curated for women and gender-diverse people.</p>
                </div>
                <div class="grid gap-4 md:grid-cols-3">
                    <article v-for="article in articles" :key="article.slug" class="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
                        <p class="text-[11px] uppercase tracking-[0.4em] text-rose-500">{{ article.category }}</p>
                        <h3 class="mt-2 text-base font-semibold text-slate-900">{{ article.title }}</h3>
                        <p class="mt-1 text-sm text-slate-600">{{ article.summary }}</p>
                    </article>
                </div>
                <p v-if="disclaimer" class="text-xs text-slate-500">{{ disclaimer }}</p>
            </section>
        </section>

        <aside class="w-full lg:w-80">
            <section class="space-y-4 rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm">
                <div>
                    <h2 class="text-lg font-semibold text-slate-900">Partner perks</h2>
                    <p class="text-sm text-slate-500">Brands that offered women-first discounts on movement, rest, and Vipassana-friendly retreats.</p>
                </div>
                <div v-if="offers.length === 0" class="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Add your interests so we can match you with aligned partners soon.
                </div>
                <div v-else class="space-y-4">
                    <article v-for="offer in offers" :key="offer.id" class="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-rose-50 p-4 shadow-sm">
                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">{{ offer.brand }}</p>
                        <h3 class="text-base font-semibold text-slate-900">{{ offer.headline }}</h3>
                        <p class="text-sm text-slate-600">{{ offer.description }}</p>
                        <p v-if="offer.discount_code" class="text-sm font-semibold text-rose-600">Code: {{ offer.discount_code }}</p>
                        <p v-if="offer.validity_notice" class="text-xs text-slate-500">{{ offer.validity_notice }}</p>
                        <a
                            :href="offer.cta_url"
                            target="_blank"
                            rel="noopener"
                            class="mt-3 inline-flex items-center justify-center rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow"
                            @click="trackOfferClick(offer)"
                        >
                            {{ offer.cta_label }} ↗
                        </a>
                    </article>
                </div>
            </section>
        </aside>
    </div>
</template>

<script>
import axios from 'axios';

export default {
    name: 'WellbeingDashboard',
    props: {
        user: {
            type: Object,
            required: true,
        },
        interests: {
            type: Array,
            default: () => [],
        },
    },
    data() {
        return {
            profile: {
                movement_level: '',
                pref_yoga: false,
                pref_running: false,
                pref_strength: false,
                pref_team_sport: false,
                pref_outdoors: false,
                pref_meditation: false,
                pref_vipassana: false,
                pref_body_positive: false,
                pref_adaptive: false,
                pref_dv_safe: false,
                pref_prenatal_postnatal: false,
                goals: '',
                constraints: '',
                health_topics: '',
                availability: '',
                energy_pattern: '',
            },
            saving: false,
            saveMessage: '',
            error: '',
            filters: {
                type: '',
                mode: '',
                body_positive: false,
                adaptive: false,
                dv_safe: false,
                prenatal_postnatal: false,
            },
            interestTags: this.interests ?? [],
            plan: null,
            events: [],
            offers: [],
            articles: [],
            disclaimer: null,
        };
    },
    computed: {
        displayName() {
            return this.user?.name ?? 'friend';
        },
        primaryInterest() {
            if (!this.interestTags || !this.interestTags.length) {
                return null;
            }

            const priority = this.interestTags.find((tag) => tag !== 'wellness');
            return priority ?? this.interestTags[0];
        },
        groupedEvents() {
            if (!this.events.length) {
                return [];
            }

            const groups = {};
            this.events.forEach((event) => {
                const dateKey = event.starts_at ? event.starts_at.split('T')[0] : 'upcoming';
                if (!groups[dateKey]) {
                    groups[dateKey] = {
                        date: dateKey,
                        label: event.starts_at_human ? event.starts_at_human.split('•')[0] : 'Upcoming',
                        items: [],
                    };
                }
                groups[dateKey].items.push(event);
            });

            return Object.values(groups);
        },
    },
    created() {
        this.initialLoad();
    },
    methods: {
        async initialLoad() {
            await this.fetchProfile();
            await Promise.all([this.fetchEvents(), this.fetchOffers(), this.fetchArticles()]);
        },
        async fetchProfile() {
            try {
                const { data } = await axios.get('/api/v1/wellbeing/profile');
                if (data.profile) {
                    this.profile = {
                        ...this.profile,
                        ...data.profile,
                    };
                }
                this.interestTags = data.interest_tags ?? this.interestTags;
                this.plan = data.plan ?? null;
            } catch (err) {
                console.error(err);
                this.error = 'Unable to load your wellbeing profile right now.';
            }
        },
        async saveProfile() {
            this.saving = true;
            this.saveMessage = '';
            this.error = '';

            try {
                const payload = {
                    ...this.profile,
                    pref_yoga: !!this.profile.pref_yoga,
                    pref_running: !!this.profile.pref_running,
                    pref_strength: !!this.profile.pref_strength,
                    pref_team_sport: !!this.profile.pref_team_sport,
                    pref_outdoors: !!this.profile.pref_outdoors,
                    pref_meditation: !!this.profile.pref_meditation,
                    pref_vipassana: !!this.profile.pref_vipassana,
                    pref_body_positive: !!this.profile.pref_body_positive,
                    pref_adaptive: !!this.profile.pref_adaptive,
                    pref_dv_safe: !!this.profile.pref_dv_safe,
                    pref_prenatal_postnatal: !!this.profile.pref_prenatal_postnatal,
                };

                const { data } = await axios.post('/api/v1/wellbeing/profile', payload);
                this.interestTags = data.interest_tags ?? this.interestTags;
                this.saveMessage = data.message ?? 'Saved.';
                // Refresh plan after saving profile
                await this.fetchProfile();
                await Promise.all([this.fetchEvents(), this.fetchOffers(), this.fetchArticles()]);
            } catch (err) {
                console.error(err);
                this.error = 'Something went wrong — please try again shortly.';
            } finally {
                this.saving = false;
            }
        },
        async fetchEvents() {
            try {
                const params = {
                    ...this.filters,
                };

                if (this.primaryInterest) {
                    params.interest = this.primaryInterest;
                }

                const { data } = await axios.get('/api/v1/wellbeing/events', { params });
                this.events = data.events ?? [];
            } catch (err) {
                console.error(err);
                this.events = [];
            }
        },
        async fetchOffers() {
            try {
                const params = {};
                if (this.primaryInterest) {
                    params.interest = this.primaryInterest;
                }

                const { data } = await axios.get('/api/v1/wellbeing/offers', { params });
                this.offers = data.offers ?? [];
            } catch (err) {
                console.error(err);
                this.offers = [];
            }
        },
        async fetchArticles() {
            try {
                const { data } = await axios.get('/api/v1/wellbeing/articles');
                this.articles = data.articles ?? [];
                this.disclaimer = data.disclaimer ?? null;
            } catch (err) {
                console.error(err);
                this.articles = [];
            }
        },
        labelForEvent(type) {
            return (
                {
                    yoga: 'Yoga / stretch',
                    run: 'Walk / run',
                    strength: 'Strength training',
                    meditation: 'Meditation',
                    vipassana: 'Vipassana',
                    public_speaking: 'Public speaking',
                }[type] ?? 'Wellbeing event'
            );
        },
        openAiConcierge(event) {
            this.sendTelemetry('ask_athena', {
                event_id: event?.id ?? null,
                event_type: event?.type ?? null,
            });
            const prompt = `Could you help me understand if this event suits my current energy and constraints? ${event.title} — ${event.summary ?? ''}`;
            const url = new URL(window.location.origin + '/ai');
            url.searchParams.set('context', 'wellbeing-fitness');
            url.searchParams.set('prompt', prompt);
            window.open(url.toString(), '_blank');
        },
        trackEventRsvp(item) {
            this.sendTelemetry('event_rsvp', {
                event_id: item?.id ?? null,
                event_type: item?.type ?? null,
            });
        },
        trackOfferClick(offer) {
            this.sendTelemetry('offer_clicked', {
                offer_id: offer?.id ?? null,
                brand: offer?.brand ?? null,
            });
        },
        sendTelemetry(eventName, context = {}) {
            axios
                .post('/api/v1/wellbeing/telemetry', {
                    event: eventName,
                    context,
                })
                .catch(() => {
                    /* Non-blocking */
                });
        },
        formatInterestTag(tag) {
            if (!tag || typeof tag !== 'string') {
                return 'Interest';
            }

            const cleaned = tag.replace(/^wellness:/i, '').replace(/[_:]/g, ' ').trim();
            if (!cleaned) {
                return tag;
            }

            return cleaned
                .split(/[\s-]+/)
                .filter(Boolean)
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        },
    },
};
</script>
