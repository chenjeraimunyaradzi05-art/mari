@php
    use Illuminate\Support\Str;

    $pageTitle = $targetUser->id === $viewer->id ? 'My Purpose & Access' : 'Member Purpose Review';
@endphp

<x-app-layout>
    <x-slot name="title">{{ $pageTitle }}</x-slot>

    <div class="max-w-5xl mx-auto px-4 py-10">
        <div class="flex items-center justify-between mb-8">
            <div>
                <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ $pageTitle }}</h1>
                <p class="text-sm text-gray-500">
                    Review or adjust the member's primary purpose, intents, and alignment.
                </p>
            </div>

            @if ($canReviewOthers)
                <form method="GET" action="{{ route('account.purpose.edit') }}" class="flex items-center gap-2">
                    <input type="text"
                        name="user_id"
                        value="{{ request('user_id') }}"
                        placeholder="Lookup user id or email"
                        class="rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 text-sm">
                    <button class="btn btn-secondary text-sm">Lookup</button>
                </form>
            @endif
        </div>

        @if (session('success'))
            <div class="mb-6 rounded-md bg-green-50 border border-green-200 text-green-800 px-4 py-3">
                {{ session('success') }}
            </div>
        @endif

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div class="lg:col-span-2 space-y-8">
                <x-panel>
                    <form method="POST" action="{{ route('account.purpose.update') }}" class="space-y-6">
                        @csrf
                        @method('PUT')

                        @if ($viewer->id !== $targetUser->id)
                            <input type="hidden" name="target_user_id" value="{{ $targetUser->id }}">
                        @endif

                        <div>
                            <x-input-label value="Primary Purpose" />
                            <div class="mt-3 grid gap-4 md:grid-cols-2">
                                @foreach ($purposeOptions as $key => $option)
                                    <label class="border rounded-lg p-4 cursor-pointer flex gap-3 {{ old('primary_purpose', optional($record)->primary_purpose ?? '') === $key ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200' }}">
                                        <input type="radio" name="primary_purpose" value="{{ $key }}" class="mt-1" @checked(old('primary_purpose', optional($record)->primary_purpose ?? '') === $key)>
                                        <div>
                                            <div class="font-semibold text-gray-900 dark:text-gray-100">{{ $option['title'] }}</div>
                                            <p class="text-sm text-gray-500">{{ $option['summary'] ?? '' }}</p>
                                        </div>
                                    </label>
                                @endforeach
                            </div>
                            <x-input-error :messages="$errors->get('primary_purpose')" />
                        </div>

                        <div>
                            <x-input-label value="Secondary Intents" />
                            <p class="text-sm text-gray-500">Select every intent that applies.</p>
                            <div class="mt-3 grid gap-3 md:grid-cols-2">
                                @foreach ($intentOptions as $key => $option)
                                    <label class="border rounded-lg p-3 flex gap-3 {{ in_array($key, old('secondary_intents', optional($record)->secondary_intents ?? [])) ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200' }}">
                                        <input type="checkbox" name="secondary_intents[]" value="{{ $key }}" class="mt-1" @checked(in_array($key, old('secondary_intents', optional($record)->secondary_intents ?? [])))>
                                        <div>
                                            <div class="font-medium text-gray-900 dark:text-gray-100">{{ $option['title'] }}</div>
                                            <p class="text-sm text-gray-500">{{ $option['summary'] ?? '' }}</p>
                                        </div>
                                    </label>
                                @endforeach
                            </div>
                            <x-input-error :messages="$errors->get('secondary_intents')" />
                        </div>

                        <div>
                            <x-input-label value="Identity Alignment" />
                            <select class="mt-2 rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900" name="identity_alignment">
                                <option value="">Select alignment</option>
                                @foreach ($identityOptions as $key => $label)
                                    <option value="{{ $key }}" @selected(old('identity_alignment', optional($record)->identity_alignment ?? '') === $key)>{{ $label }}</option>
                                @endforeach
                            </select>
                            <x-input-error :messages="$errors->get('identity_alignment')" />
                        </div>

                        <div>
                            <x-input-label value="Purpose Story" />
                            <textarea name="purpose_story" rows="3" class="mt-2 w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900" placeholder="Capture nuance, context, or commitments.">{{ old('purpose_story', optional($record)->purpose_story ?? '') }}</textarea>
                            <x-input-error :messages="$errors->get('purpose_story')" />
                        </div>

                        <div>
                            <x-input-label value="Guardian Notes" />
                            <textarea name="male_signal_notes" rows="3" class="mt-2 w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900" placeholder="Optional guardian notes.">{{ old('male_signal_notes', optional($record)->male_signal_notes ?? '') }}</textarea>
                            <x-input-error :messages="$errors->get('male_signal_notes')" />
                        </div>

                        <div class="flex justify-end">
                            <x-primary-button>Save purpose</x-primary-button>
                        </div>
                    </form>
                </x-panel>
            </div>

            <div class="space-y-6">
                <x-panel>
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-lg font-semibold">Member Snapshot</h2>
                            <p class="text-sm text-gray-500">Latest completion metadata.</p>
                        </div>
                    </div>

                    <dl class="space-y-3 text-sm">
                        <div class="flex justify-between">
                            <dt class="text-gray-500">Member</dt>
                            <dd class="font-medium">{{ $targetUser->name }} ({{ $targetUser->email }})</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-gray-500">Primary purpose</dt>
                            <dd class="font-medium">{{ $purposeOptions[optional($record)->primary_purpose]['title'] ?? '—' }}</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-gray-500">Last updated</dt>
                            <dd class="font-medium">{{ optional(optional($record)->updated_at)->diffForHumans() ?? 'Never' }}</dd>
                        </div>
                        <div>
                            <dt class="text-gray-500">Feature flags</dt>
                            <dd class="mt-1">
                                @forelse (optional($record)->feature_flags ?? [] as $flag)
                                    <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 mr-1">{{ $flag }}</span>
                                @empty
                                    <span class="text-gray-400">None</span>
                                @endforelse
                            </dd>
                        </div>
                    </dl>
                </x-panel>

                <x-panel>
                    <h2 class="text-lg font-semibold mb-3">Telemetry</h2>
                    <ul class="divide-y divide-gray-100">
                        @forelse ($events as $event)
                            <li class="py-3">
                                <div class="text-sm font-medium">{{ Str::of($event->action)->replace('_', ' ')->title() }}</div>
                                <div class="text-xs text-gray-500">{{ $event->occurred_at?->diffForHumans() ?? $event->created_at->diffForHumans() }}</div>
                                @if ($event->payload)
                                    <pre class="mt-2 bg-gray-900/90 text-gray-100 text-xs rounded p-2 overflow-x-auto">{{ json_encode($event->payload, JSON_PRETTY_PRINT) }}</pre>
                                @endif
                            </li>
                        @empty
                            <li class="py-3 text-sm text-gray-500">No recent events.</li>
                        @endforelse
                    </ul>
                </x-panel>
            </div>
        </div>
    </div>
</x-app-layout>
