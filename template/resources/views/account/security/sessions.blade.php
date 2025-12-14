@php
    use Illuminate\Support\Str;

    $pageTitle = 'Login & Device Security';
    $riskReason = $risk['reason'] ?? null;
@endphp

<x-app-layout>
    <x-slot name="title">{{ $pageTitle }}</x-slot>

    <div class="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-50">{{ $pageTitle }}</h1>
                <p class="text-sm text-gray-500">Review every active device, revoke stale sessions, and keep your account safe.</p>
            </div>
            <span class="inline-flex items-center rounded-full bg-indigo-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-700">
                {{ __('Secure by Athena') }}
            </span>
        </div>

        @if (session('success'))
            <div class="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {{ session('success') }}
            </div>
        @endif

        @if (session('status'))
            <div class="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                {{ session('status') }}
            </div>
        @endif

        @if ($riskReason && $risk['label'])
            <div class="rounded-3xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
                <div class="flex items-start gap-3">
                    <div class="mt-1 h-10 w-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600">Potential risk detected</p>
                        <p class="text-base font-medium">{{ $risk['label'] }}</p>
                        <p class="text-sm text-amber-800/80">
                            @if ($risk['detected_at'])
                                {{ __('Flagged :time ago', ['time' => $risk['detected_at']->diffForHumans()]) }} ·
                            @endif
                            {{ __('Review devices you do not recognize and revoke them immediately.') }}
                        </p>
                    </div>
                </div>
            </div>
        @endif

        <div class="grid gap-4 sm:grid-cols-3">
            <x-panel class="sm:col-span-1">
                <p class="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">Active Sessions</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">{{ number_format($stats['total']) }}</p>
                <p class="text-xs text-gray-500">Devices currently signed in.</p>
            </x-panel>
            <x-panel class="sm:col-span-1">
                <p class="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">Countries Seen</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">{{ number_format($stats['countries']) }}</p>
                <p class="text-xs text-gray-500">Unique countries in the last activity window.</p>
            </x-panel>
            <x-panel class="sm:col-span-1">
                <p class="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">Latest Activity</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">
                    {{ $stats['last_activity'] ? $stats['last_activity']->diffForHumans() : '—' }}
                </p>
                <p class="text-xs text-gray-500">Most recent heartbeat from any device.</p>
            </x-panel>
        </div>

        <x-panel>
            <div class="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 class="text-lg font-semibold text-gray-900">Active devices</h2>
                    <p class="text-sm text-gray-500">Each row is a session that can be revoked instantly.</p>
                </div>
                <p class="text-xs font-semibold uppercase tracking-[0.35em] text-gray-400">{{ __('Auto-refresh every sign in') }}</p>
            </div>

            <div class="divide-y divide-gray-100">
                @forelse ($sessions as $session)
                    <div class="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="text-base font-semibold text-gray-900">{{ $session->device_name ?? 'Unknown device' }}</p>
                                @if ($session->id === $currentSessionId)
                                    <span class="inline-flex items-center rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                                        {{ __('This device') }}
                                    </span>
                                @endif
                            </div>
                            <p class="text-sm text-gray-500">
                                {{ Str::headline($session->device_type ?? 'device') }} ·
                                {{ $session->browser ?? 'Browser' }} on {{ $session->platform ?? 'platform' }}
                            </p>
                            <p class="text-xs text-gray-400 mt-1">
                                {{ $session->ip_address ?? __('Unknown IP') }}
                                @php
                                    $location = collect([$session->location_city, $session->location_country])->filter()->implode(', ');
                                @endphp
                                · {{ $location ?: __('Location unknown') }}
                            </p>
                        </div>
                        <div class="flex flex-col items-start gap-3 text-sm text-gray-500 md:items-end md:text-right">
                            <div>
                                <p class="font-semibold text-gray-900">
                                    {{ optional($session->last_activity)->format('M d, Y · H:i') ?? __('No signal') }}
                                </p>
                                <p class="text-xs text-gray-400">
                                    {{ optional($session->last_activity)?->diffForHumans() ?? __('Never active') }}
                                </p>
                            </div>
                            <form method="POST" action="{{ route('account.sessions.destroy', $session) }}" onsubmit="return confirm('Sign out this session?');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="inline-flex items-center rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                                    <i class="fas fa-power-off mr-2"></i>
                                    {{ __('Revoke session') }}
                                </button>
                            </form>
                        </div>
                    </div>
                @empty
                    <div class="py-10 text-center text-sm text-gray-500">
                        {{ __('No active sessions found.') }}
                    </div>
                @endforelse
            </div>

            <div class="mt-6">
                {{ $sessions->links() }}
            </div>
        </x-panel>
    </div>
</x-app-layout>
