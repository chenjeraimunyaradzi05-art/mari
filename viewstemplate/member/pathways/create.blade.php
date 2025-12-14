@extends('layouts.app')

@section('content')
<div class="container mx-auto px-4 py-8" x-data="{
    selectedTemplate: null,
    customGoal: '',
    selectTemplate(id) {
        this.selectedTemplate = id;
        this.customGoal = '';
    },
    focusGoal() {
        this.selectedTemplate = null;
    }
}">
    <div class="max-w-2xl mx-auto">
        <div class="mb-6">
            <a href="{{ route('member.pathways.index') }}" class="text-blue-600 hover:text-blue-800 mb-4 inline-block">&larr; Back to Pathways</a>
            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">Create New Pathway</h1>
            <p class="text-gray-600 dark:text-gray-300 mt-2">Choose a template or describe your own goal.</p>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            @if ($errors->any())
                <div class="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                    <p class="font-bold">Please fix the following errors:</p>
                    <ul class="list-disc list-inside">
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <form action="{{ route('member.pathways.store') }}" method="POST">
                @csrf

                <!-- Option 1: Select Template -->
                <div class="mb-8">
                    <h2 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">Option 1: Choose a Template</h2>
                    <div class="grid grid-cols-1 gap-4">
                        @foreach($templates as $template)
                            <label class="relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors"
                                :class="selectedTemplate == {{ $template->id }} ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'">
                                <div class="flex items-center h-5">
                                    <input type="radio" name="template_id" value="{{ $template->id }}"
                                        @click="selectTemplate({{ $template->id }})"
                                        :checked="selectedTemplate == {{ $template->id }}"
                                        class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300">
                                </div>
                                <div class="ml-3 text-sm">
                                    <span class="block font-medium text-gray-900 dark:text-white">{{ $template->template_name }}</span>
                                    <span class="block text-gray-500 dark:text-gray-400">{{ $template->description }}</span>
                                </div>
                            </label>
                        @endforeach
                    </div>
                </div>

                <div class="relative flex py-5 items-center">
                    <div class="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                    <span class="flex-shrink-0 mx-4 text-gray-400">OR</span>
                    <div class="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                </div>

                <!-- Option 2: Custom Goal -->
                <div class="mb-8">
                    <h2 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">Option 2: Describe Your Goal</h2>
                    <div class="space-y-4">
                        <div>
                            <label for="goal" class="block text-sm font-medium text-gray-700 dark:text-gray-300">What do you want to achieve?</label>
                            <input type="text" name="goal" id="goal"
                                x-model="customGoal"
                                @focus="focusGoal()"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="e.g., Start a small business, Buy my first home">
                        </div>
                        <p class="text-sm text-gray-500">We'll use AI to generate a custom pathway for you.</p>
                    </div>
                </div>

                <div class="flex justify-end">
                    <button type="submit"
                        :disabled="!selectedTemplate && !customGoal"
                        :class="(!selectedTemplate && !customGoal) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'"
                        class="bg-blue-600 text-white px-6 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all">
                        Create Pathway
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
@endsection
