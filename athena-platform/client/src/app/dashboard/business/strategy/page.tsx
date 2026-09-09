'use client';

/**
 * The business strategy: the structure to trade under, what the business
 * is worth, what a raise costs, how long the cash lasts, and which of the
 * listed grants fit. Saved as one plan.
 */

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Building2, Compass, Landmark, PieChart, Timer } from 'lucide-react';
import { strategyApi } from '@/lib/strategy-api';
import { Bars, Check, Disclaimer, Field, JumpLinks, LineChart, Notes, NumberInput, Panel, Pending, SavePlanBar, SelectInput, Stat, aud, num, opt, pct, useCalc } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

const INDUSTRIES = [
  ['saas', 'Software and subscriptions'], ['services', 'Trades and personal services'], ['professional', 'Professional services'], ['retail', 'Retail'], ['ecommerce', 'Online retail'],
  ['hospitality', 'Cafes, food and hospitality'], ['health', 'Health and allied health'], ['education', 'Education and training'], ['manufacturing', 'Manufacturing'], ['creative', 'Creative and media'], ['other', 'Other'],
].map(([value, label]) => ({ value, label }));
const STAGES = ['Idea', 'Startup', 'Early', 'Growth', 'Established'].map((s) => ({ value: s, label: s }));
const STATES = ['', 'QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s || 'Anywhere in Australia' }));

type Form = {
  profit: string; otherIncome: string; hasCoFounders: boolean; partners: string; beneficiaries: string; retainPct: string; turnover: string;
  assetProtection: boolean; raisingCapital: boolean; simplicity: boolean; flexibleDistribution: boolean;
  revenue: string; annualProfit: string; growth: string; industry: string; recurring: string; ownerDependence: string; yearsOperating: string; netAssets: string;
  preMoney: string; raise: string; pool: string; founderPct: string;
  cash: string; monthlyRevenue: string; monthlyExpenses: string; revenueGrowth: string; expenseGrowth: string;
  stage: string; grantIndustry: string; state: string; amountNeeded: string; indigenous: boolean; regional: boolean;
};

const DEFAULTS: Form = {
  profit: '', otherIncome: '', hasCoFounders: false, partners: '2', beneficiaries: '1', retainPct: '50', turnover: '',
  assetProtection: false, raisingCapital: false, simplicity: false, flexibleDistribution: false,
  revenue: '', annualProfit: '', growth: '10', industry: 'services', recurring: '0', ownerDependence: 'medium', yearsOperating: '3', netAssets: '',
  preMoney: '', raise: '', pool: '10', founderPct: '100',
  cash: '', monthlyRevenue: '', monthlyExpenses: '', revenueGrowth: '5', expenseGrowth: '1',
  stage: 'Early', grantIndustry: '', state: 'QLD', amountNeeded: '', indigenous: false, regional: false,
};

type Structures = { recommended: string; reasons: string[]; yourMarginalRate: number; notes: string[]; asAt: string; options: Array<{ type: string; label: string; taxOnProfit: number; effectiveRate: number; yourTax: number; setupCost: { low: number; high: number }; annualCost: { low: number; high: number }; complexity: number; assetProtection: number; raisingCapital: number; canRetainProfits: boolean; available: boolean; unavailableReason?: string; pros: string[]; cons: string[]; taxNote: string; score: number }> };
type Valuation = { industry: string; range: { low: number; mid: number; high: number }; adjustmentPct: number; methods: { revenueMultiple: { low: number; high: number; multipleLow: number; multipleHigh: number }; earningsMultiple: { low: number; high: number; multipleLow: number; multipleHigh: number }; discountedCashFlow: { value: number; discountRatePct: number }; netAssets: number }; drivers: Array<{ label: string; effect: number; detail: string }>; notes: string[] };
type Raise = { postMoney: number; investorPct: number; founderPctAfter: number; founderValueAfter: number; pricePerShare: number | null; ifValuationLower: { preMoney: number; founderPctAfter: number }; notes: string[] };
type Runway = { monthlyBurn: number; runwayMonths: number | null; runwayEnds: string | null; breakEvenMonth: number | null; lowestCash: number; series: Array<{ month: number; cash: number }>; notes: string[] };
type Matches = { matches: Array<{ id: string; name: string; provider: string; maxFunding?: string | number | null; deadline?: string | null; isRolling?: boolean; match: { score: number; reasons: string[]; gaps: string[] } }> };

const dots = (n: number) => '●'.repeat(n) + '○'.repeat(3 - n);

export default function BusinessStrategyPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const profit = num(form.profit);
  const structures = useCalc<Structures>(strategyApi.business.structures, { profit, otherIncome: opt(form.otherIncome), hasCoFounders: form.hasCoFounders, partners: opt(form.partners), beneficiaries: opt(form.beneficiaries), retainPct: opt(form.retainPct), turnover: opt(form.turnover), priorities: { assetProtection: form.assetProtection, raisingCapital: form.raisingCapital, simplicity: form.simplicity, flexibleDistribution: form.flexibleDistribution } }, profit > 0);
  const revenue = num(form.revenue);
  const valuation = useCalc<Valuation>(strategyApi.business.valuation, { annualRevenue: revenue, annualProfit: num(form.annualProfit), growthPct: opt(form.growth), industry: form.industry, recurringRevenuePct: opt(form.recurring), ownerDependence: form.ownerDependence, yearsOperating: opt(form.yearsOperating), netAssets: opt(form.netAssets) }, revenue > 0);
  const raise = useCalc<Raise>(strategyApi.business.raise, { preMoney: num(form.preMoney), raiseAmount: num(form.raise), optionPoolPct: opt(form.pool), founderOwnershipPct: opt(form.founderPct) }, num(form.preMoney) > 0 && num(form.raise) > 0);
  const runway = useCalc<Runway>(strategyApi.business.runway, { cashOnHand: num(form.cash), monthlyRevenue: num(form.monthlyRevenue), monthlyExpenses: num(form.monthlyExpenses), revenueGrowthPct: opt(form.revenueGrowth), expenseGrowthPct: opt(form.expenseGrowth) }, num(form.monthlyExpenses) > 0);
  const grants = useCalc<Matches>(strategyApi.business.grantMatches, { stage: form.stage, industry: form.grantIndustry || undefined, state: form.state || undefined, amountNeeded: opt(form.amountNeeded), womenLed: true, indigenous: form.indigenous, regional: form.regional }, true, 500);

  const recommended = structures.result?.options.find((o) => o.type === structures.result?.recommended);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Compass className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Business strategy</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">The decisions before the paperwork</h1>
          <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">Which structure, what it is worth, what a raise costs, how long the cash lasts, and which grants are really for you.</p>
        </div>
        <Link href="/dashboard/formation" className="btn-secondary inline-flex items-center gap-2"><Building2 className="h-4 w-4" /> Formation studio</Link>
      </div>

      <JumpLinks items={[{ id: 'structure', label: 'Structure' }, { id: 'valuation', label: 'Valuation' }, { id: 'raise', label: 'A raise' }, { id: 'runway', label: 'Runway' }, { id: 'grants', label: 'Grants' }]} />

      <SavePlanBar
        area="BUSINESS"
        inputs={form}
        result={{ recommended: structures.result?.recommended ?? null, valuationMid: valuation.result?.range.mid ?? null, runwayMonths: runway.result?.runwayMonths ?? null, founderPctAfter: raise.result?.founderPctAfter ?? null }}
        onLoaded={(inputs) => setForm((f) => ({ ...f, ...(inputs as Partial<Form>) }))}
        summary={recommended ? `Leaning ${recommended.label.toLowerCase()}.` : undefined}
      />

      <Panel id="structure" icon={Compass} title="Which structure" intro="The same profit through each of the four, on this year’s tax scale, with the running costs and what each gives you beyond tax.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Profit this year, before your wage"><NumberInput value={form.profit} onChange={set('profit')} prefix="$" placeholder="120000" /></Field>
          <Field label="Your other income" hint="A salary alongside, if any."><NumberInput value={form.otherIncome} onChange={set('otherIncome')} prefix="$" /></Field>
          <Field label="Turnover" hint="Only matters past $50 million."><NumberInput value={form.turnover} onChange={set('turnover')} prefix="$" /></Field>
          <Field label="Profit kept in a company" hint="The rest is paid out to you."><NumberInput value={form.retainPct} onChange={set('retainPct')} suffix="%" min={0} max={100} /></Field>
          <Field label="Adults a trust could pay" hint="You, plus any lower-income adult in the family."><NumberInput value={form.beneficiaries} onChange={set('beneficiaries')} min={1} max={10} /></Field>
          <Field label="Partners, if a partnership"><NumberInput value={form.partners} onChange={set('partners')} min={2} max={20} /></Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Check checked={form.hasCoFounders} onChange={set('hasCoFounders')} label="I have co-founders" />
          <Check checked={form.assetProtection} onChange={set('assetProtection')} label="Protect my home and savings" />
          <Check checked={form.raisingCapital} onChange={set('raisingCapital')} label="I will raise from investors" />
          <Check checked={form.simplicity} onChange={set('simplicity')} label="Keep it simple" />
          <Check checked={form.flexibleDistribution} onChange={set('flexibleDistribution')} label="Share profit with family" />
        </div>

        {profit > 0 && (
          <Pending loading={structures.loading} error={structures.error}>
            {structures.result && recommended && (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl bg-rose-50 p-4 dark:bg-rose-900/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">Leaning</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{recommended.label}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    {structures.result.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {structures.result.options.map((o) => (
                    <div key={o.type} className={cn('rounded-xl border p-4', o.type === structures.result?.recommended ? 'border-rose-300 dark:border-rose-700' : 'border-slate-200 dark:border-slate-800', !o.available && 'opacity-60')}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{o.label}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{o.taxNote}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-slate-900 dark:text-white">{aud(o.taxOnProfit)}</p>
                          <p className="text-xs text-slate-500">tax, {pct(o.effectiveRate, 1)} of profit</p>
                        </div>
                      </div>
                      {!o.available && o.unavailableReason && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{o.unavailableReason}</p>}
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <dt>Set up</dt><dd className="text-right">{aud(o.setupCost.low)} to {aud(o.setupCost.high)}</dd>
                        <dt>Each year</dt><dd className="text-right">{aud(o.annualCost.low)} to {aud(o.annualCost.high)}</dd>
                        <dt>Protects your assets</dt><dd className="text-right tracking-widest">{dots(o.assetProtection)}</dd>
                        <dt>Investors can buy in</dt><dd className="text-right tracking-widest">{dots(o.raisingCapital)}</dd>
                        <dt>Simplicity</dt><dd className="text-right tracking-widest">{dots(4 - o.complexity)}</dd>
                      </dl>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <ul className="space-y-1 text-emerald-700 dark:text-emerald-300">{o.pros.map((p) => <li key={p}>+ {p}</li>)}</ul>
                        <ul className="space-y-1 text-slate-500 dark:text-slate-400">{o.cons.map((c) => <li key={c}>− {c}</li>)}</ul>
                      </div>
                    </div>
                  ))}
                </div>
                <Notes items={structures.result.notes} />
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <Panel id="valuation" icon={Landmark} title="What it is worth" intro="Three ordinary methods side by side, with the things that move the number named. A range, not a price tag.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Revenue, a year"><NumberInput value={form.revenue} onChange={set('revenue')} prefix="$" placeholder="400000" /></Field>
          <Field label="Owner’s earnings" hint="Profit before your wage and tax."><NumberInput value={form.annualProfit} onChange={set('annualProfit')} prefix="$" /></Field>
          <Field label="Growth, a year"><NumberInput value={form.growth} onChange={set('growth')} suffix="%" /></Field>
          <Field label="Industry"><SelectInput value={form.industry} onChange={set('industry')} options={INDUSTRIES} /></Field>
          <Field label="Recurring revenue" hint="Subscriptions, retainers."><NumberInput value={form.recurring} onChange={set('recurring')} suffix="%" min={0} max={100} /></Field>
          <Field label="Runs without you?"><SelectInput value={form.ownerDependence} onChange={set('ownerDependence')} options={[{ value: 'low', label: 'Mostly, there is a team' }, { value: 'medium', label: 'Partly' }, { value: 'high', label: 'No, I am the business' }]} /></Field>
          <Field label="Years operating"><NumberInput value={form.yearsOperating} onChange={set('yearsOperating')} min={0} /></Field>
          <Field label="Net assets" hint="Equipment and stock less debt."><NumberInput value={form.netAssets} onChange={set('netAssets')} prefix="$" /></Field>
        </div>
        {revenue > 0 && (
          <Pending loading={valuation.loading} error={valuation.error}>
            {valuation.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Low" value={aud(valuation.result.range.low)} />
                  <Stat label="Likely" value={aud(valuation.result.range.mid)} tone="rose" big sub={`${valuation.result.adjustmentPct >= 0 ? '+' : ''}${valuation.result.adjustmentPct}% on the ${valuation.result.industry.toLowerCase()} multiples`} />
                  <Stat label="High" value={aud(valuation.result.range.high)} />
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs text-slate-500">Revenue multiple</p><p className="font-medium text-slate-900 dark:text-white">{aud(valuation.result.methods.revenueMultiple.low)} to {aud(valuation.result.methods.revenueMultiple.high)}</p><p className="text-xs text-slate-500">{valuation.result.methods.revenueMultiple.multipleLow}× to {valuation.result.methods.revenueMultiple.multipleHigh}× revenue</p></div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs text-slate-500">Earnings multiple</p><p className="font-medium text-slate-900 dark:text-white">{aud(valuation.result.methods.earningsMultiple.low)} to {aud(valuation.result.methods.earningsMultiple.high)}</p><p className="text-xs text-slate-500">{valuation.result.methods.earningsMultiple.multipleLow}× to {valuation.result.methods.earningsMultiple.multipleHigh}× earnings</p></div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs text-slate-500">Discounted cash flow</p><p className="font-medium text-slate-900 dark:text-white">{aud(valuation.result.methods.discountedCashFlow.value)}</p><p className="text-xs text-slate-500">five years at {valuation.result.methods.discountedCashFlow.discountRatePct}%</p></div>
                </div>
                {valuation.result.drivers.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {valuation.result.drivers.map((d) => (
                      <li key={d.label} className="flex gap-2"><span className={cn('w-12 shrink-0 font-medium', d.effect >= 0 ? 'text-emerald-600' : 'text-amber-600')}>{d.effect >= 0 ? '+' : ''}{Math.round(d.effect * 100)}%</span><span className="text-slate-700 dark:text-slate-300"><strong className="font-medium">{d.label}.</strong> {d.detail}</span></li>
                    ))}
                  </ul>
                )}
                <Notes items={valuation.result.notes} />
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="raise" icon={PieChart} title="A raise" intro="What you keep after the round.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pre-money valuation"><NumberInput value={form.preMoney} onChange={set('preMoney')} prefix="$" placeholder={valuation.result ? String(valuation.result.range.mid) : '1500000'} /></Field>
            <Field label="Raising"><NumberInput value={form.raise} onChange={set('raise')} prefix="$" placeholder="300000" /></Field>
            <Field label="Option pool" hint="Set aside for future hires."><NumberInput value={form.pool} onChange={set('pool')} suffix="%" min={0} max={30} /></Field>
            <Field label="Founders own now"><NumberInput value={form.founderPct} onChange={set('founderPct')} suffix="%" min={0} max={100} /></Field>
          </div>
          {num(form.preMoney) > 0 && num(form.raise) > 0 && (
            <Pending loading={raise.loading} error={raise.error}>
              {raise.result && (
                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Founders after" value={pct(raise.result.founderPctAfter, 1)} sub={`worth ${aud(raise.result.founderValueAfter)}`} tone="rose" big />
                    <Stat label="Investor takes" value={pct(raise.result.investorPct, 1)} sub={`post-money ${aud(raise.result.postMoney)}`} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">At a valuation 20% lower ({aud(raise.result.ifValuationLower.preMoney)}) the founders would keep {pct(raise.result.ifValuationLower.founderPctAfter, 1)} instead.</p>
                  <Notes items={raise.result.notes} />
                </div>
              )}
            </Pending>
          )}
        </Panel>

        <Panel id="runway" icon={Timer} title="Runway" intro="How many months the cash lasts, and whether revenue catches up first.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cash in the bank"><NumberInput value={form.cash} onChange={set('cash')} prefix="$" /></Field>
            <Field label="Revenue, a month"><NumberInput value={form.monthlyRevenue} onChange={set('monthlyRevenue')} prefix="$" /></Field>
            <Field label="Expenses, a month"><NumberInput value={form.monthlyExpenses} onChange={set('monthlyExpenses')} prefix="$" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Revenue growth, monthly"><NumberInput value={form.revenueGrowth} onChange={set('revenueGrowth')} suffix="%" /></Field>
              <Field label="Cost growth"><NumberInput value={form.expenseGrowth} onChange={set('expenseGrowth')} suffix="%" /></Field>
            </div>
          </div>
          {num(form.monthlyExpenses) > 0 && (
            <Pending loading={runway.loading} error={runway.error}>
              {runway.result && (
                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Runway" value={runway.result.runwayMonths === null ? 'Not running out' : `${runway.result.runwayMonths} months`} sub={runway.result.runwayEnds ? `cash gone around ${runway.result.runwayEnds}` : `lowest point ${aud(runway.result.lowestCash)}`} tone={runway.result.runwayMonths !== null && runway.result.runwayMonths < 9 ? 'warn' : 'good'} big />
                    <Stat label="Break-even" value={runway.result.breakEvenMonth === null ? 'Not in 3 years' : `Month ${runway.result.breakEvenMonth}`} sub={`burning ${aud(runway.result.monthlyBurn)} a month now`} />
                  </div>
                  <LineChart series={[{ label: 'Cash', color: '#f43f5e', values: runway.result.series.map((p) => p.cash) }]} labels={runway.result.series.map((p) => `M${p.month}`)} height={140} />
                  <Notes items={runway.result.notes} />
                </div>
              )}
            </Pending>
          )}
        </Panel>
      </div>

      <Panel id="grants" icon={BadgeCheck} title="Grants that fit" intro="Every grant listed on the platform, scored against your stage, industry, state and the amount you need. Apply from the grants page." aside={<Link href="/dashboard/grants" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">All grants</Link>}>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Stage"><SelectInput value={form.stage} onChange={set('stage')} options={STAGES} /></Field>
          <Field label="Industry"><input value={form.grantIndustry} onChange={(e) => set('grantIndustry')(e.target.value)} placeholder="e.g. Technology" className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:text-white" /></Field>
          <Field label="State"><SelectInput value={form.state} onChange={set('state')} options={STATES} /></Field>
          <Field label="Amount you need"><NumberInput value={form.amountNeeded} onChange={set('amountNeeded')} prefix="$" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <Check checked={form.indigenous} onChange={set('indigenous')} label="First Nations business" />
          <Check checked={form.regional} onChange={set('regional')} label="Regional or remote" />
        </div>
        <Pending loading={grants.loading} error={grants.error}>
          {grants.result && (
            grants.result.matches.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">No open grants are listed yet. The grants page fills as programs are added.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {grants.result.matches.slice(0, 10).map((g) => (
                  <li key={g.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{g.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{g.provider}{g.maxFunding ? ` · up to ${aud(Number(g.maxFunding))}` : ''}{g.isRolling ? ' · rolling' : g.deadline ? ` · closes ${String(g.deadline).slice(0, 10)}` : ''}</p>
                      </div>
                      <div className="w-32">
                        <Bars rows={[{ label: 'Fit', value: g.match.score, display: `${g.match.score}%`, color: g.match.score >= 70 ? 'bg-emerald-500' : g.match.score >= 40 ? 'bg-amber-400' : 'bg-slate-400' }]} max={100} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {g.match.reasons.map((r) => <span key={r} className="text-emerald-700 dark:text-emerald-300">✓ {r}</span>)}
                      {g.match.gaps.map((r) => <span key={r} className="text-amber-700 dark:text-amber-300">! {r}</span>)}
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </Pending>
      </Panel>

      <Disclaimer asAt={structures.result?.asAt} />
    </div>
  );
}
