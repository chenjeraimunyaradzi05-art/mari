@php
    use Illuminate\Support\Arr;
@endphp
<div class="space-y-10">
    <section class="bg-white/70 backdrop-blur rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs font-semibold tracking-[0.3em] text-pink-500 uppercase">Business Formation Studio</p>
                <h1 class="text-2xl font-bold text-slate-900">Choose the structure that matches your goals</h1>
                <p class="text-sm text-slate-500">Compare liability, GST obligations, setup effort, and download ready-to-edit documents.</p>
            </div>
            <div class="flex gap-3 text-sm text-slate-600">
                <label class="flex items-center gap-2">
                    <span class="font-medium">Annual revenue</span>
                    <input type="number" min="0" wire:model.lazy="questionnaire.annual_revenue"
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
                <label class="flex items-center gap-2">
                    <input type="checkbox" wire:model="questionnaire.gst_registered" class="rounded border-slate-300 text-pink-500 focus:ring-pink-500">
                    <span>GST registered</span>
                </label>
            </div>
        </div>
        <div class="grid gap-4 md:grid-cols-4 p-6 bg-slate-50">
            @foreach($entities as $key => $entity)
                <button wire:click="selectEntity('{{ $key }}')"
                    class="text-left rounded-2xl border p-4 transition shadow-sm {{ $selectedEntity === $key ? 'border-pink-400 bg-white shadow-pink-100/70' : 'border-slate-200 bg-white hover:border-pink-200' }}">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-widest">{{ $entity['label'] }}</p>
                    <p class="mt-2 text-lg font-semibold text-slate-900">{{ $entity['summary'] }}</p>
                    <p class="mt-3 text-sm text-slate-500">Tax rate: {{ $entity['tax_rate'] }}</p>
                    <p class="mt-1 text-xs text-slate-400">Setup: {{ $entity['setup_cost'] }}</p>
                </button>
            @endforeach
        </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-3">
        <article class="rounded-3xl bg-white border border-slate-100 shadow-xs p-6 lg:col-span-2">
            <header class="flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs uppercase tracking-[0.3em] text-emerald-500 font-semibold">Fit score</p>
                    <h2 class="text-xl font-semibold text-slate-900">{{ Arr::get($analysis, 'meta.label') }} overview</h2>
                    <p class="text-sm text-slate-500">{{ $analysis['summary'] ?? '' }}</p>
                </div>
                <div class="text-right">
                    <p class="text-4xl font-black text-slate-900">{{ $analysis['score'] ?? 0 }}<span class="text-base font-medium text-slate-500">/100</span></p>
                    <p class="text-xs text-slate-400">Confidence score</p>
                </div>
            </header>
            <div class="mt-6 grid gap-4 md:grid-cols-2">
                <div class="rounded-2xl border border-slate-100 p-4">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">Pros</p>
                    <ul class="mt-3 space-y-2 text-sm text-slate-700">
                        @foreach(Arr::get($analysis, 'meta.pros', []) as $pro)
                            <li class="flex items-start gap-2"><span class="mt-1 h-2 w-2 rounded-full bg-emerald-400"></span>{{ $pro }}</li>
                        @endforeach
                    </ul>
                </div>
                <div class="rounded-2xl border border-slate-100 p-4">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">Considerations</p>
                    <ul class="mt-3 space-y-2 text-sm text-slate-700">
                        @foreach(Arr::get($analysis, 'meta.cons', []) as $con)
                            <li class="flex items-start gap-2"><span class="mt-1 h-2 w-2 rounded-full bg-amber-400"></span>{{ $con }}</li>
                        @endforeach
                    </ul>
                </div>
            </div>
            <div class="mt-6 grid gap-4 md:grid-cols-3">
                <div class="rounded-2xl bg-slate-50 p-4">
                    <p class="text-xs text-slate-500 uppercase tracking-[0.2em]">Liability</p>
                    <p class="mt-2 text-base font-semibold text-slate-900">{{ Arr::get($analysis, 'meta.liability') }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 p-4">
                    <p class="text-xs text-slate-500 uppercase tracking-[0.2em]">Compliance effort</p>
                    <p class="mt-2 text-base font-semibold text-slate-900">{{ Arr::get($analysis, 'meta.compliance') }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 p-4">
                    <p class="text-xs text-slate-500 uppercase tracking-[0.2em]">Best for</p>
                    <p class="mt-2 text-base font-semibold text-slate-900">{{ implode(', ', Arr::get($analysis, 'meta.best_for', [])) }}</p>
                </div>
            </div>
            <div class="mt-6">
                <p class="text-xs font-semibold text-slate-500 uppercase tracking-[0.3em]">Next steps</p>
                <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                    @foreach($analysis['next_steps'] ?? [] as $step)
                        <li>{{ $step }}</li>
                    @endforeach
                </ol>
            </div>
        </article>
        <article class="rounded-3xl bg-indigo-950 text-white p-6 flex flex-col gap-4">
            <header>
                <p class="text-xs uppercase tracking-[0.3em] text-indigo-200 font-semibold">GST & Compliance</p>
                <h2 class="text-xl font-semibold">Stay on top of BAS + clearing entries</h2>
            </header>
            <dl class="space-y-3 text-sm">
                <div>
                    <dt class="text-indigo-300 uppercase text-[0.65rem] tracking-[0.4em]">Status</dt>
                    <dd class="text-base font-semibold">{{ Arr::get($analysis, 'gst.status') }}</dd>
                </div>
                <div>
                    <dt class="text-indigo-300 uppercase text-[0.65rem] tracking-[0.4em]">Treatment</dt>
                    <dd>{{ Arr::get($analysis, 'gst.treatment') }}</dd>
                </div>
                <div>
                    <dt class="text-indigo-300 uppercase text-[0.65rem] tracking-[0.4em]">Reporting cadence</dt>
                    <dd>{{ Arr::get($analysis, 'gst.reporting') }}</dd>
                </div>
                <div>
                    <dt class="text-indigo-300 uppercase text-[0.65rem] tracking-[0.4em]">Accounting method</dt>
                    <dd>{{ Arr::get($analysis, 'gst.method') }}</dd>
                </div>
            </dl>
            <p class="text-sm text-indigo-100">{{ Arr::get($analysis, 'gst.clearing_entry') }}</p>
            <div class="rounded-2xl bg-indigo-900/60 p-4 text-sm">
                <p class="text-xs text-indigo-200 uppercase tracking-[0.4em] mb-2">Risk notes</p>
                <ul class="space-y-2">
                    @foreach($analysis['risk_notes'] ?? [] as $note)
                        <li>
                            <p class="font-semibold">{{ $note['label'] }}</p>
                            <p class="text-indigo-200">{{ $note['detail'] }}</p>
                        </li>
                    @endforeach
                </ul>
            </div>
        </article>
    </section>

    <section class="grid gap-6 lg:grid-cols-2">
        <article class="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
            <div class="flex items-start justify-between">
                <div>
                    <p class="text-xs uppercase tracking-[0.3em] text-pink-500 font-semibold">Templates</p>
                    <h3 class="text-lg font-semibold text-slate-900">Download + personalise</h3>
                </div>
                <a href="{{ route('ai.concierge') }}" class="text-sm text-pink-500 font-semibold">Open Athena AI →</a>
            </div>
            <div class="mt-4 divide-y divide-slate-100">
                @foreach($templates as $template)
                    <div class="py-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p class="font-semibold text-slate-900">{{ $template['label'] }}</p>
                            <p class="text-xs text-slate-500">{{ $template['jurisdiction'] }} · Updated {{ \Carbon\Carbon::parse($template['updated_at'])->format('M d, Y') }} · {{ $template['complexity'] }} complexity</p>
                        </div>
                        <a href="{{ route('business.templates.download', $template['slug']) }}"
                            class="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-pink-300 hover:text-pink-600">
                            Download
                        </a>
                    </div>
                @endforeach
            </div>
            <p class="mt-4 text-xs text-slate-500">{{ $disclaimer }}</p>
        </article>
        <article class="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
            <p class="text-xs uppercase tracking-[0.3em] text-indigo-500 font-semibold">AI drafting prompts</p>
            <h3 class="text-lg font-semibold text-slate-900">Send context to Athena in one tap</h3>
                <div class="mt-4 grid gap-3">
                @foreach($aiPrompts as $key => $config)
                    <button type="button"
                        onclick="navigator.clipboard.writeText(@js($this->aiPrompt($key)))"
                        class="flex flex-col rounded-2xl border border-slate-100 px-4 py-3 text-left hover:border-indigo-200">
                        <span class="text-sm font-semibold text-slate-900">{{ $config['label'] }}</span>
                        <span class="text-xs text-slate-500">Tap to copy prompt (includes GST + disclaimer language).</span>
                    </button>
                @endforeach
            </div>
            <div class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
                <p class="font-semibold">Disclaimer</p>
                <p>This workspace is educational only. Confirm GST filings, legal documents, and tax deductions with a registered professional.</p>
            </div>
        </article>
    </section>

    <section class="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.3em] text-emerald-500 font-semibold">Live financial tracker</p>
                <h2 class="text-2xl font-semibold text-slate-900">Budgets · Profit & Loss · Cashflow</h2>
                <p class="text-sm text-slate-500">Weekly, monthly, quarterly, and yearly views with GST clearing + journals.</p>
            </div>
            <div class="flex gap-2">
                @foreach(['weekly','monthly','quarterly','yearly'] as $frame)
                    <button wire:click="setTimeframe('{{ $frame }}')"
                        class="rounded-full px-4 py-2 text-sm font-semibold {{ $timeframe === $frame ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600' }}">
                        {{ ucfirst($frame) }}
                    </button>
                @endforeach
            </div>
        </header>

        <div class="mt-6 grid gap-4 md:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 p-4">
                <p class="text-xs text-slate-500 uppercase tracking-[0.2em]">Income</p>
                <p class="text-2xl font-bold text-slate-900">${{ number_format(Arr::get($financials,'profit_and_loss.income_total',0), 2) }}</p>
                <p class="text-xs text-slate-400">{{ ucfirst($timeframe) }} actual</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
                <p class="text-xs text-slate-500 uppercase tracking-[0.2em]">Expenses</p>
                <p class="text-2xl font-bold text-slate-900">${{ number_format(Arr::get($financials,'profit_and_loss.expense_total',0), 2) }}</p>
                <p class="text-xs text-slate-400">Includes deductible + non-deductible</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
                <p class="text-xs text-slate-500 uppercase tracking-[0.2em]">Net profit</p>
                <p class="text-2xl font-bold text-slate-900">${{ number_format(Arr::get($financials,'profit_and_loss.net_profit',0), 2) }}</p>
                <p class="text-xs text-slate-400">Margin {{ Arr::get($financials,'profit_and_loss.margin',0) }}%</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
                <p class="text-xs text-slate-500 uppercase tracking-[0.2em]">Projected</p>
                <p class="text-2xl font-bold text-slate-900">${{ number_format(Arr::get($financials,'cashflow_projection.projected',0), 2) }}</p>
                <p class="text-xs text-slate-400">Trend {{ Arr::get($financials,'cashflow_projection.trend') }}</p>
            </div>
        </div>

        <div class="mt-8 grid gap-6 lg:grid-cols-3">
            <article class="rounded-2xl border border-slate-100 p-4 lg:col-span-2">
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold text-slate-900">Cashflow & Budget variance</h3>
                    <button wire:click="toggleExplanation('cashflow')" class="text-xs text-pink-600 font-semibold">Explain</button>
                </div>
                <div class="mt-4">
                    <div class="flex gap-2 text-xs text-slate-500">
                        <span class="inline-flex items-center gap-1"><span class="h-1.5 w-6 rounded-full bg-emerald-400"></span>Income</span>
                        <span class="inline-flex items-center gap-1"><span class="h-1.5 w-6 rounded-full bg-pink-400"></span>Expenses</span>
                    </div>
                    <div class="mt-2 grid gap-2" style="grid-template-columns: repeat({{ max(1, count(Arr::get($financials,'cashflow_projection.series',[]))) }}, minmax(0, 1fr));">
                        @foreach(Arr::get($financials,'cashflow_projection.series',[]) as $point)
                            <div class="flex flex-col justify-end gap-1 text-center">
                                <div class="h-24 flex flex-col justify-end gap-1">
                                    @php
                                        $max = max(1, abs($point['income']) + abs($point['expenses']));
                                        $incomeHeight = $max ? max(4, intval(($point['income'] / $max) * 100)) : 4;
                                        $expenseHeight = $max ? max(4, intval(($point['expenses'] / $max) * 100)) : 4;
                                    @endphp
                                    <span class="block w-full rounded-full bg-emerald-300" style="height: {{ $incomeHeight }}%"></span>
                                    <span class="block w-full rounded-full bg-pink-300" style="height: {{ $expenseHeight }}%"></span>
                                </div>
                                <p class="text-[0.6rem] text-slate-500">{{ $point['label'] }}</p>
                            </div>
                        @endforeach
                    </div>
                </div>
                @if($expandedSections['cashflow'] ?? false)
                    <p class="mt-4 text-xs text-slate-500">Cashflow bars compare recorded income vs expenses for each interval. Variance data uses your latest business budgets to flag overspend (pink) or underspend (emerald). Use the GST clearing account to ensure BAS payments do not distort operating expenses.</p>
                @endif
                <div class="mt-4 grid gap-4 md:grid-cols-2">
                    <div class="rounded-xl bg-slate-50 p-4 text-sm">
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Budget planned</p>
                        <p class="mt-1 font-semibold text-slate-900">Income ${{ number_format(Arr::get($financials,'budget_vs_actual.planned.income',0),2) }}</p>
                        <p class="font-semibold text-slate-900">Expenses ${{ number_format(Arr::get($financials,'budget_vs_actual.planned.expenses',0),2) }}</p>
                    </div>
                    <div class="rounded-xl bg-slate-50 p-4 text-sm">
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Variance</p>
                        <p class="mt-1 font-semibold text-emerald-600">Income {{ number_format(Arr::get($financials,'budget_vs_actual.variance.income',0),2) }}</p>
                        <p class="font-semibold text-pink-600">Expenses {{ number_format(Arr::get($financials,'budget_vs_actual.variance.expenses',0),2) }}</p>
                    </div>
                </div>
            </article>
            <article class="rounded-2xl border border-slate-100 p-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold text-slate-900">Expense composition</h3>
                    <button wire:click="toggleExplanation('expense-pie')" class="text-xs text-pink-600 font-semibold">Explain</button>
                </div>
                @php
                    $breakdown = Arr::get($financials,'category_breakdown',[]);
                    $colors = ['#f472b6','#c084fc','#38bdf8','#facc15','#10b981','#f97316','#94a3b8'];
                    $start = 0;
                    $segments = [];
                    foreach ($breakdown as $index => $slice) {
                        $end = $start + ($slice['percentage'] / 100) * 360;
                        $segments[] = sprintf('%s %.2fdeg %.2fdeg', $colors[$index % count($colors)], $start, $end);
                        $start = $end;
                    }
                    $pieBackground = $segments === [] ? '#e2e8f0' : 'conic-gradient(' . implode(', ', $segments) . ')';
                @endphp
                <div class="mt-4 flex items-center gap-4">
                    <div class="h-32 w-32 rounded-full" style="background: {{ $pieBackground }};">
                    </div>
                    <div class="space-y-2 text-sm">
                        @foreach($breakdown as $index => $slice)
                            <div class="flex items-center gap-2">
                                <span class="h-2 w-2 rounded-full" style="background-color: hsl({{ 320 + ($index * 20) }},80%,70%);"></span>
                                <p class="font-semibold text-slate-900">{{ $slice['category'] }}</p>
                                <p class="text-xs text-slate-500">{{ $slice['percentage'] }}% (${{ number_format($slice['amount'],2) }})</p>
                            </div>
                        @endforeach
                    </div>
                </div>
                @if($expandedSections['expense-pie'] ?? false)
                    <p class="mt-4 text-xs text-slate-500">Pie slices show total spend per category (deductible + capital). Expand any slice to see ledger detail and decide whether GST codes are correct.</p>
                @endif
            </article>
        </div>

        <div class="mt-8 grid gap-6 lg:grid-cols-2">
            <article class="rounded-2xl border border-slate-100 p-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold text-slate-900">GST clearing account</h3>
                    <button wire:click="toggleExplanation('gst-clearing')" class="text-xs text-pink-600 font-semibold">Explain</button>
                </div>
                <dl class="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                        <dt class="text-xs text-slate-500 uppercase tracking-[0.3em]">Collected</dt>
                        <dd class="text-xl font-semibold text-slate-900">${{ number_format(Arr::get($financials,'gst.collected',0),2) }}</dd>
                    </div>
                    <div>
                        <dt class="text-xs text-slate-500 uppercase tracking-[0.3em]">Paid</dt>
                        <dd class="text-xl font-semibold text-slate-900">${{ number_format(Arr::get($financials,'gst.paid',0),2) }}</dd>
                    </div>
                    <div>
                        <dt class="text-xs text-slate-500 uppercase tracking-[0.3em]">Net</dt>
                        <dd class="text-xl font-semibold text-slate-900">${{ number_format(Arr::get($financials,'gst.net',0),2) }} ({{ Arr::get($financials,'gst.status') }})</dd>
                    </div>
                    <div>
                        <dt class="text-xs text-slate-500 uppercase tracking-[0.3em]">Clearing balance</dt>
                        <dd class="text-xl font-semibold text-slate-900">${{ number_format(Arr::get($financials,'gst.clearing_balance',0),2) }}</dd>
                    </div>
                </dl>
                @if($expandedSections['gst-clearing'] ?? false)
                    <p class="mt-4 text-xs text-slate-500">GST collected on sales credits the clearing account; GST on purchases debits it. When BAS is lodged, post a journal to zero the balance (debit GST clearing / credit bank for payments or the reverse for refunds).</p>
                @endif
            </article>
            <article class="rounded-2xl border border-slate-100 p-4">
                <h3 class="text-base font-semibold text-slate-900">Deductible expenses</h3>
                <p class="text-xs text-slate-500">Track deductible vs personal spending.</p>
                <dl class="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                        <dt class="text-xs text-slate-500 uppercase tracking-[0.3em]">Deductible</dt>
                        <dd class="text-xl font-semibold text-slate-900">${{ number_format(Arr::get($financials,'deductibles.deductible_total',0),2) }}</dd>
                    </div>
                    <div>
                        <dt class="text-xs text-slate-500 uppercase tracking-[0.3em]">Non-deductible</dt>
                        <dd class="text-xl font-semibold text-slate-900">${{ number_format(Arr::get($financials,'deductibles.non_deductible_total',0),2) }}</dd>
                    </div>
                </dl>
                <table class="mt-4 w-full text-sm">
                    <thead>
                        <tr class="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                            <th class="py-2">Date</th>
                            <th class="py-2">Category</th>
                            <th class="py-2 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach(Arr::get($financials,'deductibles.recent_items',[]) as $item)
                            <tr class="border-t border-slate-100 text-slate-700">
                                <td class="py-2">{{ $item['date'] }}</td>
                                <td class="py-2">{{ $item['category'] }}</td>
                                <td class="py-2 text-right">${{ number_format($item['amount'],2) }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </article>
        </div>

        <div class="mt-8 grid gap-6 lg:grid-cols-2">
            <article class="rounded-2xl border border-slate-100 p-4">
                <h3 class="text-base font-semibold text-slate-900">Asset register</h3>
                <p class="text-xs text-slate-500">{{ Arr::get($financials,'assets.count',0) }} assets tracked • Total ${{ number_format(Arr::get($financials,'assets.total_value',0),2) }}</p>
                <div class="mt-4 max-h-56 overflow-y-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                                <th class="py-2">Asset</th>
                                <th class="py-2">Date</th>
                                <th class="py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach(Arr::get($financials,'assets.items',[]) as $asset)
                                <tr class="border-t border-slate-100 text-slate-700">
                                    <td class="py-2">{{ $asset['name'] }}</td>
                                    <td class="py-2">{{ $asset['date'] }}</td>
                                    <td class="py-2 text-right">${{ number_format($asset['amount'],2) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </article>
            <article class="rounded-2xl border border-slate-100 p-4">
                <h3 class="text-base font-semibold text-slate-900">Balance sheet snapshot</h3>
                <div class="mt-4 grid gap-4 md:grid-cols-3 text-sm">
                    <div>
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Assets</p>
                        <ul class="mt-2 space-y-1">
                            @foreach(Arr::get($financials,'balance_sheet.assets',[]) as $label => $value)
                                <li class="flex justify-between"><span class="text-slate-600">{{ ucwords(str_replace('_',' ', $label)) }}</span><span class="font-semibold">${{ number_format($value,2) }}</span></li>
                            @endforeach
                        </ul>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Liabilities</p>
                        <ul class="mt-2 space-y-1">
                            @foreach(Arr::get($financials,'balance_sheet.liabilities',[]) as $label => $value)
                                <li class="flex justify-between"><span class="text-slate-600">{{ ucwords(str_replace('_',' ', $label)) }}</span><span class="font-semibold">${{ number_format($value,2) }}</span></li>
                            @endforeach
                        </ul>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Equity</p>
                        <ul class="mt-2 space-y-1">
                            @foreach(Arr::get($financials,'balance_sheet.equity',[]) as $label => $value)
                                <li class="flex justify-between"><span class="text-slate-600">{{ ucwords(str_replace('_',' ', $label)) }}</span><span class="font-semibold">${{ number_format($value,2) }}</span></li>
                            @endforeach
                        </ul>
                    </div>
                </div>
            </article>
        </div>

        <div class="mt-8 rounded-2xl border border-slate-100 p-4">
            <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold text-slate-900">Suggested journals</h3>
                <button wire:click="toggleExplanation('journals')" class="text-xs text-pink-600 font-semibold">Explain</button>
            </div>
            <div class="mt-4 space-y-4 text-sm">
                @forelse(Arr::get($financials,'journals',[]) as $journal)
                    <div class="rounded-xl bg-slate-50 p-4">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p class="font-semibold text-slate-900">{{ $journal['description'] }}</p>
                                <p class="text-xs text-slate-500">{{ $journal['date'] }} · {{ ucfirst($journal['timeframe']) }} view</p>
                            </div>
                        </div>
                        <table class="mt-3 w-full text-xs">
                            <thead>
                                <tr class="text-slate-500">
                                    <th class="text-left">Account</th>
                                    <th class="text-right">Debit</th>
                                    <th class="text-right">Credit</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($journal['entries'] as $entry)
                                    <tr class="border-t border-slate-100 text-slate-800">
                                        <td class="py-1">{{ $entry['account'] }}</td>
                                        <td class="py-1 text-right">${{ number_format($entry['debit'],2) }}</td>
                                        <td class="py-1 text-right">${{ number_format($entry['credit'],2) }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                @empty
                    <p class="text-slate-500">Add BAS or payroll entries to generate journal suggestions.</p>
                @endforelse
            </div>
            @if($expandedSections['journals'] ?? false)
                <p class="mt-4 text-xs text-slate-500">Journal blueprints help you close the GST clearing account and maintain double-entry accuracy. Always reconcile against the general ledger before lodging BAS.</p>
            @endif
        </div>
    </section>
</div>
