@php
    use Illuminate\Support\Str;

    $recaptchaEnabled = config('features.leads.recaptcha.enabled');
    $recaptchaSiteKey = $recaptchaEnabled ? config('features.leads.recaptcha.site_key') : null;
    $personaMeta = $personaMeta ?? ($page->persona_meta ?? []);
@endphp

@extends('frontend.layouts.master')

@push('scripts')
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            document.querySelectorAll('.js-hls-player').forEach(function (video) {
                var manifest = video.dataset.manifest;

                if (!manifest) {
                    return;
                }

                if (window.Hls && Hls.isSupported()) {
                    var hls = new Hls({ enableWorker: true });
                    hls.loadSource(manifest);
                    hls.attachMedia(video);
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = manifest;
                } else if (video.dataset.fallback) {
                    video.src = video.dataset.fallback;
                }
            });
        });
    </script>
@endpush

@if($recaptchaEnabled && $recaptchaSiteKey)
    @push('scripts')
        <script src="https://www.google.com/recaptcha/api.js?render={{ urlencode($recaptchaSiteKey) }}" defer></script>
    @endpush
@endif

@push('scripts')
    <script>
        (function () {
            var orgSlug = @json($page->slug);

            if (!window.womenriseAnalytics) {
                window.womenriseAnalytics = {
                    track: function (eventName, properties) {
                        if (typeof eventName !== 'string' || eventName.trim() === '') {
                            return Promise.resolve();
                        }

                        var payload = {
                            event: eventName.trim(),
                            properties: properties && typeof properties === 'object' ? properties : {},
                        };

                        var headers = {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        };

                        var csrf = document.querySelector('meta[name="csrf-token"]');

                        if (csrf) {
                            headers['X-CSRF-TOKEN'] = csrf.getAttribute('content') || '';
                        }

                        if (typeof fetch !== 'function') {
                            return Promise.resolve();
                        }

                        return fetch('/api/v1/analytics/events', {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify(payload),
                            credentials: 'include',
                        }).then(function () {
                            return;
                        }).catch(function () {
                            return;
                        });
                    },
                };
            }

            function resolveLeadType(form) {
                var select = form ? form.querySelector('#lead-type') : null;
                return select ? select.value : null;
            }

            function dispatchAnalytics(eventName, properties) {
                var payload = properties || {};
                var delivered = false;

                if (window.womenriseAnalytics && typeof window.womenriseAnalytics.track === 'function') {
                    window.womenriseAnalytics.track(eventName, payload);
                    delivered = true;
                }

                if (window.analytics && typeof window.analytics.track === 'function') {
                    window.analytics.track(eventName, payload);
                    delivered = true;
                }

                if (window.amplitude && typeof window.amplitude.getInstance === 'function') {
                    window.amplitude.getInstance().logEvent(eventName, payload);
                    delivered = true;
                }

                if (!delivered && window.console && typeof window.console.debug === 'function') {
                    console.debug('[lead-form]', eventName, payload);
                }
            }

            function createAnalytics(form) {
                var submitted = false;

                function basePayload(extra) {
                    var data = {
                        component: 'organization_lead_form',
                        org_slug: orgSlug,
                        lead_type: resolveLeadType(form),
                        location: window.location.href
                    };

                    if (extra && typeof extra === 'object') {
                        for (var key in extra) {
                            if (Object.prototype.hasOwnProperty.call(extra, key)) {
                                data[key] = extra[key];
                            }
                        }
                    }

                    return data;
                }

                return {
                    opened: function () {
                        dispatchAnalytics('lead_form_opened', basePayload());
                    },
                    submitted: function () {
                        if (submitted) {
                            return;
                        }

                        submitted = true;
                        dispatchAnalytics('lead_form_submitted', basePayload());
                    },
                    error: function (messages) {
                        var errorList = Array.isArray(messages) ? messages : [];
                        dispatchAnalytics('lead_form_error', basePayload({ errors: errorList }));
                    }
                };
            }

            window.addEventListener('load', function () {
                var form = document.getElementById('lead-form');

                if (!form) {
                    return;
                }

                var analytics = createAnalytics(form);
                analytics.opened();

                var errorContainer = document.querySelector('[data-lead-form-errors]');

                if (errorContainer && errorContainer.dataset && errorContainer.dataset.leadFormErrors) {
                    try {
                        var parsedErrors = JSON.parse(errorContainer.dataset.leadFormErrors);

                        if (Array.isArray(parsedErrors) && parsedErrors.length) {
                            analytics.error(parsedErrors);
                        }
                    } catch (error) {
                        analytics.error(['unparseable_error_payload']);
                    }
                }

                form.addEventListener('submit', function () {
                    analytics.submitted();
                });

                var tokenField = document.getElementById('lead-recaptcha-token');

                if (!tokenField) {
                    return;
                }

                var siteKey = tokenField.getAttribute('data-recaptcha-site-key');

                if (!siteKey) {
                    analytics.error(['missing_recaptcha_site_key']);
                    return;
                }

                var submitButton = form.querySelector('button[type="submit"]');
                var defaultButtonText = submitButton ? submitButton.textContent : null;
                var action = tokenField.dataset.recaptchaAction || 'submit';
                var inflight = false;

                function setSubmitting(isSubmitting) {
                    if (!submitButton) {
                        return;
                    }

                    submitButton.disabled = isSubmitting;

                    if (defaultButtonText) {
                        submitButton.textContent = isSubmitting ? 'Sending...' : defaultButtonText;
                    }
                }

                form.addEventListener('submit', function (event) {
                    if (tokenField.value !== '' || inflight) {
                        return;
                    }

                    if (typeof grecaptcha === 'undefined' || typeof grecaptcha.execute !== 'function') {
                        analytics.error(['recaptcha_unavailable']);
                        return;
                    }

                    event.preventDefault();
                    inflight = true;
                    setSubmitting(true);

                    grecaptcha.ready(function () {
                        grecaptcha.execute(siteKey, { action: action }).then(function (token) {
                            tokenField.value = token;
                            inflight = false;
                            setSubmitting(false);
                            form.submit();
                        }).catch(function () {
                            tokenField.value = '';
                            inflight = false;
                            setSubmitting(false);
                            analytics.error(['recaptcha_fetch_failed']);
                            alert('We could not verify your request. Please try again.');
                        });
                    });
                });
            });
        })();
    </script>
@endpush

@section('contents')
    

    <section class="organization-hero py-5">
        <div class="container">
            <div class="row align-items-center g-5">
                <div class="col-lg-6">
                    <span class="meta-chip mb-3 d-inline-flex align-items-center gap-2">
                        <i class="fas fa-bolt"></i>
                        {{ Str::upper($page->type?->label() ?? 'Org') }} profile
                    </span>
                    <h1 class="display-5 fw-bold mb-3">{{ $page->name }}</h1>
                    @if($page->tagline)
                        <p class="fs-5 text-white-50 mb-4">{{ $page->tagline }}</p>
                    @endif

                    <div class="d-flex flex-wrap gap-3 text-white-50 mb-4">
                        <span><i class="fas fa-users me-2 text-warning"></i>{{ number_format($page->followers_count) }} followers</span>
                        @if($page->company)
                            <span><i class="fas fa-briefcase me-2 text-info"></i>{{ $page->company->name }}</span>
                        @endif
                        <span><i class="fas fa-shield-check me-2 text-success"></i>{{ Str::headline($page->verification_status) }}</span>
                    </div>

                    <div class="neon-divider"></div>

                    <div class="d-flex flex-wrap gap-3">
                        <button class="btn btn-lg btn-light text-primary fw-semibold shadow-sm" type="button" data-follow-url="{{ url('/api/org/'.$page->slug.'/follow') }}">
                            <i class="fas fa-plus-circle me-2"></i>Follow Page
                        </button>
                        @if($page->hero_cta_label && $page->hero_cta_url)
                            <a href="{{ $page->hero_cta_url }}" class="btn btn-lg btn-outline-light fw-semibold" target="_blank" rel="noopener">
                                <i class="fas fa-external-link-alt me-2"></i>{{ $page->hero_cta_label }}
                            </a>
                        @endif
                        @if($page->website_url)
                            <a href="{{ $page->website_url }}" class="btn btn-lg btn-link text-white fw-semibold" target="_blank" rel="noopener">
                                Visit website
                            </a>
                        @endif
                    </div>
                </div>
                <div class="col-lg-6">
                    @if($page->coverMedia && ! $page->coverMedia->is_flagged)
                        @if($page->coverMedia->type === 'video' && $page->coverMedia->stream_url)
                            <video
                                class="w-100 js-hls-player"
                                controls
                                playsinline
                                preload="metadata"
                                poster="{{ $page->coverMedia->thumbnail_url }}"
                                data-manifest="{{ $page->coverMedia->stream_url }}"
                                data-fallback="{{ $page->coverMedia->download_url }}"
                                controlsList="nodownload"
                            ></video>
                        @elseif($page->coverMedia->type === 'video')
                            <video class="w-100" controls playsinline poster="{{ $page->coverMedia->thumbnail_url }}">
                                <source src="{{ $page->coverMedia->download_url ?? $page->coverMedia->url }}" type="video/mp4">
                            </video>
                        @else
                            <img src="{{ $page->coverMedia->url }}" alt="{{ $page->name }} hero" class="img-fluid">
                        @endif
                    @else
                        <div class="p-5 rounded-4 bg-white text-center shadow-lg">
                            <i class="fas fa-photo-video fa-3x text-primary mb-3"></i>
                            <p class="mb-0 text-muted">Upload a hero video or image to showcase {{ $page->name }}.</p>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </section>

    @if(!empty($personaMeta))
        <section class="persona-spotlight py-5">
            <div class="container">
                <div class="row align-items-center g-4">
                    <div class="col-lg-7">
                        <span class="persona-pill mb-3">
                            <i class="fas fa-shapes"></i>
                            {{ $personaMeta['badge'] ?? ($personaMeta['label'].' Persona') }}
                        </span>
                        <h2 class="display-6 fw-bold mb-3">{{ $personaMeta['tagline'] ?? ($personaMeta['label'].' persona spotlight') }}</h2>
                        <p class="text-white-50 mb-4">{{ $personaMeta['summary'] ?? '' }}</p>
                        <div class="d-flex flex-wrap gap-3 text-white-50 small">
                            <span><i class="fas fa-layer-group me-2"></i>{{ $personaMeta['label'] }}</span>
                            <span class="badge bg-white text-dark text-uppercase">Lead intent: {{ Str::title($personaMeta['default_lead_intent'] ?? 'general') }}</span>
                        </div>
                    </div>
                    <div class="col-lg-5">
                        <div class="persona-card p-4 shadow-lg h-100">
                            <h4 class="h6 text-uppercase text-white-50 mb-3">Activation Playbook</h4>
                            <ul class="list-unstyled mb-0">
                                @foreach($personaMeta['unlocks'] ?? [] as $unlock)
                                    <li class="d-flex align-items-start gap-2 mb-2">
                                        <i class="fas fa-check-circle text-success"></i>
                                        <span>{{ $unlock }}</span>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    @endif

    <section class="py-5">
        <div class="container">
            <div class="row">
                <div class="col-lg-8">
                    @if($page->about)
                        <div class="mb-5">
                            <h2>About</h2>
                            <p class="text-muted">{{ $page->about }}</p>
                        </div>
                    @endif

                    @if($page->mission)
                        <div class="mb-5">
                            <h3>Mission</h3>
                            <p class="text-muted">{{ $page->mission }}</p>
                        </div>
                    @endif

                    @if(!empty($page->highlights))
                        <div class="mb-5">
                            <h3>Highlights</h3>
                            <ul class="list-unstyled">
                                @foreach($page->highlights as $highlight)
                                    <li class="d-flex align-items-center mb-2">
                                        <i class="fas fa-check text-primary me-2"></i>
                                        <span>{{ $highlight }}</span>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                    @endif

                    @if(($coursePreview ?? collect())->isNotEmpty())
                        <div class="mb-5">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h3 class="mb-0">Featured Courses</h3>
                                <a class="btn btn-sm btn-outline-primary" href="{{ route('organizations.courses.index', $page->slug) }}">
                                    View all courses ({{ number_format($courseCount ?? 0) }})
                                </a>
                            </div>
                            <div class="row g-3">
                                @foreach($coursePreview as $course)
                                    <div class="col-md-4">
                                        <div class="card h-100 shadow-sm">
                                            <div class="card-body d-flex flex-column">
                                                <span class="badge bg-secondary text-uppercase mb-2">{{ Str::upper($course->type) }}</span>
                                                <h4 class="h5 mb-2">
                                                    <a href="{{ route('organizations.courses.show', [$page->slug, $course->slug]) }}" class="text-decoration-none">
                                                        {{ $course->title }}
                                                    </a>
                                                </h4>
                                                <p class="text-muted small flex-grow-1">{{ Str::limit($course->summary, 120) }}</p>
                                                @php
                                                    $nextIntake = $course->intakes->first();
                                                @endphp
                                                <div class="mt-3">
                                                    <div class="d-flex justify-content-between text-muted small">
                                                        <span><i class="fas fa-laptop me-1"></i>{{ Str::title(str_replace('_', ' ', $course->mode)) }}</span>
                                                        <span><i class="fas fa-map-marker-alt me-1"></i>{{ $course->location ?? 'Flexible' }}</span>
                                                    </div>
                                                    @if($nextIntake)
                                                        <div class="text-muted small mt-2">
                                                            <i class="fas fa-calendar-alt me-1 text-primary"></i>
                                                            Starts {{ optional($nextIntake->start_on)->format('M j, Y') }}
                                                        </div>
                                                    @endif
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                @endforeach
                            </div>
                        </div>
                    @endif

                    @if($page->posts->isNotEmpty())
                        <div class="mb-5">
                            <h3>Recent Posts</h3>
                            <div class="list-group">
                                @foreach($page->posts as $post)
                                    <article class="list-group-item list-group-item-action mb-3">
                                        @if($post->title)
                                            <h4 class="h5">{{ $post->title }}</h4>
                                        @endif
                                        @if($post->content)
                                            <p class="mb-2">{{ Str::limit(strip_tags($post->content), 240) }}</p>
                                        @endif
                                        <div class="d-flex justify-content-between text-muted small">
                                            <span>{{ optional($post->published_at)->format('M j, Y') ?? 'Scheduled' }}</span>
                                            <span>
                                                <i class="far fa-heart me-1"></i>{{ $post->likes }}
                                                <i class="far fa-comment ms-3 me-1"></i>{{ $post->comments }}
                                            </span>
                                        </div>
                                    </article>
                                @endforeach
                            </div>
                        </div>
                    @endif
                </div>
                <div class="col-lg-4">
                    <div class="card shadow-sm mb-4">
                        <div class="card-body">
                            <h3 class="h5 mb-3">Connect with {{ $page->name }}</h3>
                            @if(session('status'))
                                <div class="alert alert-success">{{ session('status') }}</div>
                            @endif
                            @if($errors->any())
                                <div class="alert alert-danger" data-lead-form-errors='@json($errors->all())'>
                                    <ul class="mb-0">
                                        @foreach($errors->all() as $error)
                                            <li>{{ $error }}</li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif
                            <form id="lead-form" method="POST" action="{{ route('organizations.lead', $page->slug) }}">
                                @csrf
                                <div class="mb-3">
                                    <label class="form-label" for="lead-type">I'm interested in</label>
                                    @php $selectedType = old('type', $leadIntent); @endphp
                                    <select class="form-select" name="type" id="lead-type" required>
                                        <option value="general" @selected($selectedType === 'general')>General enquiry</option>
                                        <option value="course" @selected($selectedType === 'course')>Courses</option>
                                        <option value="apprenticeship" @selected($selectedType === 'apprenticeship')>Apprenticeships</option>
                                        <option value="job" @selected($selectedType === 'job')>Roles & hiring</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="lead-name">Full name</label>
                                    <input class="form-control" type="text" id="lead-name" name="name" value="{{ old('name') }}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="lead-email">Email</label>
                                    <input class="form-control" type="email" id="lead-email" name="email" value="{{ old('email') }}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="lead-phone">Phone (optional)</label>
                                    <input class="form-control" type="text" id="lead-phone" name="phone" value="{{ old('phone') }}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="lead-message">Message</label>
                                    <textarea class="form-control" id="lead-message" name="message" rows="4">{{ old('message') }}</textarea>
                                </div>
                                <div class="form-check mb-3">
                                    <input class="form-check-input" type="checkbox" id="lead-consent" name="consent" value="1" @checked(old('consent')) required>
                                    <label class="form-check-label" for="lead-consent">
                                        I agree to the <a href="{{ route('custom-page', 'privacy-policy') }}" class="text-decoration-underline">privacy policy</a> and understand {{ $page->name }} will contact me.
                                    </label>
                                </div>
                                @if($recaptchaEnabled)
                                    <input
                                        type="hidden"
                                        name="recaptcha_token"
                                        id="lead-recaptcha-token"
                                        data-recaptcha-action="org_lead_form"
                                        data-recaptcha-site-key="{{ $recaptchaSiteKey }}"
                                    >
                                @endif
                                <button type="submit" class="btn btn-primary w-100">Send enquiry</button>
                            </form>
                        </div>
                    </div>

                    @if(!empty($page->policies))
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <h3 class="h6 text-uppercase">Policies & Commitments</h3>
                                <ul class="list-unstyled mb-0">
                                    @foreach($page->policies as $policy)
                                        <li class="d-flex align-items-center mb-2">
                                            <i class="fas fa-shield-alt text-success me-2"></i>
                                            <span>{{ $policy }}</span>
                                        </li>
                                    @endforeach
                                </ul>
                            </div>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </section>

    @if($page->media->isNotEmpty())
        <section class="py-5 bg-light">
            <div class="container">
                <h3 class="mb-4">Latest Media</h3>
                <div class="row g-4">
                    @foreach($page->media as $media)
                        @php
                            $isVideo = $media->type === 'video';
                            $durationLabel = $media->duration ? gmdate('i:s', max($media->duration, 1)) : null;
                        @endphp
                        <div class="col-md-4">
                            <div class="media-card h-100">
                                @if($isVideo && $media->stream_url)
                                    <video
                                        class="js-hls-player"
                                        controls
                                        playsinline
                                        preload="metadata"
                                        poster="{{ $media->thumbnail_url }}"
                                        data-manifest="{{ $media->stream_url }}"
                                        data-fallback="{{ $media->download_url }}"
                                        controlsList="nodownload"
                                    ></video>
                                @elseif($isVideo)
                                    <video class="w-100" controls playsinline poster="{{ $media->thumbnail_url }}">
                                        <source src="{{ $media->download_url ?? $media->url }}" type="video/mp4">
                                    </video>
                                @else
                                    <img src="{{ $media->url }}" alt="Media asset" loading="lazy">
                                @endif
                                <div class="media-overlay">
                                    <span class="media-chip">
                                        <i class="fas {{ $isVideo ? 'fa-play-circle' : 'fa-image' }}"></i>
                                        {{ Str::title($media->type) }}
                                    </span>
                                    <div class="d-flex justify-content-between align-items-center mt-3">
                                        <span class="small text-white-50">
                                            <i class="fas fa-clock me-2"></i>{{ $media->created_at->diffForHumans() }}
                                        </span>
                                        @if($durationLabel && $isVideo)
                                            <span class="small text-white fw-semibold">
                                                <i class="fas fa-hourglass-half me-1"></i>{{ $durationLabel }}
                                            </span>
                                        @endif
                                    </div>
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>
        </section>
    @endif
@endsection

