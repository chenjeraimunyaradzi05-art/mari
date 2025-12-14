<div class="space-y-6">
    <div class="rounded-3xl border border-rose-100 bg-white/95 p-6 shadow-md">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="space-y-2">
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Persona Console</p>
                <h2 class="text-2xl font-bold text-slate-900">WomenRise persona profile</h2>
                <p class="text-sm text-slate-600">Shape how JourneyHub and the For You feed introduce you across the community.</p>
            </div>
            <div class="flex items-center gap-4">
                <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Persona</p>
                    <select wire:model="persona" class="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-rose-300 focus:ring-rose-400">
                        @foreach($personaOptions as $value => $label)
                            <option value="{{ $value }}">{{ $label }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="text-right">
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Completion</p>
                    <p class="text-3xl font-black text-rose-500">{{ $completionScore }}%</p>
                    <p class="text-xs text-slate-500">{{ $completionScore >= 80 ? 'Ready for highlights' : 'Keep sharing details' }}</p>
                </div>
            </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            <button type="button" wire:click="openStoryBuilder" class="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-rose-600 shadow-sm hover:border-rose-300">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v12m6-6H6" /></svg>
                Story Builder
            </button>
            <button type="button" wire:click="openTrustCoach" class="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-indigo-600 shadow-sm hover:border-indigo-300">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" /></svg>
                Trust Coach
            </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
            <label class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                <span>Highlight in discovery feed</span>
                <input type="checkbox" wire:model="highlightInFeed" class="h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-400">
            </label>
            <label class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                <span>AI auto-share suggestions</span>
                <input type="checkbox" wire:model="autoShareOptIn" class="h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-400">
            </label>
        </div>

        @if($readinessSignals)
            <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Readiness guidance</p>
                        <p class="text-[11px] font-semibold text-slate-600">Premium unlock at {{ $premiumThreshold }}% completion</p>
                    </div>
                    <p class="text-xs font-semibold text-slate-500">Live draft · {{ $completionScore }}% saved</p>
                </div>
                <ul class="mt-3 grid gap-3 md:grid-cols-2">
                    @foreach($readinessSignals as $signal)
                        @php($ready = (($signal['status'] ?? 'incomplete') === 'ready'))
                        <li class="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-sm font-semibold text-slate-900">{{ $signal['label'] ?? 'Readiness signal' }}</p>
                                    <p class="text-xs text-slate-500">{{ $signal['description'] ?? '' }}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-xl font-black {{ $ready ? 'text-emerald-600' : 'text-rose-500' }}">{{ $signal['percent'] ?? 0 }}%</p>
                                    <p class="text-[10px] font-semibold uppercase tracking-[0.2em] {{ $ready ? 'text-emerald-600' : 'text-rose-500' }}">
                                        {{ $ready ? 'Ready' : 'Needs detail' }}
                                    </p>
                                </div>
                            </div>
                        </li>
                    @endforeach
                </ul>
            </div>
        @endif

        @if($message)
            <div class="mt-4 rounded-2xl border {{ $status === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700' }} px-4 py-3 text-sm">
                {{ $message }}
            </div>
        @endif

        @if($sectionProgress)
            <div class="mt-6 grid gap-3 md:grid-cols-3">
                @foreach($sectionProgress as $section => $progress)
                    <div class="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{{ str($section)->headline() }}</p>
                        <div class="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                            <span>{{ $progress['complete'] }} / {{ $progress['total'] }} fields</span>
                            <span class="text-sm {{ $progress['percent'] >= 80 ? 'text-emerald-600' : 'text-rose-500' }}">{{ $progress['percent'] }}%</span>
                        </div>
                        <div class="mt-3 h-2 w-full rounded-full bg-white">
                            <div class="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400" style="width: {{ $progress['percent'] }}%"></div>
                        </div>
                    </div>
                @endforeach
            </div>
        @endif

        @if($trustCoachChecklist)
            <div class="mt-4 rounded-2xl border border-indigo-100 bg-white/70 p-4">
                <div class="flex items-center justify-between">
                    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Trust Coach Focus</p>
                    <button type="button" wire:click="openTrustCoach" class="text-xs font-semibold text-indigo-600">Open Coach →</button>
                </div>
                <ul class="mt-3 space-y-2 text-sm">
                    @foreach($trustCoachChecklist as $index => $tip)
                        <li class="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-2">
                            <span class="text-slate-700">{{ $tip['label'] }}</span>
                            <button type="button" wire:click="toggleChecklistItem({{ $index }})" class="text-xs font-semibold {{ $tip['status'] === 'done' ? 'text-emerald-600' : 'text-rose-600' }}">
                                {{ $tip['status'] === 'done' ? 'Marked' : 'Mark done' }}
                            </button>
                        </li>
                    @endforeach
                </ul>
            </div>
        @endif

        @if(count($personaCoachTips))
            <div class="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">Persona Coach Nudges</p>
                        <p class="text-[11px] font-semibold text-amber-800">
                            {{ $personaCoachFromAi ? 'Athena AI via ' . str($personaCoachProvider ?? 'WomenRise')->headline() : 'WomenRise playbook guidance' }}
                        </p>
                    </div>
                    <button
                        type="button"
                        wire:click="refreshPersonaCoachTips"
                        wire:loading.attr="disabled"
                        wire:target="refreshPersonaCoachTips"
                        class="text-xs font-semibold text-amber-700"
                    >
                        <span wire:loading.remove wire:target="refreshPersonaCoachTips">Refresh tips →</span>
                        <span wire:loading wire:target="refreshPersonaCoachTips">Updating...</span>
                    </button>
                </div>
                <ul class="mt-3 space-y-3 text-sm">
                    @foreach($personaCoachTips as $tip)
                        <li class="rounded-2xl border border-amber-100 bg-white/80 px-4 py-3">
                            <p class="font-semibold text-slate-900">{{ $tip['title'] ?? 'Coach tip' }}</p>
                            <p class="mt-1 text-slate-600">{{ $tip['body'] ?? '' }}</p>
                            @if(!empty($tip['cta']))
                                <p class="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">{{ $tip['cta'] }}</p>
                            @endif
                        </li>
                    @endforeach
                </ul>
            </div>
        @endif
    </div>

    @foreach($schema as $sectionKey => $section)
        <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">{{ $section['label'] }}</p>
                    <p class="text-sm text-slate-500">Tailor what {{ $section['label'] === 'Identity & Story' ? 'introduces' : 'supports' }} your story.</p>
                </div>
                <button
                    type="button"
                    wire:click="saveSection('{{ $sectionKey }}')"
                    wire:loading.attr="disabled"
                    class="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white shadow-md focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-60"
                >
                    <span wire:loading.remove wire:target="saveSection('{{ $sectionKey }}')">Save {{ $section['label'] }}</span>
                    <span wire:loading wire:target="saveSection('{{ $sectionKey }}')">Saving...</span>
                </button>
            </div>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
                @foreach($section['fields'] as $fieldKey => $field)
                    <div class="space-y-2">
                        <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            <span>{{ str($fieldKey)->headline() }}</span>
                            <select wire:model="form.{{ $sectionKey }}.{{ $fieldKey }}.visibility" class="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                                <option value="private">Private</option>
                                <option value="network">Network</option>
                                <option value="public">Public</option>
                            </select>
                        </div>

                        @php($modelKey = "form.{$sectionKey}.{$fieldKey}.value")

                        @switch($field['type'])
                            @case('select')
                                <select wire:model="{{ $modelKey }}" class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-300 focus:ring-rose-400">
                                    <option value="">Select an option</option>
                                    @foreach($field['options'] as $option)
                                        <option value="{{ $option }}">{{ str($option)->headline() }}</option>
                                    @endforeach
                                </select>
                                @break

                            @case('multiselect')
                                <div class="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
                                    <div class="flex flex-wrap gap-2">
                                        @foreach($field['options'] as $option)
                                            <label class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                                                <input type="checkbox" value="{{ $option }}" wire:model="{{ $modelKey }}" class="h-3 w-3 rounded border-slate-300 text-rose-500 focus:ring-rose-400">
                                                {{ str($option)->headline() }}
                                            </label>
                                        @endforeach
                                    </div>
                                </div>
                                @break

                            @case('number')
                                <input type="number" wire:model="{{ $modelKey }}" placeholder="{{ $field['placeholder'] ?? '' }}" class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-300 focus:ring-rose-400" />
                                @break

                            @case('textarea')
                                <textarea wire:model="{{ $modelKey }}" rows="3" placeholder="{{ $field['placeholder'] ?? '' }}" class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-300 focus:ring-rose-400"></textarea>
                                @break

                            @default
                                <input type="text" wire:model="{{ $modelKey }}" placeholder="{{ $field['placeholder'] ?? '' }}" class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-300 focus:ring-rose-400" />
                        @endswitch
                    </div>
                @endforeach
            </div>
        </div>
    @endforeach

    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Featured media</p>
                <p class="text-sm text-slate-500">Point your persona card at a photo or video from your media locker.</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
                <button type="button" wire:click="toggleMediaDrawer" class="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                    {{ $mediaDrawerVisible ? 'Hide media locker' : 'Open media locker' }}
                </button>
                <button type="button" wire:click="saveSection" wire:loading.attr="disabled" class="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-70">
                    <span wire:loading.remove wire:target="saveSection">Save Persona Profile</span>
                    <span wire:loading wire:target="saveSection">Saving...</span>
                </button>
            </div>
        </div>

        <div class="mt-4">
            <select wire:model="featuredMediaId" class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-300 focus:ring-rose-400">
                <option value="">Select featured asset</option>
                @foreach($mediaOptions as $media)
                    <option value="{{ $media['id'] }}">
                        {{ ucfirst($media['media_type']) }} — {{ $media['caption'] ?: 'Untitled asset #'.$media['id'] }}
                    </option>
                @endforeach
            </select>
        </div>

        @if($mediaDrawerVisible)
            <div class="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 p-4">
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">Upload new media</p>
                <p class="text-sm text-slate-600">Add a new clip or gallery item without leaving the wizard.</p>
                <div class="mt-4">
                    <livewire:women-real-estate.onboarding.user-media-library :key="'persona-wizard-media-' . $persona" />
                </div>
            </div>
        @endif
    </div>
</div>

@if($showStoryBuilder)
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4">
        <div class="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">Story Builder</p>
                    <h3 class="text-xl font-semibold text-slate-900">Craft a narrative for your profile</h3>
                </div>
                <button type="button" wire:click="closeStoryBuilder" class="text-slate-500">✕</button>
            </div>
            <div class="mt-4 space-y-4">
                <textarea wire:model.defer="storyBuilderPrompt" rows="5" class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-300 focus:ring-rose-400" placeholder="Share raw notes or bullet points for your story..."></textarea>
                <div class="flex items-center gap-3 text-sm">
                    <button type="button" wire:click="generateStoryBuilderSuggestion" class="rounded-full bg-gradient-to-r from-rose-500 to-amber-400 px-5 py-2 font-semibold text-white shadow">Generate summary</button>
                    <p class="text-slate-500">We keep everything private until you apply it.</p>
                </div>
                @if($storyBuilderSuggestion)
                    <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                        <p>{{ $storyBuilderSuggestion }}</p>
                        <button type="button" wire:click="applyStoryBuilderSuggestion" class="mt-3 inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">Use this story</button>
                    </div>
                @endif
            </div>
        </div>
    </div>
@endif

@if($showTrustCoach)
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4">
        <div class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Trust Coach</p>
                    <h3 class="text-xl font-semibold text-slate-900">Boost confidence signals</h3>
                </div>
                <button type="button" wire:click="closeTrustCoach" class="text-slate-500">✕</button>
            </div>
            <div class="mt-4 space-y-4">
                <input type="text" wire:model.defer="trustCoachFocus" class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-300 focus:ring-indigo-400" placeholder="What do you want advice on? (e.g. safety, transport)">
                <div class="flex items-center gap-3 text-sm">
                    <button type="button" wire:click="generateTrustCoachChecklist" class="rounded-full bg-indigo-600 px-5 py-2 font-semibold text-white shadow">Refresh tips</button>
                    <p class="text-slate-500">Tips adapt to incomplete sections and your focus keyword.</p>
                </div>
                <div class="space-y-3">
                    @forelse($trustCoachChecklist as $index => $tip)
                        <div class="flex items-start justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <div>
                                <p class="font-semibold">{{ $tip['label'] }}</p>
                                <p class="text-xs text-slate-500">{{ $tip['percent'] }}% complete</p>
                            </div>
                            <button type="button" wire:click="toggleChecklistItem({{ $index }})" class="rounded-full px-3 py-1 text-xs font-semibold {{ $tip['status'] === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700' }}">
                                {{ $tip['status'] === 'done' ? 'Completed' : 'Mark done' }}
                            </button>
                        </div>
                    @empty
                        <p class="text-sm text-slate-500">All sections look great. Keep sharing updates!</p>
                    @endforelse
                </div>
            </div>
        </div>
    </div>
@endif
