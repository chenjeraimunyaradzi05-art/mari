'use client';

/**
 * The investing plan: a risk profile from six questions, the mix it points
 * to, what she owns against it, where it goes over the years, and the
 * emergency fund that comes before any of it. General information, and it
 * says so; the profile is saved with the plan so net worth reads it back.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Activity, LifeBuoy, PieChart, Plus, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { strategyApi, apiMessage } from '@/lib/strategy-api';
import { financeApi } from '@/lib/api';
import { Bars, Disclaimer, Field, JumpLinks, LineChart, Notes, NumberInput, Panel, Pending, SavePlanBar, SelectInput, Stat, aud, inputClass, num, opt, pct, useCalc } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

const QUESTIONS: Array<{ id: string; text: string; options: string[] }> = [
  { id: 'horizon', text: 'When will you need most of this money?', options: ['Within 3 years', '3 to 5 years', '5 to 10 years', 'More than 10 years'] },
  { id: 'drop', text: 'Your investments fall 20% in a bad year. You would…', options: ['Sell so it cannot fall further', 'Move some to cash', 'Hold on', 'Buy more while it is cheap'] },
  { id: 'experience', text: 'How much investing have you done?', options: ['None, this is new', 'A little, mostly savings', 'Some shares or ETFs', 'Comfortable with a portfolio'] },
  { id: 'income', text: 'How steady is your income?', options: ['Irregular, or between jobs', 'Casual or part-time', 'Steady', 'Steady, with savings to spare'] },
  { id: 'goal', text: 'What matters more?', options: ['Never losing money', 'Mostly steady, some growth', 'Growth, with some bumps', 'The most growth over time'] },
  { id: 'access', text: 'Could you leave it alone through a downturn?', options: ['No, I may need it', 'Probably not', 'Yes, for a year or two', 'Yes, for as long as it takes'] },
];

const CATEGORIES = [
  ['CASH', 'Cash and savings'], ['BONDS', 'Bonds and fixed interest'], ['AU_SHARES', 'Australian shares'], ['INTL_SHARES', 'International shares'], ['PROPERTY', 'Property'], ['SUPER', 'Superannuation'], ['CRYPTO', 'Crypto'], ['BUSINESS', 'Business equity'], ['OTHER_ASSET', 'Other asset'],
  ['MORTGAGE', 'Mortgage'], ['HECS', 'HELP debt'], ['CREDIT_CARD', 'Credit card'], ['PERSONAL_LOAN', 'Personal or car loan'], ['OTHER_LIABILITY', 'Other debt'],
].map(([value, label]) => ({ value, label }));

type Form = {
  answers: Record<string, number>; age: string;
  investments: string; superNow: string; monthly: string; salary: string; salaryGrowth: string; years: string; extra: string; breakStart: string; breakYears: string;
  expenses: string; months: string; efSavings: string; efMonthly: string; stability: string;
};

const DEFAULTS: Form = {
  answers: {}, age: '',
  investments: '', superNow: '', monthly: '', salary: '', salaryGrowth: '3', years: '15', extra: '200', breakStart: '3', breakYears: '2',
  expenses: '', months: '', efSavings: '', efMonthly: '', stability: 'stable',
};

type Profile = { profile: string; label: string; summary: string; score: number; maxScore: number; growthPct: number; defensivePct: number; allocation: Array<{ assetClass: string; label: string; pct: number }>; expectedReturnPct: number; volatilityPct: number; cappedBy: string | null; notes: string[]; asAt: string };
type Holding = { id: string; name: string; kind: 'ASSET' | 'LIABILITY'; category: string; value: string | number; notes?: string | null };
type NetWorth = { totalAssets: number; totalLiabilities: number; netWorth: number; investable: number; profile: string | null; byCategory: Array<{ category: string; label: string; kind: string; value: number; pctOfAssets: number }>; allocation: Array<{ assetClass: string; label: string; value: number; currentPct: number; targetPct: number; drift: number; move: number }>; suggestions: string[]; warnings: string[] };
type Projection = { years: number; returnPct: number; scenarios: Array<{ key: string; label: string; endTotal: number; endRealTotal: number; totalContributed: number; growth: number; milestones: Array<{ amount: number; year: number | null }>; series: Array<{ year: number; total: number }> }>; notes: string[] };
type Emergency = { monthsRecommended: number; target: number; current: number; gap: number; progressPct: number; monthsToTarget: number | null; targetDate: string | null; milestones: Array<{ pct: number; amount: number; reached: boolean }>; notes: string[] };

const COLORS = ['#f43f5e', '#a855f7', '#f59e0b', '#10b981', '#3b82f6'];

export default function InvestPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const answered = QUESTIONS.every((q) => form.answers[q.id]);

  const profile = useCalc<Profile>(strategyApi.investing.riskProfile, { answers: form.answers, age: opt(form.age) }, answered);

  // Holdings are the member's own records, loaded once and after each change.
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingsLoaded, setHoldingsLoaded] = useState(false);
  const [newHolding, setNewHolding] = useState({ name: '', category: 'CASH', value: '' });
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
  const [netWorthError, setNetWorthError] = useState<string | null>(null);
  const profileId = profile.result?.profile;

  const loadNetWorth = useCallback(async () => {
    try {
      const [h, nw] = await Promise.all([strategyApi.investing.getHoldings(), strategyApi.investing.netWorth(profileId ? { profile: profileId } : undefined)]);
      setHoldings(h.data?.data ?? []);
      setNetWorth(nw.data?.data ?? null);
      setNetWorthError(null);
    } catch (err) {
      setNetWorthError(apiMessage(err, 'Sign in to keep holdings and see net worth.'));
    } finally {
      setHoldingsLoaded(true);
    }
  }, [profileId]);

  useEffect(() => { loadNetWorth(); }, [loadNetWorth]);

  const addHolding = async () => {
    if (!newHolding.name.trim() || !newHolding.value) { toast.error('A name and a value, please.'); return; }
    try {
      await strategyApi.investing.addHolding({ name: newHolding.name.trim(), category: newHolding.category, value: num(newHolding.value) });
      setNewHolding({ name: '', category: newHolding.category, value: '' });
      await loadNetWorth();
    } catch (err) {
      toast.error(apiMessage(err, 'That could not be added.'));
    }
  };

  const removeHolding = async (id: string) => {
    try {
      await strategyApi.investing.deleteHolding(id);
      await loadNetWorth();
    } catch (err) {
      toast.error(apiMessage(err, 'That could not be removed.'));
    }
  };

  const projection = useCalc<Projection>(strategyApi.investing.projection, { currentInvestments: opt(form.investments), currentSuper: opt(form.superNow), monthlyContribution: opt(form.monthly), salary: opt(form.salary), salaryGrowthPct: opt(form.salaryGrowth), years: num(form.years, 15), extraMonthly: opt(form.extra), careerBreak: { startYear: num(form.breakStart, 3), years: num(form.breakYears, 2) }, profile: profileId }, num(form.monthly) > 0 || num(form.investments) > 0 || num(form.superNow) > 0);

  const expenses = num(form.expenses);
  const emergency = useCalc<Emergency>(strategyApi.investing.emergencyFund, { monthlyExpenses: expenses, months: opt(form.months), currentSavings: opt(form.efSavings), monthlySaving: opt(form.efMonthly), incomeStability: form.stability }, expenses > 0);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const startEmergencyGoal = async () => {
    if (!emergency.result) return;
    setCreatingGoal(true);
    try {
      await financeApi.createSavingsGoal({ name: `Emergency fund, ${emergency.result.monthsRecommended} months`, type: 'EMERGENCY_FUND', targetAmount: emergency.result.target, monthlyTarget: opt(form.efMonthly) });
      toast.success('Emergency fund goal started');
    } catch (err) {
      toast.error(apiMessage(err, 'The goal could not be created.'));
    } finally {
      setCreatingGoal(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Investing plan</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">Building wealth, at your own pace</h1>
          <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">The safety net first. Then the mix that suits you, what you own against it, and where it all goes if you keep going.</p>
        </div>
        <Link href="/dashboard/finance/savings" className="btn-secondary inline-flex items-center gap-2">Savings goals</Link>
      </div>

      <JumpLinks items={[{ id: 'emergency', label: 'Safety net' }, { id: 'profile', label: 'Your mix' }, { id: 'net-worth', label: 'What you own' }, { id: 'projection', label: 'Where it goes' }]} />

      <SavePlanBar
        area="INVESTMENT"
        inputs={form}
        result={{ profile: profileId ?? null, label: profile.result?.label ?? null, netWorth: netWorth?.netWorth ?? null, emergencyTarget: emergency.result?.target ?? null, endTotal: projection.result?.scenarios[0]?.endTotal ?? null }}
        onLoaded={(inputs) => setForm((f) => ({ ...f, ...(inputs as Partial<Form>) }))}
        summary={profile.result ? `${profile.result.label} mix.` : undefined}
      />

      <Panel id="emergency" icon={LifeBuoy} title="The safety net first" intro="Three to six months of expenses somewhere you can reach in a day. It is what lets everything else stay invested through a bad year.">
        <div className="grid gap-4 md:grid-cols-5">
          <Field label="Expenses, a month"><NumberInput value={form.expenses} onChange={set('expenses')} prefix="$" placeholder="3800" /></Field>
          <Field label="Income"><SelectInput value={form.stability} onChange={set('stability')} options={[{ value: 'stable', label: 'Steady' }, { value: 'variable', label: 'Variable or casual' }, { value: 'single_income_with_dependants', label: 'One income, dependants' }]} /></Field>
          <Field label="Months to cover" hint="Blank picks from your income."><NumberInput value={form.months} onChange={set('months')} min={1} max={12} placeholder="auto" /></Field>
          <Field label="Saved for it now"><NumberInput value={form.efSavings} onChange={set('efSavings')} prefix="$" /></Field>
          <Field label="Adding each month"><NumberInput value={form.efMonthly} onChange={set('efMonthly')} prefix="$" /></Field>
        </div>
        {expenses > 0 && (
          <Pending loading={emergency.loading} error={emergency.error}>
            {emergency.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label={`${emergency.result.monthsRecommended} months of expenses`} value={aud(emergency.result.target)} sub={`${pct(emergency.result.progressPct)} there, ${aud(emergency.result.gap)} to go`} tone="rose" big />
                  <Stat label="At this rate" value={emergency.result.monthsToTarget === null ? 'Add a monthly amount' : emergency.result.monthsToTarget === 0 ? 'Done' : `${emergency.result.monthsToTarget} months`} sub={emergency.result.targetDate ? `around ${emergency.result.targetDate}` : undefined} tone={emergency.result.gap === 0 ? 'good' : 'plain'} />
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Milestones</p>
                    <div className="mt-2 flex gap-1">
                      {emergency.result.milestones.map((m) => <div key={m.pct} className={cn('h-2 flex-1 rounded-full', m.reached ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')} title={`${m.pct}%: ${aud(m.amount)}`} />)}
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{emergency.result.milestones.map((m) => `${m.pct}% ${aud(m.amount)}`).join(' · ')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={startEmergencyGoal} disabled={creatingGoal} className="btn-primary inline-flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> {creatingGoal ? 'Starting…' : 'Track it as a savings goal'}</button>
                  <Link href="/dashboard/finance/insurance" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Income protection, the other half of the net</Link>
                </div>
                <Notes items={emergency.result.notes} />
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <Panel id="profile" icon={Sparkles} title="Your mix" intro="Six questions. The answer is the split between growth and defensive assets that people in your position usually hold, not a recommendation for you.">
        <div className="grid gap-4 md:grid-cols-2">
          {QUESTIONS.map((q) => (
            <fieldset key={q.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <legend className="px-1 text-sm font-medium text-slate-800 dark:text-slate-200">{q.text}</legend>
              <div className="mt-1 grid gap-1">
                {q.options.map((label, i) => (
                  <label key={label} className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm', form.answers[q.id] === i + 1 ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800')}>
                    <input type="radio" name={q.id} checked={form.answers[q.id] === i + 1} onChange={() => setForm((f) => ({ ...f, answers: { ...f.answers, [q.id]: i + 1 } }))} className="h-3.5 w-3.5 text-rose-500" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-4 max-w-xs"><Field label="Your age" hint="Optional. Near retirement, the mix leans safer."><NumberInput value={form.age} onChange={set('age')} min={16} max={110} /></Field></div>
        {answered && (
          <Pending loading={profile.loading} error={profile.error}>
            {profile.result && (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="rounded-xl bg-rose-50 p-4 dark:bg-rose-900/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">{profile.result.growthPct}% growth, {profile.result.defensivePct}% defensive</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{profile.result.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{profile.result.summary}</p>
                  {profile.result.cappedBy && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Held back a notch: {profile.result.cappedBy.toLowerCase()}.</p>}
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Long-run assumption {profile.result.expectedReturnPct}% a year, with swings of about {profile.result.volatilityPct}% in a bad year.</p>
                </div>
                <div>
                  <Bars rows={profile.result.allocation.map((a, i) => ({ label: a.label, value: a.pct, display: `${a.pct}%`, color: ['bg-slate-400', 'bg-blue-400', 'bg-emerald-400', 'bg-purple-400', 'bg-amber-400'][i] }))} max={60} />
                  <Notes items={profile.result.notes} />
                </div>
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <Panel id="net-worth" icon={PieChart} title="What you own" intro="Add what you hold and owe. Super accounts and savings goals you already track are counted in automatically." aside={<Link href="/dashboard/finance/super" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Super tracker</Link>}>
        {netWorthError && holdingsLoaded && <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{netWorthError}</p>}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <Field label="What is it"><input value={newHolding.name} onChange={(e) => setNewHolding((h) => ({ ...h, name: e.target.value }))} placeholder="e.g. Vanguard ETF, car loan" className={inputClass} /></Field>
          <Field label="Kind"><SelectInput value={newHolding.category} onChange={(v) => setNewHolding((h) => ({ ...h, category: v }))} options={CATEGORIES} /></Field>
          <Field label="Value"><NumberInput value={newHolding.value} onChange={(v) => setNewHolding((h) => ({ ...h, value: v }))} prefix="$" /></Field>
          <button type="button" onClick={addHolding} className="btn-primary inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Add</button>
        </div>

        {holdings.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {holdings.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2">
                <span className="text-slate-800 dark:text-slate-200">{h.name} <span className="text-xs text-slate-400">· {CATEGORIES.find((c) => c.value === h.category)?.label ?? h.category}</span></span>
                <span className="flex items-center gap-3">
                  <span className={cn('font-medium', h.kind === 'LIABILITY' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white')}>{h.kind === 'LIABILITY' ? '−' : ''}{aud(Number(h.value))}</span>
                  <button type="button" onClick={() => removeHolding(h.id)} className="text-slate-400 hover:text-rose-500" aria-label={`Remove ${h.name}`}><Trash2 className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {netWorth && (netWorth.totalAssets > 0 || netWorth.totalLiabilities > 0) && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Net worth" value={aud(netWorth.netWorth)} sub={`${aud(netWorth.totalAssets)} owned, ${aud(netWorth.totalLiabilities)} owed`} tone="rose" big />
              <Stat label="Invested outside super" value={aud(netWorth.investable)} sub="after the emergency fund" />
              <Stat label="Measured against" value={netWorth.profile ? netWorth.profile.replace('_', ' ') : 'balanced'} sub={netWorth.profile ? 'your mix above' : 'answer the questions to use yours'} />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">By kind</h3>
                <div className="mt-3"><Bars rows={netWorth.byCategory.map((c) => ({ label: c.label, value: c.value, display: `${c.kind === 'LIABILITY' ? '−' : ''}${aud(c.value)}`, color: c.kind === 'LIABILITY' ? 'bg-amber-400' : 'bg-rose-400' }))} /></div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Against the mix <span className="font-normal text-slate-400">(marker is the target)</span></h3>
                <div className="mt-3"><Bars rows={netWorth.allocation.map((a) => ({ label: a.label, value: a.currentPct, display: `${Math.round(a.currentPct)}% of ${a.targetPct}%`, color: Math.abs(a.drift) > 5 ? 'bg-amber-400' : 'bg-emerald-400', marker: a.targetPct }))} max={100} /></div>
              </div>
            </div>
            <ul className="space-y-1 text-sm">
              {netWorth.suggestions.map((s) => <li key={s} className="text-slate-700 dark:text-slate-300">→ {s}</li>)}
              {netWorth.warnings.map((w) => <li key={w} className="text-amber-700 dark:text-amber-300">! {w}</li>)}
            </ul>
          </div>
        )}
      </Panel>

      <Panel id="projection" icon={Activity} title="Where it goes" intro="Keep going as you are, add a little more, or take a break. All three, side by side, in today’s dollars too.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Invested now, outside super"><NumberInput value={form.investments} onChange={set('investments')} prefix="$" /></Field>
          <Field label="Super now"><NumberInput value={form.superNow} onChange={set('superNow')} prefix="$" /></Field>
          <Field label="Investing each month"><NumberInput value={form.monthly} onChange={set('monthly')} prefix="$" placeholder="400" /></Field>
          <Field label="Salary" hint="For employer super at 12%."><NumberInput value={form.salary} onChange={set('salary')} prefix="$" /></Field>
          <Field label="Salary growth, a year"><NumberInput value={form.salaryGrowth} onChange={set('salaryGrowth')} suffix="%" /></Field>
          <Field label="Years"><NumberInput value={form.years} onChange={set('years')} min={1} max={40} /></Field>
          <Field label="The extra to test"><NumberInput value={form.extra} onChange={set('extra')} prefix="$" suffix="/mo" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Break from year"><NumberInput value={form.breakStart} onChange={set('breakStart')} min={1} /></Field>
            <Field label="For"><NumberInput value={form.breakYears} onChange={set('breakYears')} suffix="yrs" min={0} /></Field>
          </div>
        </div>
        <Pending loading={projection.loading} error={projection.error}>
          {projection.result && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {projection.result.scenarios.map((s, i) => (
                  <Stat key={s.key} label={s.label} value={aud(s.endTotal)} sub={`${aud(s.endRealTotal)} in today’s dollars · ${aud(s.growth)} of it is growth`} tone={i === 0 ? 'rose' : i === 1 ? 'good' : 'warn'} big={i === 0} />
                ))}
              </div>
              <LineChart series={projection.result.scenarios.map((s, i) => ({ label: s.label, color: COLORS[i], values: s.series.map((p) => p.total) }))} labels={projection.result.scenarios[0].series.map((p) => `Yr ${p.year}`)} />
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                {projection.result.scenarios[0].milestones.filter((m) => m.year !== null).map((m) => <span key={m.amount}>{aud(m.amount)} in year {m.year}</span>)}
              </div>
              <Notes items={projection.result.notes} />
            </div>
          )}
        </Pending>
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer asAt={profile.result?.asAt} advice />
        <Link href="/dashboard/finance/tax/plan#super" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">The super moves that cut tax</Link>
      </div>
    </div>
  );
}
