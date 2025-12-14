@extends('layouts.app')

@section('title', $grant->name)

@section('content')
@php($application = $application ?? null)
<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div class="bg-gradient-to-r from-teal-500 to-emerald-500 px-8 py-6 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <p class="text-xs uppercase tracking-widest font-semibold">{{ strtoupper($grant->provider_type) }}</p>
                <h1 class="text-3xl font-bold">{{ $grant->name }}</h1>
                <p class="text-white/80">{{ $grant->provider_name }} • {{ $grant->location_restriction ?? 'Australia-wide' }}</p>
            </div>
            <div class="text-right">
                <p class="text-xs text-white/70">Funding up to</p>
                <p class="text-4xl font-bold">{{ money_format($grant->max_amount ?? 0) }}</p>
                <p class="text-xs text-white/80">Closes {{ optional($grant->closes_at)->format('M d, Y') ?? 'TBA' }}</p>
            </div>
        </div>

        <div class="p-8 space-y-8">
            <section>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Purpose</h2>
                <p class="text-gray-700 dark:text-gray-300 leading-relaxed">{{ $grant->description }}</p>
            </section>

            <section>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3">Eligibility Checklist</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    @foreach($grant->eligibility_requirements ?? [] as $item)
                        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex items-start gap-3">
                            <svg class="h-5 w-5 text-{{ $item['met'] ? 'teal' : 'gray' }}-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $item['label'] }}</p>
                                <p class="text-xs text-gray-500">{{ $item['detail'] }}</p>
                            </div>
                        </div>
                    @endforeach
                </div>
            </section>

            <section>
                <h2 class="text-xl">Key Dates & Deliverables</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm text-gray-600 dark:text-gray-300">
                    <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p class="text-xs uppercase tracking-wide text-gray-500">Opens</p>
                        <p class="text-lg font-bold text-gray-900 dark:text-white">{{ optional($grant->opens_at)->format('M d, Y') ?? 'TBA' }}</p>
                    </div>
                    <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p class="text-xs uppercase tracking-wide text-gray-500">Closes</p>
                        <p class="text-lg font-bold text-gray-900 dark:text-white">{{ optional($grant->closes_at)->format('M d, Y') ?? 'TBA' }}</p>
                    </div>
                    <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p class="text-xs uppercase tracking-wide text-gray-500">Decision Date</p>
                        <p class="text-lg font-bold text-gray-900 dark:text-white">{{ optional($grant->decision_at)->format('M d, Y') ?? 'TBA' }}</p>
                    </div>
                </div>
            </section>

            <section>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3">Required Documents</h2>
                <ul class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    @foreach($grant->required_documents ?? [] as $doc)
                        <li class="flex items-start gap-2">
                            <svg class="h-4 w-4 text-teal-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8a2 2 0 002-2v-5h3l-5-5-5 5h3v5a2 2 0 002 2z" />
                            </svg>
                            <span>{{ $doc }}</span>
                        </li>
                    @endforeach
                </ul>
            </section>
        </div>
    </div>

    @if($application)
        <div class="rounded-lg border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <p class="text-sm text-teal-800 dark:text-teal-200">Athena workspace status</p>
                <p class="text-lg font-semibold text-teal-900 dark:text-white">{{ ucfirst($application->status) }} • {{ $application->progress_percent }}% complete</p>
                @if($application->ready_for_review)
                    <p class="text-sm text-teal-700 dark:text-teal-100">Marked ready for strategist review.</p>
                @endif
            </div>
            <div class="flex flex-wrap gap-3">
                <a href="{{ route('grants.apply', ['grant' => $grant]) }}" class="inline-flex items-center px-5 py-3 bg-white dark:bg-teal-950 text-teal-700 dark:text-teal-100 rounded-md font-semibold border border-teal-200 dark:border-teal-700">Resume in Athena</a>
                @if($application->status === 'submitted')
                    <span class="inline-flex items-center px-4 py-2 rounded-md bg-emerald-100 text-emerald-800 text-sm font-semibold">Submitted {{ optional($application->submitted_at)->format('M d, Y') ?? 'recently' }}</span>
                @endif
            </div>
        </div>
    @elseif(auth()->check())
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <p class="text-sm text-gray-500">No Athena draft yet</p>
                <p class="text-lg font-semibold text-gray-900 dark:text-white">Start your application to track requirements and uploads.</p>
            </div>
            <a href="{{ route('grants.apply', ['grant' => $grant]) }}" class="inline-flex items-center px-5 py-3 bg-teal-600 text-white rounded-md font-semibold">Launch workspace</a>
        </div>
    @endif

    <div class="bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <p class="text-sm text-gray-500">Ready to apply?</p>
            <p class="text-lg font-semibold text-gray-900 dark:text-white">Track your application inside Athena and stay ahead of deadlines.</p>
        </div>
        <div class="flex flex-wrap gap-3">
            <a href="{{ $grant->application_url }}" class="inline-flex items-center px-5 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-semibold text-gray-700 dark:text-gray-200" target="_blank" rel="noopener">Visit Provider Site</a>
            <a href="{{ route('grants.apply', ['grant' => $grant]) }}" class="inline-flex items-center px-5 py-3 bg-teal-600 text-white rounded-md font-semibold">Start Athena Application</a>
        </div>
    </div>
</div>
@endsection
