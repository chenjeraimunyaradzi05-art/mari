import Alpine from 'alpinejs';
import WomenRiseAnalytics from './analytics';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const currencyFormatterWithCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const STATUS_CLASS_MAP = {
	draft: 'bg-slate-100 text-slate-600',
	scheduled: 'bg-slate-100 text-slate-600',
	active: 'bg-emerald-100 text-emerald-700',
	paused: 'bg-amber-100 text-amber-700',
	completed: 'bg-indigo-100 text-indigo-700',
	approved: 'bg-emerald-100 text-emerald-700',
	pending: 'bg-amber-100 text-amber-700',
	rejected: 'bg-rose-100 text-rose-700',
	archived: 'bg-slate-200 text-slate-600',
	ahead: 'bg-sky-100 text-sky-700',
	behind: 'bg-rose-100 text-rose-700',
};

const OBJECTIVE_LABELS = {
	reach: 'Awareness & reach',
	traffic: 'Website traffic',
	leads: 'Lead generation',
	applications: 'Applications',
};

const BILLING_LABELS = {
	cpm: 'CPM: impressions based',
	cpc: 'CPC: click based',
	cpa: 'CPA: action based',
};

const getHttpClient = () => {
	if (window?.axios) {
		return window.axios;
	}

	console.warn('Axios instance was not found. Advertising dashboard cannot load data.');
	return null;
};

const formatCurrencyFromCents = (value, { withCents = false } = {}) => {
	if (value === null || value === undefined) {
		return withCents ? currencyFormatterWithCents.format(0) : currencyFormatter.format(0);
	}

	const dollars = Number(value) / 100;
	return withCents ? currencyFormatterWithCents.format(dollars) : currencyFormatter.format(dollars);
};

const formatNumber = (value) => {
	if (value === null || value === undefined || Number.isNaN(Number(value))) {
		return '0';
	}

	return numberFormatter.format(Number(value));
};

const formatPercent = (value) => {
	if (value === null || value === undefined || Number.isNaN(Number(value))) {
		return percentFormatter.format(0);
	}

	return percentFormatter.format(Number(value));
};

const formatDate = (value) => {
	if (!value) {
		return null;
	}

	try {
		return dateFormatter.format(new Date(value));
	} catch (error) {
		return value;
	}
};

const formatDateTime = (value) => {
	if (!value) {
		return '—';
	}

	try {
		return dateTimeFormatter.format(new Date(value));
	} catch (error) {
		return value;
	}
};

const relativeTimeFrom = (value) => {
	if (!value) {
		return 'Not updated yet';
	}

	try {
		const now = Date.now();
		const dateValue = new Date(value).getTime();
		const diffMs = dateValue - now;
		const diffMinutes = Math.round(diffMs / 60000);

		if (Math.abs(diffMinutes) < 60) {
			return relativeFormatter.format(diffMinutes, 'minute');
		}

		const diffHours = Math.round(diffMinutes / 60);
		if (Math.abs(diffHours) < 24) {
			return relativeFormatter.format(diffHours, 'hour');
		}

		const diffDays = Math.round(diffHours / 24);
		return relativeFormatter.format(diffDays, 'day');
	} catch (error) {
		return 'Recently updated';
	}
};

const statusBadge = (status) => STATUS_CLASS_MAP[status] ?? STATUS_CLASS_MAP.draft;
const statusCopy = (status) => {
	if (!status) {
		return 'Draft';
	}

	const formatted = status.replace('_', ' ');
	return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const objectiveCopy = (objective) => OBJECTIVE_LABELS[objective] ?? 'Custom objective';
const billingCopy = (billing) => BILLING_LABELS[billing] ?? 'Standard billing';

const normaliseEntries = (payload) => {
	if (!payload || typeof payload !== 'object') {
		return [];
	}

	return Object.entries(payload)
		.map(([label, value]) => {
			if (Array.isArray(value)) {
				return {
					label: label.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
					value: value.filter(Boolean).join(', ') || '—',
				};
			}

			if (value && typeof value === 'object') {
				return {
					label: label.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
					value: Object.entries(value)
						.map(([nestedLabel, nestedValue]) => `${nestedLabel}: ${nestedValue}`)
						.join(', '),
				};
			}

			return {
				label: label.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
				value: value ?? '—',
			};
		})
		.filter((entry) => Boolean(entry.value));
};

Alpine.data('orgCampaignsTable', (options = {}) => ({
	pages: options.orgPages ?? [],
	routes: options.routes ?? {},
	selectedPageId: options.defaultOrgPageId ?? null,
	campaigns: [],
	overview: null,
	filters: {
		q: '',
		status: '',
		objective: '',
	},
	loading: false,
	error: null,
	pagination: null,
	actionBusy: new Set(),

	init() {
		if (!this.selectedPageId && this.pages.length) {
			this.selectedPageId = this.pages[0].id;
		}

		if (!this.hasOrgPages()) {
			return;
		}

		this.fetchOverview();
		this.fetchCampaigns();

		this.$watch('selectedPageId', () => {
			this.fetchOverview();
			this.fetchCampaigns();
		});
	},

	hasOrgPages() {
		return Array.isArray(this.pages) && this.pages.length > 0;
	},

	async fetchOverview() {
		if (!this.selectedPageId) {
			this.overview = null;
			return;
		}

		const client = getHttpClient();
		if (!client) {
			return;
		}

		try {
			const { data } = await client.get(`/api/ads/org-pages/${this.selectedPageId}/overview`);
			this.overview = data;
		} catch (error) {
			console.error(error);
		}
	},

	async fetchCampaigns(page = 1) {
		if (!this.selectedPageId) {
			return;
		}

		const client = getHttpClient();
		if (!client) {
			return;
		}

		this.loading = true;
		this.error = null;

		try {
			const { data } = await client.get('/api/ads/campaigns', {
				params: {
					org_page_id: this.selectedPageId,
					q: this.filters.q || undefined,
					status: this.filters.status || undefined,
					objective: this.filters.objective || undefined,
					with_metrics_summary: true,
					page,
				},
			});

			this.campaigns = data.data ?? [];
			const meta = data.meta ?? {};
			this.pagination = {
				current_page: meta.current_page ?? 1,
				last_page: meta.last_page ?? 1,
				prev: meta.current_page > 1 ? meta.current_page - 1 : null,
				next: meta.current_page < (meta.last_page ?? 1) ? meta.current_page + 1 : null,
			};
		} catch (error) {
			console.error(error);
			this.error = error.response?.data?.message ?? 'Unable to load campaigns.';
		} finally {
			this.loading = false;
		}
	},

	goTo(page) {
		if (!page) {
			return;
		}

		this.fetchCampaigns(page);
	},

	statusBadge(status) {
		return statusBadge(status);
	},

	statusCopy,
	formatDate,
	formatNumber,
	formatCurrencyFromCents,
	formatPercent,

	get overviewPeriod() {
		const period = this.overview?.metrics?.period;
		if (!period?.from || !period?.to) {
			return 'Month to date';
		}

		return `${formatDate(period.from)} – ${formatDate(period.to)}`;
	},

	viewUrl(campaign) {
		const base = this.routes?.view ?? '/company/advertising/campaigns';
		return `${base}/${campaign.id}`;
	},

	async changeStatus(campaign, action) {
		if (!campaign?.id) {
			return;
		}

		const client = getHttpClient();
		if (!client) {
			return;
		}

		this.actionBusy.add(campaign.id);
		this.error = null;

		try {
			const { data } = await client.post(`/api/ads/campaigns/${campaign.id}/actions`, { action });
			const idx = this.campaigns.findIndex((row) => row.id === campaign.id);
			if (idx !== -1) {
				this.campaigns.splice(idx, 1, data);
			}
		} catch (error) {
			console.error(error);
			this.error = error.response?.data?.message ?? 'Unable to update campaign status.';
		} finally {
			this.actionBusy.delete(campaign.id);
		}
	},

	isActionBusy(id) {
		return this.actionBusy.has(id);
	},
}));

Alpine.data('orgCampaignDetail', (options = {}) => ({
	campaignId: options.campaignId,
	orgPageId: options.orgPageId,
	campaign: options.initialCampaign ?? null,
	metricsSummary: null,
	metrics: [],
	metricsDays: 30,
	metricsLoading: false,
	slotInsights: null,
	slotInsightsLoading: false,
	slotInsightsError: null,
	slotInsightsDays: 30,
	creatives: [],
	creativesLoading: false,
	statusBusy: false,
	error: null,

	init() {
		this.fetchCampaign();
		this.fetchMetrics();
		this.fetchCreatives();
		this.fetchSlotInsights();
	},

	async fetchCampaign() {
		const client = getHttpClient();
		if (!client || !this.campaignId) {
			return;
		}

		try {
			const { data } = await client.get(`/api/ads/campaigns/${this.campaignId}`);
			this.campaign = data;
		} catch (error) {
			console.error(error);
		}
	},

	async fetchMetrics(days = this.metricsDays) {
		const client = getHttpClient();
		if (!client || !this.campaignId) {
			return;
		}

		this.metricsLoading = true;

		try {
			const { data } = await client.get(`/api/ads/campaigns/${this.campaignId}/metrics`, {
				params: { days },
			});

			this.metricsSummary = data.summary ?? null;
			this.metrics = data.metrics ?? [];
			this.metricsDays = days;
		} catch (error) {
			console.error(error);
		} finally {
			this.metricsLoading = false;
		}
	},

	async fetchSlotInsights(days = this.slotInsightsDays) {
		const client = getHttpClient();
		if (!client) {
			return;
		}

		this.slotInsightsLoading = true;
		this.slotInsightsError = null;
		this.trackEvent('ads.slot_insights.range_selected', {
			campaign_id: this.campaignId,
			days,
		});

		try {
			const { data } = await client.get('/company/advertising/slot-insights', {
				params: {
					days,
					campaign_id: this.campaignId,
				},
			});
			this.slotInsights = data ?? null;
			this.slotInsightsDays = days;
			this.trackEvent('ads.slot_insights.loaded', {
				campaign_id: this.campaignId,
				days,
				slot_count: this.slotInsights?.slots?.length ?? 0,
				alert_count: this.slotInsights?.alerts?.length ?? 0,
			});
		} catch (error) {
			console.error(error);
			this.slotInsightsError = error.response?.data?.message ?? 'Unable to load slot insights.';
			this.trackEvent('ads.slot_insights.load_failed', {
				campaign_id: this.campaignId,
				days,
				error: error?.response?.status || 'client_error',
			});
		} finally {
			this.slotInsightsLoading = false;
		}
	},

	async fetchCreatives() {
		const client = getHttpClient();
		if (!client || !this.campaignId) {
			return;
		}

		this.creativesLoading = true;

		try {
			const { data } = await client.get('/api/ads/creatives', {
				params: {
					campaign_id: this.campaignId,
					per_page: 50,
				},
			});

			this.creatives = data.data ?? [];
		} catch (error) {
			console.error(error);
		} finally {
			this.creativesLoading = false;
		}
	},

	async runAction(action) {
		if (!['pause', 'resume', 'complete'].includes(action)) {
			return;
		}

		const client = getHttpClient();
		if (!client || !this.campaignId) {
			return;
		}

		this.statusBusy = true;
		this.error = null;

		try {
			const { data } = await client.post(`/api/ads/campaigns/${this.campaignId}/actions`, { action });
			this.campaign = data;
		} catch (error) {
			console.error(error);
			this.error = error.response?.data?.message ?? 'Unable to update campaign status.';
		} finally {
			this.statusBusy = false;
		}
	},

	get statusLabel() {
		return statusCopy(this.campaign?.status);
	},

	get objectiveLabel() {
		return objectiveCopy(this.campaign?.objective);
	},

	get billingModelLabel() {
		return billingCopy(this.campaign?.billing_model);
	},

	get lastUpdated() {
		if (!this.campaign?.updated_at) {
			return 'Not updated yet';
		}

		return `Updated ${relativeTimeFrom(this.campaign.updated_at)}`;
	},

	get metricsRangeLabel() {
		const range = this.metricsSummary?.date_range;
		if (range?.start && range?.end) {
			return `${formatDate(range.start)} – ${formatDate(range.end)}`;
		}

		return 'No reporting window yet';
	},

	slotInsightsPeriodLabel() {
		const period = this.slotInsights?.period;
		if (period?.from && period?.to) {
			return `${formatDate(period.from)} – ${formatDate(period.to)}`;
		}

		return `${this.slotInsightsDays}-day window`;
	},

	trendLabel(trend) {
		if (!trend || trend.delta_percent === null || trend.direction === 'flat') {
			return 'Flat';
		}

		const delta = Math.abs(trend.delta_percent ?? 0);
		const label = formatPercent(delta);

		return trend.direction === 'up' ? `Up ${label}` : `Down ${label}`;
	},

	trendClass(trend) {
		if (!trend) {
			return 'text-slate-500';
		}

		if (trend.direction === 'up') {
			return 'text-emerald-600';
		}

		if (trend.direction === 'down') {
			return 'text-rose-600';
		}

		return 'text-slate-500';
	},

	alertBadgeClass(severity) {
		switch (severity) {
			case 'critical':
				return 'bg-rose-100 text-rose-700';
			case 'warning':
				return 'bg-amber-100 text-amber-700';
			case 'info':
				return 'bg-sky-100 text-sky-700';
			default:
				return 'bg-slate-100 text-slate-600';
		}
	},

	slotShareWidth(slot) {
		if (!slot || typeof slot.share !== 'number') {
			return 0;
		}

		return Math.min(100, Math.max(0, Math.round(slot.share * 100)));
	},

	trackEvent(eventName, properties = {}) {
		if (!eventName) {
			return;
		}

		const trackers = [WomenRiseAnalytics, window?.womenriseAnalytics].filter(Boolean);
		trackers.forEach((tracker, index) => {
			if (tracker && typeof tracker.track === 'function') {
				try {
					tracker.track(eventName, properties);
				} catch (error) {
					if (index === trackers.length - 1 && window?.console?.debug) {
						window.console.debug('[analytics] track failed', eventName, error);
					}
				}
			}
		});
	},
	get pacingProgress() {
		const progress = this.campaign?.pacing?.progress ?? 0;
		return Math.min(100, Math.max(0, Math.round(progress * 100)));
	},

	get healthStatusKey() {
		if (!this.campaign) {
			return 'draft';
		}

		if (this.campaign.status && this.campaign.status !== 'active') {
			return this.campaign.status;
		}

		const progress = this.campaign?.pacing?.progress ?? 0;
		if (progress >= 1.05) {
			return 'ahead';
		}

		if (progress <= 0.75) {
			return 'behind';
		}

		return 'active';
	},

	get healthStatusLabel() {
		const map = {
			ahead: 'Ahead of spend plan',
			behind: 'Needs attention',
			active: 'On track',
			paused: 'Paused',
			completed: 'Completed',
			draft: 'Draft',
		};

		return map[this.healthStatusKey] ?? 'On track';
	},

	get scheduleRange() {
		const start = formatDate(this.campaign?.start_on);
		const end = formatDate(this.campaign?.end_on);

		if (start && end) {
			return `${start} → ${end}`;
		}

		if (start) {
			return `${start} → Open`;
		}

		return 'Flexible schedule';
	},

	get targetingEntries() {
		return normaliseEntries(this.campaign?.targeting);
	},

	get optimisationEntries() {
		return normaliseEntries(this.campaign?.optimisation);
	},

	statusBadge(status) {
		return statusBadge(status);
	},

	statusCopy,
	formatDate,
	formatDateTime,
	formatNumber,
	formatCurrencyFromCents,
	formatPercent,
}));
