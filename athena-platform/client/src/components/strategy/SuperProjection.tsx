'use client';

/**
 * Super carried to retirement, with the gap a career break opens and what
 * closes it. Sits on the super tracker under the accounts; the balance
 * comes from them, everything else is a few fields.
 */

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { strategyApi } from '@/lib/strategy-api';
import { Field, LineChart, Notes, NumberInput, Panel, Pending, Stat, aud, num, opt, useCalc } from '@/components/strategy/StrategyUi';

type Projection = { retirementAge: number; yearsToGo: number; scenarios: Array<{ key: string; label: string; endBalance: number; endBalanceToday: number; series: Array<{ age: number; balance: number }> }>; comfortableStandard: { single: number; couple: number; asAt: string }; gapToComfortable: number; careerBreakCost: number; catchUpMonthly: number; notes: string[] };

export function SuperProjectionPanel({ balance }: { balance: number }) {
  const [age, setAge] = useState('');
  const [salary, setSalary] = useState('');
  const [extra, setExtra] = useState('200');
  const [breakYears, setBreakYears] = useState('2');
  const [breakAt, setBreakAt] = useState('');
  const [partTime, setPartTime] = useState('3');
  const [retireAt, setRetireAt] = useState('67');

  const ready = num(age) >= 15 && num(salary) > 0;
  const p = useCalc<Projection>(strategyApi.investing.superProjection, { age: num(age), retirementAge: opt(retireAt), balance, salary: num(salary), extraMonthly: opt(extra), careerBreakYears: opt(breakYears), breakAtAge: opt(breakAt), partTimeYears: opt(partTime) }, ready);

  return (
    <Panel icon={TrendingUp} title="At retirement" intro="Where the balance lands if you keep going, what a break for children costs it, and the monthly amount that makes the break up.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Your age"><NumberInput value={age} onChange={setAge} min={15} max={80} /></Field>
        <Field label="Salary"><NumberInput value={salary} onChange={setSalary} prefix="$" placeholder="85000" /></Field>
        <Field label="Retire at"><NumberInput value={retireAt} onChange={setRetireAt} min={55} max={80} /></Field>
        <Field label="Extra a month to test"><NumberInput value={extra} onChange={setExtra} prefix="$" /></Field>
        <Field label="A break of"><NumberInput value={breakYears} onChange={setBreakYears} suffix="yrs" min={0} max={20} /></Field>
        <Field label="Starting at age" hint="Blank means two years from now."><NumberInput value={breakAt} onChange={setBreakAt} min={15} max={80} /></Field>
        <Field label="Then part-time for"><NumberInput value={partTime} onChange={setPartTime} suffix="yrs" min={0} max={30} /></Field>
      </div>
      {!ready && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Add your age and salary to see the projection; the balance comes from the accounts above ({aud(balance)}).</p>}
      {ready && (
        <Pending loading={p.loading} error={p.error}>
          {p.result && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {p.result.scenarios.map((s, i) => (
                  <Stat key={s.key} label={s.label} value={aud(s.endBalance)} sub={`${aud(s.endBalanceToday)} in today’s dollars at ${p.result!.retirementAge}`} tone={i === 0 ? 'rose' : i === 1 ? 'warn' : 'good'} big={i === 0} />
                ))}
                <Stat label="The break costs" value={aud(p.result.careerBreakCost)} sub={`${aud(p.result.catchUpMonthly)} a month from now closes it`} tone="warn" />
              </div>
              <LineChart series={p.result.scenarios.map((s, i) => ({ label: s.label, color: ['#f43f5e', '#f59e0b', '#10b981'][i], values: s.series.map((x) => x.balance) }))} labels={p.result.scenarios[0].series.map((x) => `${x.age}`)} />
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {p.result.gapToComfortable > 0
                  ? `In today’s dollars that is ${aud(p.result.gapToComfortable)} short of the ${aud(p.result.comfortableStandard.single)} a comfortable retirement is put at for a single home-owner.`
                  : `In today’s dollars that clears the ${aud(p.result.comfortableStandard.single)} a comfortable retirement is put at for a single home-owner.`}
                {' '}<Link href="/dashboard/finance/tax/plan#super" className="font-medium text-rose-600 hover:underline dark:text-rose-400">The contribution moves that cut tax</Link>
              </p>
              <Notes items={p.result.notes} />
            </div>
          )}
        </Pending>
      )}
    </Panel>
  );
}
