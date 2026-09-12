'use client';

/**
 * The tax plan: what she will owe this year, what she can claim, what super
 * would save her, and what a sole trader puts aside each quarter. The BAS
 * and returns live on the tax page; this is the thinking before them.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Calculator, Coins, GraduationCap, Landmark, Receipt, ScanSearch, Sparkles, Wallet } from 'lucide-react';
import { strategyApi, apiMessage } from '@/lib/strategy-api';
import { Bars, Check, Disclaimer, Field, JumpLinks, Notes, NumberInput, Panel, Pending, SavePlanBar, Stat, aud, num, opt, pct, useCalc } from '@/components/strategy/StrategyUi';

type Form = {
  income: string; deductionsGuess: string; sacrifice: string; help: boolean; helpBalance: string;
  wfhHours: string; wfhWeeks: string; carKm: string; selfEducation: string; tools: string; fees: string; donations: string; incomeProtection: string; phone: string; phonePct: string; clothing: string; personalSuper: string; other: string;
  superBalance: string; personalDeductible: string; afterTax: string; spouseIncome: string; spouseContribution: string;
  profit: string; sales: string; expenses: string; soleOtherIncome: string; gst: boolean;
  helpGrowth: string; helpIndexation: string; helpLump: string; helpExtra: string;
};

const DEFAULTS: Form = {
  income: '', deductionsGuess: '', sacrifice: '', help: false, helpBalance: '',
  wfhHours: '', wfhWeeks: '48', carKm: '', selfEducation: '', tools: '', fees: '', donations: '', incomeProtection: '', phone: '', phonePct: '50', clothing: '', personalSuper: '', other: '',
  superBalance: '', personalDeductible: '', afterTax: '', spouseIncome: '', spouseContribution: '',
  profit: '', sales: '', expenses: '', soleOtherIncome: '', gst: false,
  helpGrowth: '3', helpIndexation: '3.2', helpLump: '', helpExtra: '',
};

type Estimate = { asAt: string; taxableIncome: number; incomeTax: number; lito: number; medicareLevy: number; helpRepayment: number; totalTax: number; netIncome: number; monthlyTakeHome: number; fortnightlyTakeHome: number; marginalRate: number; effectiveRate: number; employerSuper: number; brackets: Array<{ from: number; to: number | null; rate: number; amount: number; tax: number }>; notes: string[] };
type Deductions = { items: Array<{ key: string; label: string; amount: number; basis: string; records: string }>; totalDeductions: number; taxSaved: number; marginalRate: number; notes: string[] };
type SuperPlan = { employerContributions: number; voluntaryConcessional: number; concessionalTotal: number; concessionalCap: number; concessionalHeadroom: number; overCapBy: number; taxSavedByVoluntary: number; netCostOfVoluntary: number; division293Tax: number; coContribution: number; spouseOffset: number; marginalRate: number; moves: Array<{ key: string; label: string; amount: number; benefit: number; detail: string }>; notes: string[] };
type SetAside = { taxOnBusinessIncome: number; helpOnBusinessIncome: number; gstNetAnnual: number; quarterlyIncomeTax: number; quarterlyGst: number; quarterlyTotal: number; setAsidePctOfProfit: number; mustRegisterForGst: boolean; suggestedSuper: number; notes: string[] };

type HelpDebt = { balance: number; compulsoryThisYear: number; repaymentRatePct: number; scenarios: Array<{ key: string; label: string; yearsToRepay: number | null; totalIndexation: number; totalRepaid: number; voluntaryPaid: number; series: Array<{ year: number; balance: number }> }>; lumpSumComparison: { lumpSum: number; indexationSaved: number; investedInstead: number; yearsSooner: number; verdict: string } | null; notes: string[] };
type Scan = { from: string; to: string; scanned: number; lines: Array<{ id?: string; description: string; amount: number; postedAt?: string; category: string; key: string; likelihood: string; reason: string }>; totals: Array<{ key: string; label: string; likely: number; possible: number; count: number }>; suggestedInput: Record<string, number>; notes: string[] };
type Statement = { fy: string; from: string; to: string; lines: Array<{ key: string; label: string; count: number; gross: number; platformFees: number; net: number }>; assessableIncome: number; platformFees: number; paidToBank: number; gstRegistrationDue: boolean; notes: string[] };
const CURRENT_FY = new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear();
const SCAN_TO_FORM: Record<string, keyof Form> = { selfEducation: 'selfEducation', toolsAndEquipment: 'tools', professionalFees: 'fees', donations: 'donations', incomeProtectionPremiums: 'incomeProtection', phoneAndInternet: 'phone', workClothing: 'clothing', other: 'other' };

export default function TaxPlanPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const [scan, setScan] = useState<Scan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [statementFy, setStatementFy] = useState(String(CURRENT_FY));
  const [statementBusy, setStatementBusy] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);

  const loadStatement = async () => {
    setStatementBusy(true);
    setStatementError(null);
    try {
      const res = await strategyApi.tax.earningsStatement({ fy: num(statementFy, CURRENT_FY) });
      setStatement(res.data?.data ?? null);
    } catch (err) {
      setStatementError(apiMessage(err, 'Sign in to see what the platform paid you.'));
    } finally {
      setStatementBusy(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const res = await strategyApi.tax.bankDeductions();
      setScan(res.data?.data ?? null);
    } catch (err) {
      setScanError(apiMessage(err, 'Connect a bank or paste a statement on the bank feeds page first.'));
    } finally {
      setScanning(false);
    }
  };
  const useScan = () => {
    if (!scan) return;
    setForm((f) => {
      const next = { ...f };
      for (const [field, key] of Object.entries(SCAN_TO_FORM)) {
        const amount = scan.suggestedInput[field];
        if (amount) (next as Record<string, unknown>)[key] = String(amount);
      }
      return next;
    });
    toast.success('Amounts carried into the deductions planner');
  };

  const income = num(form.income);
  const estimate = useCalc<Estimate>(strategyApi.tax.estimate, { grossIncome: income, deductions: opt(form.deductionsGuess), salarySacrifice: opt(form.sacrifice), hasHelpDebt: form.help, helpBalance: opt(form.helpBalance) }, income > 0);
  const deductions = useCalc<Deductions>(strategyApi.tax.deductions, { taxableIncome: income, homeOfficeHoursPerWeek: opt(form.wfhHours), weeksWorkedFromHome: opt(form.wfhWeeks), carWorkKm: opt(form.carKm), selfEducation: opt(form.selfEducation), toolsAndEquipment: opt(form.tools), professionalFees: opt(form.fees), donations: opt(form.donations), incomeProtectionPremiums: opt(form.incomeProtection), phoneAndInternet: opt(form.phone), phoneWorkUsePct: opt(form.phonePct), workClothing: opt(form.clothing), personalSuperContributions: opt(form.personalSuper), other: opt(form.other) }, income > 0);
  const superPlan = useCalc<SuperPlan>(strategyApi.tax.superPlan, { income, superBalance: opt(form.superBalance), salarySacrifice: opt(form.sacrifice), personalDeductible: opt(form.personalDeductible), personalAfterTax: opt(form.afterTax), spouseIncome: opt(form.spouseIncome), spouseContribution: opt(form.spouseContribution) }, income > 0);
  const profit = num(form.profit);
  const setAside = useCalc<SetAside>(strategyApi.tax.setAside, { businessProfit: profit, businessSales: opt(form.sales), businessExpenses: opt(form.expenses), otherIncome: opt(form.soleOtherIncome), gstRegistered: form.gst, hasHelpDebt: form.help }, profit > 0);
  const helpDebt = useCalc<HelpDebt>(strategyApi.tax.helpDebt, { balance: num(form.helpBalance), income, incomeGrowthPct: opt(form.helpGrowth), indexationPct: opt(form.helpIndexation), lumpSum: opt(form.helpLump), extraMonthly: opt(form.helpExtra) }, form.help && num(form.helpBalance) > 0 && income > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Receipt className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Tax plan</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">What you will owe, and what you can do about it</h1>
          <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">This year’s tax on the published scale, the deductions worth keeping receipts for, the super moves that cut the bill, and the quarter set-aside for a business of your own.</p>
        </div>
        <Link href="/dashboard/finance/tax" className="btn-secondary inline-flex items-center gap-2">BAS and returns</Link>
      </div>

      <JumpLinks items={[{ id: 'estimate', label: 'This year’s tax' }, { id: 'help', label: 'HELP debt' }, { id: 'deductions', label: 'Deductions' }, { id: 'bank', label: 'From the bank feed' }, { id: 'super', label: 'Super' }, { id: 'set-aside', label: 'Sole trader quarter' }, { id: 'earnings', label: 'Paid by ATHENA' }]} />

      <SavePlanBar
        area="TAX"
        inputs={form}
        result={{ totalTax: estimate.result?.totalTax ?? null, netIncome: estimate.result?.netIncome ?? null, deductionsSaved: deductions.result?.taxSaved ?? null, superHeadroom: superPlan.result?.concessionalHeadroom ?? null, quarterlySetAside: setAside.result?.quarterlyTotal ?? null }}
        onLoaded={(inputs) => setForm((f) => ({ ...f, ...(inputs as Partial<Form>) }))}
        summary={estimate.result ? `About ${aud(estimate.result.totalTax)} in tax on ${aud(income)}.` : undefined}
      />

      <Panel id="estimate" icon={Calculator} title="This year’s tax" intro="Resident rates, Medicare levy, the low income offset and HELP if you have it.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Income, a year" hint="Salary before tax, plus any other income."><NumberInput value={form.income} onChange={set('income')} prefix="$" placeholder="85000" /></Field>
          <Field label="Deductions you expect" hint="Or work them out below."><NumberInput value={form.deductionsGuess} onChange={set('deductionsGuess')} prefix="$" /></Field>
          <Field label="Salary sacrifice to super"><NumberInput value={form.sacrifice} onChange={set('sacrifice')} prefix="$" /></Field>
          <Field label="HELP balance" hint="If you have a study debt."><NumberInput value={form.helpBalance} onChange={set('helpBalance')} prefix="$" /></Field>
        </div>
        <div className="mt-3"><Check checked={form.help} onChange={set('help')} label="I have a HELP (HECS) debt" /></div>
        {income > 0 && (
          <Pending loading={estimate.loading} error={estimate.error}>
            {estimate.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Take-home, a month" value={aud(estimate.result.monthlyTakeHome)} sub={`${aud(estimate.result.fortnightlyTakeHome)} a fortnight`} tone="good" big />
                  <Stat label="Tax for the year" value={aud(estimate.result.totalTax)} sub={`${pct(estimate.result.effectiveRate, 1)} of income overall`} tone="rose" />
                  <Stat label="Your next dollar" value={pct(estimate.result.marginalRate * 100)} sub="marginal rate, before Medicare" />
                  <Stat label="Employer super" value={aud(estimate.result.employerSuper)} sub="12% on top of salary" />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Where it goes</h3>
                    <div className="mt-3">
                      <Bars rows={[
                        { label: 'Income tax', value: estimate.result.incomeTax - estimate.result.lito, display: aud(estimate.result.incomeTax - estimate.result.lito), color: 'bg-rose-400' },
                        { label: 'Medicare levy', value: estimate.result.medicareLevy, display: aud(estimate.result.medicareLevy), color: 'bg-purple-400' },
                        { label: 'HELP repayment', value: estimate.result.helpRepayment, display: estimate.result.helpRepayment ? aud(estimate.result.helpRepayment) : 'none', color: 'bg-amber-400' },
                      ]} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Bracket by bracket</h3>
                    <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                      {estimate.result.brackets.filter((b) => b.amount > 0).map((b) => (
                        <li key={b.from} className="flex items-center justify-between py-1.5">
                          <span className="text-slate-600 dark:text-slate-300">{aud(b.from)} to {b.to === null ? 'above' : aud(b.to)} at {Math.round(b.rate * 100)}%</span>
                          <span className="font-medium text-slate-900 dark:text-white">{aud(b.tax)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <Notes items={estimate.result.notes} />
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <Panel id="help" icon={GraduationCap} title="The HELP debt" intro="No interest, but indexed every June and repaid through your tax. When it is gone, what a lump sum or an extra amount does, and whether paying it early beats investing the money.">
        {!form.help || num(form.helpBalance) === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Tick “I have a HELP debt” above and give the balance.</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="A lump sum now"><NumberInput value={form.helpLump} onChange={set('helpLump')} prefix="$" /></Field>
              <Field label="Extra each month"><NumberInput value={form.helpExtra} onChange={set('helpExtra')} prefix="$" /></Field>
              <Field label="Indexation" hint="The lower of CPI and wage growth."><NumberInput value={form.helpIndexation} onChange={set('helpIndexation')} suffix="%" step={0.1} /></Field>
              <Field label="Income growth, a year"><NumberInput value={form.helpGrowth} onChange={set('helpGrowth')} suffix="%" step={0.5} /></Field>
            </div>
            {income > 0 && (
              <Pending loading={helpDebt.loading} error={helpDebt.error}>
                {helpDebt.result && (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {helpDebt.result.scenarios.map((s, i) => (
                        <Stat key={s.key} label={s.label} value={s.yearsToRepay === null ? 'Not in 40 years' : `Gone in ${s.yearsToRepay} year${s.yearsToRepay === 1 ? '' : 's'}`} sub={`${aud(s.totalIndexation)} of indexation along the way`} tone={i === 0 ? 'rose' : 'good'} big={i === 0} />
                      ))}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">This year’s compulsory repayment is about {aud(helpDebt.result.compulsoryThisYear)}, {pct(helpDebt.result.repaymentRatePct, 1)} of your income, taken out of your pay.</p>
                    {helpDebt.result.lumpSumComparison && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-800 dark:bg-slate-800/60 dark:text-slate-200">{helpDebt.result.lumpSumComparison.verdict}</div>}
                    <Notes items={helpDebt.result.notes} />
                  </div>
                )}
              </Pending>
            )}
          </>
        )}
      </Panel>

      <Panel id="deductions" icon={Sparkles} title="Deductions worth the receipts" intro="Each one at the published rate, and what it saves at your marginal rate. Fill in what applies.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Hours at home, a week"><NumberInput value={form.wfhHours} onChange={set('wfhHours')} min={0} max={80} /></Field>
          <Field label="Weeks worked from home"><NumberInput value={form.wfhWeeks} onChange={set('wfhWeeks')} min={0} max={52} /></Field>
          <Field label="Work kilometres by car" hint="Not home to work."><NumberInput value={form.carKm} onChange={set('carKm')} suffix="km" /></Field>
          <Field label="Self-education"><NumberInput value={form.selfEducation} onChange={set('selfEducation')} prefix="$" /></Field>
          <Field label="Tools and equipment"><NumberInput value={form.tools} onChange={set('tools')} prefix="$" /></Field>
          <Field label="Union and professional fees"><NumberInput value={form.fees} onChange={set('fees')} prefix="$" /></Field>
          <Field label="Donations"><NumberInput value={form.donations} onChange={set('donations')} prefix="$" /></Field>
          <Field label="Income protection premiums"><NumberInput value={form.incomeProtection} onChange={set('incomeProtection')} prefix="$" /></Field>
          <Field label="Phone and internet, a year"><NumberInput value={form.phone} onChange={set('phone')} prefix="$" /></Field>
          <Field label="Work share of it"><NumberInput value={form.phonePct} onChange={set('phonePct')} suffix="%" min={0} max={100} /></Field>
          <Field label="Uniform and laundry"><NumberInput value={form.clothing} onChange={set('clothing')} prefix="$" /></Field>
          <Field label="Personal super, deductible"><NumberInput value={form.personalSuper} onChange={set('personalSuper')} prefix="$" /></Field>
        </div>
        {income > 0 && (
          <Pending loading={deductions.loading} error={deductions.error}>
            {deductions.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Stat label="Deductions" value={aud(deductions.result.totalDeductions)} sub="taken off taxable income" />
                  <Stat label="Tax saved" value={aud(deductions.result.taxSaved)} sub={`at about ${Math.round(deductions.result.marginalRate * 100)}% plus Medicare`} tone="good" big />
                </div>
                {deductions.result.items.length > 0 && (
                  <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                    {deductions.result.items.map((i) => (
                      <li key={i.key} className="py-2">
                        <div className="flex items-center justify-between"><span className="font-medium text-slate-800 dark:text-slate-200">{i.label}</span><span className="text-slate-900 dark:text-white">{aud(i.amount)}</span></div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{i.basis}. Keep: {i.records}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <Notes items={deductions.result.notes} />
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <Panel id="bank" icon={ScanSearch} title="What your bank feed suggests" intro="The financial year’s spending read against the kinds of cost the ATO accepts. A hint at what to keep receipts for, carried into the planner above with one click." aside={<Link href="/dashboard/finance/banking" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Bank feeds</Link>}>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={runScan} disabled={scanning} className="btn-primary inline-flex items-center gap-2"><ScanSearch className="h-4 w-4" /> {scanning ? 'Reading…' : scan ? 'Read it again' : 'Read my bank feed'}</button>
          {scan && Object.keys(scan.suggestedInput).length > 0 && <button type="button" onClick={useScan} className="btn-secondary">Carry these into the deductions</button>}
          {scanError && <span className="text-sm text-slate-500 dark:text-slate-400">{scanError}</span>}
        </div>
        {scan && (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">{scan.scanned} lines from {scan.from} to {scan.to}; {scan.lines.length} look like they could be for work.</p>
            {scan.totals.length > 0 && (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {scan.totals.map((t) => (
                  <li key={t.key} className="flex items-center justify-between py-2">
                    <span className="text-slate-800 dark:text-slate-200">{t.label} <span className="text-xs text-slate-400">· {t.count} line{t.count === 1 ? '' : 's'}</span></span>
                    <span className="text-right text-slate-900 dark:text-white">{t.likely > 0 && <span className="text-emerald-700 dark:text-emerald-300">{aud(t.likely)} likely</span>}{t.likely > 0 && t.possible > 0 && ' · '}{t.possible > 0 && <span className="text-amber-700 dark:text-amber-300">{aud(t.possible)} possible</span>}</span>
                  </li>
                ))}
              </ul>
            )}
            {scan.lines.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300">The lines</summary>
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-xs">
                  {scan.lines.slice(0, 200).map((l, i) => (
                    <li key={l.id ?? i} className="flex items-start justify-between gap-3 rounded bg-slate-50 px-2 py-1 dark:bg-slate-800/60"><span className="text-slate-700 dark:text-slate-300">{l.postedAt ? `${l.postedAt} · ` : ''}{l.description} <span className="text-slate-400">· {l.category}, {l.likelihood}</span></span><span className="shrink-0 text-slate-900 dark:text-white">{aud(l.amount)}</span></li>
                  ))}
                </ul>
              </details>
            )}
            <Notes items={scan.notes} />
          </div>
        )}
      </Panel>

      <Panel id="super" icon={Landmark} title="Super that cuts the bill" intro="Contributions before tax are taxed at 15% inside super instead of your marginal rate. Here is the room you have and what each move is worth." aside={<Link href="/dashboard/finance/super" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Super tracker</Link>}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Super balance"><NumberInput value={form.superBalance} onChange={set('superBalance')} prefix="$" /></Field>
          <Field label="Personal contribution, deductible"><NumberInput value={form.personalDeductible} onChange={set('personalDeductible')} prefix="$" /></Field>
          <Field label="Personal contribution, after tax"><NumberInput value={form.afterTax} onChange={set('afterTax')} prefix="$" /></Field>
          <Field label="Partner’s income" hint="If you might contribute for them."><NumberInput value={form.spouseIncome} onChange={set('spouseIncome')} prefix="$" /></Field>
          <Field label="Contribution for your partner"><NumberInput value={form.spouseContribution} onChange={set('spouseContribution')} prefix="$" /></Field>
        </div>
        {income > 0 && (
          <Pending loading={superPlan.loading} error={superPlan.error}>
            {superPlan.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Room under the cap" value={aud(superPlan.result.concessionalHeadroom)} sub={`${aud(superPlan.result.concessionalTotal)} of ${aud(superPlan.result.concessionalCap)} used`} tone={superPlan.result.overCapBy > 0 ? 'warn' : 'good'} big />
                  <Stat label="Saved by your contributions" value={aud(superPlan.result.taxSavedByVoluntary)} sub={`${aud(superPlan.result.voluntaryConcessional)} in costs you ${aud(superPlan.result.netCostOfVoluntary)} of take-home`} />
                  <Stat label="Co-contribution" value={aud(superPlan.result.coContribution)} sub="from the government, on after-tax money" />
                  <Stat label="Spouse offset" value={aud(superPlan.result.spouseOffset)} sub="off your own tax" />
                </div>
                <ul className="space-y-2">
                  {superPlan.result.moves.map((m) => (
                    <li key={m.key} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                      <div className="flex items-center justify-between"><span className="font-medium text-slate-900 dark:text-white">{m.label}</span>{m.benefit > 0 && <span className="text-emerald-700 dark:text-emerald-300">worth about {aud(m.benefit)}</span>}</div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{m.detail}</p>
                    </li>
                  ))}
                </ul>
                <Notes items={superPlan.result.notes} />
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <Panel id="set-aside" icon={Wallet} title="The sole trader quarter" intro="Nothing is withheld from a business of your own, so this is what to move into a separate account as money comes in." aside={<Link href="/dashboard/finance/tax" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">BAS worksheet</Link>}>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Profit this year"><NumberInput value={form.profit} onChange={set('profit')} prefix="$" placeholder="60000" /></Field>
          <Field label="Sales, including GST"><NumberInput value={form.sales} onChange={set('sales')} prefix="$" /></Field>
          <Field label="Expenses with GST in them"><NumberInput value={form.expenses} onChange={set('expenses')} prefix="$" /></Field>
          <Field label="Other income" hint="A job alongside."><NumberInput value={form.soleOtherIncome} onChange={set('soleOtherIncome')} prefix="$" /></Field>
        </div>
        <div className="mt-3"><Check checked={form.gst} onChange={set('gst')} label="Registered for GST" hint="Required once sales pass $75,000." /></div>
        {profit > 0 && (
          <Pending loading={setAside.loading} error={setAside.error}>
            {setAside.result && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Put aside each quarter" value={aud(setAside.result.quarterlyTotal)} sub={`${pct(setAside.result.setAsidePctOfProfit)} of profit for income tax${setAside.result.quarterlyGst ? ', plus GST' : ''}`} tone="rose" big />
                  <Stat label="Income tax on the business" value={aud(setAside.result.taxOnBusinessIncome + setAside.result.helpOnBusinessIncome)} sub="for the year" />
                  <Stat label="GST to hand on" value={aud(setAside.result.gstNetAnnual)} sub={setAside.result.mustRegisterForGst ? 'registration required' : 'a year, if registered'} tone={setAside.result.mustRegisterForGst && !form.gst ? 'warn' : 'plain'} />
                  <Stat label="Super for yourself" value={aud(setAside.result.suggestedSuper)} sub="12%, the same as an employee; deductible" />
                </div>
                <Notes items={setAside.result.notes} />
              </div>
            )}
          </Pending>
        )}
      </Panel>

      <Panel id="earnings" icon={Coins} title="What the platform paid you" intro="Gifts from viewers, mentoring sessions and the payouts to your bank, summed for a financial year: the statement to keep with your tax records if you earn here.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36"><Field label="Financial year ending June"><NumberInput value={statementFy} onChange={setStatementFy} min={2020} max={2100} /></Field></div>
          <button type="button" onClick={loadStatement} disabled={statementBusy} className="btn-primary inline-flex items-center gap-2"><Coins className="h-4 w-4" /> {statementBusy ? 'Adding up…' : 'Show the statement'}</button>
          {statementError && <span className="text-sm text-slate-500 dark:text-slate-400">{statementError}</span>}
        </div>
        {statement && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label={`Assessable income, ${statement.fy}`} value={aud(statement.assessableIncome)} sub={`${statement.from} to ${statement.to}, after the platform fee`} tone="rose" big />
              <Stat label="Platform fees taken" value={aud(statement.platformFees)} sub="already off the figure on the left" />
              <Stat label="Paid to your bank" value={aud(statement.paidToBank)} sub={statement.gstRegistrationDue ? 'over $75,000 gross: GST registration is due' : 'under the GST threshold'} tone={statement.gstRegistrationDue ? 'warn' : 'plain'} />
            </div>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {statement.lines.map((l) => (
                <li key={l.key} className="flex items-center justify-between py-2">
                  <span className="text-slate-800 dark:text-slate-200">{l.label} <span className="text-xs text-slate-400">· {l.count}</span></span>
                  <span className="text-slate-900 dark:text-white">{aud(l.net)}{l.platformFees > 0 ? <span className="text-xs text-slate-400"> (gross {aud(l.gross)})</span> : null}</span>
                </li>
              ))}
            </ul>
            <Notes items={statement.notes} />
          </div>
        )}
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer asAt={estimate.result?.asAt} />
        <Link href="/dashboard/business/strategy#structure" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Compare business structures</Link>
      </div>
    </div>
  );
}
