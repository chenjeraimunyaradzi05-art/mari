/**
 * We'll load the axios HTTP library which allows us to easily issue requests
 * to our Laravel back-end. This library automatically handles sending the
 * CSRF token as a header based on the value of the "XSRF" token cookie.
 */

import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const csrfToken = document.head.querySelector('meta[name="csrf-token"]');
if (csrfToken) {
	window.axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken.content;
}

window.axios.defaults.withCredentials = true;

/**
 * Echo exposes an expressive API for subscribing to channels and listening
 * for events that are broadcast by Laravel. Echo and event broadcasting
 * allows your team to easily build robust real-time web applications.
 */

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const pusherKey = import.meta.env.VITE_PUSHER_APP_KEY;

if (pusherKey) {
	const csrf = csrfToken?.content ?? document.querySelector('meta[name="csrf-token"]')?.content;
	const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1';
	const scheme = (import.meta.env.VITE_PUSHER_SCHEME ?? 'https').toLowerCase();
	const hasCustomHost = Boolean(import.meta.env.VITE_PUSHER_HOST);
	const defaultPort = scheme === 'https' ? 443 : 80;
	const configuredPort = Number(import.meta.env.VITE_PUSHER_PORT ?? defaultPort);

	const echoConfig = {
		broadcaster: 'pusher',
		key: pusherKey,
		cluster,
		forceTLS: scheme === 'https',
		authEndpoint: '/broadcasting/auth',
		auth: {
			headers: csrf ? { 'X-CSRF-TOKEN': csrf } : {},
		},
		disableStats: true,
	};

	if (hasCustomHost) {
		Object.assign(echoConfig, {
			wsHost: import.meta.env.VITE_PUSHER_HOST,
			wsPort: configuredPort,
			wssPort: configuredPort,
			enabledTransports: ['ws', 'wss'],
		});
	}

	window.Echo = new Echo(echoConfig);
} else {
	console.info('Laravel Echo not initialised - missing VITE_PUSHER_APP_KEY.');
}
