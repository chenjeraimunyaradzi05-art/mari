@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <div class="mb-6">
        <a href="{{ route('member.pathways.index') }}" class="text-blue-600 hover:text-blue-800 mb-4 inline-block">&larr; Back to Pathways</a>

        <div class="flex justify-between items-start">
            <div>
                <h1 class="text-3xl font-bold text-gray-800 dark:text-white mb-2">{{ $pathway->goal_title }}</h1>
                <p class="text-gray-600 dark:text-gray-300">{{ $pathway->goal_description }}</p>
            </div>
            <div class="flex flex-col items-end">
                <span class="px-3 py-1 rounded-full text-sm font-medium mb-2
                    {{ $pathway->status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' }}">
                    {{ ucfirst($pathway->status) }}
                </span>
                <span class="text-sm text-gray-500">Started {{ $pathway->created_at->format('M d, Y') }}</span>
            </div>
        </div>
    </div>

    <!-- Progress Overview -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <div class="flex justify-between items-center mb-2">
            <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Overall Progress</h2>
            <span class="text-2xl font-bold text-blue-600">{{ $progress }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
            <div class="bg-blue-600 h-4 rounded-full transition-all duration-500" style="width: {{ $progress }}%"></div>
        </div>
    </div>

    <!-- Phases -->
    <div class="space-y-8">
        @foreach($pathway->phases as $phase)
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border-l-4
                {{ $phase->readiness_state === 'completed' ? 'border-green-500' : ($phase->readiness_state === 'active' ? 'border-blue-500' : 'border-gray-300') }}">

                <div class="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800 dark:text-white">
                                Phase {{ $phase->sequence }}: {{ $phase->title }}
                            </h3>
                            @if($phase->description)
                                <p class="text-gray-600 dark:text-gray-400 mt-1">{{ $phase->description }}</p>
                            @endif
                        </div>
                        <span class="px-3 py-1 rounded text-xs font-medium uppercase tracking-wider
                            {{ $phase->readiness_state === 'completed' ? 'bg-green-100 text-green-800' : ($phase->readiness_state === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600') }}">
                            {{ $phase->readiness_state }}
                        </span>
                    </div>
                </div>

                <div class="p-6">
                    <h4 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Milestones</h4>
                    <div class="space-y-4">
                        @foreach($phase->milestones as $milestone)
                            <div class="flex items-start p-4 rounded-lg border {{ $milestone->status === 'completed' ? 'bg-green-50 border-green-100' : 'bg-white border-gray-200' }}">
                                <div class="flex-shrink-0 mt-1">
                                    @if($milestone->status === 'completed')
                                        <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    @else
                                        <div class="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                                    @endif
                                </div>
                                <div class="ml-4 flex-grow">
                                    <div class="flex justify-between">
                                        <h5 class="text-md font-medium text-gray-900 dark:text-white {{ $milestone->status === 'completed' ? 'line-through text-gray-500' : '' }}">
                                            {{ $milestone->title }}
                                        </h5>
                                        @if($milestone->due_on)
                                            <span class="text-xs text-gray-500">Due {{ $milestone->due_on->format('M d') }}</span>
                                        @endif
                                    </div>
                                    @if($milestone->description)
                                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ $milestone->description }}</p>
                                    @endif

                                    @if($milestone->status !== 'completed' && $phase->readiness_state === 'active')
                                        <div class="mt-3">
                                            <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                                Mark as Complete
                                            </button>
                                        </div>
                                    @endif
                                </div>
                            </div>
                        @endforeach
                    </div>
                </div>
            </div>
        @endforeach
    </div>
</div>
@endsection
