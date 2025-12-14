@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">My Pathways</h1>
        <a href="{{ route('member.pathways.create') }}" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            + Create New Pathway
        </a>
    </div>

    @if($pathways->isEmpty())
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <p class="text-gray-600 dark:text-gray-300 mb-4">You don't have any active pathways yet.</p>
            <p class="text-sm text-gray-500">Start your journey by creating a new pathway.</p>
        </div>
    @else
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @foreach($pathways as $item)
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <div class="p-6">
                        <div class="flex justify-between items-start mb-4">
                            <h2 class="text-xl font-semibold text-gray-800 dark:text-white">
                                {{ $item['pathway']->goal_title }}
                            </h2>
                            <span class="px-2 py-1 text-xs rounded-full
                                {{ $item['pathway']->status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' }}">
                                {{ ucfirst($item['pathway']->status) }}
                            </span>
                        </div>

                        <div class="mb-4">
                            <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                                <span>Progress</span>
                                <span>{{ $item['progress_percentage'] }}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                <div class="bg-blue-600 h-2.5 rounded-full" style="width: {{ $item['progress_percentage'] }}%"></div>
                            </div>
                        </div>

                        @if($item['next_actions']->isNotEmpty())
                            <div class="mt-4">
                                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Next Actions:</h3>
                                <ul class="space-y-2">
                                    @foreach($item['next_actions'] as $action)
                                        <li class="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <input type="checkbox" class="mr-2 rounded text-blue-600 focus:ring-blue-500">
                                            {{ $action->title }}
                                        </li>
                                    @endforeach
                                </ul>
                            </div>
                        @endif
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-700 px-6 py-3">
                        <a href="{{ route('member.pathways.show', $item['pathway']) }}" class="text-blue-600 hover:text-blue-800 text-sm font-medium">View Details &rarr;</a>
                    </div>
                </div>
            @endforeach
        </div>
    @endif
</div>
@endsection
