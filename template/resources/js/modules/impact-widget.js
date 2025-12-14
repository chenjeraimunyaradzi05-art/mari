/* Impact widget loader
 * Finds elements with [data-impact-widget] and fetches the endpoint returning
 * { data: { timeframe, window_start, window_end, generated_at, metrics } }
 * Renders metric cards, updates window / generated meta lines and supports
 * autosync (cache TTL) and manual refresh. Shows friendly messages when
 * telemetry is paused or data can't be loaded.
 */

function formatTimeAgo(iso) {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        const diff = Date.now() - d.getTime();
        if (diff < 60_000) return 'just now';
        if (diff < 3600_000) return Math.round(diff / 60_000) + ' minutes ago';
        if (diff < 86400_000) return Math.round(diff / 3600_000) + ' hours ago';
        return d.toLocaleString();
    } catch (e) {
        return iso;
    }
}

function renderMetricCard(metric) {
    const article = document.createElement('article');
    article.className = 'impact-widget__card';
    article.setAttribute('role', 'listitem');

    const label = document.createElement('p');
    label.className = 'impact-widget__label';
    label.textContent = metric.label ?? metric.key;

    const value = document.createElement('p');
    value.className = 'impact-widget__value';
    const unit = metric.unit ? ' ' + metric.unit : '';
    value.textContent = String(metric.value ?? '—') + unit;

    const description = document.createElement('p');
    description.className = 'impact-widget__description';
    description.textContent = metric.description ?? metric.meta?.note ?? '';

    article.appendChild(label);
    article.appendChild(value);
    if (description.textContent) article.appendChild(description);

    return article;
}

function renderErrorCard(message = 'Unable to load impact metrics right now.') {
    const article = document.createElement('article');
    article.className = 'impact-widget__card impact-widget__card--error';
    article.setAttribute('role', 'listitem');

    const label = document.createElement('p');
    label.className = 'impact-widget__label';
    label.textContent = 'Telemetry paused';

    const value = document.createElement('p');
    value.className = 'impact-widget__value';
    value.textContent = '—';

    const description = document.createElement('p');
    description.className = 'impact-widget__description';
    description.textContent = message;

    article.appendChild(label);
    article.appendChild(value);
    article.appendChild(description);

    return article;
}

function hydrateWidget(el) {
    const endpoint = el.dataset.impactEndpoint;
    const cacheTtl = parseInt(el.dataset.impactCacheTtl || '', 10) || 15 * 60 * 1000; // default to 15m
    const grid = el.querySelector('[data-impact-grid]');
    const windowLine = el.querySelector('[data-impact-window]');
    const generatedLine = el.querySelector('[data-impact-generated]');
    const telemetryKey = el.dataset.impactTelemetry || null;

    if (!endpoint || !grid) return;

    let latest = null;
    let polling = null;

    async function load(now = false) {
        // show placeholders
        grid.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const placeholder = document.createElement('article');
            placeholder.className = 'impact-widget__card impact-widget__card--placeholder';
            placeholder.setAttribute('aria-hidden', 'true');
            placeholder.innerHTML = '<p class="impact-widget__label">Calibrating metric...</p><p class="impact-widget__value">—</p><p class="impact-widget__description">Syncing live signals</p>';
            grid.appendChild(placeholder);
        }

        try {
            const res = await fetch(endpoint, { credentials: 'same-origin' });

            if (!res.ok) {
                throw new Error(`http_${res.status}`);
            }

            const json = await res.json();

            const data = json.data || json;
            const metrics = Array.isArray(data.metrics) ? data.metrics : (data.metrics || []);

            // update window and generated
            if (windowLine) {
                const start = data.window_start || '';
                const end = data.window_end || '';
                windowLine.textContent = start && end ? `Window: ${start} — ${end}` : 'Window synced';
            }

            if (generatedLine) {
                latest = data.generated_at ?? new Date().toISOString();
                generatedLine.textContent = `Last updated ${formatTimeAgo(latest)}`;
            }

            grid.innerHTML = '';

            if (metrics.length === 0) {
                grid.appendChild(renderErrorCard('No metrics available'));
                return;
            }

            // render metrics
            metrics.forEach((m) => {
                grid.appendChild(renderMetricCard(m));
            });

        } catch (err) {
            if (windowLine) windowLine.textContent = 'Telemetry paused';
            if (generatedLine) generatedLine.textContent = 'Unable to load impact metrics right now.';
            grid.innerHTML = '';
            grid.appendChild(renderErrorCard());
            // try again after cacheTtl
        }
    }

    // attach refresh button if present
    const refreshBtn = el.querySelector('[data-impact-refresh]');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            load(true);
            if (window.womenriseAnalytics && telemetryKey) {
                window.womenriseAnalytics.track(`${telemetryKey}.refresh`, { endpoint });
            }
        });
    }

    // initial load
    load();

    // polling
    polling = setInterval(load, cacheTtl);

    // store handles so future scripts can access if needed
    el.__impact_widget = { load, stop: () => clearInterval(polling) };
}

function init() {
    if (typeof window === 'undefined') return;

    document.querySelectorAll('[data-impact-widget]').forEach((el) => hydrateWidget(el));
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

export default { init };
