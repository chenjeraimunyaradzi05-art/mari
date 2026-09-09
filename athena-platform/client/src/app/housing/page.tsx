'use client';

/**
 * Housing, in public. The first-home guide the blueprint asks for, with the
 * two calculators a visitor wants before she signs up (what rent she can
 * carry, what duty a price attracts), and the way into the safe listings.
 * The full plan, the deposit goal and the loan live behind a sign-in.
 */

import { useState } from 'react';
import Link from 'next/link';
import { HeartHandshake, Home, Key, Landmark, PiggyBank, ShieldCheck } from 'lucide-react';
import { PageHero, PageShell, Section } from '@/components/layout/PageShell';
import { strategyApi } from '@/lib/strategy-api';
import { Check, Disclaimer, Field, NumberInput, Pending, SelectInput, Stat, aud, num, useCalc } from '@/components/strategy/StrategyUi';

const STATES = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }));

type Rent = { comfortableWeeklyRent: number; netWeeklyIncome: number };
type Duty = { dutyPayable: number; generalDuty: number; firstHomeRelief: number; reliefApplied: string; note: string; asAt: string };
type RentHelp = { households: Array<{ id: string; label: string }>; bondHelp: Array<{ state: string; scheme: string; what: string; who: string; leavingViolence: string; url: string }>; leavingViolence: { name: string; what: string; url: string; phone: string } };
type Assistance = { estimateFortnightly: number; threshold: number; maximum: number };

const STEPS = [
  { title: 'The deposit', copy: 'Five percent is enough under the Home Guarantee Scheme, with no mortgage insurance. Twenty percent avoids it without the scheme. The plan works out which, and when you get there.', href: '/dashboard/housing/plan#deposit' },
  { title: 'Transfer duty', copy: 'Every state gives first home buyers relief, and every state draws the line somewhere different. Try a price below.', href: '#duty' },
  { title: 'The loan', copy: 'A lender tests you at the rate plus three points. Knowing that number first means the price you look at is one you can carry.', href: '/dashboard/housing/plan#loan' },
  { title: 'Rent or buy', copy: 'Buying is not always ahead. The comparison starts both paths with the same cash and shows where each lands after the years you choose.', href: '/dashboard/housing/plan#rent-or-buy' },
  { title: 'Settling', copy: 'A conveyancer, a building and pest inspection, and a few thousand set aside for the move. The plan counts these in the cash you need.', href: '/dashboard/housing/plan#deposit' },
];

export default function HousingPage() {
  const [income, setIncome] = useState('');
  const [state, setState] = useState('QLD');
  const [price, setPrice] = useState('');
  const [firstHome, setFirstHome] = useState(true);
  const [newHome, setNewHome] = useState(false);

  const [household, setHousehold] = useState('single');
  const [fortnightlyRent, setFortnightlyRent] = useState('');

  const rent = useCalc<Rent>(strategyApi.housing.rent, { annualIncome: num(income) }, num(income) > 0);
  const duty = useCalc<Duty>(strategyApi.housing.stampDuty, { state, price: num(price), firstHome, newHome }, num(price) > 0);
  const help = useCalc<RentHelp>(() => strategyApi.housing.rentHelp(), {}, true, 0);
  const assistance = useCalc<Assistance>(strategyApi.housing.rentAssistance, { fortnightlyRent: num(fortnightlyRent), household }, num(fortnightlyRent) > 0);
  const bond = help.result?.bondHelp.find((b) => b.state === state);

  return (
    <PageShell>
      <PageHero
        kicker="Housing"
        title="Somewhere to live, and how to afford it"
        description="Rent that leaves room for the rest of life, a first home reached one pay at a time, and safe places listed by people who understand why privacy matters."
        primaryAction={{ label: 'Plan to rent or buy', href: '/dashboard/housing/plan' }}
        secondaryAction={{ label: 'Safe housing listings', href: '/dashboard/housing' }}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section icon={Key} title="What rent leaves room" description="The line housing agencies draw is 30% of income. Under it, rent is a bill; over it, rent is the budget.">
          <Field label="Your income, a year"><NumberInput value={income} onChange={setIncome} prefix="$" placeholder="65000" /></Field>
          {num(income) > 0 && (
            <Pending loading={rent.loading} error={rent.error}>
              {rent.result && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Stat label="Comfortable rent" value={`${aud(rent.result.comfortableWeeklyRent)} a week`} tone="good" big />
                  <Stat label="Take-home pay" value={`${aud(rent.result.netWeeklyIncome)} a week`} sub="after tax, roughly" />
                </div>
              )}
            </Pending>
          )}
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">Bond is usually four weeks of rent, and every state runs a bond loan for anyone who cannot pay it up front.</p>
        </Section>

        <Section icon={Landmark} title="Transfer duty, quickly" description="What the state charges on the day, and what a first home buyer is spared.">
          <div id="duty" className="grid grid-cols-2 gap-3">
            <Field label="State"><SelectInput value={state} onChange={setState} options={STATES} /></Field>
            <Field label="Price"><NumberInput value={price} onChange={setPrice} prefix="$" placeholder="650000" /></Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <Check checked={firstHome} onChange={setFirstHome} label="First home" />
            <Check checked={newHome} onChange={setNewHome} label="New build or land" />
          </div>
          {num(price) > 0 && (
            <Pending loading={duty.loading} error={duty.error}>
              {duty.result && (
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Duty to pay" value={aud(duty.result.dutyPayable)} tone={duty.result.dutyPayable === 0 ? 'good' : 'rose'} big />
                    <Stat label="Without relief" value={aud(duty.result.generalDuty)} sub={duty.result.firstHomeRelief > 0 ? `${aud(duty.result.firstHomeRelief)} spared` : undefined} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-400">{duty.result.note}</p>
                </div>
              )}
            </Pending>
          )}
        </Section>
      </div>

      <div className="mt-6">
        <Section icon={Home} title="A first home, one step at a time" description="The order the money happens in. Each step opens the part of the plan that works it out for you." action={{ label: 'Open the plan', href: '/dashboard/housing/plan' }}>
          <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="tile-soft flex flex-col p-4">
                <span className="text-xs font-semibold text-rose-500">Step {i + 1}</span>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-1 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{s.copy}</p>
                <Link href={s.href} className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-400">Work it out</Link>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section icon={ShieldCheck} title="Safe housing" description="Listings from agents and members who know what a safe home means, some of them only for women leaving a dangerous one.">
          <ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            <li>Ask about a place through the platform; the address is not shown until the person who listed it answers you.</li>
            <li>Flexible leases, break clauses and emergency and transitional places are marked as such.</li>
            <li>Safe mode hides this part of the site from anyone looking over your shoulder.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/housing" className="focusable rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900">See the listings</Link>
            <Link href="/safety-center" className="focusable rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">Safety centre</Link>
          </div>
        </Section>

        <Section icon={PiggyBank} title="Saving for it" description="A deposit goal in the savings tracker, and the super scheme that helps first home buyers.">
          <ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            <li>The plan turns the cash you need into a monthly amount and a date, and starts the goal for you.</li>
            <li>The First Home Super Saver scheme lets you put up to $50,000 of voluntary contributions into super at 15% tax and draw them out for the deposit.</li>
            <li>A high-interest savings account or an offset keeps the deposit reachable and earning.</li>
          </ul>
          <div className="mt-4">
            <Link href="/dashboard/finance/savings" className="text-sm font-semibold text-rose-600 dark:text-rose-400">Savings goals</Link>
          </div>
        </Section>
      </div>

      <div className="mt-6">
        <Section icon={HeartHandshake} title="Help with the bond and the rent" description="Every state lends the bond interest-free to people who cannot pay it up front, and Rent Assistance tops up a low income. Pick your state above and the scheme appears here.">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Household"><SelectInput value={household} onChange={setHousehold} options={(help.result?.households ?? [{ id: 'single', label: 'Single, no children' }]).map((h) => ({ value: h.id, label: h.label }))} /></Field>
                <Field label="Rent, a fortnight"><NumberInput value={fortnightlyRent} onChange={setFortnightlyRent} prefix="$" placeholder="800" /></Field>
              </div>
              {num(fortnightlyRent) > 0 && (
                <Pending loading={assistance.loading} error={assistance.error}>
                  {assistance.result && <div className="mt-3"><Stat label="Rent Assistance, with an income support payment" value={`${aud(assistance.result.estimateFortnightly)} a fortnight`} sub={`75c for each dollar of rent over ${aud(assistance.result.threshold)}, up to ${aud(assistance.result.maximum)}`} tone={assistance.result.estimateFortnightly > 0 ? 'good' : 'plain'} big /></div>}
                </Pending>
              )}
            </div>
            <div className="space-y-3">
              {bond && (
                <div className="tile-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">{bond.state}: {bond.scheme}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{bond.what}</p>
                  <a href={bond.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-rose-600 dark:text-rose-400">How to apply</a>
                </div>
              )}
              {help.result && (
                <div className="tile-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">If you are leaving violence</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{bond?.leavingViolence} {help.result.leavingViolence.name}: {help.result.leavingViolence.what}</p>
                  <a href={help.result.leavingViolence.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-rose-600 dark:text-rose-400">{help.result.leavingViolence.phone}</a>
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-6"><Disclaimer asAt={duty.result?.asAt} /></div>
    </PageShell>
  );
}
