@extends('frontend.layouts.master')

@section('page_title', 'Wellness rituals')

@section('content')
    <section class="section-box-2 mt-80">
        <div class="container">
            <div class="row">
                <div class="col-lg-8">
                    <div class="card-style-1 hover-up p-4 mb-4"
                        style="border-radius: 32px; background: linear-gradient(135deg, #0f172a, #4c1d95); color: #fff;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h1 class="mb-2">Care rituals, AI guidance, and money calm</h1>
                                <p class="mb-0">Trade breathwork, trauma-aware scripts, and financial education in one women-first lane.</p>
                            </div>
                            <span class="badge bg-success-subtle text-uppercase">Wellness</span>
                        </div>
                        <div class="d-flex gap-2 flex-wrap">
                            <a class="btn btn-default btn-shadow" href="{{ route('business.network') }}">Partner handoffs</a>
                            <a class="btn btn-border" href="{{ route('grants.index') }}">Guides &amp; stories</a>
                            <a class="btn btn-border" href="{{ route('wellness.dashboard') }}">Member dashboard</a>
                        </div>
                    </div>

                    <div class="card shadow-sm p-4 mb-4" style="border-radius: 28px;">
                        @if(isset($aiPlan) && $aiPlan)
                            <div class="mb-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="text-lg font-semibold text-indigo-900">Your AI Wellness Plan</h3>
                                    <span class="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-200 rounded-full">Personalized</span>
                                </div>
                                <p class="text-indigo-800 mb-4">{{ $aiPlan['summary'] }}</p>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <h4 class="text-sm font-medium text-indigo-900 uppercase tracking-wide mb-2">Focus Areas</h4>
                                        <div class="flex flex-wrap gap-2">
                                            @foreach($aiPlan['focus_areas'] as $area)
                                                <span class="px-2 py-1 text-xs bg-white text-indigo-700 rounded border border-indigo-200">{{ $area }}</span>
                                            @endforeach
                                        </div>
                                    </div>
                                    <div>
                                        <h4 class="text-sm font-medium text-indigo-900 uppercase tracking-wide mb-2">Weekly Schedule</h4>
                                        <ul class="space-y-1 text-sm text-indigo-800">
                                            @foreach($aiPlan['schedule'] as $day => $activity)
                                                <li><span class="font-medium">{{ $day }}:</span> {{ $activity }}</li>
                                            @endforeach
                                        </ul>
                                    </div>
                                </div>

                                @if(isset($aiPlan['recommended_events']) && $aiPlan['recommended_events']->isNotEmpty())
                                    <div class="mt-4 pt-4 border-t border-indigo-200">
                                        <h4 class="text-sm font-medium text-indigo-900 uppercase tracking-wide mb-2">Recommended Events</h4>
                                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            @foreach($aiPlan['recommended_events'] as $event)
                                                <a href="{{ $event->registration_url }}" class="block p-3 bg-white rounded border border-indigo-100 hover:border-indigo-300 transition-colors">
                                                    <p class="font-medium text-indigo-900 text-sm truncate">{{ $event->title }}</p>
                                                    <p class="text-xs text-indigo-500">{{ $event->starts_at->format('M d, g:ia') }}</p>
                                                </a>
                                            @endforeach
                                        </div>
                                    </div>
                                @endif
                            </div>
                        @endif

                        <div class="row g-4 align-items-stretch">
                            <div class="col-md-7">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div>
                                        <p class="text-uppercase text-muted mb-1" style="letter-spacing: 0.2em;">AI-guided journeys</p>
                                        <h2 class="h4 mb-0">Concierge playlists that talk to Money Inbox</h2>
                                    </div>
                                </div>
                                <div class="row g-3">
                                    @foreach ($aiPlaylists as $playlist)
                                        @php
                                            $playlistCta = $playlist['cta'] ?? [];
                                            $playlistCtaUrl = $playlistCta['url'] ?? null;
                                            $playlistRequiresAuth = (bool) ($playlistCta['requires_auth'] ?? false);
                                            $playlistButtonUrl = $playlistRequiresAuth && !auth()->check() ? route('login') : $playlistCtaUrl;
                                        @endphp
                                        <div class="col-sm-6">
                                            <div class="h-100 rounded-4 border border-success-subtle p-3 bg-success-subtle bg-opacity-10">
                                                <p class="text-uppercase small text-muted mb-1">{{ $playlist['focus'] ?? 'AI ritual' }}</p>
                                                <h3 class="h6">{{ $playlist['title'] ?? 'AI playlist' }}</h3>
                                                <p class="text-muted small">{{ $playlist['summary'] ?? '' }}</p>
                                                @if (!empty($playlist['badges']))
                                                    <div class="mb-2">
                                                        @foreach ($playlist['badges'] as $badge)
                                                            <span class="badge bg-success-subtle text-success-emphasis me-1 mb-1">{{ $badge }}</span>
                                                        @endforeach
                                                    </div>
                                                @endif
                                                @if ($playlistCtaUrl)
                                                    <a class="btn btn-sm btn-success" href="{{ $playlistButtonUrl }}">
                                                        {{ $playlistRequiresAuth && !auth()->check() ? 'Sign in to launch' : ($playlistCta['label'] ?? 'Open AI coach') }}
                                                    </a>
                                                @endif
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                            <div class="col-md-5">
                                <p class="text-uppercase text-muted mb-1" style="letter-spacing: 0.2em;">Financial education desk</p>
                                <h3 class="h5">Budget, debt, and relief tools tuned for care work</h3>
                                <ul class="list-unstyled mb-4">
                                    @foreach ($financialEducationTracks as $track)
                                        @php
                                            $trackCta = $track['cta'] ?? [];
                                            $trackUrl = $trackCta['url'] ?? null;
                                        @endphp
                                        <li class="mb-3">
                                            <p class="fw-semibold mb-1">{{ $track['title'] ?? 'Financial module' }}</p>
                                            <p class="text-muted small mb-2">{{ $track['description'] ?? '' }}</p>
                                            @if ($trackUrl)
                                                <a class="text-success fw-semibold" href="{{ $trackUrl }}">{{ $trackCta['label'] ?? 'Open module' }} &rarr;</a>
                                            @endif
                                        </li>
                                    @endforeach
                                </ul>
                                <div class="d-flex flex-wrap gap-3">
                                    @foreach ($wellnessFinanceSignals as $signal)
                                        <div class="p-3 rounded-4 bg-light flex-fill" style="min-width: 140px;">
                                            <p class="text-uppercase text-muted small mb-1">{{ $signal['label'] ?? 'Signal' }}</p>
                                            <p class="h5 mb-1">{{ $signal['value'] ?? '—' }}</p>
                                            <p class="text-muted small mb-0">{{ $signal['description'] ?? '' }}</p>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mb-4">
                        <h2 class="mb-3">Ritual library</h2>
                        <div class="row">
                            @foreach ($rituals as $ritual)
                                <div class="col-md-4 mb-3">
                                    <div class="card h-100 shadow-sm" style="border-radius: 20px;">
                                        <div class="card-body d-flex flex-column">
                                            <span class="text-muted text-uppercase small mb-2">{{ $ritual['length'] ?? '—' }}</span>
                                            <h3 class="h5">{{ $ritual['title'] }}</h3>
                                            <p class="text-muted flex-grow-1">{{ $ritual['description'] }}</p>
                                            @php
                                                $cta = $ritual['cta'] ?? [];
                                                $ctaUrl = $cta['url'] ?? (isset($cta['route']) ? route($cta['route'], $cta['parameters'] ?? []) : null);
                                                $requiresAuth = (bool) ($cta['requires_auth'] ?? false);
                                                $analytics = $ritual['analytics'] ?? [];
                                            @endphp
                                            @if ($ctaUrl)
                                                @if (!$requiresAuth || auth()->check())
                                                    <a class="btn btn-success" href="{{ $ctaUrl }}">
                                                        {{ $cta['label'] ?? 'Explore' }}
                                                    </a>
                                                @else
                                                    <a class="btn btn-success" href="{{ route('login') }}">
                                                        Sign in to continue
                                                    </a>
                                                @endif
                                            @endif
                                            @if (!empty($analytics))
                                                <div class="mt-3 d-flex gap-3 text-muted small">
                                                    <span>
                                                        <i class="fas fa-eye me-1" aria-hidden="true"></i>
                                                        {{ number_format($analytics['views'] ?? 0) }} views
                                                    </span>
                                                    <span>
                                                        <i class="fas fa-heart me-1" aria-hidden="true"></i>
                                                        {{ number_format($analytics['likes'] ?? 0) }} likes
                                                    </span>
                                                </div>
                                            @endif
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="card shadow-sm mb-4" style="border-radius: 24px;">
                        <div class="card-body">
                            <h2 class="h4">Stories &amp; prompts</h2>
                            <p class="text-muted">Weekly drops from founding coaches, policy leaders, and care strategists.</p>
                            <ul class="list-unstyled">
                                @foreach ($stories as $story)
                                    <li class="mb-3">
                                        <h3 class="h6 mb-1">{{ $story['title'] }}</h3>
                                        <p class="text-muted mb-1">{{ $story['excerpt'] }}</p>
                                        @php
                                            $storyUrl = $story['url'] ?? (isset($story['route']) ? route($story['route'], $story['parameters'] ?? []) : '#');
                                        @endphp
                                        <a class="text-success" href="{{ $storyUrl }}">Read the drop &rarr;</a>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                    </div>
                    <div class="card shadow-sm" style="border-radius: 24px;">
                        <div class="card-body">
                            <h2 class="h5">Need faster support?</h2>
                            <p class="text-muted">Tap AI Concierge for 24/7 prompts or open Social Feed to swap care + car wins. Money Inbox links keep every answer grounded in financial education.</p>
                            <div class="d-grid gap-2">
                                <a class="btn btn-border" href="{{ $isAuthenticated ? route('social.feed.index') : route('login') }}">
                                    {{ $isAuthenticated ? 'Open community' : 'Sign in to connect' }}
                                </a>
                                <a class="btn btn-success" href="{{ $isAuthenticated ? route('ai.concierge', ['context' => 'wellness-fast-hand-off']) : route('login') }}">
                                    {{ $isAuthenticated ? 'Launch AI concierge' : 'Sign in for AI guidance' }}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
