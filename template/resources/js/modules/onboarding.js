import Alpine from 'alpinejs';

const parseJson = (value, fallback) => {
    try {
        if (value === undefined || value === null || value === '') {
            return fallback;
        }

        if (typeof value !== 'string') {
            return value;
        }

        return JSON.parse(value);
    } catch (error) {
        console.warn('Failed to parse onboarding JSON payload', error);
        return fallback;
    }
};

document.addEventListener('alpine:init', () => {
    Alpine.data('onboardingApp', (config) => ({
        loading: true,
        savingProfile: false,
        savingPersonas: false,
        completing: false,
        error: null,
        notice: null,
        noticeType: 'success',
        noticeTimer: null,
        user: null,
        personaOptions: [],
        personaGuidance: [],
        supports: [],
        backbone: null,
        backboneMeta: null,
        backboneLoading: false,
        backboneError: null,
        checklist: {
            items: [],
            completed: 0,
            total: 0,
            progress: 0,
        },
        profileForm: {
            name: '',
            preferred_name: '',
            pronouns: '',
            timezone: '',
        },
        selectedPersonas: [],
        personaCatalog: parseJson(config.personas, {}),
        supportCatalog: parseJson(config.supports, {}),
        dismissedNudges: [],
        endpoints: {
            show: config.endpoint,
            profile: config.profileEndpoint,
            personas: config.personaEndpoint,
            complete: config.completeEndpoint,
            engagement: config.engagementEndpoint,
            backbone: config.backboneEndpoint,
        },
        init() {
            this.fetchState();
            this.fetchBackbone();
        },
        canCompleteOnboarding() {
            if (!this.checklist || !Array.isArray(this.checklist.items)) {
                return false;
            }

            return this.checklist.items
                .filter((item) => item && item.id !== 'finish')
                .every((item) => Boolean(item.completed));
        },
        missingChecklistRequirements() {
            if (!this.checklist || !Array.isArray(this.checklist.items)) {
                return [];
            }

            return this.checklist.items
                .filter((item) => item && item.id !== 'finish' && !item.completed)
                .map((item) => item.label)
                .filter(Boolean);
        },
        async fetchState() {
            this.loading = true;
            this.error = null;
            this.lastFailedAction = null;
            try {
                const { data } = await window.axios.get(this.endpoints.show);
                this.applyState(data);
            } catch (error) {
                this.error = this.resolveError(error);
                this.lastFailedAction = 'fetchState';
            } finally {
                this.loading = false;
            }
        },
        async fetchBackbone(options = {}) {
            if (!this.endpoints.backbone || !window.axios) {
                return;
            }

            this.backboneLoading = true;
            this.backboneError = null;

            try {
                const requestConfig = {};

                if (options.refresh) {
                    requestConfig.params = { refresh: 1 };
                }

                const { data } = await window.axios.get(this.endpoints.backbone, requestConfig);

                this.backbone = data?.data ?? null;
                this.backboneMeta = data?.meta?.cache ?? null;
            } catch (error) {
                this.backboneError = this.resolveError(error);
            } finally {
                this.backboneLoading = false;
            }
        },
        refreshBackbone() {
            this.fetchBackbone({ refresh: true });
        },
        backboneStat(path, fallback = 0) {
            if (!this.backbone || !path) {
                return fallback;
            }

            const value = path.split('.').reduce((carry, segment) => {
                if (carry === null || carry === undefined) {
                    return undefined;
                }

                return carry[segment];
            }, this.backbone);

            return value ?? fallback;
        },
        backboneItems(path, limit = 3) {
            const value = this.backboneStat(path, []);

            if (!Array.isArray(value)) {
                return [];
            }

            if (typeof limit === 'number') {
                return value.slice(0, limit);
            }

            return value;
        },
        applyState(payload) {
            // Track previous checklist for granular feedback and animation
            const prevChecklist = this.checklist && Array.isArray(this.checklist.items)
                ? this.checklist.items.map(item => ({ id: item.id, completed: item.completed }))
                : [];
            this.justCompletedChecklistItem = null;

            this.user = payload?.user ?? null;
            this.personaOptions = payload?.persona_options ?? [];
            this.personaGuidance = payload?.persona_guidance ?? [];
            this.checklist = payload?.checklist ?? this.checklist;

            // Granular feedback for checklist step completion and animation
            if (payload?.checklist && Array.isArray(payload.checklist.items)) {
                payload.checklist.items.forEach((item) => {
                    const prev = prevChecklist.find(i => i.id === item.id);
                    if (prev && !prev.completed && item.completed) {
                        this.setNotice(`Step completed: ${item.label}`);
                        this.justCompletedChecklistItem = item.id;
                        // Remove the highlight after a short delay
                        setTimeout(() => {
                            if (this.justCompletedChecklistItem === item.id) {
                                this.justCompletedChecklistItem = null;
                            }
                        }, 1200);
                    }
                });
            }

            if (this.user) {
                this.profileForm = {
                    name: this.user.name ?? '',
                    preferred_name: this.user.preferred_name ?? '',
                    pronouns: this.user.pronouns ?? '',
                    timezone: this.user.timezone ?? '',
                };

                this.selectedPersonas = Array.isArray(this.user.persona_flags)
                    ? [...this.user.persona_flags]
                    : [];

                this.loadDismissedNudges();
            } else {
                this.dismissedNudges = [];
            }

            const supports = payload?.recommendations?.supports ?? [];
            this.supports = this.filterDismissedSupportNudges(supports);
        },
        async saveProfile() {
            this.savingProfile = true;
            this.error = null;
            this.clearNotice();
            this.lastFailedAction = null;
            try {
                await window.axios.post(this.endpoints.profile, this.profileForm);
                await this.fetchState();
                this.setNotice('Profile details saved.');
            } catch (error) {
                this.error = this.resolveError(error);
                this.lastFailedAction = 'saveProfile';
            } finally {
                this.savingProfile = false;
            }
        },
        async savePersonas() {
            this.savingPersonas = true;
            this.error = null;
            this.clearNotice();
            this.lastFailedAction = null;

            if (!this.selectedPersonas.length) {
                this.error = 'Select at least one persona so we can personalise your journey.';
                this.savingPersonas = false;
                return;
            }

            try {
                await window.axios.post(this.endpoints.personas, {
                    personas: this.selectedPersonas,
                });

                await this.fetchState();
                this.setNotice('Persona preferences updated.');
            } catch (error) {
                this.error = this.resolveError(error);
                this.lastFailedAction = 'savePersonas';
            } finally {
                this.savingPersonas = false;
            }
        },
        async completeOnboarding() {
            if (this.user?.onboarding_step === 'completed') {
                this.setNotice('Onboarding already completed. Great work!');
                return;
            }

            if (!this.canCompleteOnboarding()) {
                const pending = this.missingChecklistRequirements();
                const message = pending.length
                    ? `Finish these first: ${pending.join(', ')}.`
                    : 'Complete the required steps before finishing onboarding.';
                this.setNotice(message, 'warning');
                return;
            }

            this.completing = true;
            this.error = null;
            this.clearNotice();
            this.lastFailedAction = null;

            try {
                await window.axios.post(this.endpoints.complete);
                await this.fetchState();
                this.setNotice('You have completed onboarding. Welcome to WomenRise!');
            } catch (error) {
                this.error = this.resolveError(error);
                this.lastFailedAction = 'completeOnboarding';
            } finally {
                this.completing = false;
            }

        },
        retryLastFailedAction() {
            if (this.lastFailedAction === 'fetchState') {
                this.fetchState();
            } else if (this.lastFailedAction === 'saveProfile') {
                this.saveProfile();
            } else if (this.lastFailedAction === 'savePersonas') {
                this.savePersonas();
            } else if (this.lastFailedAction === 'completeOnboarding') {
                this.completeOnboarding();
            }
        },
        togglePersona(value) {
            this.clearNotice();

            if (this.personaSelected(value)) {
                this.selectedPersonas = this.selectedPersonas.filter((item) => item !== value);
                return;
            }

            if (this.selectedPersonas.length >= 5) {
                this.setNotice('You can choose up to five personas.', 'warning');
                return;
            }

            this.selectedPersonas = [...this.selectedPersonas, value];
        },
        personaSelected(value) {
            return this.selectedPersonas.includes(value);
        },
        supportDescription(type, item) {
            switch (type) {
                case 'courses':
                    return item.summary ?? 'Explore this course to see if it aligns with your journey.';
                case 'housing': {
                    const rent = typeof item.rent_cents === 'number'
                        ? this.formatCurrency((item.rent_cents ?? 0) / 100, item.currency ?? 'AUD', item.rent_frequency)
                        : null;
                    const location = item.location ?? null;
                    return [rent, location].filter(Boolean).join(' • ') || 'Verified housing available for relocation support.';
                }
                case 'mentorship': {
                    const focus = item.focus_area ?? null;
                    const mode = item.delivery_mode ? `${item.delivery_mode.replace('_', ' ')}` : null;
                    const duration = item.duration_minutes ? `${item.duration_minutes} mins` : null;
                    return [focus, mode, duration].filter(Boolean).join(' • ') || 'Mentorship focused on WomenRise journeys.';
                }
                case 'jobs': {
                    const location = item.location ?? null;
                    const salary = item.salary_range && (item.salary_range.min || item.salary_range.max)
                        ? `Salary: ${this.formatNumber(item.salary_range.min)} - ${this.formatNumber(item.salary_range.max)} ${item.salary_range.currency ?? ''}`.trim()
                        : null;
                    const deadline = item.deadline ? `Apply by ${this.formatDate(item.deadline)}` : null;
                    return [location, salary, deadline].filter(Boolean).join(' • ') || 'Career opportunity aligned to your personas.';
                }
                default:
                    return '';
            }
        },
        supportLink(type, item) {
            switch (type) {
                case 'courses':
                    return item.url ?? item.application_url ?? null;
                case 'jobs':
                    return item.url ?? item.apply?.url ?? null;
                case 'housing':
                    return null;
                case 'mentorship':
                    return null;
                default:
                    return null;
            }
        },
        dismissNudge(section, nudge) {
            if (!section || !section.type || !nudge) {
                return;
            }

            this.recordSupportEngagement(section, null, {
                action: 'nudge_dismissed',
                metadata: {
                    nudge_text: nudge,
                },
                highlighted: section.highlighted,
                cta_label: section.cta_label,
            });

            this.addDismissedNudge(section.type, nudge);

            this.supports = this.supports.map((entry) => {
                if (!entry || entry.type !== section.type) {
                    return entry;
                }

                const filteredNudges = Array.isArray(entry.nudges)
                    ? entry.nudges.filter((item) => item !== nudge)
                    : [];

                return {
                    ...entry,
                    nudges: filteredNudges,
                };
            });
        },
        handleSupportCta(section, item) {
            // Provide user feedback for support CTA actions
            this.setNotice('Processing your support action...');
            this.recordSupportEngagementWithFeedback(section, item, { action: 'cta_clicked' });
        },

        async recordSupportEngagementWithFeedback(section, item, overrides = {}) {
            if (!window.axios || !this.endpoints.engagement) {
                this.setNotice('Support engagement endpoint unavailable.', 'warning');
                return;
            }

            const supportType = section?.type;
            if (!supportType) {
                this.setNotice('Support type missing. Please try again.', 'warning');
                return;
            }

            const payload = {
                action: overrides.action || 'cta_clicked',
                support_type: supportType,
                highlighted: Boolean(section?.highlighted),
                cta_label: overrides.cta_label || section?.cta_label || this.supportCta(section),
            };

            const supportId = item?.id;
            if (supportId !== undefined && supportId !== null && `${supportId}` !== '') {
                payload.support_id = String(supportId);
            }

            const defaultMetadata = {
                item_title: item?.title ?? item?.name ?? null,
                item_slug: item?.slug ?? null,
                provider: item?.provider ?? item?.company_name ?? null,
            };

            const metadata = { ...defaultMetadata, ...(overrides.metadata || {}) };
            Object.keys(metadata).forEach((key) => {
                const value = metadata[key];
                if (value === null || value === undefined || value === '') {
                    delete metadata[key];
                }
            });
            if (Object.keys(metadata).length) {
                payload.metadata = metadata;
            }

            try {
                await window.axios.post(this.endpoints.engagement, payload);
                this.setNotice('Support engagement recorded!');
            } catch (error) {
                this.setNotice('Could not record your support action. Please try again.', 'warning');
            }
        },
        recordSupportEngagement(section, item, overrides = {}) {
            if (!window.axios || !this.endpoints.engagement) {
                return;
            }

            const supportType = section?.type;
            if (!supportType) {
                return;
            }

            const payload = {
                action: overrides.action || 'cta_clicked',
                support_type: supportType,
                highlighted: Boolean(section?.highlighted),
                cta_label: overrides.cta_label || section?.cta_label || this.supportCta(section),
            };

            const supportId = item?.id;
            if (supportId !== undefined && supportId !== null && `${supportId}` !== '') {
                payload.support_id = String(supportId);
            }

            if (overrides.highlighted !== undefined) {
                payload.highlighted = Boolean(overrides.highlighted);
            }

            const defaultMetadata = {
                item_title: item?.title ?? item?.name ?? null,
                item_slug: item?.slug ?? null,
                provider: item?.provider ?? item?.company_name ?? null,
            };

            const metadata = { ...defaultMetadata, ...(overrides.metadata || {}) };

            Object.keys(metadata).forEach((key) => {
                const value = metadata[key];
                if (value === null || value === undefined || value === '') {
                    delete metadata[key];
                }
            });

            if (Object.keys(metadata).length) {
                payload.metadata = metadata;
            }

            window.axios.post(this.endpoints.engagement, payload).catch((error) => {
                console.warn('Failed to record onboarding support engagement', error);
            });
        },
        filterDismissedSupportNudges(sections) {
            if (!Array.isArray(sections)) {
                return [];
            }

            if (!this.dismissedNudges.length) {
                return sections;
            }

            return sections.map((section) => {
                if (!section || !section.type || !Array.isArray(section.nudges)) {
                    return section;
                }

                const filteredNudges = section.nudges.filter((nudge) => !this.isNudgeDismissed(section.type, nudge));
                return {
                    ...section,
                    nudges: filteredNudges,
                };
            });
        },
        isNudgeDismissed(type, nudge) {
            return this.dismissedNudges.some((entry) => entry.type === type && entry.text === nudge);
        },
        addDismissedNudge(type, nudge) {
            if (!type || !nudge || this.isNudgeDismissed(type, nudge)) {
                return;
            }

            this.dismissedNudges = [
                ...this.dismissedNudges,
                { type, text: nudge },
            ];

            this.persistDismissedNudges();
        },
        dismissedNudgesStorageKey() {
            if (!this.user || !this.user.id) {
                return null;
            }

            return `womenrise:onboarding:dismissed-nudges:${this.user.id}`;
        },
        loadDismissedNudges() {
            const storageKey = this.dismissedNudgesStorageKey();
            if (!storageKey || !window.localStorage) {
                this.dismissedNudges = [];
                return;
            }

            try {
                const raw = window.localStorage.getItem(storageKey);
                if (!raw) {
                    this.dismissedNudges = [];
                    return;
                }

                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) {
                    this.dismissedNudges = [];
                    return;
                }

                this.dismissedNudges = parsed
                    .map((entry) => {
                        if (!entry || typeof entry !== 'object') {
                            return null;
                        }

                        const type = typeof entry.type === 'string' ? entry.type : null;
                        const text = typeof entry.text === 'string' ? entry.text : null;

                        if (!type || !text) {
                            return null;
                        }

                        return { type, text };
                    })
                    .filter(Boolean);
            } catch (error) {
                console.warn('Failed to load dismissed nudges state', error);
                this.dismissedNudges = [];
            }
        },
        persistDismissedNudges() {
            const storageKey = this.dismissedNudgesStorageKey();
            if (!storageKey || !window.localStorage) {
                return;
            }

            try {
                window.localStorage.setItem(storageKey, JSON.stringify(this.dismissedNudges));
            } catch (error) {
                console.warn('Failed to persist dismissed nudges state', error);
            }
        },
        supportCta(section) {
            if (section && typeof section === 'object' && section.cta_label) {
                return section.cta_label;
            }

            const type = section?.type ?? section;

            switch (type) {
                case 'courses':
                    return 'View course';
                case 'jobs':
                    return 'View role';
                case 'housing':
                    return 'Housing support info';
                case 'mentorship':
                    return 'Mentorship details';
                default:
                    return 'Learn more';
            }
        },
        formatCurrency(amount, currency = 'AUD', frequency = null) {
            if (amount === null || amount === undefined) {
                return '';
            }

            let value;

            try {
                value = new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency,
                    maximumFractionDigits: 2,
                }).format(amount);
            } catch (error) {
                value = `${amount} ${currency}`;
            }

            if (frequency) {
                return `${value} ${frequency}`.trim();
            }

            return value;
        },
        formatNumber(value) {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                return '';
            }

            return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 }).format(value);
        },
        formatDate(value) {
            if (!value) {
                return '';
            }

            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return value;
            }

            return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(date);
        },
        resolveError(error) {
            if (error?.response?.data?.message) {
                return error.response.data.message;
            }
            if (error?.response?.data?.errors) {
                // Laravel validation errors
                const errors = error.response.data.errors;
                return Object.values(errors).flat().join(' ');
            }
            if (error?.message) {
                return error.message;
            }
            return 'Something went wrong. Please check your connection and try again.';
        },
        clearNotice() {
            this.notice = null;
            this.noticeType = 'success';

            if (this.noticeTimer) {
                clearTimeout(this.noticeTimer);
                this.noticeTimer = null;
            }
        },
        setNotice(message, type = 'success') {
            this.notice = message;
            this.noticeType = type;

            if (this.noticeTimer) {
                clearTimeout(this.noticeTimer);
            }

            this.noticeTimer = window.setTimeout(() => {
                this.notice = null;
                this.noticeTimer = null;
            }, 5000);
        },
    }));
});
