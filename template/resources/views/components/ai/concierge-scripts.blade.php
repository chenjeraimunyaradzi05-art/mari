@once
    @push('scripts')
        <script>
            const athenaAiDefaultEndpoint = () => {
                const meta = document.querySelector('meta[name="ai-concierge-endpoint"]');
                return meta ? meta.content : '/ai/concierge/respond';
            };

            const athenaAiCsrf = () => {
                const meta = document.querySelector('meta[name="csrf-token"]');
                return meta ? meta.content : '';
            };

            const athenaAiRequest = async ({ endpoint, context, question, meta = {} }) => {
                const target = endpoint || athenaAiDefaultEndpoint();
                const body = { context, question };

                Object.entries(meta || {}).forEach(([key, value]) => {
                    if (value !== undefined) {
                        body[key] = value;
                    }
                });

                try {
                    const response = await fetch(target, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': athenaAiCsrf(),
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify(body),
                    });

                    if (!response.ok) {
                        let message = 'Concierge temporarily unavailable.';
                        try {
                            const payload = await response.json();
                            message = payload.message || message;
                        } catch (error) {
                            // ignore JSON parse issues
                        }
                        const error = new Error(message);
                        error.code = `http_${response.status}`;
                        error.stage = 'response';
                        error.status = response.status;
                        throw error;
                    }

                    return response.json();
                } catch (error) {
                    if (error instanceof Error) {
                        if (!error.code) {
                            error.code = 'network_failure';
                        }
                        if (!error.stage) {
                            error.stage = 'request';
                        }
                    }

                    throw error;
                }
            };

            const athenaAnalyticsEndpoint = () => '/api/v1/analytics/events';

            const athenaTrackAnalyticsEvent = (event, properties = {}) => {
                return fetch(athenaAnalyticsEndpoint(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': athenaAiCsrf(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ event, properties }),
                }).catch(() => null);
            };

            document.addEventListener('alpine:init', () => {
                Alpine.data('aiCoach', ({ context, endpoint } = {}) => ({
                    context,
                    endpoint: endpoint || athenaAiDefaultEndpoint(),
                    question: '',
                    loading: false,
                    answer: '',
                    disclaimer: '',
                    error: '',
                    async ask() {
                        this.error = '';
                        if (!this.question || this.question.trim() === '') {
                            this.error = 'Let Athena know what feels heavy first.';
                            return;
                        }

                        this.loading = true;
                        this.answer = '';
                        this.disclaimer = '';

                        try {
                            const payload = await athenaAiRequest({
                                endpoint: this.endpoint,
                                context: this.context,
                                question: this.question,
                            });
                            this.answer = payload.answer ?? '';
                            this.disclaimer = payload.disclaimer ?? '';
                        } catch (error) {
                            this.error = error.message || 'Athena could not respond right now.';
                        } finally {
                            this.loading = false;
                        }
                    },
                }));

                Alpine.data('aiConciergeBar', ({ contexts, defaultContext, endpoint, entryUrl, payloads, surface }) => ({
                    contexts: contexts || {},
                    contextPayloads: payloads || {},
                    currentContext: defaultContext,
                    endpoint: endpoint || athenaAiDefaultEndpoint(),
                    entryUrl,
                    surface: surface || 'global_concierge',
                    question: '',
                    loading: false,
                    answer: '',
                    disclaimer: '',
                    error: '',
                    telemetryFlags: {
                        shown: false,
                        opened: false,
                    },
                    externalSelectHandler: null,
                    init() {
                        window.__athenaAiConciergeMounted = true;
                        this.emitLauncherShown();
                        this.externalSelectHandler = (event) => this.handleExternalSelect(event);
                        window.addEventListener('ai:select-context', this.externalSelectHandler);
                    },
                    destroy() {
                        if (this.externalSelectHandler) {
                            window.removeEventListener('ai:select-context', this.externalSelectHandler);
                        }
                    },
                    get currentMeta() {
                        return this.contexts?.[this.currentContext] ?? {};
                    },
                    get currentPayload() {
                        return this.contextPayloads?.[this.currentContext] ?? {};
                    },
                    get snapshotMeta() {
                        const payload = this.currentPayload || {};
                        const hasSnapshot = Boolean(payload.context_payload || payload.selection_total || payload.filters);

                        return {
                            hasSnapshot,
                            selection_total: payload.selection_total ?? null,
                            filters: payload.filters ?? null,
                            token: payload.token ?? null,
                            history_token: payload.resumed_from_history ? (payload.token ?? null) : null,
                        };
                    },
                    get fullWorkspaceUrl() {
                        if (!this.entryUrl) {
                            return '/ai';
                        }
                        const contextParam = this.currentContext ? `context=${encodeURIComponent(this.currentContext)}` : '';
                        const payload = this.currentPayload || {};
                        const promptParam = payload.prompt
                            ? `prompt=${encodeURIComponent(payload.prompt)}`
                            : '';
                        const payloadParam = payload.context_payload
                            ? `context_payload=${encodeURIComponent(payload.context_payload)}`
                            : '';

                        const params = [contextParam, promptParam, payloadParam].filter(Boolean).join('&');

                        if (!params) {
                            return this.entryUrl;
                        }

                        return this.entryUrl.includes('?')
                            ? `${this.entryUrl}&${params}`
                            : `${this.entryUrl}?${params}`;
                    },
                    selectContext(key) {
                        if (this.currentContext === key) {
                            return;
                        }
                        this.currentContext = key;
                        this.answer = '';
                        this.disclaimer = '';
                        this.error = '';
                    },
                    emitLauncherShown() {
                        if (this.telemetryFlags.shown) {
                            return;
                        }

                        this.telemetryFlags.shown = true;
                        this.trackEvent('ai.concierge.launcher_shown', {
                            surface: this.surface,
                            context_key: this.currentContext,
                            snapshot_available: this.snapshotMeta.hasSnapshot,
                            selection_total: this.snapshotMeta.selection_total,
                        });
                    },
                    emitLauncherOpened(trigger = 'click') {
                        if (this.telemetryFlags.opened) {
                            return;
                        }

                        this.telemetryFlags.opened = true;
                        const meta = this.snapshotMeta;
                        this.trackEvent('ai.concierge.launcher_opened', {
                            surface: this.surface,
                            context_key: this.currentContext,
                            trigger_source: trigger,
                            snapshot_available: meta.hasSnapshot,
                            selection_total: meta.selection_total,
                            filters: meta.filters ?? undefined,
                        });
                    },
                    handleFocus(trigger = 'focus') {
                        this.emitLauncherOpened(trigger);
                    },
                    handleExternalSelect(event) {
                        const detail = event?.detail || {};
                        const key = detail.key;

                        if (!key || !this.contexts[key]) {
                            if (detail.fallbackUrl) {
                                window.location.href = detail.fallbackUrl;
                            }
                            return;
                        }

                        this.selectContext(key);

                        if (typeof detail.question === 'string') {
                            this.question = detail.question;
                        }

                        if (detail.scroll !== false && this.$root) {
                            this.$root.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }

                        if (detail.autoOpen) {
                            this.handleFocus('external_event');
                            this.$nextTick(() => {
                                this.focusQuestion();
                            });
                        }
                    },
                    focusQuestion() {
                        if (this.$refs?.questionField) {
                            try {
                                this.$refs.questionField.focus({ preventScroll: true });
                            } catch (error) {
                                this.$refs.questionField.focus();
                            }
                        }
                    },
                    async ask() {
                        this.error = '';
                        if (!this.question || this.question.trim() === '') {
                            this.error = 'Share a quick sentence so Athena knows where to start.';
                            return;
                        }

                        this.emitLauncherOpened('ask_button');
                        this.loading = true;
                        this.answer = '';
                        this.disclaimer = '';

                        try {
                            const payload = await athenaAiRequest({
                                endpoint: this.endpoint,
                                context: this.currentContext,
                                question: this.question,
                                meta: this.telemetryPayload(),
                            });
                            this.answer = payload.answer ?? '';
                            this.disclaimer = payload.disclaimer ?? '';
                        } catch (error) {
                            this.error = error.message || 'Athena could not respond right now.';
                            this.trackLauncherError(error);
                        } finally {
                            this.loading = false;
                        }
                    },
                    telemetryPayload() {
                        const snapshot = this.snapshotMeta;

                        return {
                            surface: this.surface,
                            selection_total: snapshot.selection_total ?? undefined,
                            filters: snapshot.filters ?? undefined,
                            history_token: snapshot.history_token ?? undefined,
                            payload_token: snapshot.token ?? undefined,
                            used_history_payload: Boolean(snapshot.history_token),
                        };
                    },
                    trackLauncherError(error) {
                        const meta = this.snapshotMeta;
                        this.trackEvent('ai.concierge.launcher_error', {
                            surface: this.surface,
                            context_key: this.currentContext,
                            error_code: error?.code || 'unknown',
                            stage: error?.stage || 'request',
                            snapshot_available: meta.hasSnapshot,
                        });
                    },
                    trackEvent(event, properties = {}) {
                        const sanitised = Object.fromEntries(
                            Object.entries(properties).filter(([, value]) => value !== undefined)
                        );
                        athenaTrackAnalyticsEvent(event, sanitised);
                    },
                }));
            });
        </script>
    @endpush
@endonce
