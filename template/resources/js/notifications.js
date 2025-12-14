import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const csrfToken = document.head.querySelector('meta[name="csrf-token"]')?.content;
const userId = resolveUserId();
const pusherKey = import.meta.env.VITE_PUSHER_APP_KEY;

if (userId && pusherKey) {
    const echo = ensureEchoInstance({
        key: pusherKey,
        cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1',
        scheme: (import.meta.env.VITE_PUSHER_SCHEME ?? 'https').toLowerCase(),
    });

    echo.private(`user.${userId}`)
        .listen('NotificationPushed', ({ alert }) => displayLegacyToast(alert));

    echo.private(`social.user.${userId}`)
        .listen('.social.post.created', (payload) => displayPostToast(payload));
}

function ensureEchoInstance({ key, cluster, scheme }) {
    if (window.Echo) {
        return window.Echo;
    }

    const forceTLS = scheme === 'https';
    window.Echo = new Echo({
        broadcaster: 'pusher',
        key,
        cluster,
        forceTLS,
        authEndpoint: '/broadcasting/auth',
        auth: {
            headers: csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {},
        },
    });

    return window.Echo;
}

function resolveUserId() {
    if (window.currentUserId) {
        return Number(window.currentUserId);
    }

    const meta = document.querySelector('meta[name="user-id"]');
    if (meta?.content) {
        return Number(meta.content);
    }

    return null;
}

function displayLegacyToast(alert) {
    if (!alert) {
        return;
    }

    const container = document.getElementById('realtime-notifications') || document.body;
    const div = document.createElement('div');
    div.className = 'alert alert-info shadow-sm mb-2';
    div.innerHTML = `<strong>${escapeHtml(alert.title ?? 'Notification')}</strong>: ${escapeHtml(alert.message ?? '')}`;
    container.prepend(div);

    setTimeout(() => div.remove(), 8000);
}

function displayPostToast(payload) {
    if (!payload || !payload.post) {
        return;
    }

    const container = document.getElementById('realtime-notifications') || document.body;
    const wrapper = document.createElement('div');
    wrapper.className = 'alert alert-light border border-indigo-100 shadow-sm mb-2';
    wrapper.innerHTML = `
        <div class="d-flex align-items-start gap-3">
            <div class="avatar" style="width:40px;height:40px;border-radius:9999px;background:#eef2ff url('${payload.author?.avatar_url ?? ''}') center/cover;"></div>
            <div class="flex-grow-1">
                <strong>${escapeHtml(payload.author?.display_name ?? 'Your network')}</strong>
                <div class="text-muted small">shared a new update</div>
                <p class="mb-0 mt-2">${escapeHtml(payload.post.caption || payload.post.content || '')}</p>
            </div>
            <button type="button" class="btn-close" aria-label="Dismiss"></button>
        </div>
    `;

    wrapper.querySelector('.btn-close')?.addEventListener('click', () => wrapper.remove());

    container.prepend(wrapper);
    setTimeout(() => wrapper.remove(), 10000);
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}
