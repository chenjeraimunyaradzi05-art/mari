'use client';

/**
 * The goal broken into a monthly amount, shown under the savings goal form
 * as the person fills it in: "$X a month reaches $Y by the date". One click
 * puts the figure in the monthly target field.
 */

import { strategyApi } from '@/lib/strategy-api';
import { aud, num, useCalc } from '@/components/strategy/StrategyUi';

type GoalPlan = { monthlyNeeded: number; weeklyNeeded: number; months: number; note: string; milestones: Array<{ pct: number; amount: number; month: number }> };

export function GoalPlanHint({ target, current, targetDate, onUse }: { target: string; current?: number; targetDate: string; onUse: (monthly: number) => void }) {
  const ready = num(target) > 0 && Boolean(targetDate) && new Date(targetDate).getTime() > Date.now();
  const plan = useCalc<GoalPlan>(strategyApi.investing.goalPlan, { target: num(target), current: current ?? 0, targetDate, ratePct: 4 }, ready);
  if (!ready || !plan.result) return null;
  return (
    <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
      <span>{plan.result.note} About {aud(plan.result.weeklyNeeded)} a week.</span>
      <button type="button" onClick={() => onUse(plan.result!.monthlyNeeded)} className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 dark:bg-slate-900 dark:text-emerald-300">Use {aud(plan.result.monthlyNeeded)} a month</button>
    </div>
  );
}
