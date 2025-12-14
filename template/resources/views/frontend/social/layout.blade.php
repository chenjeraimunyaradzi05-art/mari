@extends('layouts.app')

@php
    $socialMetrics = \App\Support\SocialMetrics::forUser(auth()->user());
    $memberLabels = [
        'member' => member_label(),
        'members' => member_label('members'),
        'member_hub' => member_label('member_hub'),
        'member_dashboard' => member_label('member_dashboard'),
        'member_onboarding' => member_label('member_onboarding'),
        'member_profile' => member_label('member_profile'),
    ];
@endphp

@section('navigation')
    {{-- Social pages manage their own navigation inside the content block. --}}
@endsection

@section('content')
@if(auth()->check())
    <meta name="user-id" content="{{ auth()->id() }}">
@endif
<meta name="social-default-avatar" content="{{ asset('images/default-avatar.png') }}">

<div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
    <!-- Social Navigation -->
    @includeFirst([
        'frontend.social.components.navigation',
        'social.components.navigation'
    ], ['metrics' => $socialMetrics])

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <!-- Sidebar -->
            <div class="lg:col-span-2" style="padding-left:1rem;padding-right:1rem;">
                @includeFirst([
                    'frontend.social.components.sidebar',
                    'social.components.sidebar'
                ], ['metrics' => $socialMetrics])
            </div>

            <!-- Main Content -->
            <div class="lg:col-span-3">
                @yield('social-content')
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
    window.memberLabels = @json($memberLabels);
    window.currentUserId = {{ auth()->id() ?? 'null' }};
    window.socialReactionPalette = @json(config('social.reactions.palette', []));
    window.socialShareChannels = @json(config('social.shares.channels', []));
</script>
<script src="{{ asset('js/social/ai-features.js') }}"></script>
<script src="{{ asset('js/social/interactions.js') }}"></script>
<script src="{{ asset('js/social/notifications.js') }}"></script>
<script src="{{ asset('js/social/real-time.js') }}"></script>
@endpush
