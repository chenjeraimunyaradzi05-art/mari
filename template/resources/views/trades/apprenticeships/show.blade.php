@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8">
    <div class="bg-white shadow rounded-lg overflow-hidden">
        <div class="p-6 md:p-8">
            <div class="flex justify-between items-start">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">{{ $program->title }}</h1>
                    <p class="text-lg text-gray-600 mt-2">{{ $program->provider_name }}</p>
                </div>
                <form action="{{ route('trades.apprenticeships.apply', $program) }}" method="POST">
                    @csrf
                    <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium">
                        Apply Now
                    </button>
                </form>
            </div>

            <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-2">
                    <h2 class="text-xl font-semibold mb-4">Program Description</h2>
                    <div class="prose max-w-none text-gray-700">
                        {{ $program->description }}
                    </div>

                    <h2 class="text-xl font-semibold mt-8 mb-4">Competencies & Progress</h2>
                    <div class="space-y-4">
                        @foreach($program->competencies as $competency)
                            @php
                                $record = $program->progressRecords->where('apprenticeship_competency_id', $competency->id)->first();
                                $status = $record ? $record->status : 'not_started';
                                $statusColors = [
                                    'not_started' => 'bg-gray-100 text-gray-800',
                                    'in_progress' => 'bg-yellow-100 text-yellow-800',
                                    'completed' => 'bg-green-100 text-green-800',
                                ];
                            @endphp
                            <div class="border rounded-lg p-4">
                                <div class="flex justify-between items-center">
                                    <h3 class="font-medium text-gray-900">{{ $competency->title }}</h3>
                                    <span class="px-2 py-1 rounded-full text-xs font-medium {{ $statusColors[$status] }}">
                                        {{ ucfirst(str_replace('_', ' ', $status)) }}
                                    </span>
                                </div>
                                <p class="text-sm text-gray-600 mt-1">{{ $competency->description }}</p>

                                <!-- Update Progress Form -->
                                <form action="{{ route('trades.apprenticeships.update-progress', $program) }}" method="POST" class="mt-4 flex items-center space-x-4">
                                    @csrf
                                    @method('PUT')
                                    <input type="hidden" name="competency_id" value="{{ $competency->id }}">

                                    <select name="status" class="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
                                        <option value="not_started" {{ $status == 'not_started' ? 'selected' : '' }}>Not Started</option>
                                        <option value="in_progress" {{ $status == 'in_progress' ? 'selected' : '' }}>In Progress</option>
                                        <option value="completed" {{ $status == 'completed' ? 'selected' : '' }}>Completed</option>
                                    </select>

                                    <input type="text" name="notes" placeholder="Add notes..." value="{{ $record ? $record->coach_notes : '' }}" class="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">

                                    <button type="submit" class="text-sm text-indigo-600 hover:text-indigo-900 font-medium">Update</button>
                                </form>
                            </div>
                        @endforeach
                    </div>
                </div>

                <div class="md:col-span-1 space-y-6">
                    <div class="bg-gray-50 p-6 rounded-lg">
                        <h3 class="font-semibold text-gray-900 mb-4">Program Details</h3>
                        <dl class="space-y-3 text-sm">
                            <div class="flex justify-between">
                                <dt class="text-gray-500">Duration</dt>
                                <dd class="font-medium text-gray-900">{{ $program->duration_months }} Months</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-gray-500">Level</dt>
                                <dd class="font-medium text-gray-900">{{ $program->level ?? 'N/A' }}</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-gray-500">Location</dt>
                                <dd class="font-medium text-gray-900">{{ $program->location ?? 'Various' }}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
