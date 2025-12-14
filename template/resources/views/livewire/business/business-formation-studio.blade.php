@php
    use Illuminate\Support\Str;

    $csrfToken = csrf_token();
@endphp
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
            <p class="text-xs font-semibold tracking-[0.35em] text-pink-500 uppercase">Formation studio</p>
            <h1 class="text-3xl font-bold text-slate-900">Design the right business structure</h1>
            <p class="text-sm text-slate-500">Compare structures, understand compliance obligations, and keep every template + AI prompt inside one workspace.</p>
        </div>
        <div class="text-sm text-slate-500">
            <p class="font-semibold text-slate-900">{{ $templateCount }} downloadable templates · {{ $aiPromptCount }} AI prompt packs</p>
            <p>Data pulled from Athena’s business entity knowledge base.</p>
        </div>
    </div>

    @if($showDisclaimerBanner)
        <div class="flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm sm:flex-row sm:items-start sm:justify-between" data-testid="formation-disclaimer-banner">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">Compliance notice</p>
                <p class="mt-2">{{ $legalDisclaimerCopy }}</p>
            </div>
            <div class="flex items-center gap-3 text-xs">
                <p class="text-amber-700">We log dismissals in accordance with Athena compliance controls.</p>
                <button type="button" class="inline-flex items-center justify-center rounded-full border border-amber-500 px-4 py-2 font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50" wire:click="dismissDisclaimerBanner" wire:loading.attr="disabled">
                    <span wire:loading.remove>Dismiss</span>
                    <span wire:loading>Saving…</span>
                </button>
            </div>
        </div>
    @endif

    <section class="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm space-y-4">
        <div class="flex flex-col gap-1">
            <p class="text-xs uppercase tracking-[0.35em] text-indigo-500 font-semibold">Quick questionnaire</p>
            <p class="text-sm text-slate-500">Tweak team size, partner count, asset protection, and international reach to re-run the wizard instantly.</p>
            <div class="flex flex-wrap gap-2 pt-1 text-[0.7rem] uppercase tracking-[0.3em] text-slate-400">
                <span class="rounded-full border border-slate-200 px-3 py-1">Team {{ $questionnaire['team_size'] ?? 0 }}</span>
                <span class="rounded-full border border-slate-200 px-3 py-1">Partners {{ $questionnaire['partner_count'] ?? 1 }}</span>
                <span class="rounded-full border border-slate-200 px-3 py-1">Asset {{ Str::upper(substr($questionnaire['asset_protection'] ?? 'medium', 0, 1)) }}</span>
                <span class="rounded-full border border-slate-200 px-3 py-1">Overseas {{ ($questionnaire['international_trade'] ?? false) ? 'Yes' : 'No' }}</span>
            </div>
        </div>
        <div class="flex flex-wrap gap-3 text-sm text-slate-600">
            <label class="flex flex-col gap-1">
                <span class="font-semibold text-slate-700">Annual revenue (AUD)</span>
                <input type="number" min="0" step="1000" wire:model.lazy="questionnaire.annual_revenue"
                    class="w-40 rounded-lg border-slate-200 focus:border-pink-400 focus:ring-pink-200" />
            </label>
            <label class="flex flex-col gap-1">
                <span class="font-semibold text-slate-700">Team size</span>
                <input type="number" min="0" step="1" wire:model.lazy="questionnaire.team_size"
                    class="w-32 rounded-lg border-slate-200 focus:border-pink-400 focus:ring-pink-200" />
            </label>
            <label class="flex flex-col gap-1">
                <span class="font-semibold text-slate-700">Active partners</span>
                <input type="number" min="1" step="1" wire:model.lazy="questionnaire.partner_count"
                    class="w-32 rounded-lg border-slate-200 focus:border-pink-400 focus:ring-pink-200" />
            </label>
            <label class="flex items-center gap-2">
                <input type="checkbox" wire:model="questionnaire.hiring" class="rounded border-slate-300 text-pink-500 focus:ring-pink-500">
                <span>Hiring team</span>
            </label>
            <label class="flex items-center gap-2">
                <input type="checkbox" wire:model="questionnaire.external_investment" class="rounded border-slate-300 text-pink-500 focus:ring-pink-500">
                <span>Raising capital</span>
            </label>
            <label class="flex flex-col gap-1">
                <span class="font-semibold text-slate-700">Complexity</span>
                <select wire:model="questionnaire.complexity" class="rounded-lg border-slate-200 focus:border-pink-400 focus:ring-pink-200">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
            </label>
            <label class="flex flex-col gap-1">
                <span class="font-semibold text-slate-700">Asset protection priority</span>
                <select wire:model="questionnaire.asset_protection" class="rounded-lg border-slate-200 focus:border-pink-400 focus:ring-pink-200">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
            </label>
            <label class="flex items-center gap-2">
                <input type="checkbox" wire:model="questionnaire.family_owned" class="rounded border-slate-300 text-pink-500 focus:ring-pink-500">
                <span>Family owned</span>
            </label>
            <label class="flex items-center gap-2">
                <input type="checkbox" wire:model="questionnaire.international_trade" class="rounded border-slate-300 text-pink-500 focus:ring-pink-500">
                <span>Trading overseas</span>
            </label>
            <label class="flex items-center gap-2">
                <input type="checkbox" wire:model="questionnaire.ip_strategy" class="rounded border-slate-300 text-pink-500 focus:ring-pink-500">
                <span>IP or grants heavy</span>
            </label>
        </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-3">
        <section
            x-data="formationSummary({ initialEntity: '{{ $recommendedEntityKey }}', initialTimeframe: '{{ $defaultTimeframe }}', initialAvailability: @js($templateAvailability) })"
            x-init="init()"
            class="space-y-5 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm">
            <div>
                <p class="text-xs uppercase tracking-[0.35em] text-emerald-500 font-semibold">Entity selector</p>
                <h2 class="text-xl font-semibold text-slate-900">Match structures to your goals</h2>
                <p class="text-sm text-slate-500">Tap a tile to explore liability, compliance effort, and GST posture for each entity.</p>
            </div>
            <div class="flex flex-wrap gap-2 text-sm">
                @foreach(['weekly','monthly','quarterly','yearly'] as $frame)
                    <button type="button"
                        class="rounded-full border px-3 py-1 font-semibold"
                        :class="timeframeButtonClasses('{{ $frame }}')"
                        :disabled="!hasTemplates('{{ $frame }}')"
                        @click="selectTimeframe('{{ $frame }}')">
                        {{ ucfirst($frame) }} view
                    </button>
                @endforeach
            </div>
            <div class="space-y-4">
                @foreach($entityOptions as $entity)
                    <button type="button"
                        class="w-full text-left rounded-2xl border p-4 transition shadow-sm"
                        :class="selectedEntity === '{{ $entity['key'] }}' ? 'border-emerald-400 bg-emerald-50/60 shadow-inner' : 'border-slate-100 hover:border-emerald-200'"
                        @click="selectEntity('{{ $entity['key'] }}')">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{{ $entity['label'] }}</p>
                                <p class="mt-2 text-sm text-slate-600">{{ $entity['summary'] }}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-3xl font-black text-slate-900">{{ $entity['fit_score'] }}<span class="text-base font-semibold text-slate-500">/100</span></p>
                                <p class="text-xs font-semibold" :class="selectedEntity === '{{ $entity['key'] }}' ? 'text-emerald-600' : 'text-slate-400'"
                                    x-text="selectedEntity === '{{ $entity['key'] }}' ? 'Selected' : '{{ $entity['is_recommended'] ? 'Recommended' : 'Explore fit' }}'"></p>
                            </div>
                        </div>
                        <dl class="mt-4 grid gap-3 sm:grid-cols-2 text-xs text-slate-500">
                            <div>
                                <dt class="uppercase tracking-[0.3em]">Liability</dt>
                                <dd class="text-sm font-semibold text-slate-900">{{ $entity['liability'] }}</dd>
                            </div>
                            <div>
                                <dt class="uppercase tracking-[0.3em]">Compliance</dt>
                                <dd class="text-sm font-semibold text-slate-900">{{ $entity['compliance'] }}</dd>
                            </div>
                            <div>
                                <dt class="uppercase tracking-[0.3em]">Tax</dt>
                                <dd class="text-sm font-semibold text-slate-900">{{ $entity['tax_rate'] }}</dd>
                            </div>
                            <div>
                                <dt class="uppercase tracking-[0.3em]">Setup</dt>
                                <dd class="text-sm font-semibold text-slate-900">{{ $entity['setup_cost'] }}</dd>
                            </div>
                        </dl>
                    </button>
                @endforeach
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
                @foreach($summaryKpis as $kpi)
                    <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p class="text-xs uppercase tracking-[0.35em] text-slate-500">{{ $kpi['label'] }}</p>
                        <p class="mt-2 text-lg font-semibold text-slate-900">{{ $kpi['value'] }}</p>
                    </div>
                @endforeach
            </div>

            <div class="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
                <div class="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-emerald-600 font-semibold">
                    <p>Next steps</p>
                    <p class="text-[0.65rem] normal-case tracking-normal text-emerald-700" x-text="timeframeLabel"></p>
                </div>
                <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-emerald-900">
                    @foreach($structureAdvice['next_steps'] as $step)
                        <li>{{ $step }}</li>
                    @endforeach
                </ol>
            </div>
        </section>

        <section class="space-y-5 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm">
            <div>
                <p class="text-xs uppercase tracking-[0.35em] text-indigo-500 font-semibold">Comparison grid</p>
                <h2 class="text-xl font-semibold text-slate-900">Compliance + funding cards</h2>
                <p class="text-sm text-slate-500">Spot liability, tax, setup costs, and investor readiness at a glance.</p>
            </div>
            <div class="grid gap-6 lg:grid-cols-12">
                @if(!empty($deltaSummary))
                    <div class="lg:col-span-4">
                        <div class="sticky top-4 rounded-3xl border border-indigo-100 bg-indigo-50/80 p-5 shadow-sm">
                            <p class="text-xs uppercase tracking-[0.35em] text-indigo-600 font-semibold">Delta summary</p>
                            <p class="mt-1 text-lg font-semibold text-slate-900">{{ $deltaSummary['headline'] }}</p>
                            <dl class="mt-4 space-y-3 text-sm text-slate-700">
                                @foreach($deltaSummary['items'] as $item)
                                    <div class="flex items-start justify-between gap-3">
                                        <dt class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{{ $item['label'] }}</dt>
                                        <dd class="text-right font-semibold text-indigo-900">{{ $item['value'] }}</dd>
                                    </div>
                                @endforeach
                            </dl>
                            <p class="mt-4 text-xs text-slate-500">Use this bar to explain why the wizard prefers the highlighted entity.</p>
                        </div>
                    </div>
                @endif
                @php
                    $cardsColumnClass = !empty($deltaSummary) ? 'lg:col-span-8' : 'lg:col-span-12';
                @endphp
                <div class="{{ $cardsColumnClass }} space-y-4">
                    <div class="grid gap-4 md:grid-cols-2">
                        @foreach($comparisonGrid as $card)
                            <article class="rounded-3xl border {{ $card['is_recommended'] ? 'border-emerald-200 bg-emerald-50/80 shadow-inner' : 'border-slate-100 bg-white/80' }} p-5">
                                <div class="flex items-center justify-between gap-4">
                                    <div>
                                        <p class="text-xs uppercase tracking-[0.35em] font-semibold text-slate-500">{{ $card['label'] }}</p>
                                        <p class="mt-1 text-sm text-slate-500">{{ $card['compliance_level'] }}</p>
                                    </div>
                                    <span class="text-xs font-semibold uppercase tracking-[0.3em] {{ $card['is_recommended'] ? 'text-emerald-700' : 'text-slate-400' }}">
                                        {{ $card['is_recommended'] ? 'Recommended' : 'Compare' }}
                                    </span>
                                </div>
                                <dl class="mt-4 grid gap-3 text-sm text-slate-700">
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.3em] text-slate-400">Liability</dt>
                                        <dd class="font-semibold text-slate-900">{{ $card['liability'] }}</dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.3em] text-slate-400">Tax</dt>
                                        <dd class="font-semibold text-slate-900">{{ $card['tax_rate'] }}</dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.3em] text-slate-400">Setup cost</dt>
                                        <dd class="font-semibold text-slate-900">{{ $card['setup_cost'] }}</dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.3em] text-slate-400">Funding friendliness</dt>
                                        <dd class="font-semibold text-slate-900">{{ $card['funding'] }}</dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs uppercase tracking-[0.3em] text-slate-400">Compliance effort</dt>
                                        <dd class="font-semibold text-slate-900">{{ $card['compliance'] }}</dd>
                                    </div>
                                </dl>
                            </article>
                        @endforeach
                    </div>
                </div>
            </div>

            <div class="space-y-4" x-data="structureDeckAccordion({ initial: '{{ $recommendedEntityKey }}' })">
                @foreach($structureDeck as $deck)
                    <article class="rounded-2xl border border-slate-100 bg-white/80" :class="{ 'border-emerald-200 shadow-inner': isOpen('{{ $deck['key'] }}') }">
                        <button type="button" class="w-full px-5 py-4 flex flex-col gap-3 text-left" @click="toggle('{{ $deck['key'] }}')">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p class="text-xs uppercase tracking-[0.35em] font-semibold text-slate-500">{{ $deck['label'] }}</p>
                                    <p class="text-sm text-slate-500">Tap to view trade-offs</p>
                                </div>
                                <span class="text-xs font-semibold uppercase tracking-[0.3em]" :class="isOpen('{{ $deck['key'] }}') ? 'text-emerald-600' : 'text-slate-400'">
                                    <span x-show="isOpen('{{ $deck['key'] }}')">Expanded</span>
                                    <span x-show="!isOpen('{{ $deck['key'] }}')">Preview</span>
                                </span>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                @foreach($deck['best_for'] as $badge)
                                    <span class="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Best for: {{ $badge }}</span>
                                @endforeach
                            </div>
                        </button>
                        <div x-show="isOpen('{{ $deck['key'] }}')" x-transition class="px-5 pb-5">
                            <div class="grid gap-4 md:grid-cols-2">
                                <div class="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                                    <p class="text-xs uppercase tracking-[0.35em] text-emerald-700 font-semibold">When it shines</p>
                                    <ul class="mt-3 space-y-2 text-sm text-emerald-900">
                                        @foreach($deck['when_it_shines'] as $pro)
                                            <li class="flex gap-2"><span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>{{ $pro }}</li>
                                        @endforeach
                                    </ul>
                                </div>
                                <div class="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                                    <p class="text-xs uppercase tracking-[0.35em] text-amber-700 font-semibold">Watch-outs</p>
                                    <ul class="mt-3 space-y-2 text-sm text-amber-900">
                                        @foreach($deck['watch_outs'] as $con)
                                            <li class="flex gap-2"><span class="mt-1 h-2 w-2 rounded-full bg-amber-500"></span>{{ $con }}</li>
                                        @endforeach
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </article>
                @endforeach
            </div>
            @if(!empty($structureAdvice['benefits']))
                <div class="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p class="text-xs uppercase tracking-[0.35em] text-indigo-600 font-semibold">Benefit spotlight</p>
                        <p class="text-[0.7rem] uppercase tracking-[0.4em] text-indigo-400">{{ $structureAdvice['recommended_structure'] }} advantage</p>
                    </div>
                    <ul class="mt-3 space-y-3 text-sm text-indigo-900">
                        @foreach($structureAdvice['benefits'] as $benefit)
                            <li class="rounded-xl bg-white/70 p-3 border border-indigo-100">
                                <p class="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600">{{ $benefit['label'] }}</p>
                                <p class="mt-1 text-slate-700">{{ $benefit['detail'] }}</p>
                            </li>
                        @endforeach
                    </ul>
                </div>
            @endif
            <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
                <p>{{ $structureAdvice['disclaimer'] }}</p>
            </div>
        </section>

        <section class="space-y-5 rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm"
            x-data="documentWorkspaceSummary({ templates: @js($documentWorkspace['templates']), initialTimeframe: '{{ $defaultTimeframe }}' })"
            x-init="init()">
            <div>
                <p class="text-xs uppercase tracking-[0.35em] text-pink-500 font-semibold">Document workspace</p>
                <div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h2 class="text-xl font-semibold text-slate-900">Templates + AI prompts</h2>
                    <p class="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600" x-text="`${prettyTimeframe} financial focus`"></p>
                </div>
                <p class="text-sm text-slate-500">Download starter docs and send curated prompts straight to Athena AI with {{ strtolower($disclaimer) }}.</p>
            </div>
            <article class="rounded-2xl border border-slate-100">
                <template x-if="filteredTemplates.length">
                    <div class="divide-y divide-slate-100">
                        <template x-for="template in filteredTemplates" :key="template.slug">
                            <div class="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                                <div class="space-y-2">
                                    <div>
                                        <p class="font-semibold text-slate-900" x-text="template.label"></p>
                                        <p class="text-xs text-slate-500" x-text="`${template.jurisdiction} · Updated ${template.updated_label} · ${template.complexity} complexity`"></p>
                                        <p class="text-[0.65rem] uppercase tracking-[0.4em] text-slate-400" x-text="`Best for ${template.timeframes.join(', ')}`"></p>
                                    </div>
                                    <div class="flex flex-wrap gap-2" x-show="template.prerequisites?.length" x-cloak>
                                        <template x-for="(prereq, idx) in template.prerequisites" :key="idx">
                                            <span class="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                                <span class="text-amber-500">⚠</span>
                                                <span x-text="`Prerequisite: ${prereq}`"></span>
                                            </span>
                                        </template>
                                    </div>
                                </div>
                                <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                                    <a :href="template.download_url" class="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 sm:w-auto">
                                        Download pack
                                    </a>
                                    <p class="text-xs text-slate-400" x-text="`CTA powered by TemplateDownloadController`"></p>
                                </div>
                                <div class="mt-3 w-full rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-700" data-testid="template-disclaimer-footnote">
                                    {{ $legalDisclaimerCopy }}
                                </div>
                            </div>
                        </template>
                    </div>
                </template>
                <div x-show="!filteredTemplates.length" class="p-5 text-sm text-slate-500" x-cloak>
                    No templates pre-loaded for this timeframe yet. Switch to another view or request a custom pack via Athena.
                </div>
            </article>
            <article class="space-y-3">
                @foreach($documentWorkspace['ai_prompts'] as $prompt)
                    <div class="rounded-2xl border border-slate-100 p-4">
                        <p class="text-sm font-semibold text-slate-900">{{ $prompt['label'] }}</p>
                        <p class="mt-2 text-xs text-slate-500">{{ Str::limit(trim($prompt['prompt']), 180) }}</p>
                        <p class="mt-2 text-[0.7rem] uppercase tracking-[0.4em] text-slate-400" x-text="`Context: ${prettyTimeframe} budgets + GST view`"></p>
                        <div class="mt-3 flex items-center justify-between text-xs">
                            <span class="text-slate-500">Paste into Athena or launch the AI workspace.</span>
                            @if($aiEntryUrl)
                                <a href="{{ $aiEntryUrl }}" class="font-semibold text-indigo-500">Open Athena →</a>
                            @endif
                        </div>
                    </div>
                @endforeach
            </article>
            <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
                <p class="font-semibold">Disclaimer</p>
                <p>{{ $documentWorkspace['disclaimer'] }}</p>
            </div>
        </section>

        <section class="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6 shadow-sm space-y-4"
            x-data="aiDraftingLane({
                presets: @js($aiDraftPresets),
                endpoint: '{{ $aiDraftEndpoint }}',
                csrfToken: '{{ $csrfToken }}',
                context: @js($aiDraftContext)
            })"
            x-init="init()"
        >
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-xs uppercase tracking-[0.35em] text-indigo-600 font-semibold">Athena AI drafting lane</p>
                    <h2 class="text-xl font-semibold text-slate-900">Spin up founders docs + BAS notes</h2>
                    <p class="text-sm text-slate-500">Pick a preset, refine the details, then capture Athena's draft with an auditable context token.</p>
                </div>
                <div class="text-xs text-slate-500">
                    <p>All requests are tagged and replayable in the audit log.</p>
                </div>
            </div>

            <template x-if="presets.length">
                <div class="flex flex-wrap gap-2">
                    <template x-for="preset in presets" :key="preset.key">
                        <button type="button" class="rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em]"
                            :class="selected === preset.key ? 'border-emerald-400 bg-white text-emerald-700 shadow' : 'border-indigo-200 bg-indigo-100 text-indigo-600 hover:border-emerald-200'"
                            @click="select(preset.key)">
                            <span x-text="preset.label"></span>
                        </button>
                    </template>
                </div>
            </template>
            <div x-show="!presets.length" class="rounded-2xl border border-indigo-100 bg-white/80 p-4 text-sm text-slate-600" x-cloak>
                No curated presets yet. Add one in the Livewire component to unlock the drafting lane.
            </div>

            <div x-show="presets.length" class="space-y-3" x-cloak>
                <label class="block text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Prompt details</label>
                <textarea x-model="prompt" rows="5" class="w-full rounded-2xl border border-indigo-200 bg-white/95 p-4 text-sm text-slate-800 focus:border-emerald-300 focus:ring-emerald-200" placeholder="Describe what Athena should draft"></textarea>
                <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <button type="button" class="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                        @click="draft()" :disabled="loading">
                        <span x-show="!loading">Draft with Athena</span>
                        <span x-show="loading" class="flex items-center gap-2">
                            <span class="h-2 w-2 animate-pulse rounded-full bg-white"></span>
                            Sending
                        </span>
                    </button>
                    <p x-text="statusLabel"></p>
                </div>
                <div x-show="error" class="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" x-cloak x-text="error"></div>
                <div x-show="draft" class="rounded-2xl border border-slate-200 bg-white/90 p-4" x-cloak>
                    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p class="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Latest draft</p>
                        <span class="text-xs font-semibold text-indigo-500" x-text="contextToken ? `Context token: ${contextToken}` : ''"></span>
                    </div>
                    <pre class="mt-3 whitespace-pre-wrap text-sm text-slate-800" x-text="draft"></pre>
                </div>
            </div>
        </section>
    </div>

    <section class="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm"
        x-data="formationGuidance({ initialTimeframe: '{{ $defaultTimeframe }}', initialEntity: '{{ $recommendedEntityKey }}', entityLabels: @js($entityLabelMap) })"
        x-init="init()">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.35em] text-emerald-700 font-semibold">Athena guidance</p>
                <h2 class="text-xl font-semibold text-emerald-900" x-text="`Keep ${currentEntityLabel} on track`"></h2>
                <p class="text-sm text-emerald-800" x-text="`You are reviewing the ${prettyTimeframe} cadence. Capture receipts weekly, reconcile ${prettyTimeframe.toLowerCase()} goals, and prepare BAS support before ${nextMilestone}.`"></p>
            </div>
            <div class="text-xs text-emerald-700">
                <p class="font-semibold">Tips refresh automatically as you toggle structures or timeframes.</p>
            </div>
        </div>
        <ul class="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            <template x-for="tip in tips" :key="tip.label">
                <li class="rounded-2xl bg-white/70 p-4 border border-emerald-100">
                    <p class="text-xs uppercase tracking-[0.35em] text-emerald-600 font-semibold" x-text="tip.label"></p>
                    <p class="mt-2 text-slate-700" x-text="tip.copy"></p>
                </li>
            </template>
        </ul>
    </section>

    <div class="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-md">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.35em] text-indigo-500 font-semibold">Deep dive workspace</p>
                <h2 class="text-2xl font-semibold text-slate-900">Explore the interactive Livewire studio</h2>
                <p class="text-sm text-slate-500">Run the full questionnaire, GST clearing walkthrough, budgets, and financial tracker without leaving this page.</p>
            </div>
            @if($aiEntryUrl)
                <a href="{{ $aiEntryUrl }}" class="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Launch Athena AI</a>
            @endif
        </div>
        <div class="mt-8">
            @livewire('business.formation-studio', ['userId' => $userId])
        </div>
    </div>
</div>

@push('scripts')
<script>
document.addEventListener('alpine:init', () => {
    Alpine.data('formationSummary', ({ initialEntity, initialTimeframe, initialAvailability }) => ({
        selectedEntity: initialEntity,
        timeframe: initialTimeframe,
        availableTimeframes: initialAvailability ?? {},
        get timeframeLabel() {
            return `${this.prettyTimeframe} snapshot`;
        },
        get prettyTimeframe() {
            return this.timeframe.charAt(0).toUpperCase() + this.timeframe.slice(1);
        },
        normalizeAvailability(payload) {
            const baseline = { weekly: 0, monthly: 0, quarterly: 0, yearly: 0 };
            if (!payload || typeof payload !== 'object') {
                return { ...baseline };
            }
            return Object.keys(baseline).reduce((acc, key) => {
                acc[key] = Number(payload[key] ?? 0);
                return acc;
            }, {});
        },
        hasTemplates(frame) {
            return (this.availableTimeframes?.[frame] ?? 0) > 0;
        },
        timeframeButtonClasses(frame) {
            const active = 'border-emerald-400 bg-emerald-100 text-emerald-700';
            const inactive = 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200';
            const disabled = 'opacity-50 cursor-not-allowed';
            const base = this.timeframe === frame ? active : inactive;

            return this.hasTemplates(frame) ? base : `${base} ${disabled}`;
        },
        init() {
            this.availableTimeframes = this.normalizeAvailability(this.availableTimeframes);
            window.addEventListener('formation-summary-sync', (event) => {
                if (event.detail?.entity) {
                    this.selectedEntity = event.detail.entity;
                }
                if (event.detail?.timeframe) {
                    this.timeframe = event.detail.timeframe;
                }
                if (event.detail?.availableTimeframes) {
                    this.availableTimeframes = this.normalizeAvailability(event.detail.availableTimeframes);
                }
            });
        },
        selectEntity(entity) {
            this.selectedEntity = entity;
            if (window.Livewire?.dispatch) {
                window.Livewire.dispatch('formation-summary:set-entity', { entity });
            }
        },
        selectTimeframe(frame) {
            if (!this.hasTemplates(frame)) {
                return;
            }
            this.timeframe = frame;
            if (window.Livewire?.dispatch) {
                window.Livewire.dispatch('formation-summary:set-timeframe', { timeframe: frame });
            }
        },
    }));

    Alpine.data('documentWorkspaceSummary', ({ templates, initialTimeframe }) => ({
        templates,
        timeframe: initialTimeframe,
        get prettyTimeframe() {
            return this.timeframe.charAt(0).toUpperCase() + this.timeframe.slice(1);
        },
        get filteredTemplates() {
            return this.templates.filter((template) => {
                const frames = template.timeframes?.length ? template.timeframes : ['weekly', 'monthly', 'quarterly', 'yearly'];
                return frames.includes(this.timeframe);
            });
        },
        init() {
            window.addEventListener('formation-summary-sync', (event) => {
                if (event.detail?.timeframe) {
                    this.timeframe = event.detail.timeframe;
                }
            });
        },
    }));

    Alpine.data('formationGuidance', ({ initialTimeframe, initialEntity, entityLabels }) => ({
        timeframe: initialTimeframe,
        selectedEntity: initialEntity,
        entityLabels,
        tips: [],
        get prettyTimeframe() {
            return this.timeframe.charAt(0).toUpperCase() + this.timeframe.slice(1);
        },
        get currentEntityLabel() {
            return this.entityLabels[this.selectedEntity] ?? 'your structure';
        },
        get nextMilestone() {
            return ({
                weekly: 'next BAS touchpoint',
                monthly: 'month-end review',
                quarterly: 'quarter close',
                yearly: 'financial year wrap-up',
            })[this.timeframe] ?? 'upcoming review';
        },
        init() {
            this.updateTips();
            window.addEventListener('formation-summary-sync', (event) => {
                if (event.detail?.timeframe) {
                    this.timeframe = event.detail.timeframe;
                    this.updateTips();
                }
                if (event.detail?.entity) {
                    this.selectedEntity = event.detail.entity;
                }
            });
        },
        updateTips() {
            const library = {
                weekly: [
                    { label: 'Cashflow pulse', copy: 'Lock receipts and invoices within seven days so GST clearing never drifts.' },
                    { label: 'AI notes', copy: 'Drop a short Loom or note into Athena so prompts stay rich for next BAS.' },
                    { label: 'Compliance micro-step', copy: 'Match payroll, super, and GST codes before Friday so the tracker stays real-time.' },
                ],
                monthly: [
                    { label: 'Budget sync', copy: 'Compare actuals vs budget mid-month to flag over-spend or capital gaps early.' },
                    { label: 'Template refresh', copy: 'Download the governance template bundle to prep board packs alongside cashflow.' },
                    { label: 'BAS ready', copy: 'Reconcile GST clearing + suspense accounts before closing the books.' },
                ],
                quarterly: [
                    { label: 'Strategy lens', copy: 'Use the company constitution or HOA templates to lock investor agreements pre-quarter close.' },
                    { label: 'Capital planning', copy: 'Layer AI prompts with quarterly KPIs to brief advisors on funding readiness.' },
                    { label: 'Review loop', copy: 'Schedule a governance retro: confirm minutes, ASIC filings, and trust distributions.' },
                ],
                yearly: [
                    { label: 'Board ready', copy: 'Bundle constitution + founder agreements for auditors and new directors.' },
                    { label: 'Tax posture', copy: 'Use the BAS + GST prompt to narrate year-to-date clearing balances to your accountant.' },
                    { label: 'Expansion plan', copy: 'Feed Athena a yearly recap to auto-draft strategy docs for grants or investors.' },
                ],
            };

            this.tips = library[this.timeframe] ?? library.monthly;
        },
    }));

    Alpine.data('structureDeckAccordion', ({ initial }) => ({
        openKey: initial,
        toggle(key) {
            this.openKey = this.openKey === key ? null : key;
        },
        isOpen(key) {
            return this.openKey === key;
        },
    }));

    Alpine.data('aiDraftingLane', ({ presets, endpoint, csrfToken, context }) => ({
        presets: presets ?? [],
        endpoint,
        csrfToken,
        context,
        selected: null,
        prompt: '',
        draft: '',
        contextToken: '',
        error: '',
        loading: false,
        init() {
            if (this.presets.length) {
                this.select(this.presets[0].key);
            }
        },
        select(key) {
            this.selected = key;
            const preset = this.presets.find((item) => item.key === key);
            if (preset) {
                this.prompt = preset.prompt;
            }
        },
        get statusLabel() {
            if (this.loading) {
                return 'Sending to Athena…';
            }
            if (this.contextToken) {
                return `Draft generated · token ${this.contextToken}`;
            }
            return 'Ready to draft';
        },
        async draft() {
            if (!this.selected) {
                this.error = 'Select a preset before drafting.';
                return;
            }

            if (!this.prompt?.trim()) {
                this.error = 'Tell Athena what to draft.';
                return;
            }

            this.loading = true;
            this.error = '';
            this.draft = '';
            this.contextToken = '';

            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': this.csrfToken,
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        template: this.selected,
                        prompt: this.prompt,
                        context: this.context,
                    }),
                });

                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(payload.message ?? 'Athena could not draft that right now.');
                }

                this.draft = payload.draft ?? '';
                this.contextToken = payload.context_token ?? '';
            } catch (error) {
                this.error = error?.message ?? 'Unexpected error drafting with Athena.';
            } finally {
                this.loading = false;
            }
        },
    }));
});
</script>
@endpush
