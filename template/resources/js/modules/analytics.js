const createStub = () => ({
    track: () => Promise.resolve(),
});

const WomenRiseAnalytics = typeof window === 'undefined'
    ? createStub()
    : (function () {
    const endpoint = '/api/v1/analytics/events';

    function normalisePayload(eventName, properties) {
        if (typeof eventName !== 'string' || eventName.trim() === '') {
            return null;
        }

        const cleanedProps = properties && typeof properties === 'object' ? properties : {};

        return {
            event: eventName.trim(),
            properties: cleanedProps,
        };
    }

    async function sendWithAxios(payload) {
        if (!window.axios) {
            return Promise.reject(new Error('axios_unavailable'));
        }

        return window.axios.post(endpoint, payload, { withCredentials: true });
    }

    async function sendWithFetch(payload) {
        return fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
            },
            body: JSON.stringify(payload),
            credentials: 'include',
        });
    }

    function track(eventName, properties) {
        const payload = normalisePayload(eventName, properties);

        if (!payload) {
            return Promise.resolve();
        }

        return sendWithAxios(payload).catch(() => sendWithFetch(payload)).catch(() => {
            if (window.console && typeof window.console.debug === 'function') {
                window.console.debug('[analytics] failed to deliver event', payload);
            }
        });
    }

    return { track };
    })();

if (typeof window !== 'undefined' && !window.womenriseAnalytics) {
    window.womenriseAnalytics = WomenRiseAnalytics;
}

export default WomenRiseAnalytics;
