@extends('frontend.social.layout')



@section('social-content')
	@php
		$composerPrivacyOptions = collect($privacyOptions ?? []);
		$composerActivePrivacy = $activePrivacyOption ?? $composerPrivacyOptions->first();
	@endphp
	<div class="pulse-layout">
		<section class="pulse-hero">
			<div class="pulse-hero__grid">
				<div class="pulse-hero__copy">
					<div class="pulse-hero__badge">Pulse</div>
					<h1 class="pulse-hero__headline">Stories from your network</h1>
					<p class="pulse-hero__subtitle">See the latest updates tailored to your skills and interests. Engage, share and discover short stories from members you follow.</p>

					<div class="pulse-hero__actions">
						<a href="#composer" class="pulse-hero__cta pulse-hero__cta--outline">Create a post</a>
						<a href="#" class="pulse-hero__cta pulse-hero__cta--ghost">Explore topics</a>
					</div>

					<div class="pulse-hero__meta">
						<span><i class="fas fa-user-friends"></i> Followed community</span>
						<span><i class="fas fa-bolt"></i> Curated for you</span>
					</div>
				</div>

				<div class="pulse-hero__visual">
					<div class="pulse-hero__card">
						<div class="pulse-hero__eyebrow">Your profile</div>
						<div class="pulse-hero__card-title">Ready to contribute?</div>
						<p class="pulse-hero__card-copy">Share a short update, an insight or a question. Your network learns when you participate.</p>
					</div>

					<div class="pulse-hero__stats">
						<div class="pulse-hero__stat">
							<div class="pulse-hero__stat-label">Active now</div>
							<div class="pulse-hero__stat-value">{{ number_format(auth()->user()->socialProfile?->posts_count ?? 0) }}</div>
						</div>
						<div class="pulse-hero__stat">
							<div class="pulse-hero__stat-label">Connections</div>
							<div class="pulse-hero__stat-value">{{ number_format(auth()->user()->connections_count ?? 0) }}</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<div class="pulse-grid">
			<main class="pulse-main">
				<div class="neo-card composer-card" id="composer">
					<div class="composer-card__primary">
						<img src="{{ $profileAvatar }}" alt="You" class="composer-card__avatar">
						<div class="composer-card__intro">
							<h3>{{ auth()->user()->name }}</h3>
							<p>Share an update with your network</p>
						</div>

						<div class="composer-card__actions">
							@if($canPost)
								<a href="#composer-form" class="composer-primary pulse-hero__cta">Write a post</a>
							@else
								<button class="composer-secondary pulse-hero__cta" disabled>Upgrade to post</button>
							@endif
						</div>
					</div>

					<form id="composer-form" action="{{ route('social.posts.store') }}" method="POST" enctype="multipart/form-data">
						@csrf
						<div class="composer-card__chips composer-card__body" data-composer-root>
							<textarea name="content" rows="4" placeholder="What's happening?" class="w-full p-3 rounded-md border" maxlength="5000" data-composer-input></textarea>
							<div class="composer-uploader mt-4" data-uploader>
								<div class="composer-dropzone" data-dropzone>
									<input type="file" name="media[]" id="composer-media-input" class="sr-only" accept="image/*,video/*" multiple data-media-input>
									<div class="composer-dropzone__copy">
										<p class="composer-dropzone__title">Add media</p>
										<p class="composer-dropzone__hint">Drag &amp; drop or click upload. Up to {{ $uploadLimits['max_media'] ?? 5 }} items, {{ $uploadLimits['max_file_mb'] ?? 12 }}MB each.</p>
									</div>
									<div class="composer-dropzone__actions">
										<button type="button" class="composer-secondary" data-upload-trigger>Upload</button>
									</div>
								</div>
								<p class="composer-uploader__status text-sm text-slate-500" data-uploader-hint>Uploads scan for trust &amp; safety before posting.</p>
								<ul class="composer-attachment-list" data-attachment-list></ul>
								<div data-session-inputs class="hidden"></div>
								<div data-import-inputs class="hidden"></div>
							</div>
							<div class="composer-tools mt-4" data-composer-tools>
								<p class="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Quick capture</p>
								<div class="flex flex-wrap gap-2">
									<button type="button" class="composer-chip" data-capture-trigger="video">
										<i class="fas fa-video me-1"></i>Record camera
									</button>
									<button type="button" class="composer-chip" data-capture-trigger="audio">
										<i class="fas fa-microphone me-1"></i>Record audio
									</button>
									<button type="button" class="composer-chip" data-link-import-trigger>
										<i class="fas fa-link me-1"></i>Import social link
									</button>
									<button type="button" class="composer-chip" data-integrations-trigger>
										<i class="fas fa-plug me-1"></i>Manage integrations
									</button>
								</div>
								<p class="text-xs text-slate-500 mt-2" data-capture-hint>{{ $captureConfig['consent_copy'] ?? 'Recording is encrypted and opt-in.' }}</p>
							</div>
							<div class="composer-link-import mt-4" data-link-importer>
								<div class="composer-link-import__panel" data-link-import-panel hidden>
									<label class="text-sm font-semibold mb-1 d-block" for="composer-link-input">Paste up to {{ $integrationConfig['max_links'] ?? 5 }} links</label>
									<textarea id="composer-link-input" rows="3" class="w-full rounded-md border p-2 text-sm" placeholder="https://youtu.be/…" data-link-import-input></textarea>
									<div class="flex items-center gap-2 mt-2">
										<button type="button" class="composer-primary" data-link-import-submit>Import</button>
										<button type="button" class="composer-secondary" data-link-import-cancel>Cancel</button>
									</div>
									<p class="text-xs text-rose-600 mt-2 hidden" data-link-import-status></p>
								</div>
								<ul class="composer-link-import__list mt-3" data-link-import-list></ul>
							</div>
							<div class="composer-card__footer">
								<div>
									<small class="text-slate-500" data-char-count>0 / 5000</small>
									<p class="text-xs text-rose-600 mt-1 hidden" data-composer-status></p>
								</div>
								<div class="composer-card__controls">
									<div class="composer-privacy" data-privacy>
										<button type="button" class="composer-privacy__trigger" data-privacy-trigger>
											<span class="composer-privacy__eyebrow">Audience</span>
											<span class="composer-privacy__value" data-privacy-value>{{ $composerActivePrivacy['label'] ?? 'Network-only' }}</span>
											<i class="fas fa-chevron-down"></i>
										</button>
										<p class="composer-privacy__description" data-privacy-description>{{ $composerActivePrivacy['description'] ?? 'Connections can view this update.' }}</p>
										<div class="composer-privacy__menu" data-privacy-menu hidden>
											@foreach($privacyOptions ?? [] as $option)
												<button type="button" class="composer-privacy__option @if(($option['key'] ?? null) === ($composerActivePrivacy['key'] ?? null)) is-selected @endif" data-privacy-option="{{ $option['key'] }}" data-privacy-visibility="{{ $option['visibility'] }}">
													<div>
														<p class="composer-privacy__option-label">{{ $option['label'] }}</p>
														<p class="composer-privacy__option-description">{{ $option['description'] }}</p>
													</div>
													<dl class="composer-privacy__policies">
														<div>
															<dt>DMs</dt>
															<dd>{{ \Illuminate\Support\Str::headline(str_replace('_', ' ', $option['policies']['dm_policy'] ?? 'connections_only')) }}</dd>
														</div>
														<div>
															<dt>Tags</dt>
															<dd>{{ \Illuminate\Support\Str::headline(str_replace('_', ' ', $option['policies']['tag_policy'] ?? 'connections_only')) }}</dd>
														</div>
													</dl>
												</button>
											@endforeach
										</div>
									</div>
									<input type="hidden" name="visibility" value="{{ $composerActivePrivacy['visibility'] ?? 'connections' }}" data-privacy-input>
									<label class="composer-toggle">
										<input type="checkbox" name="comments_disabled" value="1">
										<span>Disable comments</span>
									</label>
									<button type="submit" class="composer-primary" data-composer-submit>Post</button>
								</div>
							</div>
							<div class="composer-modal" data-capture-modal hidden>
								<div class="composer-modal__dialog">
									<header class="composer-modal__header">
										<h4 class="mb-0" data-capture-title>Record clip</h4>
										<button type="button" class="composer-modal__close" data-capture-close aria-label="Close capture">
											<i class="fas fa-times"></i>
										</button>
									</header>
									<video class="w-full rounded-lg bg-black" data-capture-preview autoplay playsinline muted></video>
									<p class="text-sm text-slate-600 mt-3" data-capture-status>Grant access to your microphone or camera to begin.</p>
									<div class="flex items-center gap-2 mt-4">
										<button type="button" class="composer-primary" data-capture-start>Start</button>
										<button type="button" class="composer-secondary" data-capture-stop disabled>Stop</button>
									</div>
								</div>
							</div>
							<div class="composer-modal" data-integrations-panel hidden>
								<div class="composer-modal__dialog">
									<header class="composer-modal__header">
										<h4 class="mb-0">Social integrations</h4>
										<button type="button" class="composer-modal__close" data-integrations-close aria-label="Close integrations">
											<i class="fas fa-times"></i>
										</button>
									</header>
									<p class="text-sm text-slate-600" data-integrations-status>Loading providers…</p>
									<ul class="composer-integrations__list mt-3" data-integrations-list></ul>
									<div class="flex items-center gap-2 mt-4">
										<button type="button" class="composer-secondary" data-integrations-refresh>Refresh</button>
										<button type="button" class="composer-primary" data-integrations-close>Done</button>
									</div>
								</div>
							</div>
						</div>
						<noscript>
							<p class="mt-4 text-sm text-rose-600">Enable JavaScript to access chunked uploads and privacy controls.</p>
						</noscript>
					</form>
				</div>

				<div class="neo-card" style="padding: 0;">
					<div class="p-4 flex items-center justify-between feed-toolbar">
						<div class="feed-toolbar__filters">
							<button class="feed-filter-btn neo-chip active" data-filter="all">All</button>
							<button class="feed-filter-btn neo-chip" data-filter="connections">Connections</button>
							<button class="feed-filter-btn neo-chip" data-filter="recommended">For you</button>
						</div>
						<div class="feed-toolbar__actions">
							<a href="#" class="neo-chip">Most recent</a>
						</div>
					</div>

					<div id="posts-feed" style="padding: 1.25rem;">
						<!-- Posts hydrate via posts.js -->
					</div>
				</div>
			</main>

			<aside class="pulse-aside">
				<div class="neo-card pulse-aside-card">
					<h4 class="pulse-aside-card__title">Reels</h4>
					<p class="pulse-aside-card__copy">Short videos from your network</p>
					<div class="pulse-reels-preview">
						@forelse($reels as $reel)
							<a href="#" class="pulse-reels-preview__item">
								<img src="{{ $reel['media'] }}" alt="Reel" class="w-full rounded-md object-cover">
								<div class="mt-2 text-sm text-gray-700">{{ $reel['author'] }}</div>
							</a>
						@empty
							<p class="text-sm text-slate-500">Reels refresh hourly.</p>
						@endforelse
					</div>
				</div>

				<div class="neo-card pulse-aside-card">
					<h4 class="pulse-aside-card__title">Newsletter</h4>
					<p class="pulse-aside-card__copy">Get the best stories in your inbox.</p>
					<form action="{{ route('newsletter.store') }}" method="POST" class="newsletter-input">
						@csrf
						<input type="email" name="email" placeholder="Your email" required>
						<button type="submit">Subscribe</button>
					</form>
				</div>
			</aside>
		</div>
	</div>
@endsection

@push('scripts')
	<script>
		window.initialFeed = @json($initialFeed ?? []);
		window.socialComposerConfig = {
			routes: @json($mediaUploadRoutes ?? []),
			placeholder: @json($mediaSessionPlaceholder ?? '__MEDIA_SESSION__'),
			uploadLimits: @json($uploadLimits ?? []),
			privacyOptions: @json($privacyOptions ?? []),
			activePrivacy: @json($activePrivacyOption ?? null),
			canPost: @json($canPost ?? false),
			csrfToken: '{{ csrf_token() }}',
			locale: '{{ app()->getLocale() }}',
			capture: @json($captureConfig ?? []),
			integrations: @json($integrationConfig ?? []),
			endpoints: @json($socialApiEndpoints ?? []),
		};
	</script>
	<script src="{{ asset('js/social/posts.js') }}"></script>
	<script>
		document.addEventListener('DOMContentLoaded', function () {
			if (Array.isArray(window.initialFeed) && window.initialFeed.length > 0 && typeof PostsModule !== 'undefined' && typeof PostsModule.displayFeed === 'function') {
				PostsModule.displayFeed(window.initialFeed);
			}
		});
	</script>
@endpush


