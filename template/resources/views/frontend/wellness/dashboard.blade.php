@extends('frontend.layouts.master')

@section('page_title', 'Wellness dashboard')

@section('content')
    <section class="section-box-2 mt-80">
        <div class="container">
            <div class="card shadow-sm p-4 mb-4" style="border-radius: 32px;">
                <div class="d-flex flex-column flex-md-row justify-content-between gap-3">
                    <div>
                        <p class="text-uppercase text-muted mb-1">Active persona</p>
                        <h1 class="mb-2">{{ optional($user)->name ?? 'Guest' }}</h1>
                        <p class="mb-0">Curated care rituals and partner handoffs personalised to your intents.</p>
                    </div>
                    <div class="text-md-end">
                        <p class="text-uppercase text-muted mb-1">Allowed contexts</p>
                        <div>
                            @forelse ($allowedContexts as $context)
                                <span class="badge bg-success-subtle text-uppercase me-1 mb-1">{{ $context }}</span>
                            @empty
                                <span class="text-muted">No contexts detected</span>
                            @endforelse
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                @foreach ($focusCards as $card)
                    <div class="col-md-4 mb-4">
                        <div class="card h-100 shadow-sm" style="border-radius: 24px;">
                            <div class="card-body d-flex flex-column">
                                <h2 class="h5">{{ $card['title'] }}</h2>
                                <p class="text-muted flex-grow-1">{{ $card['description'] }}</p>
                                @php
                                    $cardUrl = $card['url'] ?? (isset($card['route']) ? route($card['route'], $card['parameters'] ?? []) : '#');
                                    $requiresAuth = (bool) ($card['requires_auth'] ?? false);
                                @endphp
                                @if ($requiresAuth && !auth()->check())
                                    <a class="btn btn-success" href="{{ route('login') }}">Sign in to view</a>
                                @else
                                    <a class="btn btn-success" href="{{ $cardUrl }}">Open</a>
                                @endif
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>

            <div class="card shadow-sm p-4" style="border-radius: 28px;">
                <h2 class="h4 mb-3">Next three wellness touchpoints</h2>
                @php($lastTouchpointIndex = array_key_last($touchpoints))
                <ul class="list-unstyled mb-0">
                    @foreach ($touchpoints as $index => $touchpoint)
                        <li class="mb-{{ $index === $lastTouchpointIndex ? '0' : '3' }}">
                            <strong>{{ $touchpoint['label'] }}</strong>
                            &mdash; {{ $touchpoint['description'] }}
                        </li>
                    @endforeach
                </ul>
            </div>
        </div>
    </section>
@endsection
