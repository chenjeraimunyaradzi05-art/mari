<div class="p-6 space-y-5" wire:key="verification-assistant-panel">
    <header class="flex items-start justify-between gap-3">
        <div>
            <h2 class="text-lg font-semibold text-gray-900">Need a hand?</h2>
            <p class="text-sm text-gray-500">Ask our AI assistant for guidance while you finish your verification.</p>
        </div>
    </header>

    <div class="space-y-3 rounded-lg border border-rose-100 bg-rose-50/40 p-4 max-h-72 overflow-y-auto">
        @foreach ($messages as $index => $message)
            <div class="flex flex-col gap-1">
                <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {{ $message['role'] === 'agent' ? 'You' : 'WomenRise Assistant' }}
                </span>
                <p class="text-sm leading-relaxed text-gray-800">{{ $message['content'] }}</p>
            </div>
        @endforeach
    </div>

    @if (! empty($suggestions))
        <div class="flex flex-wrap gap-2">
            @foreach ($suggestions as $suggestion)
                <button type="button" class="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" wire:click="askSuggestion(@json($suggestion))" wire:loading.attr="disabled">
                    {{ $suggestion }}
                </button>
            @endforeach
        </div>
    @endif

    <form wire:submit.prevent="send" class="space-y-3">
        <label for="assistant-prompt" class="text-xs font-semibold uppercase tracking-wide text-gray-500">Ask a question</label>
        <textarea id="assistant-prompt" rows="3" wire:model.defer="prompt" class="form-textarea w-full" placeholder="E.g. What happens after I submit?" wire:loading.attr="disabled"></textarea>
        @error('prompt')
            <p class="text-xs text-rose-600">{{ $message }}</p>
        @enderror
        <div class="flex items-center justify-between">
            <span class="text-xs text-gray-400">We keep a short history so you can revisit responses.</span>
            <button type="submit" class="inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400" wire:loading.attr="disabled">
                <svg wire:loading class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span>{{ $busy ? 'Working…' : 'Ask' }}</span>
            </button>
        </div>
    </form>
</div>
