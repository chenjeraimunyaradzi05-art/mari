const initialContext = typeof window !== 'undefined' ? window.athenaPersona ?? null : null;
const subscribers = new Set();

const datasetTarget = typeof document !== 'undefined' ? document.documentElement : null;

const PersonaMiddleware = (() => {
    const state = {
        context: initialContext,
    };

    const buildHeaders = () => {
        const ctx = state.context;

        if (!ctx) {
            return {};
        }

        const headers = {};

        if (ctx.profile_id) {
            headers['X-Persona-Profile'] = ctx.profile_id;
        }

        if (ctx.social_profile?.id) {
            headers['X-Social-Profile'] = ctx.social_profile.id;
        }

        if (ctx.privacy?.tier) {
            headers['X-Privacy-Tier'] = ctx.privacy.tier;
        }

        if (ctx.privacy?.level) {
            headers['X-Privacy-Level'] = ctx.privacy.level;
        }

        if (ctx.privacy?.dm_policy) {
            headers['X-Privacy-DM'] = ctx.privacy.dm_policy;
        }

        if (ctx.privacy?.is_private !== undefined) {
            headers['X-Persona-Private'] = ctx.privacy.is_private ? '1' : '0';
        }

        return headers;
    };

    const applyDataset = () => {
        if (!datasetTarget) {
            return;
        }

        const ctx = state.context;

        datasetTarget.dataset.personaKey = ctx?.persona?.type ?? '';
        datasetTarget.dataset.personaTier = ctx?.privacy?.tier ?? '';
        datasetTarget.dataset.personaPrivacy = ctx?.privacy?.level ?? '';
        datasetTarget.style.setProperty('--persona-tier', ctx?.privacy?.tier ?? '');
    };

    const notifySubscribers = () => {
        subscribers.forEach((callback) => {
            try {
                callback(state.context);
            } catch (error) {
                if (window?.console?.debug) {
                    window.console.debug('[persona] subscriber error', error);
                }
            }
        });

        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('persona:context-updated', {
                detail: state.context,
            }));
        }
    };

    const updateGlobals = () => {
        if (typeof window === 'undefined') {
            return;
        }

        window.athenaPersona = state.context;
        window.currentPersonaId = state.context?.profile_id ?? null;
        window.currentSocialProfileId = state.context?.social_profile?.id ?? null;
        window.currentPrivacyTier = state.context?.privacy?.tier ?? null;
    };

    const applyContext = (payload) => {
        state.context = payload || null;
        updateGlobals();
        applyDataset();
        notifySubscribers();
    };

    const installAxiosInterceptor = () => {
        if (typeof window === 'undefined' || !window.axios || window.axios.__personaInterceptorInstalled) {
            return;
        }

        window.axios.__personaInterceptorInstalled = true;
        window.axios.interceptors.request.use((config) => {
            const headers = buildHeaders();
            config.headers = config.headers || {};

            Object.entries(headers).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    config.headers[key] = value;
                }
            });

            return config;
        });
    };

    const patchFetch = () => {
        if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.__personaFetchPatched) {
            return;
        }

        window.__personaFetchPatched = true;
        const originalFetch = window.fetch.bind(window);

        window.fetch = (input, init = {}) => {
            const headers = buildHeaders();

            if (!Object.keys(headers).length) {
                return originalFetch(input, init);
            }

            const nextInit = { ...init };
            const headerBag = new Headers(nextInit.headers || {});

            Object.entries(headers).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    headerBag.set(key, value);
                }
            });

            nextInit.headers = headerBag;

            return originalFetch(input, nextInit);
        };
    };

    const subscribe = (callback) => {
        if (typeof callback === 'function') {
            subscribers.add(callback);
        }

        return () => {
            subscribers.delete(callback);
        };
    };

    const init = () => {
        installAxiosInterceptor();
        patchFetch();
        applyDataset();

        if (typeof document !== 'undefined') {
            document.addEventListener('persona:context-ready', (event) => {
                applyContext(event.detail || null);
            });
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('persona:switch', (event) => {
                applyContext(event.detail || null);
            });
        }
    };

    init();

    return {
        context: () => state.context,
        headers: () => buildHeaders(),
        set: (payload) => applyContext(payload),
        subscribe,
    };
})();

if (typeof window !== 'undefined') {
    window.PersonaMiddleware = PersonaMiddleware;
}

export default PersonaMiddleware;
