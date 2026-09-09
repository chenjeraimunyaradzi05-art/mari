'use client';

/**
 * The housing plan: rent she can carry now, the deposit and what it will
 * take, the loan and what it costs, and whether buying beats renting over
 * the years she has in mind. One page, saved as one plan, and a deposit
 * goal can be started from it in the savings tracker.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Home, Key, Landmark, PiggyBank, Scale, Wallet } from 'lucide-react';
import { strategyApi, apiMessage } from '@/lib/strategy-api';
import { financeApi } from '@/lib/api';
import { Bars, Check, Disclaimer, Field, JumpLinks, LineChart, Notes, NumberInput, Panel, Pending, SavePlanBar, SelectInput, Stat, aud, num, opt, pct, useCalc } from '@/components/strategy/StrategyUi';

const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }));

type Form = {
  income: string; partnerIncome: string; weeklyRent: string;
  state: string; regional: boolean; price: string; firstHome: boolean; newHome: boolean; savings: string; monthlySaving: string; savingsRate: string; depositPct: string; useGuarantee: boolean;
  livingExpenses: string; otherRepayments: string; cardLimits: string; dependants: string; rate: string; years: string; frequency: string; extra: string;
  horizon: string; propertyGrowth: string; rentGrowth: string; investReturn: string;
};

const DEFAULTS: Form = {
  income: '', partnerIncome: '', weeklyRent: '',
  state: 'QLD', regional: false, price: '', firstHome: true, newHome: false, savings: '', monthlySaving: '', savingsRate: '4', depositPct: '', useGuarantee: true,
  livingExpenses: '', otherRepayments: '', cardLimits: '', dependants: '0', rate: '6', years: '30', frequency: 'monthly', extra: '',
  horizon: '10', propertyGrowth: '4', rentGrowth: '3', investReturn: '6.5',
};

type Rent = { comfortableWeeklyRent: number; stretchWeeklyRent: number; netWeeklyIncome: number; rentShareOfGross: number | null; rentShareOfNet: number | null; inRentalStress: boolean; leftAfterRent: number | null; notes: string[]; asAt: string };
type Deposit = { depositPct: number; depositAmount: number; loanAmount: number; lvr: number; stampDuty: { dutyPayable: number; generalDuty: number; reliefApplied: string; note: string }; otherCosts: number; lmiEstimate: number; homeGuarantee: { eligible: boolean; cap: number; note: string }; cashNeeded: number; shortfall: number; monthsToTarget: number | null; targetDate: string | null; monthlySavingNeededIn: { twoYears: number; threeYears: number; fiveYears: number }; scenarios: Array<{ depositPct: number; depositAmount: number; lmiEstimate: number; cashNeeded: number; monthsToTarget: number | null }>; notes: string[] };
type Borrowing = { netMonthlyIncome: number; monthlyLivingExpenses: number; monthlySurplus: number; assessmentRatePct: number; estimatedBorrowingPower: number; notes: string[] };
type Mortgage = { repayment: number; monthlyEquivalent: number; totalInterest: number; totalRepaid: number; bufferedRepayment: number; withExtra: { repayment: number; yearsToRepay: number; interestSaved: number } | null };
type RentVsBuy = { years: number; ahead: 'buying' | 'renting'; difference: number; breakEvenYear: number | null; buying: { upfront: number; totalInterest: number; ownershipCosts: number; endValue: number; equity: number; netPosition: number }; renting: { totalRent: number; investedDeposit: number; netPosition: number }; series: Array<{ year: number; buying: number; renting: number }>; notes: string[] };

const months = (m: number | null) => (m === null ? 'not on this saving rate' : m === 0 ? 'already there' : m < 12 ? `${m} months` : `${Math.floor(m / 12)} yr ${m % 12} mo`);

export default function HousingPlanPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const [creatingGoal, setCreatingGoal] = useState(false);

  const income = num(form.income);
  const price = num(form.price);

  const rent = useCalc<Rent>(strategyApi.housing.rent, { annualIncome: income, partnerAnnualIncome: opt(form.partnerIncome), weeklyRent: opt(form.weeklyRent) }, income > 0);
  const deposit = useCalc<Deposit>(strategyApi.housing.deposit, { state: form.state, price, regional: form.regional, firstHome: form.firstHome, newHome: form.newHome, currentSavings: opt(form.savings), monthlySaving: opt(form.monthlySaving), savingsRatePct: opt(form.savingsRate), targetDepositPct: opt(form.depositPct), useHomeGuarantee: form.useGuarantee }, price > 0);
  const borrowing = useCalc<Borrowing>(strategyApi.housing.borrowingPower, { annualIncome: income, partnerAnnualIncome: opt(form.partnerIncome), monthlyLivingExpenses: opt(form.livingExpenses), monthlyOtherRepayments: opt(form.otherRepayments), creditCardLimits: opt(form.cardLimits), dependants: opt(form.dependants), annualRatePct: opt(form.rate), years: opt(form.years) }, income > 0);
  const principal = deposit.result?.loanAmount ?? (price > 0 ? Math.round(price * 0.8) : 0);
  const mortgage = useCalc<Mortgage>(strategyApi.housing.mortgage, { principal, annualRatePct: num(form.rate, 6), years: num(form.years, 30), frequency: form.frequency, extraRepayment: opt(form.extra) }, principal > 0);
  const rvb = useCalc<RentVsBuy>(strategyApi.housing.rentVsBuy, { state: form.state, price, weeklyRent: num(form.weeklyRent), depositPct: deposit.result?.depositPct ?? 20, annualRatePct: num(form.rate, 6), years: num(form.horizon, 10), propertyGrowthPct: opt(form.propertyGrowth), rentGrowthPct: opt(form.rentGrowth), investmentReturnPct: opt(form.investReturn), firstHome: form.firstHome, regional: form.regional }, price > 0 && num(form.weeklyRent) > 0);

  const startDepositGoal = async () => {
    const d = deposit.result;
    if (!d) return;
    setCreatingGoal(true);
    try {
      await financeApi.createSavingsGoal({ name: `Home deposit, ${form.state}`, type: 'HOME_DEPOSIT', targetAmount: d.cashNeeded, monthlyTarget: d.monthlySavingNeededIn.threeYears || undefined });
      toast.success('Deposit goal started in your savings');
    } catch (err) {
      toast.error(apiMessage(err, 'The goal could not be created.'));
    } finally {
      setCreatingGoal(false);
    }
  };

  const overLine = borrowing.result && deposit.result ? deposit.result.loanAmount > borrowing.result.estimatedBorrowingPower : false;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Home className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Housing plan</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">Somewhere to live, and how to afford it</h1>
          <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">Rent you can carry, the deposit and when, the loan, and whether buying beats renting for you. Nothing here is a lender’s decision; it is the plan you take to one.</p>
        </div>
        <Link href="/dashboard/housing" className="btn-secondary inline-flex items-center gap-2">Browse listings</Link>
      </div>

      <JumpLinks items={[{ id: 'rent', label: 'Renting now' }, { id: 'deposit', label: 'The deposit' }, { id: 'loan', label: 'The loan' }, { id: 'rent-or-buy', label: 'Rent or buy' }]} />

      <SavePlanBar
        area="HOUSING"
        inputs={form}
        result={{ cashNeeded: deposit.result?.cashNeeded ?? null, monthsToTarget: deposit.result?.monthsToTarget ?? null, borrowingPower: borrowing.result?.estimatedBorrowingPower ?? null, repayment: mortgage.result?.repayment ?? null, ahead: rvb.result?.ahead ?? null }}
        onLoaded={(inputs) => setForm((f) => ({ ...f, ...(inputs as Partial<Form>) }))}
        summary={deposit.result ? `Cash needed ${aud(deposit.result.cashNeeded)}, ${months(deposit.result.monthsToTarget)} away.` : undefined}
      />

      <Panel id="rent" icon={Key} title="Renting now" intro="The line housing agencies draw is 30% of gross household income. Under it, rent leaves room for everything else.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Your income, a year"><NumberInput value={form.income} onChange={set('income')} prefix="$" placeholder="75000" /></Field>
          <Field label="Partner’s income" hint="Leave blank if it is just you."><NumberInput value={form.partnerIncome} onChange={set('partnerIncome')} prefix="$" /></Field>
          <Field label="Weekly rent, now or planned"><NumberInput value={form.weeklyRent} onChange={set('weeklyRent')} prefix="$" placeholder="450" /></Field>
        </div>
        {income > 0 && (
          <Pending loading={rent.loading} error={rent.error}>
            {rent.result && (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stat label="Comfortable rent" value={`${aud(rent.result.comfortableWeeklyRent)} a week`} sub="30% of gross income" tone="good" big />
                <Stat label="A stretch" value={`${aud(rent.result.stretchWeeklyRent)} a week`} sub="35%, for a short while" tone="warn" />
                {rent.result.rentShareOfNet !== null ? (
                  <Stat label="Your rent" value={pct(rent.result.rentShareOfNet)} sub={`of take-home pay, ${aud(rent.result.leftAfterRent)} a week left after it`} tone={rent.result.inRentalStress ? 'rose' : 'plain'} />
                ) : (
                  <Stat label="Take-home pay" value={`${aud(rent.result.netWeeklyIncome)} a week`} sub="after tax" />
                )}
              </div>
            )}
            {rent.result?.inRentalStress && <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">That rent is over the 30% line. A bond loan, a share arrangement or a rent assistance check may be worth a look.</p>}
            <Notes items={rent.result?.notes} />
          </Pending>
        )}
      </Panel>

      <Panel id="deposit" icon={PiggyBank} title="The deposit" intro="Deposit, duty, the insurance a small deposit carries, and the other costs on the day. Then how long your saving takes to get there.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="State"><SelectInput value={form.state} onChange={set('state')} options={STATES} /></Field>
          <Field label="Price you have in mind"><NumberInput value={form.price} onChange={set('price')} prefix="$" placeholder="650000" /></Field>
          <Field label="Saved so far"><NumberInput value={form.savings} onChange={set('savings')} prefix="$" /></Field>
          <Field label="Saving each month"><NumberInput value={form.monthlySaving} onChange={set('monthlySaving')} prefix="$" placeholder="1200" /></Field>
          <Field label="Savings interest" hint="What your savings account pays."><NumberInput value={form.savingsRate} onChange={set('savingsRate')} suffix="%" step={0.1} /></Field>
          <Field label="Deposit" hint="Blank picks 5% under the guarantee, or 20% otherwise."><NumberInput value={form.depositPct} onChange={set('depositPct')} suffix="%" placeholder="auto" /></Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Check checked={form.firstHome} onChange={set('firstHome')} label="First home" hint="Unlocks duty relief and the guarantee." />
          <Check checked={form.newHome} onChange={set('newHome')} label="New build or land" hint="Some states waive duty entirely." />
          <Check checked={form.regional} onChange={set('regional')} label="Outside the capital and big centres" hint="The scheme cap is lower there." />
          <Check checked={form.useGuarantee} onChange={set('useGuarantee')} label="Use the Home Guarantee Scheme" hint="5% deposit, no lenders mortgage insurance." />
        </div>

        {price > 0 && (
          <Pending loading={deposit.loading} error={deposit.error}>
            {deposit.result && (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Cash needed on the day" value={aud(deposit.result.cashNeeded)} sub={`${deposit.result.depositPct}% deposit plus costs`} tone="rose" big />
                  <Stat label="Time to get there" value={months(deposit.result.monthsToTarget)} sub={deposit.result.targetDate ? `around ${deposit.result.targetDate}` : `${aud(deposit.result.shortfall)} still to save`} tone={deposit.result.monthsToTarget === null ? 'warn' : 'good'} />
                  <Stat label="Home Guarantee Scheme" value={deposit.result.homeGuarantee.eligible ? 'Under the cap' : 'Over the cap'} sub={`cap ${aud(deposit.result.homeGuarantee.cap)} for this area`} tone={deposit.result.homeGuarantee.eligible ? 'good' : 'warn'} />
                  <Stat label="Loan" value={aud(deposit.result.loanAmount)} sub={`${pct(deposit.result.lvr)} of the price`} />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Where the cash goes</h3>
                    <div className="mt-3">
                      <Bars rows={[
                        { label: 'Deposit', value: deposit.result.depositAmount, display: aud(deposit.result.depositAmount), color: 'bg-rose-400' },
                        { label: `Transfer duty${deposit.result.stampDuty.reliefApplied !== 'none' ? ' (after first-home relief)' : ''}`, value: deposit.result.stampDuty.dutyPayable, display: aud(deposit.result.stampDuty.dutyPayable), color: 'bg-purple-400' },
                        { label: 'Lenders mortgage insurance', value: deposit.result.lmiEstimate, display: deposit.result.lmiEstimate ? aud(deposit.result.lmiEstimate) : 'none', color: 'bg-amber-400' },
                        { label: 'Conveyancing, inspections, moving', value: deposit.result.otherCosts, display: aud(deposit.result.otherCosts), color: 'bg-slate-400' },
                      ]} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">To be there in</h3>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Stat label="2 years" value={`${aud(deposit.result.monthlySavingNeededIn.twoYears)}/mo`} />
                      <Stat label="3 years" value={`${aud(deposit.result.monthlySavingNeededIn.threeYears)}/mo`} />
                      <Stat label="5 years" value={`${aud(deposit.result.monthlySavingNeededIn.fiveYears)}/mo`} />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Or with a different deposit</h3>
                    <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                      {deposit.result.scenarios.map((s) => (
                        <li key={s.depositPct} className="flex items-center justify-between py-1.5">
                          <span className="text-slate-600 dark:text-slate-300">{s.depositPct}% deposit{s.lmiEstimate ? `, ${aud(s.lmiEstimate)} insurance` : ''}</span>
                          <span className="font-medium text-slate-900 dark:text-white">{aud(s.cashNeeded)} · {months(s.monthsToTarget)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={startDepositGoal} disabled={creatingGoal} className="btn-primary inline-flex items-center gap-2">
                    <PiggyBank className="h-4 w-4" /> {creatingGoal ? 'Starting…' : 'Start a deposit goal'}
                  </button>
                  <Link href="/dashboard/finance/savings" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">See savings goals</Link>
                </div>
                <Notes items={deposit.result.notes} />
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <Panel id="loan" icon={Landmark} title="The loan" intro="What a lender is likely to offer, and what the repayments look like at today’s rate and at the rate they test you on.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Living costs, a month" hint="Blank uses a lender benchmark for your household."><NumberInput value={form.livingExpenses} onChange={set('livingExpenses')} prefix="$" /></Field>
          <Field label="Other repayments, a month" hint="Car loan, HELP is not counted here."><NumberInput value={form.otherRepayments} onChange={set('otherRepayments')} prefix="$" /></Field>
          <Field label="Credit card limits, total"><NumberInput value={form.cardLimits} onChange={set('cardLimits')} prefix="$" /></Field>
          <Field label="Dependants"><NumberInput value={form.dependants} onChange={set('dependants')} min={0} /></Field>
          <Field label="Interest rate"><NumberInput value={form.rate} onChange={set('rate')} suffix="%" step={0.05} /></Field>
          <Field label="Loan term"><NumberInput value={form.years} onChange={set('years')} suffix="yrs" min={1} max={40} /></Field>
          <Field label="Repayments"><SelectInput value={form.frequency} onChange={set('frequency')} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'fortnightly', label: 'Fortnightly' }, { value: 'weekly', label: 'Weekly' }]} /></Field>
          <Field label="Extra each repayment" hint="See what paying a little more does."><NumberInput value={form.extra} onChange={set('extra')} prefix="$" /></Field>
        </div>

        <Pending loading={borrowing.loading || mortgage.loading} error={borrowing.error || mortgage.error}>
          {(borrowing.result || mortgage.result) && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {borrowing.result && <Stat label="Likely borrowing power" value={aud(borrowing.result.estimatedBorrowingPower)} sub={`tested at ${pct(borrowing.result.assessmentRatePct, 2)}`} tone={overLine ? 'warn' : 'good'} big />}
                {mortgage.result && <Stat label={`Repayment, ${form.frequency}`} value={aud(mortgage.result.repayment)} sub={`on a ${aud(principal)} loan`} tone="rose" big />}
                {mortgage.result && <Stat label="If rates rise 3 points" value={aud(mortgage.result.bufferedRepayment)} sub="the lender’s stress test" tone="warn" />}
                {mortgage.result && <Stat label="Interest over the term" value={aud(mortgage.result.totalInterest)} sub={`${aud(mortgage.result.totalRepaid)} repaid in all`} />}
              </div>
              {overLine && <p className="text-sm text-amber-700 dark:text-amber-300">The loan this price needs is above the likely borrowing power. A bigger deposit, a lower price or a second income closes the gap.</p>}
              {mortgage.result?.withExtra && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Paying {aud(mortgage.result.withExtra.repayment)} instead clears the loan in about {mortgage.result.withExtra.yearsToRepay} years and saves {aud(mortgage.result.withExtra.interestSaved)} in interest.
                </p>
              )}
              <Notes items={borrowing.result?.notes} />
            </div>
          )}
        </Pending>
        {income === 0 && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Add your income under “Renting now” to see borrowing power.</p>}
      </Panel>

      <Panel id="rent-or-buy" icon={Scale} title="Rent or buy" intro="Both paths start with the same cash. One buys, one rents and invests the difference. Here is where each lands.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Over"><NumberInput value={form.horizon} onChange={set('horizon')} suffix="yrs" min={1} max={30} /></Field>
          <Field label="Property growth, a year"><NumberInput value={form.propertyGrowth} onChange={set('propertyGrowth')} suffix="%" step={0.5} /></Field>
          <Field label="Rent growth, a year"><NumberInput value={form.rentGrowth} onChange={set('rentGrowth')} suffix="%" step={0.5} /></Field>
          <Field label="Investment return"><NumberInput value={form.investReturn} onChange={set('investReturn')} suffix="%" step={0.5} /></Field>
        </div>
        {price > 0 && num(form.weeklyRent) > 0 ? (
          <Pending loading={rvb.loading} error={rvb.error}>
            {rvb.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label={`After ${rvb.result.years} years`} value={rvb.result.ahead === 'buying' ? 'Buying is ahead' : 'Renting is ahead'} sub={`by ${aud(Math.abs(rvb.result.difference))}${rvb.result.breakEvenYear ? `, buying overtakes in year ${rvb.result.breakEvenYear}` : ''}`} tone={rvb.result.ahead === 'buying' ? 'good' : 'warn'} big />
                  <Stat label="Owner’s position" value={aud(rvb.result.buying.netPosition)} sub={`home worth ${aud(rvb.result.buying.endValue)}, ${aud(rvb.result.buying.totalInterest)} paid in interest`} />
                  <Stat label="Renter’s position" value={aud(rvb.result.renting.netPosition)} sub={`${aud(rvb.result.renting.totalRent)} paid in rent, the rest invested`} />
                </div>
                <LineChart series={[{ label: 'Buying', color: '#f43f5e', values: rvb.result.series.map((p) => p.buying) }, { label: 'Renting and investing', color: '#a855f7', values: rvb.result.series.map((p) => p.renting) }]} labels={rvb.result.series.map((p) => `Yr ${p.year}`)} />
                <Notes items={rvb.result.notes} />
              </div>
            )}
          </Pending>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Needs a price above and a weekly rent under “Renting now”.</p>
        )}
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer asAt={deposit.result ? undefined : rent.result?.asAt} />
        <Link href="/dashboard/finance/invest" className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:underline dark:text-rose-400"><Wallet className="h-4 w-4" /> Then the investing plan</Link>
      </div>
    </div>
  );
}
