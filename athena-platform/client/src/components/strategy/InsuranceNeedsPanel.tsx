'use client';

/**
 * The cover a household needs, sized from income, expenses, debts and who
 * depends on it, so the products above can be read against a number
 * rather than a feeling. General information; the insurer sets the terms.
 */

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { strategyApi } from '@/lib/strategy-api';
import { Bars, Disclaimer, Field, Notes, NumberInput, Panel, Pending, Stat, aud, num, opt, useCalc } from '@/components/strategy/StrategyUi';

type Needs = { asAt: string; incomeProtection: { monthlyBenefit: number; existing: number; gap: number; waitingPeriodDays: number; benefitPeriod: string; note: string }; life: { need: number; existing: number; gap: number; breakdown: Array<{ label: string; amount: number }> }; tpd: { need: number; existing: number; gap: number }; trauma: { suggested: number; note: string }; notes: string[] };

export function InsuranceNeedsPanel() {
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [debts, setDebts] = useState('');
  const [dependants, setDependants] = useState('0');
  const [partner, setPartner] = useState('');
  const [savings, setSavings] = useState('');
  const [superBalance, setSuperBalance] = useState('');
  const [efMonths, setEfMonths] = useState('3');
  const [life, setLife] = useState('');
  const [ip, setIp] = useState('');

  const ready = num(income) > 0 && num(expenses) > 0;
  const needs = useCalc<Needs>(strategyApi.investing.insuranceNeeds, { income: num(income), monthlyExpenses: num(expenses), debts: opt(debts), dependants: opt(dependants), partnerIncome: opt(partner), savings: opt(savings), superBalance: opt(superBalance), emergencyFundMonths: opt(efMonths), existingLife: opt(life), existingIncomeProtectionMonthly: opt(ip) }, ready);

  return (
    <Panel icon={Shield} title="The cover you actually need" intro="Income protection replaces most of a wage if you cannot work. Life and TPD cover are for the people who would be left carrying the debts and the household. Size them before you compare policies.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Your income, a year"><NumberInput value={income} onChange={setIncome} prefix="$" placeholder="85000" /></Field>
        <Field label="Household expenses, a month"><NumberInput value={expenses} onChange={setExpenses} prefix="$" placeholder="4500" /></Field>
        <Field label="Debts, including mortgage"><NumberInput value={debts} onChange={setDebts} prefix="$" /></Field>
        <Field label="Dependants"><NumberInput value={dependants} onChange={setDependants} min={0} max={12} /></Field>
        <Field label="Partner’s income"><NumberInput value={partner} onChange={setPartner} prefix="$" /></Field>
        <Field label="Savings"><NumberInput value={savings} onChange={setSavings} prefix="$" /></Field>
        <Field label="Super balance"><NumberInput value={superBalance} onChange={setSuperBalance} prefix="$" /></Field>
        <Field label="Emergency fund, months"><NumberInput value={efMonths} onChange={setEfMonths} min={0} max={24} /></Field>
        <Field label="Life cover you have" hint="Often inside super."><NumberInput value={life} onChange={setLife} prefix="$" /></Field>
        <Field label="Income protection you have, a month"><NumberInput value={ip} onChange={setIp} prefix="$" /></Field>
      </div>
      {ready && (
        <Pending loading={needs.loading} error={needs.error}>
          {needs.result && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Income protection" value={`${aud(needs.result.incomeProtection.monthlyBenefit)} a month`} sub={`${needs.result.incomeProtection.waitingPeriodDays}-day wait, paid ${needs.result.incomeProtection.benefitPeriod.toLowerCase()}${needs.result.incomeProtection.gap > 0 ? `; ${aud(needs.result.incomeProtection.gap)} more than you have` : ''}`} tone="rose" big />
                <Stat label="Life cover" value={aud(needs.result.life.need)} sub={needs.result.life.gap > 0 ? `${aud(needs.result.life.gap)} more than you have` : 'covered by what you have'} tone={needs.result.life.gap > 0 ? 'warn' : 'good'} />
                <Stat label="Total and permanent disability" value={aud(needs.result.tpd.need)} sub="life cover plus care and a home that works" />
                <Stat label="Trauma, if you want it" value={aud(needs.result.trauma.suggested)} sub="a lump sum on a serious diagnosis" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">How the life cover is made up</h3>
                <div className="mt-2"><Bars rows={needs.result.life.breakdown.map((b) => ({ label: b.label, value: Math.abs(b.amount), display: `${b.amount < 0 ? '−' : ''}${aud(Math.abs(b.amount))}`, color: b.amount < 0 ? 'bg-emerald-400' : 'bg-rose-400' }))} /></div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{needs.result.incomeProtection.note}</p>
              <Notes items={needs.result.notes} />
              <Disclaimer asAt={needs.result.asAt} advice />
            </div>
          )}
        </Pending>
      )}
    </Panel>
  );
}
