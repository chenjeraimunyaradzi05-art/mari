<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="ai-concierge-endpoint" content="{{ route('ai.concierge.respond') }}">
        @auth
            <meta name="user-id" content="{{ auth()->id() }}">
        @endauth

        <title>{{ config('app.name', 'Athena') }} · @yield('title', __('Empowering Women'))</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-bx92sMkBx9+1FMvx6bMpiKFFitvolSF/GpNZgbf+168Q5e0siJmq9hw3rroWAtxEvsC0BpvyOuk+qS0b+Y1Kug==" crossorigin="anonymous" referrerpolicy="no-referrer" />
        <link rel="stylesheet" href="{{ asset('frontend/assets/css/theme-feminine.css') }}">
        <link rel="stylesheet" href="{{ asset('frontend/assets/css/feminine-frontend-overrides.css') }}">

        @livewireStyles

        @stack('styles')

        <!-- Scripts -->
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="font-sans antialiased bg-gray-50 text-gray-900">
        @php
            $personaContext = auth()->check()
                ? \App\Support\PersonaContext::forUser(auth()->user())
                : [];
        @endphp
        @php
            $aiFeaturedContexts = \App\Support\AiConcierge::featuredContexts();
            $aiEntryRoute = config('app.platform.ai_entry_route', 'ai.concierge');
            $aiEntryUrl = \Illuminate\Support\Facades\Route::has($aiEntryRoute) ? route($aiEntryRoute) : url('/ai');
            $pageAiPayloads = isset($aiConciergePayloads) && is_array($aiConciergePayloads) ? $aiConciergePayloads : [];
            $currentAiSurface = $aiConciergeSurface ?? 'global_concierge';
            $suppressWelcomeCard = \Illuminate\Support\Facades\View::hasSection('suppress-welcome-card');
        @endphp
        <div class="min-h-screen">
            @hasSection('navigation')
                @yield('navigation')
            @else
                @include('layouts.navigation')
            @endif

            @include('components.ai.concierge-bar', [
                'contexts' => $aiFeaturedContexts,
                'entryUrl' => $aiEntryUrl,
                'canAsk' => auth()->check(),
                'payloads' => $pageAiPayloads,
                'surface' => $currentAiSurface,
            ])

            <!-- Page Heading -->
            @if (isset($header))
                <header class="bg-white shadow">
                    <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                        {{ $header }}
                    </div>
                </header>
            @endif

            <!-- Page Content -->
            <main>
                @isset($slot)
                    {{ $slot }}
                @else
                    @yield('content')
                @endisset
            </main>

            @include('layouts.footer')
        </div>

        @if(!empty($personaContext))
            <script>
                window.athenaPersona = @json($personaContext);
                window.currentPersonaId = {{ $personaContext['profile_id'] }};
                window.currentSocialProfileId = {{ $personaContext['social_profile']['id'] ?? 'null' }};
                window.currentPrivacyTier = @json($personaContext['privacy']['tier'] ?? 'network');

                document.documentElement.dataset.personaKey = @json($personaContext['persona']['type'] ?? '');
                document.documentElement.dataset.personaTier = @json($personaContext['privacy']['tier'] ?? '');
                document.documentElement.dataset.personaPrivacy = @json($personaContext['privacy']['level'] ?? '');

                document.dispatchEvent(new CustomEvent('persona:context-ready', {
                    detail: window.athenaPersona,
                }));
            </script>
        @endif

        <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-3fp9uP4/jDdyCjTiMQuILzfoalGoVYBoNvKpcJste9k=" crossorigin="anonymous"></script>

        @include('components.ai.concierge-scripts')
        @stack('scripts')
        @livewireScripts
    </body>
</html>
