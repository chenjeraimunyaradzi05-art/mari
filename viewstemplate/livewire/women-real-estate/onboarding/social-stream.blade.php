@php use Illuminate\Support\Str; @endphp

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <p class="text-sm font-semibold text-pink-600 uppercase tracking-wide">Community stream</p>
            <h2 class="text-xl font-bold text-slate-900">What your peers are sharing</h2>
        </div>
        <div class="hidden sm:flex items-center gap-3">
            <span class="text-xs text-slate-500">Powered by WomenRise Collective</span>
            <span class="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-semibold">WR</span>
        </div>
    </div>

    <div class="flex flex-wrap gap-2" aria-label="Filter topics">
        @foreach ($tagOptions as $option)
            <button
                type="button"
                wire:click="setTag('{{ $option['value'] }}')"
                @class([
                    'px-3 py-1.5 rounded-full border text-sm transition',
                    'bg-pink-600 text-white border-pink-600 shadow-sm' => $activeTag === $option['value'],
                    'bg-white text-slate-600 border-slate-200 hover:border-pink-400 hover:text-pink-600' => $activeTag !== $option['value'],
                ])
            >
                {{ $option['label'] }}
            </button>
        @endforeach
    </div>

    <div class="rounded-2xl border border-slate-100 bg-gradient-to-r from-rose-50 via-white to-amber-50 p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">Trusted network</p>
                <p class="text-sm text-slate-600">{{ $connectionsCount > 0 ? 'Connections synced. Keep the momentum going.' : 'Make one trusted connection to unlock social shortcuts.' }}</p>
            </div>
            <div class="flex flex-wrap gap-2 text-xs font-semibold">
                <span class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-emerald-600 shadow">
                    <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                    {{ $connectionsCount }} trusted
                </span>
                <span class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-amber-600 shadow">
                    <span class="h-2 w-2 rounded-full bg-amber-500"></span>
                    {{ $pendingConnections }} pending
                </span>
            </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <a href="{{ route('women.real-estate.network.connections') }}" class="inline-flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-700">
                Manage connections
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </a>
            <span class="hidden sm:inline">•</span>
            <span>Progress updates feed Journey Hub automatically.</span>
        </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2" wire:loading.class="opacity-75">
        @forelse ($posts as $post)
            <article class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-semibold">
                        {{ Str::of($post['profile'] ?? 'WR')->substr(0, 2)->upper() }}
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-slate-900">{{ $post['profile'] ?? 'WomenRise Member' }}</p>
                        <p class="text-xs text-slate-500">{{ $post['published_at'] ?? 'moments ago' }}</p>
                    </div>
                </div>

                <div class="space-y-2">
                    @if (!empty($post['caption']))
                        <p class="text-sm font-semibold text-slate-800">{{ $post['caption'] }}</p>
                    @endif
                    @if (!empty($post['content']))
                        <p class="text-sm text-slate-600 leading-relaxed">{{ $post['content'] }}</p>
                    @endif
                </div>

                <div class="flex items-center gap-5 text-xs text-slate-500">
                    <span class="flex items-center gap-1">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l7.5 7.5 7.5-7.5a4.5 4.5 0 10-6.364-6.364L12 7.5l-1.636-1.636A4.5 4.5 0 103.136 12.75z" />
                        </svg>
                        {{ $post['likes'] }} likes
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h6m1 8l-4-4H6a3 3 0 01-3-3V7a3 3 0 013-3h12a3 3 0 013 3v6a3 3 0 01-3 3h-2z" />
                        </svg>
                        {{ $post['comments'] }} replies
                    </span>
                    <a href="{{ $post['url'] }}" class="ml-auto text-pink-600 font-semibold hover:text-pink-700">See thread →</a>
                </div>
            </article>
        @empty
            <div class="md:col-span-2">
                <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                    <p class="font-semibold text-slate-700">No conversations yet</p>
                    <p class="text-sm">Switch topics or check back in a moment.</p>
                </div>
            </div>
        @endforelse
    </div>

    <div wire:loading class="grid gap-4 md:grid-cols-2" aria-live="polite">
        @for ($i = 0; $i < 4; $i++)
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse space-y-4">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-full bg-slate-100"></div>
                    <div class="space-y-2 flex-1">
                        <div class="h-3 bg-slate-200 rounded"></div>
                        <div class="h-2 bg-slate-100 rounded w-1/2"></div>
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="h-3 bg-slate-100 rounded w-3/4"></div>
                    <div class="h-3 bg-slate-100 rounded"></div>
                    <div class="h-3 bg-slate-100 rounded w-5/6"></div>
                </div>
                <div class="flex gap-4">
                    <div class="h-2 bg-slate-100 rounded w-16"></div>
                    <div class="h-2 bg-slate-100 rounded w-12"></div>
                </div>
            </div>
        @endfor
    </div>
</div>
