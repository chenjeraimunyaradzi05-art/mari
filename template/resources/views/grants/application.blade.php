@extends('layouts.app')

@php
    use Illuminate\Support\Facades\Storage;
    use Illuminate\Support\Str;
@endphp

@section('title', 'Apply for '.$grant->name)

@section('content')
@php
    $documentCount = count($application->documents ?? []);
    $isSubmitted = $application->status === 'submitted';
@endphp
<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-8 space-y-6">
        <header>
            <p class="text-xs uppercase tracking-widest text-gray-500">Athena Application Workspace</p>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ $grant->name }}</h1>
            <p class="text-sm text-gray-500">Submission due {{ optional($grant->closes_at)->format('M d, Y') ?? 'TBA' }}</p>
        </header>

        <x-progress.bar :value="$application->progress_percent" label="Completion" />

        <div class="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <x-badge color="teal">Status: {{ ucfirst($application->status) }}</x-badge>
            <x-badge color="gray">Documents: {{ $documentCount }}</x-badge>
            @if($application->ready_for_review)
                <x-badge color="teal">Ready for strategist review</x-badge>
            @endif
            @if($isSubmitted && $application->submitted_at)
                <x-badge color="gray">Submitted {{ $application->submitted_at->format('M d, Y') }}</x-badge>
            @endif
        </div>

        <form action="{{ route('grants.application.update', ['application' => $application]) }}" method="POST" enctype="multipart/form-data" class="space-y-6">
            @csrf
            @method('PUT')

            <x-forms.textarea name="project_summary" label="Project Summary" rows="4" required>{{ old('project_summary', $application->project_summary) }}</x-forms.textarea>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <x-forms.input name="funding_requested" label="Funding Requested (AUD)" type="number" step="1000" min="0" required :value="old('funding_requested', $application->funding_requested ?? 0)" />
                <x-forms.select name="funding_use" label="Primary Use of Funds" :options="$fundingUses" :selected="old('funding_use', $application->funding_use)" />
            </div>

            <x-forms.textarea name="impact_statement" label="Impact Statement" rows="4" placeholder="Describe community, employment, or innovation outcomes." required>{{ old('impact_statement', $application->impact_statement) }}</x-forms.textarea>

            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">Attachments</p>
                    <p class="text-xs text-gray-500">{{ $documentCount }} {{ Str::plural('file', $documentCount) }} uploaded</p>
                </div>
                <x-forms.file name="supporting_documents" label="Upload financials, letters of support, pitch deck" multiple />
                @if(! empty($application->documents))
                    <ul class="text-sm text-gray-600 dark:text-gray-300">
                        @foreach($application->documents as $doc)
                            <li class="flex items-center gap-2">
                                <svg class="h-4 w-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                                <a href="{{ $doc['url'] ?? ($doc['path'] ?? null ? Storage::url($doc['path']) : '#') }}" class="hover:text-teal-600" target="_blank">{{ $doc['name'] }}</a>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </div>

            <div class="flex flex-wrap justify-between items-center gap-4">
                <x-forms.toggle name="ready_for_review" label="Mark as ready for strategist review" :checked="$application->ready_for_review" />
                <div class="flex gap-3">
                    <button type="submit" class="inline-flex items-center px-5 py-3 bg-teal-600 text-white rounded-md font-semibold">Save Progress</button>
                    <button name="submit_final" value="1" class="inline-flex items-center px-5 py-3 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-md font-semibold">Submit to Grant Provider</button>
                </div>
            </div>
        </form>
    </div>
</div>
@endsection
