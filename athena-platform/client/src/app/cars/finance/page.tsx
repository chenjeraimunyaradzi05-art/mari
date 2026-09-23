'use client';

/**
 * Car finance, in public: the repayment on a loan and what a balloon
 * really does, several loans compared on their whole cost, what she can
 * carry from her take-home pay, the whole cost of owning one car against
 * another, and how ready an application is, with the glossary and what a
 * lender will ask. Saving the readiness figures lives behind a sign-in.
 *
 * Everything here is ATHENA's own arithmetic. ATHENA is not a lender and
 * not a licensed credit broker, so no page in this vertical may offer,
 * approve or pre-approve credit; the dashboard page this one links to used
 * to, and no longer does.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Banknote, Scale, Wallet } from 'lucide-react';
import { PageHero, PageShell } from '@/components/layout/PageShell';
import { autoApi, aud0, type Reference } from '@/lib/automotive-api';
import { AutoDisclaimer, useReference } from '@/components/automotive/AutoUi';
import { Bars, Check, Field, JumpLinks, Notes, NumberInput, Panel, Pending, SelectInput, Stat, num, opt, useCalc } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Repayment = { repayment: number; weekly: number; fortnightly: number; balloon: number; totalRepaid: number; totalInterest: number; totalFees: number; totalCost: number; effectiveRatePct: number; schedule: Array<{ year: number; interest: number; principal: number; closing: number }> };
type Comparison = { loans: Array<{ name: string; ratePct: number; repayment: number; totalCost: number; totalInterest: number; totalFees: number; effectiveRatePct: number; cheapest: boolean; moreThanCheapest: number; note: string; balloon: number }>; note: string };
type Affordability = { netMonthly: number; surplusMonthly: number; comfortableRepayment: number; comfortableLoan: number; comfortablePrice: number; maxRepayment: number; maxLoan: number; maxPrice: number; verdict: string; notes: string[] };
type Ownership = { cars: Array<{ label: string; totals: { total: number; perYear: number; perWeek: number; perKm: number; depreciation: number; energy: number; insurance: number; rego: number; servicing: number; tyres: number; interest: number }; assumptions: string[] }> };
type Readiness = { score: number; band: string; amount: number; repaymentMonthly: number; ratePct: number; notes: string[]; lenderChecks: string[] };

const JUMPS = [{ id: 'repayment', label: 'Repayment' }, { id: 'compare', label: 'Compare loans' }, { id: 'afford', label: 'What you can carry' }, { id: 'ownership', label: 'Cost of ownership' }, { id: 'ready', label: 'Ready to apply?' }, { id: 'glossary', label: 'The words' }];

function Finance() {
  const search = useSearchParams();
  const ref = useReference();
  const d = ref.data?.finance.defaults;
  const startPrice = search.get('price') ?? '35000';
  const [amount, setAmount] = useState(String(Math.round(num(startPrice) * 0.9)));
  const [rate, setRate] = useState('8.49');
  const [term, setTerm] = useState('60');
  const [balloon, setBalloon] = useState('0');
  const [estFee, setEstFee] = useState('0');
  const [monthlyFee, setMonthlyFee] = useState('0');
  const rep = useCalc<Repayment>(autoApi.finance.repayment, { amount: num(amount), ratePct: num(rate), termMonths: num(term), balloonPct: num(balloon), establishmentFee: num(estFee), monthlyFee: num(monthlyFee) }, num(amount) > 0);

  const [loans, setLoans] = useState([{ name: 'Bank', ratePct: '7.99', establishmentFee: '250', monthlyFee: '0', balloonPct: '0', secured: true }, { name: 'Dealer', ratePct: '6.49', establishmentFee: '0', monthlyFee: '8', balloonPct: '30', secured: true }, { name: 'Online lender', ratePct: '9.49', establishmentFee: '400', monthlyFee: '0', balloonPct: '0', secured: true }]);
  const cmp = useCalc<Comparison>(autoApi.finance.compare, { amount: num(amount), termMonths: num(term), loans: loans.filter((l) => l.name.trim()).map((l) => ({ name: l.name, ratePct: num(l.ratePct), establishmentFee: num(l.establishmentFee), monthlyFee: num(l.monthlyFee), balloonPct: num(l.balloonPct), secured: l.secured })) }, num(amount) > 0 && loans.length > 0);

  const [income, setIncome] = useState('');
  const [partner, setPartner] = useState('');
  const [expenses, setExpenses] = useState('');
  const [debts, setDebts] = useState('');
  const [deps, setDeps] = useState('0');
  const [deposit, setDeposit] = useState('');
  const aff = useCalc<Affordability>(autoApi.finance.affordability, { incomeAnnual: num(income), partnerIncomeAnnual: opt(partner), expensesMonthly: num(expenses), otherDebtsMonthly: opt(debts), dependants: num(deps), deposit: opt(deposit), termMonths: num(term), ratePct: num(rate) }, num(income) > 0 && num(expenses) > 0);

  const [own, setOwn] = useState([{ label: 'Petrol SUV', price: '38000', fuelType: 'PETROL', fuelPer100: '7.5', kwhPer100: '' }, { label: 'Electric SUV', price: '48000', fuelType: 'ELECTRIC', fuelPer100: '', kwhPer100: '16' }]);
  const [kmYear, setKmYear] = useState('15000');
  const [years, setYears] = useState('5');
  const [state, setState] = useState('QLD');
  const owning = useCalc<Ownership>(autoApi.finance.ownership, { cars: own.map((c) => ({ label: c.label, price: num(c.price), fuelType: c.fuelType, bodyType: 'SUV', fuelPer100: opt(c.fuelPer100), kwhPer100: opt(c.kwhPer100), kmPerYear: num(kmYear), years: num(years), state })) }, own.every((c) => num(c.price) > 0));

  const [rd, setRd] = useState({ vehiclePrice: startPrice, deposit: '', incomeAnnual: '', expensesMonthly: '', otherDebtsMonthly: '', dependants: '0', employment: 'FULL_TIME', employmentMonths: '', residency: 'CITIZEN', hasDefaults: false });
  const ready = useCalc<Readiness>(autoApi.finance.readiness, { ...rd, vehiclePrice: num(rd.vehiclePrice), deposit: opt(rd.deposit), incomeAnnual: num(rd.incomeAnnual), expensesMonthly: num(rd.expensesMonthly), otherDebtsMonthly: opt(rd.otherDebtsMonthly), dependants: num(rd.dependants), employmentMonths: opt(rd.employmentMonths), termMonths: num(term) }, num(rd.vehiclePrice) > 0 && num(rd.incomeAnnual) > 0 && num(rd.expensesMonthly) > 0);

  const setLoan = (i: number, k: string, v: string | boolean) => setLoans((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const setOwnCar = (i: number, k: string, v: string) => setOwn((cs) => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  return (
    <PageShell width="wide" backTo={{ href: '/cars', label: 'Back to cars' }}>
      <PageHero kicker="Car finance" title="The arithmetic before the paperwork" description="What a loan really costs, what a balloon does, what you can carry from your take-home pay, and what one car costs against another over the years you will keep it. Then, if it adds up, your figures saved and scored so you walk into a lender knowing where you stand." primaryAction={{ label: 'Work out where you stand', href: '/dashboard/cars/finance' }} secondaryAction={{ label: 'Insurance estimate', href: '/cars/insurance' }} />
      <div className="mt-6"><JumpLinks items={JUMPS} /></div>
      {d && <p className="mt-3 text-xs text-slate-500">Typical secured rates, {d.asAt}: new cars {d.newCarSecured.low}% to {d.newCarSecured.high}%, used cars {d.usedCarSecured.low}% to {d.usedCarSecured.high}%, unsecured {d.unsecured.low}% to {d.unsecured.high}%.</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel id="repayment" icon={Banknote} title="The repayment" intro="Change the balloon and watch the monthly figure fall and the interest rise.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Borrow"><NumberInput value={amount} onChange={setAmount} prefix="$" /></Field>
            <Field label="Rate"><NumberInput value={rate} onChange={setRate} suffix="%" step={0.1} /></Field>
            <Field label="Months"><NumberInput value={term} onChange={setTerm} /></Field>
            <Field label="Balloon"><NumberInput value={balloon} onChange={setBalloon} suffix="%" /></Field>
            <Field label="Set-up fee"><NumberInput value={estFee} onChange={setEstFee} prefix="$" /></Field>
            <Field label="Monthly fee"><NumberInput value={monthlyFee} onChange={setMonthlyFee} prefix="$" /></Field>
          </div>
          <Pending loading={rep.loading} error={rep.error}>
            {rep.result && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="A month" value={aud0(rep.result.repayment)} tone="rose" big /><Stat label="Interest" value={aud0(rep.result.totalInterest)} /><Stat label="Fees" value={aud0(rep.result.totalFees)} /><Stat label="Rate with fees" value={`${rep.result.effectiveRatePct}%`} sub="the comparison rate, roughly" /></div>
                {rep.result.balloon > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">At the end you still owe {aud0(rep.result.balloon)}, and by then the car is worth less than it is today. Have a plan for that day before you sign.</p>}
                <Bars rows={rep.result.schedule.map((y) => ({ label: `Year ${y.year}`, value: y.interest, display: `${aud0(y.interest)} interest`, color: '#f43f5e' }))} />
              </div>
            )}
          </Pending>
        </Panel>

        <Panel id="compare" icon={Scale} title="Loans compared" intro="The same amount and term through each offer. Ranked by what they cost over the loan, fees and balloon included.">
          <div className="space-y-2">
            {loans.map((l, i) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-6 dark:bg-slate-800/60">
                <Field label="Name"><input value={l.name} onChange={(e) => setLoan(i, 'name', e.target.value)} className="w-full rounded-md border border-slate-200 bg-transparent px-2 py-1.5 text-sm dark:border-slate-700" /></Field>
                <Field label="Rate"><NumberInput value={l.ratePct} onChange={(v) => setLoan(i, 'ratePct', v)} suffix="%" step={0.1} /></Field>
                <Field label="Set-up"><NumberInput value={l.establishmentFee} onChange={(v) => setLoan(i, 'establishmentFee', v)} prefix="$" /></Field>
                <Field label="Monthly"><NumberInput value={l.monthlyFee} onChange={(v) => setLoan(i, 'monthlyFee', v)} prefix="$" /></Field>
                <Field label="Balloon"><NumberInput value={l.balloonPct} onChange={(v) => setLoan(i, 'balloonPct', v)} suffix="%" /></Field>
                <div className="flex items-center justify-between gap-2 pb-1"><Check checked={l.secured} onChange={(v) => setLoan(i, 'secured', v)} label="Secured" />{loans.length > 1 && <button type="button" onClick={() => setLoans((ls) => ls.filter((_, j) => j !== i))} className="text-xs text-slate-500 hover:text-rose-600">Remove</button>}</div>
              </div>
            ))}
            {loans.length < 6 && <button type="button" onClick={() => setLoans((ls) => [...ls, { name: `Offer ${ls.length + 1}`, ratePct: '8', establishmentFee: '0', monthlyFee: '0', balloonPct: '0', secured: true }])} className="btn-ghost text-sm">Add another offer</button>}
          </div>
          <Pending loading={cmp.loading} error={cmp.error}>
            {cmp.result && (
              <ul className="mt-4 space-y-2">
                {cmp.result.loans.map((l) => (
                  <li key={l.name} className={cn('rounded-xl border p-3', l.cheapest ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800')}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900 dark:text-white">{l.name} <span className="text-xs font-normal text-slate-500">{l.ratePct}%, {l.effectiveRatePct}% with fees</span></p><p className="text-sm tabular-nums text-slate-900 dark:text-white">{aud0(l.repayment)} a month · costs {aud0(l.totalCost)}{!l.cheapest && <span className="text-rose-600"> (+{aud0(l.moreThanCheapest)})</span>}</p></div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{l.note}</p>
                  </li>
                ))}
                <li className="text-xs text-slate-500">{cmp.result.note}</li>
              </ul>
            )}
          </Pending>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel id="afford" icon={Wallet} title="What you can carry" intro="From take-home pay, the bills, other debts and dependants. Two lines: the one that leaves room to live, and the one a lender might still pass.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Your income, a year"><NumberInput value={income} onChange={setIncome} prefix="$" placeholder="78000" /></Field>
            <Field label="Partner's income" hint="If borrowing together."><NumberInput value={partner} onChange={setPartner} prefix="$" /></Field>
            <Field label="Living costs, a month"><NumberInput value={expenses} onChange={setExpenses} prefix="$" placeholder="2600" /></Field>
            <Field label="Other repayments, a month"><NumberInput value={debts} onChange={setDebts} prefix="$" /></Field>
            <Field label="Dependants"><NumberInput value={deps} onChange={setDeps} /></Field>
            <Field label="Deposit and trade-in"><NumberInput value={deposit} onChange={setDeposit} prefix="$" /></Field>
          </div>
          <Pending loading={aff.loading} error={aff.error}>
            {aff.result && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2"><Stat label="Comfortable car price" value={aud0(aff.result.comfortablePrice)} sub={`${aud0(aff.result.comfortableRepayment)} a month on a loan of ${aud0(aff.result.comfortableLoan)}`} tone="good" big /><Stat label="The most a lender might pass" value={aud0(aff.result.maxPrice)} sub={`${aud0(aff.result.maxRepayment)} a month, every dollar of surplus`} tone={aff.result.verdict === 'not_yet' ? 'warn' : 'plain'} /></div>
                <Notes items={aff.result.notes} />
              </div>
            )}
          </Pending>
        </Panel>

        <Panel id="ownership" title="Cost of ownership, one car against another" intro="Depreciation, energy, insurance, registration, servicing and tyres. The sticker is the smallest of the surprises.">
          <div className="grid grid-cols-3 gap-2"><Field label="Kilometres a year"><NumberInput value={kmYear} onChange={setKmYear} /></Field><Field label="Years"><NumberInput value={years} onChange={setYears} min={1} max={10} /></Field><Field label="State"><SelectInput value={state} onChange={setState} options={['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))} /></Field></div>
          <div className="mt-2 space-y-2">
            {own.map((c, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-5 dark:bg-slate-800/60">
                <Field label="Label"><input value={c.label} onChange={(e) => setOwnCar(i, 'label', e.target.value)} className="w-full rounded-md border border-slate-200 bg-transparent px-2 py-1.5 text-sm dark:border-slate-700" /></Field>
                <Field label="Price"><NumberInput value={c.price} onChange={(v) => setOwnCar(i, 'price', v)} prefix="$" /></Field>
                <Field label="Fuel"><SelectInput value={c.fuelType} onChange={(v) => setOwnCar(i, 'fuelType', v)} options={(ref.data?.fuelTypes ?? []).map((f) => ({ value: f.key, label: f.label }))} /></Field>
                {c.fuelType === 'ELECTRIC' ? <Field label="kWh/100 km"><NumberInput value={c.kwhPer100} onChange={(v) => setOwnCar(i, 'kwhPer100', v)} step={0.1} /></Field> : <Field label="L/100 km"><NumberInput value={c.fuelPer100} onChange={(v) => setOwnCar(i, 'fuelPer100', v)} step={0.1} /></Field>}
                <div className="flex items-end pb-1">{own.length > 1 && <button type="button" onClick={() => setOwn((cs) => cs.filter((_, j) => j !== i))} className="text-xs text-slate-500 hover:text-rose-600">Remove</button>}</div>
              </div>
            ))}
            {own.length < 4 && <button type="button" onClick={() => setOwn((cs) => [...cs, { label: `Car ${cs.length + 1}`, price: '30000', fuelType: 'HYBRID', fuelPer100: '4.5', kwhPer100: '' }])} className="btn-ghost text-sm">Add a car</button>}
          </div>
          <Pending loading={owning.loading} error={owning.error}>
            {owning.result && (
              <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-2">&nbsp;</th>{owning.result.cars.map((c) => <th key={c.label} className="py-1 pr-2">{c.label}</th>)}</tr></thead><tbody>
                {([['A week, all in', 'perWeek'], ['A year', 'perYear'], ['Over the period', 'total'], ['Value lost', 'depreciation'], ['Fuel or charging', 'energy'], ['Insurance', 'insurance'], ['Registration', 'rego'], ['Servicing', 'servicing'], ['Tyres', 'tyres']] as Array<[string, keyof Ownership['cars'][number]['totals']]>).map(([label, k]) => <tr key={k} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5 pr-2 text-slate-600 dark:text-slate-400">{label}</td>{owning.result!.cars.map((c) => <td key={c.label} className={cn('py-1.5 pr-2 tabular-nums', k === 'perWeek' && 'font-semibold text-slate-900 dark:text-white')}>{aud0(c.totals[k])}</td>)}</tr>)}
              </tbody></table><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Assumptions</summary><ul className="mt-1 list-disc pl-4">{owning.result.cars[0].assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details></div>
            )}
          </Pending>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel id="ready" title="Ready to apply?" intro="A score from what a lender reads, and the notes that say why. ATHENA is not a lender and not a licensed credit broker: nothing here is a credit check, an approval or a pre-approval, and no lender sees it. It is the arithmetic to have done before you go to one.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <Field label="Car price"><NumberInput value={rd.vehiclePrice} onChange={(v) => setRd((x) => ({ ...x, vehiclePrice: v }))} prefix="$" /></Field>
            <Field label="Deposit and trade-in"><NumberInput value={rd.deposit} onChange={(v) => setRd((x) => ({ ...x, deposit: v }))} prefix="$" /></Field>
            <Field label="Income, a year"><NumberInput value={rd.incomeAnnual} onChange={(v) => setRd((x) => ({ ...x, incomeAnnual: v }))} prefix="$" /></Field>
            <Field label="Living costs, a month"><NumberInput value={rd.expensesMonthly} onChange={(v) => setRd((x) => ({ ...x, expensesMonthly: v }))} prefix="$" /></Field>
            <Field label="Other repayments, a month"><NumberInput value={rd.otherDebtsMonthly} onChange={(v) => setRd((x) => ({ ...x, otherDebtsMonthly: v }))} prefix="$" /></Field>
            <Field label="Work"><SelectInput value={rd.employment} onChange={(v) => setRd((x) => ({ ...x, employment: v }))} options={(ref.data?.finance.employment ?? []).map((e) => ({ value: e.key, label: e.label }))} /></Field>
            <Field label="Months in it"><NumberInput value={rd.employmentMonths} onChange={(v) => setRd((x) => ({ ...x, employmentMonths: v }))} /></Field>
            <Field label="Residency"><SelectInput value={rd.residency} onChange={(v) => setRd((x) => ({ ...x, residency: v }))} options={[{ value: 'CITIZEN', label: 'Citizen' }, { value: 'PR', label: 'Permanent resident' }, { value: 'VISA', label: 'On a visa' }]} /></Field>
            <Field label="Dependants"><NumberInput value={rd.dependants} onChange={(v) => setRd((x) => ({ ...x, dependants: v }))} /></Field>
            <div className="flex items-end pb-2"><Check checked={rd.hasDefaults} onChange={(v) => setRd((x) => ({ ...x, hasDefaults: v }))} label="A default in the last five years" /></div>
          </div>
          <Pending loading={ready.loading} error={ready.error}>
            {ready.result && (
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
                <div><Stat label="Readiness" value={`${ready.result.score} / 100`} sub={ready.result.band === 'ready' ? 'Ready to apply' : ready.result.band === 'nearly' ? 'Nearly; read the notes' : 'Not yet; the notes say what to fix'} tone={ready.result.band === 'ready' ? 'good' : ready.result.band === 'nearly' ? 'plain' : 'warn'} big /><p className="mt-2 text-sm text-slate-700 dark:text-slate-300">Borrowing {aud0(ready.result.amount)} at about {ready.result.ratePct}% is {aud0(ready.result.repaymentMonthly)} a month.</p><Link href="/dashboard/cars/finance" className="btn-primary mt-3 inline-block text-sm">Save these figures</Link></div>
                <div><Notes items={ready.result.notes} title="What a lender will see" /><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">What a lender will ask for</summary><ul className="mt-1 list-disc pl-4">{ready.result.lenderChecks.map((c) => <li key={c}>{c}</li>)}</ul></details></div>
              </div>
            )}
          </Pending>
        </Panel>
      </div>

      <section id="glossary" className="mt-8 scroll-mt-24">
        <h2 className="rail-title">The words, in plain English</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">{(ref.data?.finance.glossary ?? []).map((g: Reference['finance']['glossary'][number]) => <div key={g.term} className="surface p-4"><dt className="font-semibold text-slate-900 dark:text-white">{g.term}</dt><dd className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{g.plain}</dd></div>)}</dl>
        <div className="mt-4"><AutoDisclaimer what="These figures are estimates from published rates and typical costs, for planning. ATHENA is not a lender or a licensed credit broker and cannot approve or pre-approve credit." /></div>
      </section>
    </PageShell>
  );
}

export default function FinancePage() {
  return <Suspense fallback={<PageShell width="wide"><div className="text-sm text-slate-500">Loading</div></PageShell>}><Finance /></Suspense>;
}
