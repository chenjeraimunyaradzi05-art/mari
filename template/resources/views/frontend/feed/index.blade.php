@extends('frontend.layouts.master')

@section('title', 'Athena Signal Feed')



@section('contents')
	@php
		$enabledFilters = collect($filters ?? [])->filter(static function ($filter) {
			return ! empty($filter['enabled']);
		})->values();
	@endphp

	<section
		class="signal-feed-shell"
		data-feed-shell
		data-feed-endpoint="{{ $feedEndpoint }}"
		data-feed-filter="{{ $activeFilter }}"
		data-feed-per-page="{{ $perPage }}"
	>
		<div class="signal-feed-hero">
			<p class="text-xs uppercase tracking-[0.4em] text-white/80 mb-2">Athena Network</p>
			<h1 class="text-3xl font-semibold leading-tight">Signal feed across housing, money, careers, and wellbeing.</h1>
			<p class="max-w-3xl text-white/90 text-lg">Tap into transparent pay intel, dream job drops, and community wins. Filters help you jump between discovery, following, and high-signal media posts.</p>
			<div class="signal-feed-meta">
				<span><i class="fas fa-rss"></i>Live API powered</span>
				<span><i class="fas fa-sliders-h"></i>{{ $enabledFilters->count() }} curated filters</span>
				<span><i class="fas fa-lock-open"></i>Public endpoint: /api/v1/feed</span>
			</div>
		</div>

		<div class="signal-feed-panel">
			<div class="signal-feed-controls">
				<div class="signal-feed-filters" data-feed-filters role="tablist">
					@forelse ($enabledFilters as $filter)
						@php
							$value = $filter['value'];
							$isActive = $value === $activeFilter;
						@endphp
						<button
							type="button"
							class="signal-feed-filter {{ $isActive ? 'is-active' : '' }}"
							data-feed-filter-button
							data-filter="{{ $value }}"
							role="tab"
							aria-selected="{{ $isActive ? 'true' : 'false' }}"
						>
							<i class="fas fa-hashtag" aria-hidden="true"></i>
							<span>{{ $filter['label'] }}</span>
						</button>
					@empty
						<p class="text-sm text-slate-500">No filters are enabled right now.</p>
					@endforelse
				</div>

				<div class="signal-feed-status" data-feed-status hidden>
					<i class="fas fa-spinner fa-spin"></i>
					<span>Loading activity…</span>
				</div>
			</div>

			<ul class="signal-feed-list" data-feed-list aria-live="polite"></ul>

			<div class="signal-feed-empty" data-feed-empty hidden>
				<p class="mb-2 font-semibold">No stories for this filter yet.</p>
				<p class="mb-0">Try switching filters or post something new from the social feed.</p>
			</div>

			<button type="button" class="signal-feed-load-more" data-feed-load-more hidden>
				<i class="fas fa-chevron-down"></i>
				Keep scrolling
			</button>
		</div>
	</section>
@endsection

@push('scripts')
	<script>
		(function () {
			const shell = document.querySelector('[data-feed-shell]');
			if (!shell) {
				return;
			}

			const endpoint = shell.dataset.feedEndpoint;
			if (!endpoint) {
				return;
			}

			const perPage = Number(shell.dataset.feedPerPage || 10);
			let currentFilter = shell.dataset.feedFilter || 'latest';
			let nextPage = 1;
			let isLoading = false;
			let hasMore = true;

			const list = shell.querySelector('[data-feed-list]');
			const status = shell.querySelector('[data-feed-status]');
			const emptyState = shell.querySelector('[data-feed-empty]');
			const loadMoreButton = shell.querySelector('[data-feed-load-more]');
			const filterButtons = shell.querySelectorAll('[data-feed-filter-button]');
			const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

			const escapeHtml = (value = '') => {
				return String(value)
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#039;');
			};

			const formatRelative = (isoString) => {
				if (!isoString) {
					return '';
				}

				const date = new Date(isoString);
				if (Number.isNaN(date.getTime())) {
					return '';
				}

				const now = new Date();
				const diffMs = date - now;
				const divisions = [
					{ amount: 60, unit: 'seconds' },
					{ amount: 60, unit: 'minutes' },
					{ amount: 24, unit: 'hours' },
					{ amount: 7, unit: 'days' },
					{ amount: 4.34524, unit: 'weeks' },
					{ amount: 12, unit: 'months' },
					{ amount: Number.POSITIVE_INFINITY, unit: 'years' },
				];

				let duration = diffMs / 1000;
				for (const division of divisions) {
					if (Math.abs(duration) < division.amount) {
						const value = Math.round(duration);
						const unit = division.unit.replace(/s$/, '');
						return relativeFormatter.format(value, unit);
					}
					duration /= division.amount;
				}
				return '';
			};

			const initialsFor = (name) => {
				if (!name) {
					return 'A';
				}
				const matches = name.trim().split(/\s+/).slice(0, 2);
				return matches.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'A';
			};

			const renderCard = (item) => {
				const content = item.content ? escapeHtml(item.content) : 'No caption provided yet.';
				const authorName = item.author?.name ? escapeHtml(item.author.name) : 'Anonymous member';
				const visibility = item.visibility ? escapeHtml(item.visibility) : 'public';
				const type = item.type ? escapeHtml(item.type) : 'post';
				const relative = formatRelative(item.published_at);
				const avatarLabel = initialsFor(item.author?.name);
				const mediaBlock = item.media?.url
					? `<div class="signal-feed-card__media"><img src="${encodeURI(item.media.url)}" alt="Media for post ${item.id}"></div>`
					: '';

				return `
					<li class="signal-feed-card">
						<div class="signal-feed-card__header">
							<div class="signal-feed-card__author">
								<span class="signal-feed-avatar" aria-hidden="true">${avatarLabel}</span>
								<div>
									<strong>${authorName}</strong>
									${relative ? `<div class="text-sm text-slate-500">${relative}</div>` : ''}
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span class="signal-feed-pill">${type}</span>
								<span class="signal-feed-pill">${visibility}</span>
							</div>
						</div>
						<p class="signal-feed-card__content">${content}</p>
						${mediaBlock}
					</li>
				`;
			};

			const setStatus = (message = '', isError = false) => {
				if (!status) {
					return;
				}
				if (!message) {
					status.hidden = true;
					status.dataset.error = '';
					return;
				}
				status.hidden = false;
				status.dataset.error = isError ? 'true' : '';
				status.querySelector('span').textContent = message;
				status.classList.toggle('text-rose-600', isError);
			};

			const toggleLoadMore = () => {
				if (!loadMoreButton) {
					return;
				}
				loadMoreButton.hidden = !hasMore;
				loadMoreButton.disabled = !hasMore;
			};

			const fetchPage = async ({ reset = false } = {}) => {
				if (isLoading || !hasMore) {
					return;
				}
				isLoading = true;
				setStatus('Loading activity…');
				if (loadMoreButton) {
					loadMoreButton.disabled = true;
				}

				try {
					const url = new URL(endpoint, window.location.origin);
					url.searchParams.set('page', nextPage);
					url.searchParams.set('per_page', perPage);
					url.searchParams.set('filter', currentFilter);

					const response = await fetch(url.toString(), {
						headers: { 'Accept': 'application/json' },
						credentials: 'same-origin',
					});

					if (!response.ok) {
						throw new Error('Unable to load feed right now.');
					}

					const payload = await response.json();
					const items = payload?.data ?? [];
					const meta = payload?.meta ?? {};

					if (reset && list) {
						list.innerHTML = '';
					}

					if (!items.length && nextPage === 1 && emptyState) {
						emptyState.hidden = false;
					} else if (emptyState) {
						emptyState.hidden = true;
					}

					if (list && items.length) {
						const html = items.map(renderCard).join('');
						list.insertAdjacentHTML('beforeend', html);
					}

					hasMore = Boolean(meta.has_more);
					nextPage = (meta.page ?? nextPage) + 1;
					toggleLoadMore();
					setStatus(hasMore ? '' : 'All caught up.');
				} catch (error) {
					console.error(error);
					hasMore = false;
					toggleLoadMore();
					setStatus('We could not refresh the feed. Try again soon.', true);
					if (emptyState && nextPage === 1) {
						emptyState.hidden = false;
					}
				} finally {
					isLoading = false;
					if (loadMoreButton && hasMore) {
						loadMoreButton.disabled = false;
					}
				}
			};

			filterButtons.forEach((button) => {
				button.addEventListener('click', () => {
					const { filter } = button.dataset;
					if (!filter || filter === currentFilter) {
						return;
					}

					filterButtons.forEach((candidate) => {
						candidate.classList.toggle('is-active', candidate === button);
						candidate.setAttribute('aria-selected', candidate === button ? 'true' : 'false');
					});

					currentFilter = filter;
					nextPage = 1;
					hasMore = true;
					if (emptyState) {
						emptyState.hidden = true;
					}
					fetchPage({ reset: true });
				});
			});

			loadMoreButton?.addEventListener('click', () => {
				fetchPage();
			});

			fetchPage();
		})();
	</script>
@endpush

