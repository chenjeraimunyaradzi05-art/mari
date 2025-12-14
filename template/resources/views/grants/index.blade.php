@extends('frontend.layouts.master')

@section('title', 'Funding Navigator')

@push('styles')
<style>
    .grants-header {
        background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
    }
</style>
@endpush

@section('content')
@php
    $activeFilters = $activeFilters ?? [
        'type' => null,
        'provider' => null,
        'industry' => null,
        'state' => null,
        'q' => null,
        'women_only' => false,
        'closing_soon' => false,
    ];
    $savedPresets = $savedPresets ?? collect();
    $activePresetId = $activePresetId ?? null;
    $userApplications = $userApplications ?? collect();
    $presetQuery = fn ($presetId) => array_merge(request()->except(['page']), ['preset' => $presetId]);
@endphp

<div class="min-h-screen bg-gray-50 pb-12">
    <!-- Header -->
    <div class="grants-header pt-24 pb-12 px-4 sm:px-6 lg:px-8 border-b border-teal-100">
        <div class="max-w-7xl mx-auto">
            <div class="flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                    <p class="text-teal-600 font-bold uppercase tracking-wider text-sm mb-2">Welcome to Athena</p>
                    <h1 class="text-4xl font-bold text-gray-900 mb-2">Good morning, {{ auth()->user()->name ?? 'Guest' }}.</h1>
                    <p class="text-xl text-gray-600">Let’s build something powerful today.</p>
                    <p class="text-sm text-gray-500 mt-4 italic">Crafted with dignity, respect, and love for every woman who joins Athena.</p>
                </div>
            </div>
        </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <!-- Sidebar Filters -->
            <aside class="lg:col-span-1 space-y-6">
                <div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">Search</h2>
                    <form method="GET" action="{{ route('grants.index') }}" class="space-y-4">
                        <!-- Search Input -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                            <input type="text" name="q" value="{{ $activeFilters['q'] ?? '' }}" placeholder="Search grants, providers" class="w-full rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500 text-sm">
                        </div>

                        <!-- Grant Type -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Grant Type</label>
                            <select name="type" class="w-full rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500 text-sm">
                                <option value="">All categories</option>
                                @foreach($filters['types'] as $type)
                                    <option value="{{ $type }}" @selected(($activeFilters['type'] ?? '') == $type)>{{ $type }}</option>
                                @endforeach
                            </select>
                        </div>

                        <!-- Provider -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                            <select name="provider" class="w-full rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500 text-sm">
                                <option value="">Any provider</option>
                                @foreach($filters['providers'] as $provider)
                                    <option value="{{ $provider }}" @selected(($activeFilters['provider'] ?? '') == $provider)>{{ $provider }}</option>
                                @endforeach
                            </select>
                        </div>

                        <!-- State -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">State / Territory</label>
                            <select name="state" class="w-full rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500 text-sm">
                                <option value="">Anywhere</option>
                                @foreach($filters['states'] as $state)
                                    <option value="{{ $state }}" @selected(($activeFilters['state'] ?? '') == $state)>{{ $state }}</option>
                                @endforeach
                            </select>
                        </div>

                        <!-- Industry -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                            <select name="industry" class="w-full rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500 text-sm">
                                <option value="">Any industry</option>
                                @foreach($filters['industries'] as $industry)
                                    <option value="{{ $industry }}" @selected(($activeFilters['industry'] ?? '') == $industry)>{{ $industry }}</option>
                                @endforeach
                            </select>
                        </div>

                        <!-- Toggles -->
                        <div class="space-y-3 pt-2">
                            <label class="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="women_only" value="1" class="rounded text-teal-600 focus:ring-teal-500" @checked($activeFilters['women_only'] ?? false)>
                                <span class="text-sm text-gray-700">Women-only grants</span>
                            </label>
                            <label class="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="closing_soon" value="1" class="rounded text-teal-600 focus:ring-teal-500" @checked($activeFilters['closing_soon'] ?? false)>
                                <span class="text-sm text-gray-700">Show closing soon</span>
                            </label>
                        </div>

                        <button type="submit" class="w-full py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-sm hover:bg-teal-700 transition-colors">
                            Apply Filters
                        </button>
                        @if(collect($activeFilters)->filter()->isNotEmpty())
                            <a href="{{ route('grants.index') }}" class="block w-full py-2.5 text-center text-gray-600 font-bold text-sm hover:text-gray-800">Reset</a>
                        @endif
                    </form>
                </div>

                <!-- Save Preset -->
                @auth
                <div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">Save as preset</h2>
                    <form method="POST" action="{{ route('grants.presets.store') }}" class="space-y-4">
                        @csrf
                        @foreach($activeFilters as $key => $value)
                            @if(is_bool($value))
                                <input type="hidden" name="filters[{{ $key }}]" value="{{ $value ? 1 : 0 }}">
                            @else
                                <input type="hidden" name="filters[{{ $key }}]" value="{{ $value }}">
                            @endif
                        @endforeach

                        <div>
                            <input type="text" name="name" placeholder="e.g. Climate grants" required class="w-full rounded-xl border-gray-200 focus:border-teal-500 focus:ring-teal-500 text-sm">
                        </div>

                        <div class="space-y-3">
                            <label class="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" name="notify_in_app" value="1" checked class="mt-1 rounded text-teal-600 focus:ring-teal-500">
                                <div>
                                    <span class="block text-sm font-medium text-gray-900">In-app alerts</span>
                                    <span class="block text-xs text-gray-500">Ping me in Athena when new matches appear</span>
                                </div>
                            </label>
                            <label class="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" name="notify_email" value="1" class="mt-1 rounded text-teal-600 focus:ring-teal-500">
                                <div>
                                    <span class="block text-sm font-medium text-gray-900">Email digests</span>
                                    <span class="block text-xs text-gray-500">Include this preset in quiet email roundups</span>
                                </div>
                            </label>
                        </div>

                        <button type="submit" class="w-full py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors">
                            Save preset
                        </button>
                    </form>
                </div>
                @endauth
            </aside>

            <!-- Main Content -->
            <div class="lg:col-span-3 space-y-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <p class="text-teal-600 font-bold uppercase tracking-wider text-xs mb-1">Funding Navigator</p>
                        <h2 class="text-2xl font-bold text-gray-900">Discover Grants, Rebates & Incentives</h2>
                        <p class="text-gray-600">{{ $metrics['active_count'] }} opportunities curated for women-led initiatives.</p>
                    </div>
                    <div class="flex gap-3">
                        <span class="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm font-medium border border-teal-100">Updated {{ now()->format('M d') }}</span>
                        <span class="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-sm font-medium border border-gray-200">{{ $metrics['closing_soon'] }} closing soon</span>
                    </div>
                </div>

                <!-- Results List -->
                <div class="space-y-4">
                    @forelse($grants as $grant)
                        @php($application = $userApplications->get($grant->id))
                        <div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:border-teal-200 transition-colors">
                            <div class="flex flex-col md:flex-row justify-between gap-4 mb-4">
                                <div>
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-bold uppercase">{{ $grant->provider_type }}</span>
                                        @if($grant->location_restriction)
                                            <span class="text-xs text-gray-500">📍 {{ $grant->location_restriction }}</span>
                                        @else
                                            <span class="text-xs text-gray-500">🌏 National</span>
                                        @endif
                                    </div>
                                    <h3 class="text-xl font-bold text-gray-900 mb-1">{{ $grant->name }}</h3>
                                    <p class="text-sm text-gray-500">{{ $grant->provider_name }}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide">Funding up to</p>
                                    <p class="text-2xl font-bold text-teal-600">{{ money_format($grant->max_amount ?? 0) }}</p>
                                    <p class="text-xs text-rose-600 font-medium mt-1">Closes {{ optional($grant->closes_at)->format('M d') ?? 'TBA' }}</p>
                                </div>
                            </div>

                            <p class="text-gray-600 text-sm mb-4 line-clamp-2">{{ $grant->description }}</p>

                            <div class="flex flex-wrap gap-2 mb-4">
                                @foreach($grant->tags ?? [] as $tag)
                                    <span class="px-2 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium">{{ $tag }}</span>
                                @endforeach
                            </div>

                            <div class="flex items-center justify-between pt-4 border-t border-gray-50">
                                <div class="flex items-center gap-4 text-sm">
                                    <div class="flex items-center gap-1">
                                        <span class="font-bold text-gray-900">Match:</span>
                                        <span class="text-teal-600 font-bold">{{ $grant->match_score }}%</span>
                                    </div>
                                    @if($application)
                                        <span class="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-bold">
                                            {{ ucfirst($application->status) }}
                                        </span>
                                    @endif
                                </div>
                                <div class="flex gap-3">
                                    <a href="{{ route('grants.show', $grant) }}" class="text-teal-600 font-bold text-sm hover:underline">View Details</a>
                                    <a href="{{ route('grants.apply', $grant) }}" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors">
                                        {{ $application ? 'Resume Application' : 'Apply Now' }}
                                    </a>
                                </div>
                            </div>
                        </div>
                    @empty
                        <div class="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                            <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <h3 class="text-lg font-bold text-gray-900 mb-1">No grants match your filters yet.</h3>
                            <p class="text-gray-500 text-sm mb-4">Try clearing a filter or broadening your search keywords.</p>
                            <a href="{{ route('grants.index') }}" class="inline-block px-6 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 font-bold text-sm hover:bg-gray-50">Clear Filters</a>
                        </div>

                        <!-- Advertising & Partnership -->
                        <div class="mt-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-sm p-6 border border-amber-100 relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full blur-2xl -mr-10 -mt-10 opacity-60"></div>
                            <div class="relative z-10">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <p class="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Brand Partnership</p>
                                        <h3 class="text-lg font-bold text-gray-900">Advertising & Promotions</h3>
                                    </div>
                                    <span class="bg-white/80 px-2 py-1 rounded-lg text-xs font-bold text-amber-600 border border-amber-100 shadow-sm">Ad</span>
                                </div>
                                <p class="text-gray-600 text-sm mb-4">Explore exclusive opportunities from our trusted partners. Connect with brands that align with your values and growth.</p>
                                <button type="button" class="w-full py-2.5 bg-white text-amber-800 text-sm font-bold rounded-xl border border-amber-200 hover:bg-amber-50 transition-all shadow-sm hover:shadow-md">
                                    View Opportunities
                                </button>
                            </div>
                        </div>
                    @endforelse
                </div>

                <!-- Pagination -->
                <div class="mt-6">
                    {{ $grants->links() }}
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
