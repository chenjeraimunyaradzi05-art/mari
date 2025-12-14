(function () {
	class NotificationPreferencePanel {
		constructor({ csrfToken, ensureOnline, showToast }) {
			this.csrfToken = csrfToken;
			this.ensureOnline = ensureOnline;
			this.showToast = showToast;
			this.panel = document.querySelector('[data-notification-panel]');
			if (!this.panel) {
				this.available = false;
				return;
			}

			this.available = true;
			this.fetchUrl = this.panel.dataset.notificationFetch || null;
			this.updateUrl = this.panel.dataset.notificationUpdate || null;
			this.defaultSettings = this.safeParse(this.panel.dataset.notificationDefaults) || {};
			this.body = this.panel.querySelector('[data-notification-body]');
			this.loadingNode = this.panel.querySelector('[data-notification-loading]');
			this.errorNode = this.panel.querySelector('[data-notification-error]');
			this.emptyNode = this.panel.querySelector('[data-notification-empty]');
			this.statusNode = this.panel.querySelector('[data-notification-status]');
			this.saveButton = this.panel.querySelector('[data-notification-save]');
			this.saveLabel = this.panel.querySelector('[data-notification-save-label]');
			this.saveSpinner = this.panel.querySelector('[data-notification-save-spinner]');
			this.resetButton = this.panel.querySelector('[data-notification-reset]');
			this.rowsContainer = document.createElement('div');
			this.rowsContainer.className = 'notification-panel__rows';
			this.rowsContainer.hidden = true;
			if (this.body) {
				this.body.appendChild(this.rowsContainer);
			}

			this.state = {
				categories: {},
				channels: [],
				saved: {},
				draft: {},
				baseline: '{}',
			};

			this.loading = false;
			this.saving = false;
			this.isDirty = false;

			this.registerEvents();
			this.loadPreferences();
		}

		safeParse(raw) {
			if (!raw) {
				return null;
			}

			try {
				return JSON.parse(raw);
			} catch (error) {
				console.warn('Unable to parse notification defaults', error);
				return null;
			}
		}

		registerEvents() {
			if (!this.panel) {
				return;
			}

			this.panel.addEventListener('click', (event) => {
				const toggle = event.target.closest('[data-notification-toggle]');
				if (toggle) {
					event.preventDefault();
					this.handleToggle(toggle);
					return;
				}

				const refresh = event.target.closest('[data-notification-refresh]');
				if (refresh) {
					event.preventDefault();
					this.loadPreferences({ force: true, announce: true });
					return;
				}

				const save = event.target.closest('[data-notification-save]');
				if (save) {
					event.preventDefault();
					this.persistPreferences();
					return;
				}

				const reset = event.target.closest('[data-notification-reset]');
				if (reset) {
					event.preventDefault();
					this.restoreDefaults();
				}
			});
		}

		setLoading(isLoading) {
			this.loading = isLoading;
			if (this.loadingNode) {
				if (isLoading) {
					this.loadingNode.removeAttribute('hidden');
				} else {
					this.loadingNode.setAttribute('hidden', 'hidden');
				}
			}

			if (isLoading && this.rowsContainer) {
				this.rowsContainer.hidden = true;
			}
		}

		setError(message = null) {
			if (!this.errorNode) {
				return;
			}

			if (!message) {
				this.errorNode.setAttribute('hidden', 'hidden');
				this.errorNode.textContent = '';
				return;
			}

			this.errorNode.removeAttribute('hidden');
			this.errorNode.textContent = message;
		}

		setStatus(message = '') {
			if (!this.statusNode) {
				return;
			}

			this.statusNode.textContent = message;
		}

		setEmptyState(isEmpty) {
			if (!this.emptyNode) {
				return;
			}

			if (isEmpty) {
				this.emptyNode.removeAttribute('hidden');
			} else {
				this.emptyNode.setAttribute('hidden', 'hidden');
			}
		}

		normalizeSettings(settings = {}, categories = {}, channels = []) {
			const normalized = {};
			Object.keys(categories).forEach((category) => {
				normalized[category] = {};
				channels.forEach((channel) => {
					const raw = settings?.[category]?.[channel];
					normalized[category][channel] = raw === undefined ? false : Boolean(raw);
				});
			});
			return normalized;
		}

		cloneSettings(settings = {}) {
			return JSON.parse(JSON.stringify(settings || {}));
		}

		async loadPreferences({ force = false, announce = false } = {}) {
			if (!this.fetchUrl || this.loading) {
				return;
			}

			if (!force && this.loadedOnce) {
				return;
			}

			if (typeof this.ensureOnline === 'function' && !this.ensureOnline('refresh notification preferences')) {
				return;
			}

			this.setError(null);
			this.setStatus('Syncing preferences…');
			this.setLoading(true);
			try {
				const response = await fetch(this.fetchUrl, {
					headers: { 'Accept': 'application/json' },
					credentials: 'same-origin',
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw payload;
				}

				const data = payload?.data ?? {};
				const categories = data.categories ?? {};
				const channels = Array.isArray(data.channels) ? data.channels : [];
				const settings = data.settings ?? {};
				this.state.categories = categories;
				this.state.channels = channels;
				const normalized = this.normalizeSettings(settings, categories, channels);
				this.state.saved = this.cloneSettings(normalized);
				this.state.draft = this.cloneSettings(normalized);
				this.state.baseline = JSON.stringify(normalized);
				this.renderRows();
				this.loadedOnce = true;
				this.markDirty();
				this.setStatus(announce ? 'Preferences refreshed.' : 'Preferences synced.');
			} catch (error) {
				console.error('Unable to load notification preferences', error);
				const message = error?.message || 'Unable to load notification preferences.';
				this.setError(message);
				this.setStatus('');
			} finally {
				this.setLoading(false);
			}
		}

		renderRows() {
			if (!this.rowsContainer) {
				return;
			}

			const categories = Object.keys(this.state.categories || {});
			const channels = this.state.channels || [];
			this.rowsContainer.innerHTML = '';

			if (!categories.length || !channels.length) {
				this.rowsContainer.hidden = true;
				this.setEmptyState(true);
				return;
			}

			this.setEmptyState(false);
			categories.forEach((categoryKey) => {
				const label = this.state.categories[categoryKey] || this.formatCategoryLabel(categoryKey);
				const row = document.createElement('div');
				row.className = 'notification-panel__row';
				row.dataset.notificationRow = categoryKey;

				const details = document.createElement('div');
				details.className = 'notification-panel__row-details';
				const heading = document.createElement('p');
				heading.className = 'notification-panel__row-label';
				heading.textContent = label;
				const hint = document.createElement('p');
				hint.className = 'notification-panel__row-hint';
				hint.textContent = this.buildHint(categoryKey, label);
				details.appendChild(heading);
				details.appendChild(hint);

				const channelWrapper = document.createElement('div');
				channelWrapper.className = 'notification-panel__channels';
				channels.forEach((channelKey) => {
					channelWrapper.appendChild(this.buildChannelButton(categoryKey, channelKey));
				});

				row.appendChild(details);
				row.appendChild(channelWrapper);
				this.rowsContainer.appendChild(row);
			});

			this.rowsContainer.hidden = false;
		}

		buildChannelButton(categoryKey, channelKey) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'notification-channel';
			button.dataset.notificationToggle = 'true';
			button.dataset.notificationCategory = categoryKey;
			button.dataset.notificationChannel = channelKey;

			const active = Boolean(this.state.draft?.[categoryKey]?.[channelKey]);
			if (active) {
				button.classList.add('is-active');
			}
			button.setAttribute('aria-pressed', active ? 'true' : 'false');

			const labelSpan = document.createElement('span');
			labelSpan.textContent = this.formatChannelLabel(channelKey);
			const stateSpan = document.createElement('span');
			stateSpan.className = 'notification-channel__state';
			stateSpan.dataset.channelState = 'true';
			stateSpan.textContent = active ? 'On' : 'Off';

			button.appendChild(labelSpan);
			button.appendChild(stateSpan);
			return button;
		}

		formatCategoryLabel(key) {
			return key.replace(/_/g, ' ').replace(/(^|\s)\w/g, (match) => match.toUpperCase());
		}

		formatChannelLabel(key) {
			if (key === 'in_app') {
				return 'In-app';
			}

			if (key === 'email') {
				return 'Email';
			}

			return key.replace(/_/g, ' ').replace(/(^|\s)\w/g, (match) => match.toUpperCase());
		}

		buildHint(key, label) {
			const hintMap = {
				posts: 'Alerts when your stories are boosted or reposted.',
				comments: 'Replies, mentions, and thoughtful threads.',
				reactions: 'Likes, hearts, and other quick reactions.',
				follows: 'New followers or follow requests.',
				messages: 'Direct message nudges.',
				invites: 'Group invites and collaboration requests.',
			};
			return hintMap[key] || `Updates related to ${label?.toLowerCase() ?? 'this activity'}.`;
		}

		handleToggle(button) {
			if (!button || this.saving) {
				return;
			}

			const category = button.dataset.notificationCategory;
			const channel = button.dataset.notificationChannel;
			if (!category || !channel) {
				return;
			}

			const current = Boolean(this.state.draft?.[category]?.[channel]);
			if (!this.state.draft[category]) {
				this.state.draft[category] = {};
			}

			this.state.draft[category][channel] = !current;
			button.classList.toggle('is-active', !current);
			button.setAttribute('aria-pressed', !current ? 'true' : 'false');
			const stateSpan = button.querySelector('[data-channel-state]');
			if (stateSpan) {
				stateSpan.textContent = !current ? 'On' : 'Off';
			}

			this.markDirty();
		}

		restoreDefaults() {
			if (!Object.keys(this.state.categories || {}).length) {
				this.setStatus('Still loading preferences. Please try again.');
				return;
			}

			if (!Object.keys(this.defaultSettings || {}).length) {
				this.setStatus('Defaults unavailable for this environment.');
				return;
			}

			const normalized = this.normalizeSettings(this.defaultSettings, this.state.categories, this.state.channels);
			this.state.draft = this.cloneSettings(normalized);
			this.renderRows();
			this.markDirty();
			this.setStatus('Defaults restored — save to apply.');
		}

		markDirty() {
			const signature = JSON.stringify(this.state.draft || {});
			this.isDirty = signature !== this.state.baseline;
			if (this.resetButton) {
				this.resetButton.hidden = !this.isDirty;
			}

			if (this.saveButton) {
				this.saveButton.disabled = !this.isDirty || this.saving;
			}
		}

		toggleSaving(isSaving) {
			this.saving = isSaving;
			if (this.saveButton) {
				this.saveButton.disabled = isSaving || !this.isDirty;
			}

			if (this.saveLabel) {
				this.saveLabel.textContent = isSaving ? 'Saving…' : 'Save preferences';
			}

			if (this.saveSpinner) {
				if (isSaving) {
					this.saveSpinner.removeAttribute('hidden');
				} else {
					this.saveSpinner.setAttribute('hidden', 'hidden');
				}
			}
		}

		async persistPreferences() {
			if (!this.updateUrl || !this.isDirty || this.saving) {
				return;
			}

			if (typeof this.ensureOnline === 'function' && !this.ensureOnline('update notification preferences')) {
				return;
			}

			this.setError(null);
			this.setStatus('Saving your preferences…');
			this.toggleSaving(true);
			try {
				const response = await fetch(this.updateUrl, {
					method: 'PUT',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'X-CSRF-TOKEN': this.csrfToken,
					},
					credentials: 'same-origin',
					body: JSON.stringify({ settings: this.state.draft }),
				});

				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw payload;
				}

				const nextSettings = payload?.data?.settings ?? this.state.draft;
				const normalized = this.normalizeSettings(nextSettings, this.state.categories, this.state.channels);
				this.state.saved = this.cloneSettings(normalized);
				this.state.draft = this.cloneSettings(normalized);
				this.state.baseline = JSON.stringify(normalized);
				this.markDirty();
				this.setStatus('Preferences saved.');
				if (typeof this.showToast === 'function') {
					this.showToast({ message: 'Notification preferences updated.', type: 'success' });
				}
			} catch (error) {
				console.error('Unable to save notification preferences', error);
				const message = error?.message
					|| (error?.errors ? Object.values(error.errors)[0]?.[0] : null)
					|| 'Unable to save notification preferences.';
				this.setError(message);
				this.setStatus('');
			} finally {
				this.toggleSaving(false);
			}
		}
	}

	class MessageRequestCenter {
		constructor({ csrfToken, ensureOnline, showToast }) {
			this.panel = document.querySelector('[data-request-center]');
			if (!this.panel) {
				this.available = false;
				return;
			}

			this.available = true;
			this.csrfToken = csrfToken;
			this.ensureOnline = ensureOnline;
			this.showToast = showToast;
			this.fetchUrl = this.panel.dataset.requestCenterFetch || null;
			this.approveTemplate = this.panel.dataset.requestCenterApprove || null;
			this.declineTemplate = this.panel.dataset.requestCenterDecline || null;
			this.status = this.panel.dataset.requestCenterStatus || 'pending';
			this.perPage = parseInt(this.panel.dataset.requestCenterPerPage || '10', 10);
			this.defaultAvatar = document.querySelector('meta[name="social-default-avatar"]')?.content
				|| 'https://via.placeholder.com/48';
			this.previewPlaceholder = 'Message hidden for privacy.';

			this.listNode = this.panel.querySelector('[data-request-center-list]');
			this.loadingNode = this.panel.querySelector('[data-request-center-loading]');
			this.errorNode = this.panel.querySelector('[data-request-center-error]');
			this.emptyNode = this.panel.querySelector('[data-request-center-empty]');
			this.refreshButton = this.panel.querySelector('[data-request-center-refresh]');
			this.loadMoreButton = this.panel.querySelector('[data-request-center-load-more]');
			this.loadMoreLabel = this.panel.querySelector('[data-request-center-load-more-label]');
			this.loadMoreSpinner = this.panel.querySelector('[data-request-center-load-more-spinner]');
			this.countTargets = document.querySelectorAll('[data-request-center-count]');
			this.filters = this.panel.querySelectorAll('[data-request-filter]');

			this.state = {
				records: [],
				meta: null,
				nextPage: null,
				status: this.status,
			};

			this.registerEvents();
			this.fetchRequests();
		}

		registerEvents() {
			if (this.refreshButton) {
				this.refreshButton.addEventListener('click', (event) => {
					event.preventDefault();
					this.fetchRequests({ append: false, announce: true });
				});
			}

			if (this.loadMoreButton) {
				this.loadMoreButton.addEventListener('click', (event) => {
					event.preventDefault();
					this.fetchRequests({ append: true });
				});
			}

			this.panel.addEventListener('click', (event) => {
				const filterButton = event.target.closest('[data-request-filter]');
				if (filterButton) {
					event.preventDefault();
					this.handleFilter(filterButton);
					return;
				}

				const actionButton = event.target.closest('[data-request-action]');
				if (actionButton) {
					event.preventDefault();
					const action = actionButton.dataset.requestAction;
					const requestId = actionButton.dataset.requestId;
					if (action && requestId) {
						this.handleAction(action, requestId, actionButton);
					}
				}
			});
		}

		handleFilter(button) {
			const nextStatus = button.dataset.requestFilter || 'pending';
			if (nextStatus === this.status) {
				return;
			}

			this.status = nextStatus;
			this.state.status = nextStatus;
			this.state.nextPage = null;
			this.filters.forEach((filterButton) => {
				const isActive = filterButton === button;
				filterButton.classList.toggle('active', isActive);
				filterButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
			});
			this.fetchRequests({ append: false });
		}

		async fetchRequests({ append = false, announce = false } = {}) {
			if (!this.fetchUrl) {
				return;
			}

			const nextPage = append ? this.state.nextPage : 1;
			if (append && !nextPage) {
				return;
			}

			if (typeof this.ensureOnline === 'function' && !this.ensureOnline('sync your request center')) {
				return;
			}

			if (!append) {
				this.state.records = [];
				this.renderRecords();
			}

			this.setError(null);
			this.toggleLoading(true, { append });
			try {
				const url = new URL(this.fetchUrl, window.location.origin);
				if (this.status) {
					url.searchParams.set('status', this.status);
				}
				if (nextPage) {
					url.searchParams.set('page', nextPage);
				}
				url.searchParams.set('per_page', this.perPage);

				const response = await fetch(url.toString(), {
					headers: { 'Accept': 'application/json' },
					credentials: 'same-origin',
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw payload;
				}

				const data = Array.isArray(payload?.data) ? payload.data : [];
				this.state.records = append ? this.state.records.concat(data) : data;
				this.state.meta = payload?.meta || null;
				const currentPage = this.state.meta?.current_page || nextPage || 1;
				const lastPage = this.state.meta?.last_page || currentPage;
				this.state.nextPage = currentPage < lastPage ? currentPage + 1 : null;

				this.renderRecords();
				this.updateCounts();
				this.setEmptyState(this.state.records.length === 0);
				if (announce && typeof this.showToast === 'function') {
					this.showToast({ message: 'Request center refreshed.', type: 'success' });
				}
			} catch (error) {
				console.error('Unable to load message requests', error);
				const message = error?.message
					|| (error?.errors ? Object.values(error.errors)[0]?.[0] : null)
					|| 'Unable to load message requests.';
				this.setError(message);
			} finally {
				this.toggleLoading(false, { append });
				this.refreshLoadMoreVisibility();
			}
		}

		renderRecords() {
			if (!this.listNode) {
				return;
			}

			if (!this.state.records.length) {
				this.listNode.innerHTML = '';
				return;
			}

			const html = this.state.records.map((request) => this.buildCardMarkup(request)).join('');
			this.listNode.innerHTML = html;
		}

		buildCardMarkup(request = {}) {
			const requester = request.requester || {};
			const subject = request.subject || 'Message request';
			const status = (request.status || 'pending').toLowerCase();
			const createdAt = request.created_at;
			const preview = this.getPreview(request);
			const contextSummary = this.buildContextSummary(request.context);
			const avatar = requester.avatar_url || this.defaultAvatar;
			const displayName = requester.display_name || requester.username || 'New contact';
			const username = requester.username ? `@${requester.username}` : '';
			const relativeTime = this.formatRelativeTime(createdAt);
			const statusLabel = this.formatStatusLabel(status);
			const badgeClass = this.statusBadgeClass(status);
			const requestId = request.id;
			const actions = status === 'pending'
				? `
					<div class="mt-4 grid gap-2 sm:grid-cols-2">
						<button type="button" class="btn btn-sm btn-gradient" data-request-action="approve" data-request-id="${requestId}">
							<i class="fas fa-check mr-1"></i>Approve
						</button>
						<button type="button" class="btn btn-sm btn-outline-danger" data-request-action="decline" data-request-id="${requestId}">
							<i class="fas fa-times mr-1"></i>Decline
						</button>
					</div>
				`
				: `<p class="mt-4 text-sm text-gray-500">Request ${statusLabel.toLowerCase()}.</p>`;

			return `
				<div class="bg-white rounded-lg shadow-md p-4 border border-gray-100" data-request-card="${requestId}">
					<div class="flex items-start gap-3">
						<img src="${this.escapeHtml(avatar)}" alt="${this.escapeHtml(displayName)}" class="w-12 h-12 rounded-full object-cover flex-shrink-0">
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between flex-wrap gap-2">
								<div>
									<p class="font-semibold text-gray-900">${this.escapeHtml(displayName)}</p>
									${username ? `<p class="text-xs text-gray-500">${this.escapeHtml(username)}</p>` : ''}
								</div>
								<div class="text-right">
									<span class="badge ${badgeClass}">${this.escapeHtml(statusLabel)}</span>
									<p class="text-xs text-gray-500 mt-1">${this.escapeHtml(relativeTime)}</p>
								</div>
							</div>
							<p class="mt-3 text-sm font-medium text-gray-900">${this.escapeHtml(subject)}</p>
							${preview ? `<p class="mt-2 text-sm text-gray-600">${this.escapeHtml(preview)}</p>` : ''}
							${contextSummary ? `<p class="mt-2 text-xs text-gray-500"><i class="fas fa-info-circle text-indigo-500 mr-1"></i>${this.escapeHtml(contextSummary)}</p>` : ''}
						</div>
					</div>
					${actions}
				</div>
			`;
		}

		getPreview(request) {
			const latest = request.thread?.latest_message;
			if (latest && typeof latest === 'object') {
				if (latest.is_redacted) {
					return this.previewPlaceholder;
				}

				const body = latest.body || latest.content || latest?.metadata?.preview;
				if (body) {
					return this.truncate(String(body).replace(/<[^>]+>/g, ''), 160);
				}
			}

			const fallback = request.context?.preview;
			return fallback ? this.truncate(String(fallback).replace(/<[^>]+>/g, ''), 160) : '';
		}

		buildContextSummary(context) {
			if (!context || typeof context !== 'object') {
				return '';
			}

			if (typeof context.summary === 'string') {
				return context.summary;
			}

			if (typeof context.reason === 'string') {
				return context.reason;
			}

			const entries = Object.entries(context);
			if (!entries.length) {
				return '';
			}

			const [key, value] = entries[0];
			return `${this.formatLabel(key)}: ${value}`;
		}

		async handleAction(action, requestId, button) {
			const template = action === 'approve' ? this.approveTemplate : this.declineTemplate;
			const url = this.buildActionUrl(template, requestId);
			if (!url) {
				return;
			}

			if (typeof this.ensureOnline === 'function' && !this.ensureOnline(`${action} this request`)) {
				return;
			}

			const originalHtml = button ? button.innerHTML : '';
			if (button) {
				button.disabled = true;
				button.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i>${action === 'approve' ? 'Approving…' : 'Declining…'}`;
			}

			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'X-CSRF-TOKEN': this.csrfToken,
					},
					credentials: 'same-origin',
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw payload;
				}

				this.removeRequest(requestId);
				if (typeof this.showToast === 'function') {
					this.showToast({
						message: action === 'approve'
							? 'Conversation unlocked. Continue in Messages.'
							: 'Request declined.',
						type: 'success',
					});
				}
			} catch (error) {
				console.error(`Unable to ${action} request`, error);
				const message = error?.message
					|| (error?.errors ? Object.values(error.errors)[0]?.[0] : null)
					|| `Unable to ${action} this request.`;
				this.setError(message);
			} finally {
				if (button) {
					button.disabled = false;
					button.innerHTML = originalHtml;
				}
			}
		}

		removeRequest(requestId) {
			const before = this.state.records.length;
			this.state.records = this.state.records.filter((request) => String(request.id) !== String(requestId));
			if (before !== this.state.records.length) {
				if (this.state.meta && typeof this.state.meta.total === 'number') {
					this.state.meta.total = Math.max(0, this.state.meta.total - 1);
				}
				this.renderRecords();
				this.updateCounts();
				this.setEmptyState(this.state.records.length === 0);
				if (this.state.records.length === 0 && this.state.nextPage) {
					this.fetchRequests({ append: true });
				}
			}
		}

		buildActionUrl(template, requestId) {
			if (!template || !requestId) {
				return null;
			}

			return template.replace('__REQUEST__', requestId).replace('__ID__', requestId);
		}

		toggleLoading(isLoading, { append = false } = {}) {
			if (this.loadingNode && !append) {
				this.loadingNode.hidden = !isLoading;
			}

			if (this.refreshButton && !append) {
				this.refreshButton.disabled = isLoading;
			}

			if (append && this.loadMoreButton) {
				this.loadMoreButton.disabled = isLoading;
				if (this.loadMoreSpinner) {
					this.loadMoreSpinner.classList.toggle('d-none', !isLoading);
				}
			}
		}

		refreshLoadMoreVisibility() {
			if (!this.loadMoreButton) {
				return;
			}

			if (this.state.nextPage) {
				this.loadMoreButton.classList.remove('d-none');
				this.loadMoreButton.disabled = false;
				if (this.loadMoreSpinner) {
					this.loadMoreSpinner.classList.add('d-none');
				}
			} else {
				this.loadMoreButton.classList.add('d-none');
			}
		}

		setError(message = null) {
			if (!this.errorNode) {
				return;
			}

			if (!message) {
				this.errorNode.classList.add('d-none');
				this.errorNode.textContent = '';
				return;
			}

			this.errorNode.classList.remove('d-none');
			this.errorNode.textContent = message;
		}

		setEmptyState(isEmpty) {
			if (!this.emptyNode) {
				return;
			}

			this.emptyNode.hidden = !isEmpty;
		}

		updateCounts() {
			const total = typeof this.state.meta?.total === 'number'
				? this.state.meta.total
				: this.state.records.length;
			this.countTargets.forEach((node) => {
				node.textContent = total;
			});
		}

		formatStatusLabel(status) {
			switch (status) {
				case 'approved':
					return 'Approved';
				case 'declined':
					return 'Declined';
				default:
					return 'Pending review';
			}
		}

		statusBadgeClass(status) {
			switch (status) {
				case 'approved':
					return 'bg-success text-white';
				case 'declined':
					return 'bg-secondary text-white';
				default:
					return 'bg-warning text-gray-900';
			}
		}

		formatRelativeTime(dateString) {
			if (!dateString) {
				return 'Just now';
			}

			const timestamp = Date.parse(dateString);
			if (Number.isNaN(timestamp)) {
				return 'Just now';
			}

			const now = Date.now();
			const diff = now - timestamp;
			const minute = 60 * 1000;
			const hour = 60 * minute;
			const day = 24 * hour;

			if (diff < minute) {
				return 'Moments ago';
			}

			if (diff < hour) {
				return `${Math.floor(diff / minute)}m ago`;
			}

			if (diff < day) {
				return `${Math.floor(diff / hour)}h ago`;
			}

			return `${Math.floor(diff / day)}d ago`;
		}

		formatLabel(key = '') {
			return key.replace(/[_-]+/g, ' ').replace(/(^|\s)\w/g, (match) => match.toUpperCase());
		}

		truncate(value = '', limit = 140) {
			if (value.length <= limit) {
				return value;
			}

			return `${value.slice(0, limit).trim()}…`;
		}

		escapeHtml(value = '') {
			return String(value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}
	}

	function createFallbackToastStack() {
		let stack = document.querySelector('[data-toast-stack]');
		if (!stack) {
			stack = document.createElement('div');
			stack.className = 'toast-stack';
			stack.dataset.toastStack = 'true';
			stack.setAttribute('role', 'status');
			stack.setAttribute('aria-live', 'polite');
			stack.setAttribute('aria-atomic', 'false');
			document.body.appendChild(stack);
		}
		return stack;
	}

	function fallbackToast({ message, type = 'info' } = {}) {
		if (!message) {
			return;
		}

		const stack = createFallbackToastStack();
		const toast = document.createElement('div');
		toast.className = `toast toast--${type}`;
		toast.textContent = message;
		stack.appendChild(toast);
		setTimeout(() => toast.remove(), 3200);
	}

	function fallbackEnsureOnline(actionLabel = 'complete this action') {
		if (navigator.onLine) {
			return true;
		}

		fallbackToast({ message: `You're offline – unable to ${actionLabel} right now.`, type: 'error' });
		return false;
	}

	function initializeNotificationModules() {
		const interactions = window.socialInteractions;
		const ensureOnline = interactions?.ensureOnline
			? interactions.ensureOnline.bind(interactions)
			: fallbackEnsureOnline;
		const showToast = interactions?.showToast
			? interactions.showToast.bind(interactions)
			: fallbackToast;

		const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
		const panel = new NotificationPreferencePanel({ csrfToken, ensureOnline, showToast });
		window.socialNotificationPanel = panel;
		const requestCenter = new MessageRequestCenter({ csrfToken, ensureOnline, showToast });
		window.socialRequestCenter = requestCenter;
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initializeNotificationModules, { once: true });
	} else {
		initializeNotificationModules();
	}
})();
