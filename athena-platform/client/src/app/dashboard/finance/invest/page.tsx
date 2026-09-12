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
import { Activity, Coins, History, LifeBuoy, ListChecks, PieChart, Plus, ScrollText, Sparkles, Trash2, TrendingUp } from 'lucide-react';
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
  estate: Record<string, boolean>; taxableIncome: string; roundTo: string;
};

const DEFAULTS: Form = {
  answers: {}, age: '',
  investments: '', superNow: '', monthly: '', salary: '', salaryGrowth: '3', years: '15', extra: '200', breakStart: '3', breakYears: '2',
  expenses: '', months: '', efSavings: '', efMonthly: '', stability: 'stable',
  estate: {}, taxableIncome: '', roundTo: '5',
};

type Profile = { profile: string; label: string; summary: string; score: number; maxScore: number; growthPct: number; defensivePct: number; allocation: Array<{ assetClass: string; label: string; pct: number }>; expectedReturnPct: number; volatilityPct: number; cappedBy: string | null; notes: string[]; asAt: string };
type Holding = { id: string; name: string; kind: 'ASSET' | 'LIABILITY'; category: string; value: string | number; notes?: string | null };
type NetWorth = { totalAssets: number; totalLiabilities: number; netWorth: number; investable: number; profile: string | null; byCategory: Array<{ category: string; label: string; kind: string; value: number; pctOfAssets: number }>; allocation: Array<{ assetClass: string; label: string; value: number; currentPct: number; targetPct: number; drift: number; move: number }>; suggestions: string[]; warnings: string[]; wholeOfWealth?: { growthPct: number; defensivePct: number; targetGrowthPct: number; superGrowthPct: number | null; superBalance: number; note: string }; incomeEstimate?: { annual: number; monthly: number; byCategory: Array<{ category: string; label: string; value: number; yieldPct: number; income: number }>; note: string } };
type Projection = { years: number; returnPct: number; scenarios: Array<{ key: string; label: string; endTotal: number; endRealTotal: number; totalContributed: number; growth: number; milestones: Array<{ amount: number; year: number | null }>; series: Array<{ year: number; total: number }> }>; notes: string[] };
type Emergency = { monthsRecommended: number; target: number; current: number; gap: number; progressPct: number; monthsToTarget: number | null; targetDate: string | null; milestones: Array<{ pct: number; amount: number; reached: boolean }>; notes: string[] };

type Roadmap = { steps: Array<{ key: string; title: string; why: string; status: 'done' | 'in_progress' | 'next' | 'later'; href: string; detail: string }>; completed: number; total: number; personalRunwayMonths: number | null; cash: number; monthlyExpenses: number | null };
type Peers = { members: number; enough: boolean; emergencyFund: { withGoalPct: number; medianProgressPct: number; reachedPct: number } | null; superTrackedPct: number | null; investingPlanPct: number | null; note: string };
type RoundUps = { roundTo: number; days: number; purchases: number; total: number; monthlyEstimate: number; yearlyEstimate: number; yearlyWithReturn: number; examples: Array<{ description: string; spent: number; roundUp: number }>; note: string };
type Review = { holdings: Array<{ id?: string; name: string; value: number; costBase: number | null; gain: number | null; gainPct: number | null; heldMonths: number | null; discountEligible: boolean; taxIfSold: number | null }>; unrealisedGains: number; unrealisedLosses: number; netPosition: number; taxIfAllSold: number; harvest: Array<{ name: string; loss: number; note: string }>; notes: string[] };
type NetWorthHistory = { points: Array<{ day: string; netWorth: number }>; change: number; since: string | null; milestones: Array<{ amount: number; reachedOn: string | null }> };

const ESTATE_ITEMS = [
  { key: 'will', label: 'A will', why: 'Without one the state decides who gets what, and it is rarely what you would have chosen.' },
  { key: 'attorney', label: 'An enduring power of attorney', why: 'Someone to manage money and decisions if you cannot, chosen by you rather than a tribunal.' },
  { key: 'super_nomination', label: 'A binding nomination on your super', why: 'Super does not pass under a will. Tell the fund who gets it, and make it non-lapsing.' },
  { key: 'insurance_beneficiaries', label: 'Beneficiaries on any life cover', why: 'So the payout goes straight to them, outside the estate.' },
  { key: 'guardian', label: 'A guardian named for any children', why: 'In the will, with the person asked first.' },
  { key: 'digital', label: 'A list of accounts and where the passwords are', why: 'Somewhere the executor can find it; not in the will, which becomes public.' },
];

const COLORS = ['#f43f5e', '#a855f7', '#f59e0b', '#10b981', '#3b82f6'];

export default function InvestPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const answered = QUESTIONS.every((q) => form.answers[q.id]);

  const profile = useCalc<Profile>(strategyApi.investing.riskProfile, { answers: form.answers, age: opt(form.age) }, answered);

  // Holdings are the member's own records, loaded once and after each change.
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingsLoaded, setHoldingsLoaded] = useState(false);
  const [newHolding, setNewHolding] = useState({ name: '', category: 'CASH', value: '', costBase: '', acquiredAt: '' });
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
  const [netWorthError, setNetWorthError] = useState<string | null>(null);
  const [history, setHistory] = useState<NetWorthHistory | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [peers, setPeers] = useState<Peers | null>(null);
  const [roundUps, setRoundUps] = useState<RoundUps | null>(null);
  const [roundUpsError, setRoundUpsError] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const profileId = profile.result?.profile;
  const taxable = num(form.taxableIncome);

  const loadNetWorth = useCallback(async () => {
    try {
      const [h, nw, hist, rev] = await Promise.all([
        strategyApi.investing.getHoldings(),
        strategyApi.investing.netWorth(profileId ? { profile: profileId } : undefined),
        strategyApi.investing.netWorthHistory().catch(() => null),
        strategyApi.investing.holdingsReview(taxable > 0 ? { taxableIncome: taxable } : undefined).catch(() => null),
      ]);
      setHoldings(h.data?.data ?? []);
      setNetWorth(nw.data?.data ?? null);
      setHistory(hist?.data?.data ?? null);
      setReview(rev?.data?.data ?? null);
      setNetWorthError(null);
    } catch (err) {
      setNetWorthError(apiMessage(err, 'Sign in to keep holdings and see net worth.'));
    } finally {
      setHoldingsLoaded(true);
    }
  }, [profileId, taxable]);

  useEffect(() => { loadNetWorth(); }, [loadNetWorth]);

  // The roadmap and the peer snapshot are the member's own; a visitor sees neither.
  useEffect(() => {
    strategyApi.roadmap().then((r) => setRoadmap(r.data?.data ?? null)).catch(() => setRoadmap(null));
    strategyApi.peers().then((r) => setPeers(r.data?.data ?? null)).catch(() => setPeers(null));
  }, []);

  const roundTo = num(form.roundTo, 5);
  useEffect(() => {
    strategyApi.investing.roundUps({ roundTo, days: 30 })
      .then((r) => { setRoundUps(r.data?.data ?? null); setRoundUpsError(null); })
      .catch((err) => setRoundUpsError(apiMessage(err, 'Connect a bank or paste a statement to see round-ups.')));
  }, [roundTo]);

  const applyRoundUps = async () => {
    if (!roundUps) return;
    setAutoSaving(true);
    try {
      const goals: Array<{ id: string; type: string; status: string }> = (await financeApi.getSavingsGoals()).data?.data ?? [];
      const ef = goals.find((g) => g.type === 'EMERGENCY_FUND' && g.status === 'ACTIVE');
      if (!ef) { toast.error('Start an emergency fund goal first, just above.'); return; }
      await financeApi.updateSavingsGoal(ef.id, { autoSaveEnabled: true, autoSaveAmount: roundUps.monthlyEstimate });
      toast.success(`Auto-save of ${aud(roundUps.monthlyEstimate)} a month set on the emergency fund`);
    } catch (err) {
      toast.error(apiMessage(err, 'That could not be set.'));
    } finally {
      setAutoSaving(false);
    }
  };

  const addHolding = async () => {
    if (!newHolding.name.trim() || !newHolding.value) { toast.error('A name and a value, please.'); return; }
    try {
      await strategyApi.investing.addHolding({ name: newHolding.name.trim(), category: newHolding.category, value: num(newHolding.value), costBase: opt(newHolding.costBase), acquiredAt: newHolding.acquiredAt || undefined });
      setNewHolding({ name: '', category: newHolding.category, value: '', costBase: '', acquiredAt: '' });
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

      <JumpLinks items={[{ id: 'roadmap', label: 'Roadmap' }, { id: 'emergency', label: 'Safety net' }, { id: 'round-ups', label: 'Round-ups' }, { id: 'profile', label: 'Your mix' }, { id: 'net-worth', label: 'What you own' }, { id: 'projection', label: 'Where it goes' }, { id: 'estate', label: 'A will' }]} />

      <SavePlanBar
        area="INVESTMENT"
        inputs={form}
        result={{ profile: profileId ?? null, label: profile.result?.label ?? null, netWorth: netWorth?.netWorth ?? null, emergencyTarget: emergency.result?.target ?? null, endTotal: projection.result?.scenarios[0]?.endTotal ?? null }}
        onLoaded={(inputs) => setForm((f) => ({ ...f, ...(inputs as Partial<Form>) }))}
        summary={profile.result ? `${profile.result.label} mix.` : undefined}
      />

      {roadmap && (
        <Panel id="roadmap" icon={ListChecks} title="Your roadmap" intro={`${roadmap.completed} of ${roadmap.total} in place.${roadmap.personalRunwayMonths !== null ? ` Your cash covers ${roadmap.personalRunwayMonths} months of expenses.` : ''} One thing at a time, in the order that holds up.`}>
          <ol className="grid gap-2 md:grid-cols-2">
            {roadmap.steps.map((s, i) => (
              <li key={s.key}>
                <Link href={s.href} className={cn('flex h-full gap-3 rounded-xl border p-3 transition hover:border-rose-300', s.status === 'next' ? 'border-rose-300 bg-rose-50/60 dark:border-rose-700 dark:bg-rose-900/10' : s.status === 'done' ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-slate-200 dark:border-slate-800')}>
                  <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold', s.status === 'done' ? 'bg-emerald-500 text-white' : s.status === 'next' ? 'bg-rose-500 text-white' : s.status === 'in_progress' ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>{s.status === 'done' ? '✓' : i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900 dark:text-white">{s.title}</span><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.status.replace('_', ' ')}</span></span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{s.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {peers && peers.enough && peers.emergencyFund && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Across members: {pct(peers.emergencyFund.withGoalPct)} have an emergency fund goal and the middle one is {pct(peers.emergencyFund.medianProgressPct)} of the way; {pct(peers.superTrackedPct ?? 0)} track their super. {peers.note}</p>
          )}
        </Panel>
      )}

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

      <Panel id="round-ups" icon={Coins} title="Round-ups" intro="What rounding every card purchase up would have put aside last month, read from your bank feed. Set it as the auto-save on the emergency fund and the decision is made once." aside={<Link href="/dashboard/finance/banking" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Bank feeds</Link>}>
        <div className="max-w-xs"><Field label="Round each purchase up to the nearest"><SelectInput value={form.roundTo} onChange={set('roundTo')} options={[{ value: '1', label: '$1' }, { value: '5', label: '$5' }, { value: '10', label: '$10' }]} /></Field></div>
        {roundUpsError && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{roundUpsError}</p>}
        {roundUps && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Last 30 days" value={aud(roundUps.total)} sub={`${roundUps.purchases} purchases rounded up`} tone="good" big />
              <Stat label="A month, about" value={aud(roundUps.monthlyEstimate)} sub={`${aud(roundUps.yearlyEstimate)} a year`} />
              <Stat label="A year, in a savings account" value={aud(roundUps.yearlyWithReturn)} sub="at 4.5%" />
            </div>
            {roundUps.examples.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{roundUps.examples.map((e) => `${e.description} ${aud(e.spent)} → +${aud(e.roundUp)}`).join(' · ')}</p>}
            {roundUps.monthlyEstimate > 0 && <button type="button" onClick={applyRoundUps} disabled={autoSaving} className="btn-secondary inline-flex items-center gap-2"><Coins className="h-4 w-4" /> {autoSaving ? 'Setting…' : 'Auto-save this on the emergency fund'}</button>}
          </div>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr_auto] lg:items-end">
          <Field label="What is it"><input value={newHolding.name} onChange={(e) => setNewHolding((h) => ({ ...h, name: e.target.value }))} placeholder="e.g. Vanguard ETF, car loan" className={inputClass} /></Field>
          <Field label="Kind"><SelectInput value={newHolding.category} onChange={(v) => setNewHolding((h) => ({ ...h, category: v }))} options={CATEGORIES} /></Field>
          <Field label="Value"><NumberInput value={newHolding.value} onChange={(v) => setNewHolding((h) => ({ ...h, value: v }))} prefix="$" /></Field>
          <Field label="Cost" hint="What you paid, for gains."><NumberInput value={newHolding.costBase} onChange={(v) => setNewHolding((h) => ({ ...h, costBase: v }))} prefix="$" /></Field>
          <Field label="Bought on"><input type="date" value={newHolding.acquiredAt} onChange={(e) => setNewHolding((h) => ({ ...h, acquiredAt: e.target.value }))} className={inputClass} /></Field>
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
            {(netWorth.wholeOfWealth || netWorth.incomeEstimate) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {netWorth.wholeOfWealth && <Stat label="Growth assets, super included" value={`${Math.round(netWorth.wholeOfWealth.growthPct)}% growth`} sub={netWorth.wholeOfWealth.note} tone={Math.abs(netWorth.wholeOfWealth.growthPct - netWorth.wholeOfWealth.targetGrowthPct) <= 10 ? 'good' : 'warn'} />}
                {netWorth.incomeEstimate && netWorth.incomeEstimate.annual > 0 && <Stat label="Income the holdings might pay" value={`${aud(netWorth.incomeEstimate.annual)} a year`} sub={`${aud(netWorth.incomeEstimate.monthly)} a month. ${netWorth.incomeEstimate.byCategory.map((c) => `${c.label} ${c.yieldPct}%`).join(', ')}. ${netWorth.incomeEstimate.note}`} />}
              </div>
            )}
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

        {history && history.points.length > 1 && (
          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"><History className="h-4 w-4 text-rose-500" /> Where it has gone</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{history.change >= 0 ? 'Up' : 'Down'} {aud(Math.abs(history.change))} since {history.since}.{history.milestones.filter((m) => m.reachedOn).length > 0 ? ` ${history.milestones.filter((m) => m.reachedOn).map((m) => `${aud(m.amount)} on ${m.reachedOn}`).join(' · ')}` : ''}</p>
            <div className="mt-2"><LineChart series={[{ label: 'Net worth', color: '#f43f5e', values: history.points.map((p) => p.netWorth) }]} labels={history.points.map((p) => p.day.slice(5))} height={140} /></div>
          </div>
        )}

        {review && review.holdings.some((h) => h.gain !== null) && (
          <div className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Gains, losses and the tax on them</h3>
              <div className="w-44"><Field label="Your taxable income"><NumberInput value={form.taxableIncome} onChange={set('taxableIncome')} prefix="$" placeholder="90000" /></Field></div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="Unrealised gains" value={aud(review.unrealisedGains)} tone="good" />
              <Stat label="Unrealised losses" value={aud(review.unrealisedLosses)} tone="warn" />
              <Stat label="Tax if you sold it all" value={aud(review.taxIfAllSold)} sub="after the discount on anything held over a year" />
            </div>
            <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {review.holdings.filter((h) => h.gain !== null).map((h) => (
                <li key={h.id ?? h.name} className="flex items-center justify-between py-1.5">
                  <span className="text-slate-800 dark:text-slate-200">{h.name} <span className="text-xs text-slate-400">{h.heldMonths !== null ? `· held ${h.heldMonths} months${h.discountEligible ? ', discount applies' : ''}` : ''}</span></span>
                  <span className={cn('font-medium', (h.gain ?? 0) >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>{(h.gain ?? 0) >= 0 ? '+' : ''}{aud(h.gain)}{h.gainPct !== null ? ` (${h.gainPct}%)` : ''}{h.taxIfSold ? ` · ${aud(h.taxIfSold)} tax if sold` : ''}</span>
                </li>
              ))}
            </ul>
            {review.harvest.map((x) => <p key={x.name} className="mt-2 text-sm text-slate-700 dark:text-slate-300">→ {x.note}</p>)}
            <Notes items={review.notes} />
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

      <Panel id="estate" icon={ScrollText} title="A will, and who gets the super" intro="Six things, an afternoon, done once. Tick them off here; the roadmap reads it.">
        <ul className="grid gap-2 md:grid-cols-2">
          {ESTATE_ITEMS.map((item) => (
            <li key={item.key}>
              <label className={cn('flex cursor-pointer gap-3 rounded-xl border p-3', form.estate[item.key] ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-800')}>
                <input type="checkbox" checked={Boolean(form.estate[item.key])} onChange={(e) => setForm((f) => ({ ...f, estate: { ...f.estate, [item.key]: e.target.checked } }))} className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-500" />
                <span><span className="block text-sm font-medium text-slate-900 dark:text-white">{item.label}</span><span className="block text-xs leading-5 text-slate-600 dark:text-slate-400">{item.why}</span></span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">A will and a power of attorney are done through a solicitor or the Public Trustee in your state; the super nomination is a form from your fund. Save the plan to keep the ticks.</p>
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer asAt={profile.result?.asAt} advice />
        <Link href="/dashboard/finance/tax/plan#super" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">The super moves that cut tax</Link>
      </div>
    </div>
  );
}
