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
import { Building, HeartHandshake, Home, Key, Landmark, Percent, PiggyBank, Scale, Wallet } from 'lucide-react';
import { strategyApi, apiMessage } from '@/lib/strategy-api';
import { financeApi } from '@/lib/api';
import { Bars, Check, Disclaimer, Field, JumpLinks, LineChart, Notes, NumberInput, Panel, Pending, SavePlanBar, SelectInput, Stat, aud, inputClass, num, opt, pct, useCalc } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }));

type Form = {
  income: string; partnerIncome: string; weeklyRent: string;
  state: string; regional: boolean; price: string; firstHome: boolean; newHome: boolean; savings: string; monthlySaving: string; savingsRate: string; depositPct: string; useGuarantee: boolean;
  livingExpenses: string; otherRepayments: string; cardLimits: string; dependants: string; rate: string; years: string; frequency: string; extra: string;
  horizon: string; propertyGrowth: string; rentGrowth: string; investReturn: string;
  loans: LoanForm[]; offsetBalance: string; loanHorizon: string;
  ipRent: string; ipDeposit: string; ipRate: string; ipIncome: string; ipCosts: string; ipDepreciation: string; ipInterestOnly: boolean;
  household: string; fortnightlyRent: string;
};

type LoanForm = { name: string; ratePct: string; annualFee: string; upfrontFee: string; offset: boolean; fixedYears: string; revertRatePct: string };
const LOAN_DEFAULTS: LoanForm[] = [
  { name: 'Basic variable', ratePct: '6.1', annualFee: '', upfrontFee: '', offset: false, fixedYears: '', revertRatePct: '' },
  { name: 'Package with offset', ratePct: '5.95', annualFee: '395', upfrontFee: '', offset: true, fixedYears: '', revertRatePct: '' },
  { name: 'Fixed 2 years', ratePct: '5.6', annualFee: '', upfrontFee: '', offset: false, fixedYears: '2', revertRatePct: '6.9' },
];

const DEFAULTS: Form = {
  income: '', partnerIncome: '', weeklyRent: '',
  state: 'QLD', regional: false, price: '', firstHome: true, newHome: false, savings: '', monthlySaving: '', savingsRate: '4', depositPct: '', useGuarantee: true,
  livingExpenses: '', otherRepayments: '', cardLimits: '', dependants: '0', rate: '6', years: '30', frequency: 'monthly', extra: '',
  horizon: '10', propertyGrowth: '4', rentGrowth: '3', investReturn: '6.5',
  loans: LOAN_DEFAULTS, offsetBalance: '', loanHorizon: '5',
  ipRent: '', ipDeposit: '20', ipRate: '6.5', ipIncome: '', ipCosts: '', ipDepreciation: '', ipInterestOnly: false,
  household: 'single', fortnightlyRent: '',
};

type Rent = { comfortableWeeklyRent: number; stretchWeeklyRent: number; netWeeklyIncome: number; rentShareOfGross: number | null; rentShareOfNet: number | null; inRentalStress: boolean; leftAfterRent: number | null; notes: string[]; asAt: string };
type Deposit = { depositPct: number; depositAmount: number; loanAmount: number; lvr: number; stampDuty: { dutyPayable: number; generalDuty: number; reliefApplied: string; note: string }; otherCosts: number; lmiEstimate: number; homeGuarantee: { eligible: boolean; cap: number; note: string }; cashNeeded: number; shortfall: number; monthsToTarget: number | null; targetDate: string | null; monthlySavingNeededIn: { twoYears: number; threeYears: number; fiveYears: number }; scenarios: Array<{ depositPct: number; depositAmount: number; lmiEstimate: number; cashNeeded: number; monthsToTarget: number | null }>; notes: string[] };
type Borrowing = { netMonthlyIncome: number; monthlyLivingExpenses: number; monthlySurplus: number; assessmentRatePct: number; estimatedBorrowingPower: number; notes: string[] };
type Mortgage = { repayment: number; monthlyEquivalent: number; totalInterest: number; totalRepaid: number; bufferedRepayment: number; withExtra: { repayment: number; yearsToRepay: number; interestSaved: number } | null };
type RentVsBuy = { years: number; ahead: 'buying' | 'renting'; difference: number; breakEvenYear: number | null; buying: { upfront: number; totalInterest: number; ownershipCosts: number; endValue: number; equity: number; netPosition: number }; renting: { totalRent: number; investedDeposit: number; netPosition: number }; series: Array<{ year: number; buying: number; renting: number }>; notes: string[] };

type Loans = { horizonYears: number; loans: Array<{ name: string; ratePct: number; repayment: number; repaymentAfterFixed: number | null; interestOverHorizon: number; feesOverHorizon: number; costOverHorizon: number; balanceAfterHorizon: number; offsetSaving: number; trueRatePct: number; cheapest: boolean; moreThanCheapest: number }>; notes: string[] };
type InvestmentProperty = { purchaseCosts: { deposit: number; stampDuty: number; other: number; total: number }; loan: number; annualRent: number; annualCosts: number; interestYear1: number; grossYieldPct: number; netYieldPct: number; cashFlowBeforeTax: number; taxEffect: number; cashFlowAfterTax: number; weeklyCostAfterTax: number; breakEvenWeeklyRent: number; projection: Array<{ year: number; value: number; loan: number; equity: number; cumulativeCash: number }>; saleAfterHorizon: { value: number; gain: number; cgt: number; netEquity: number; returnPct: number }; notes: string[] };
type RentHelp = { asAt: string; households: Array<{ id: string; label: string }>; bondHelp: Array<{ state: string; scheme: string; what: string; who: string; leavingViolence: string; url: string }>; leavingViolence: { name: string; what: string; url: string; phone: string } };
type RentAssistance = { estimateFortnightly: number; estimateWeekly: number; threshold: number; maximum: number; notes: string[] };

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

  const loanPrincipal = principal;
  const loans = useCalc<Loans>(strategyApi.housing.compareLoans, { principal: loanPrincipal, years: num(form.years, 30), horizonYears: opt(form.loanHorizon), offsetBalance: opt(form.offsetBalance), loans: form.loans.filter((l) => l.name.trim() && num(l.ratePct) > 0).map((l) => ({ name: l.name.trim(), ratePct: num(l.ratePct), annualFee: opt(l.annualFee), upfrontFee: opt(l.upfrontFee), offset: l.offset, fixedYears: opt(l.fixedYears), revertRatePct: opt(l.revertRatePct) })) }, loanPrincipal > 0 && form.loans.some((l) => l.name.trim() && num(l.ratePct) > 0));
  const property = useCalc<InvestmentProperty>(strategyApi.housing.investmentProperty, { state: form.state, price, weeklyRent: num(form.ipRent), depositPct: opt(form.ipDeposit), ratePct: opt(form.ipRate), interestOnly: form.ipInterestOnly, taxableIncome: num(form.ipIncome) || income, annualCosts: opt(form.ipCosts), depreciation: opt(form.ipDepreciation), growthPct: opt(form.propertyGrowth), rentGrowthPct: opt(form.rentGrowth) }, price > 0 && num(form.ipRent) > 0 && (num(form.ipIncome) > 0 || income > 0));
  const rentHelp = useCalc<RentHelp>(() => strategyApi.housing.rentHelp(), {}, true, 0);
  const assistance = useCalc<RentAssistance>(strategyApi.housing.rentAssistance, { fortnightlyRent: num(form.fortnightlyRent) || num(form.weeklyRent) * 2, household: form.household }, num(form.fortnightlyRent) > 0 || num(form.weeklyRent) > 0);
  const setLoan = (i: number, patch: Partial<LoanForm>) => setForm((f) => ({ ...f, loans: f.loans.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const bondHelp = rentHelp.result?.bondHelp.find((b) => b.state === form.state);

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

      <JumpLinks items={[{ id: 'rent', label: 'Renting now' }, { id: 'rent-help', label: 'Help with rent' }, { id: 'deposit', label: 'The deposit' }, { id: 'loan', label: 'The loan' }, { id: 'compare-loans', label: 'Compare loans' }, { id: 'rent-or-buy', label: 'Rent or buy' }, { id: 'investment', label: 'An investment property' }]} />

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
                  <span className="text-xs text-slate-400">·</span>
                  <a href={`https://www.realestate.com.au/buy/in-${form.state.toLowerCase()}/list-1?maxPrice=${Math.round(price)}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Search realestate.com.au</a>
                  <a href={`https://www.domain.com.au/sale/?state=${form.state.toLowerCase()}&price=0-${Math.round(price)}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Search Domain</a>
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

      <Panel id="rent-help" icon={HeartHandshake} title="Help with the bond and the rent" intro="Every state lends the bond interest-free to people who cannot pay it up front, and Rent Assistance tops up a low income. Here is what applies to you.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Household"><SelectInput value={form.household} onChange={set('household')} options={(rentHelp.result?.households ?? [{ id: 'single', label: 'Single, no children' }]).map((h) => ({ value: h.id, label: h.label }))} /></Field>
          <Field label="Rent, a fortnight" hint="Blank uses twice the weekly rent above."><NumberInput value={form.fortnightlyRent} onChange={set('fortnightlyRent')} prefix="$" /></Field>
        </div>
        <Pending loading={assistance.loading} error={assistance.error}>
          {assistance.result && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Rent Assistance, if you get a payment" value={`${aud(assistance.result.estimateFortnightly)} a fortnight`} sub={`75c for each dollar of rent over ${aud(assistance.result.threshold)}, up to ${aud(assistance.result.maximum)}`} tone={assistance.result.estimateFortnightly > 0 ? 'good' : 'plain'} big />
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">{assistance.result.notes[0]} <a href="https://www.servicesaustralia.gov.au/rent-assistance" target="_blank" rel="noreferrer" className="font-medium text-rose-600 hover:underline dark:text-rose-400">Services Australia</a></div>
            </div>
          )}
        </Pending>
        {bondHelp && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{bondHelp.state}: {bondHelp.scheme}</p>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{bondHelp.what}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">For {bondHelp.who.charAt(0).toLowerCase()}{bondHelp.who.slice(1)}</p>
              <a href={bondHelp.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">How to apply</a>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-900/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">If you are leaving violence</p>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{bondHelp.leavingViolence}</p>
              {rentHelp.result && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{rentHelp.result.leavingViolence.name}: {rentHelp.result.leavingViolence.what} <a href={rentHelp.result.leavingViolence.url} target="_blank" rel="noreferrer" className="font-medium text-rose-600 hover:underline dark:text-rose-400">{rentHelp.result.leavingViolence.phone}</a></p>}
            </div>
          </div>
        )}
      </Panel>

      <Panel id="compare-loans" icon={Percent} title="Compare loans" intro="Two or three loans on your own loan amount, over the years you expect to keep it, fees included. The cheapest is the one that costs least in that time, not the lowest rate.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Loan amount" hint="From the deposit plan above."><input readOnly value={loanPrincipal ? aud(loanPrincipal) : ''} className={cn(inputClass, 'opacity-70')} /></Field>
          <Field label="Years you expect to keep it"><NumberInput value={form.loanHorizon} onChange={set('loanHorizon')} suffix="yrs" min={1} max={30} /></Field>
          <Field label="Money you could hold in an offset"><NumberInput value={form.offsetBalance} onChange={set('offsetBalance')} prefix="$" /></Field>
        </div>
        <div className="mt-4 space-y-3">
          {form.loans.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-6 sm:items-end">
              <Field label="Loan"><input value={l.name} onChange={(e) => setLoan(i, { name: e.target.value })} className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:text-white" /></Field>
              <Field label="Rate"><NumberInput value={l.ratePct} onChange={(v) => setLoan(i, { ratePct: v })} suffix="%" step={0.05} /></Field>
              <Field label="Annual fee"><NumberInput value={l.annualFee} onChange={(v) => setLoan(i, { annualFee: v })} prefix="$" /></Field>
              <Field label="Upfront fee"><NumberInput value={l.upfrontFee} onChange={(v) => setLoan(i, { upfrontFee: v })} prefix="$" /></Field>
              <Field label="Fixed for" hint="Then reverts to"><div className="flex gap-1"><NumberInput value={l.fixedYears} onChange={(v) => setLoan(i, { fixedYears: v })} suffix="yrs" /><NumberInput value={l.revertRatePct} onChange={(v) => setLoan(i, { revertRatePct: v })} suffix="%" step={0.05} /></div></Field>
              <Check checked={l.offset} onChange={(v) => setLoan(i, { offset: v })} label="Offset account" />
            </div>
          ))}
        </div>
        {loanPrincipal > 0 ? (
          <Pending loading={loans.loading} error={loans.error}>
            {loans.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {loans.result.loans.map((l) => (
                    <div key={l.name} className={cn('rounded-xl border p-4', l.cheapest ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-800')}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{l.name}{l.cheapest ? ' · cheapest' : ''}</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{aud(l.costOverHorizon)}</p>
                      <p className="text-xs text-slate-500">over {loans.result!.horizonYears} years{l.moreThanCheapest > 0 ? `, ${aud(l.moreThanCheapest)} more than the cheapest` : ''}</p>
                      <dl className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between"><dt>Repayment</dt><dd>{aud(l.repayment)}/mo{l.repaymentAfterFixed ? `, then ${aud(l.repaymentAfterFixed)}` : ''}</dd></div>
                        <div className="flex justify-between"><dt>Interest</dt><dd>{aud(l.interestOverHorizon)}</dd></div>
                        <div className="flex justify-between"><dt>Fees</dt><dd>{aud(l.feesOverHorizon)}</dd></div>
                        {l.offsetSaving > 0 && <div className="flex justify-between"><dt>Offset saves</dt><dd>{aud(l.offsetSaving)}</dd></div>}
                        <div className="flex justify-between"><dt>True rate</dt><dd>{pct(l.trueRatePct, 2)}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
                <Notes items={loans.result.notes} />
              </div>
            )}
          </Pending>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Give a price under “The deposit” and the loans are compared on the amount you would borrow.</p>
        )}
      </Panel>

      <Panel id="investment" icon={Building} title="An investment property" intro="If the place is to rent out rather than live in: the yield, what it costs you each week after tax, the rent that breaks even, and ten years of holding it.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Weekly rent it would fetch"><NumberInput value={form.ipRent} onChange={set('ipRent')} prefix="$" placeholder="550" /></Field>
          <Field label="Your taxable income" hint="Blank uses the income above."><NumberInput value={form.ipIncome} onChange={set('ipIncome')} prefix="$" /></Field>
          <Field label="Deposit"><NumberInput value={form.ipDeposit} onChange={set('ipDeposit')} suffix="%" min={0} max={100} /></Field>
          <Field label="Investor rate"><NumberInput value={form.ipRate} onChange={set('ipRate')} suffix="%" step={0.05} /></Field>
          <Field label="Rates, insurance, strata, upkeep a year" hint="Blank uses 1.2% of the price."><NumberInput value={form.ipCosts} onChange={set('ipCosts')} prefix="$" /></Field>
          <Field label="Depreciation a year" hint="A quantity surveyor's schedule, newer builds."><NumberInput value={form.ipDepreciation} onChange={set('ipDepreciation')} prefix="$" /></Field>
          <div className="flex items-end pb-2"><Check checked={form.ipInterestOnly} onChange={set('ipInterestOnly')} label="Interest only" /></div>
        </div>
        {price > 0 && num(form.ipRent) > 0 && (num(form.ipIncome) > 0 || income > 0) ? (
          <Pending loading={property.loading} error={property.error}>
            {property.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Costs you, after tax" value={property.result.weeklyCostAfterTax > 0 ? `${aud(property.result.weeklyCostAfterTax)} a week` : `pays ${aud(-property.result.weeklyCostAfterTax)} a week`} sub={`${aud(property.result.cashFlowBeforeTax)} a year before tax, ${property.result.taxEffect >= 0 ? `${aud(property.result.taxEffect)} back at tax time` : `${aud(-property.result.taxEffect)} of tax`}`} tone={property.result.weeklyCostAfterTax > 0 ? 'warn' : 'good'} big />
                  <Stat label="Yield" value={`${pct(property.result.grossYieldPct, 1)} gross`} sub={`${pct(property.result.netYieldPct, 1)} after costs`} />
                  <Stat label="Rent that breaks even" value={`${aud(property.result.breakEvenWeeklyRent)} a week`} sub="after the tax effect" />
                  <Stat label="Cash to buy" value={aud(property.result.purchaseCosts.total)} sub={`${aud(property.result.purchaseCosts.stampDuty)} of it duty, no first-home relief`} />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Ten years on</h3>
                    <LineChart series={[{ label: 'Value', color: '#f43f5e', values: property.result.projection.map((p) => p.value) }, { label: 'Loan', color: '#94a3b8', values: property.result.projection.map((p) => p.loan) }, { label: 'Equity', color: '#10b981', values: property.result.projection.map((p) => p.equity) }]} labels={property.result.projection.map((p) => `Yr ${p.year}`)} height={160} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 self-start">
                    <Stat label="If sold then" value={aud(property.result.saleAfterHorizon.netEquity)} sub={`after ${aud(property.result.saleAfterHorizon.cgt)} capital gains tax and selling costs`} />
                    <Stat label="Return on your cash" value={`${pct(property.result.saleAfterHorizon.returnPct, 1)} a year`} sub="counting every dollar you put in along the way" tone={property.result.saleAfterHorizon.returnPct >= 6 ? 'good' : 'warn'} />
                  </div>
                </div>
                <Notes items={property.result.notes} />
              </div>
            )}
          </Pending>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Needs the price under “The deposit”, a weekly rent, and an income.</p>
        )}
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer asAt={deposit.result ? undefined : rent.result?.asAt} />
        <Link href="/dashboard/finance/invest" className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:underline dark:text-rose-400"><Wallet className="h-4 w-4" /> Then the investing plan</Link>
      </div>
    </div>
  );
}
