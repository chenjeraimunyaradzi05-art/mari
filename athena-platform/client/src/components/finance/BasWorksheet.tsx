'use client';

/**
 * The BAS worksheet: the quarter's figures, counted from posted journals,
 * laid out the way the statement asks for them. Lodgement is through the
 * ATO; the worksheet is recorded here as a submitted return once that is
 * done, with the figures attached.
 */

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface Worksheet {
  period: { from: string; to: string; label: string };
  g1: number;
  g2: number;
  g3: number;
  g4: number;
  g10: number;
  g11: number;
  oneA: number;
  oneB: number;
  oneAEstimated: boolean;
  oneBEstimated: boolean;
  net: number;
  lines: Array<{ accountId: string; code: string | null; name: string; taxTreatment: string; amount: number; label: string }>;
  basis: string;
}

const ATO_ONLINE = 'https://onlineservices.ato.gov.au/business/';
const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

/** Quarters on the Australian financial year, most recent first. */
function recentQuarters(count = 5): Array<{ label: string; from: string; to: string }> {
  const out: Array<{ label: string; from: string; to: string }> = [];
  const now = new Date();
  let year = now.getUTCFullYear();
  let quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3; // 0, 3, 6, 9
  for (let i = 0; i < count; i += 1) {
    const from = new Date(Date.UTC(year, quarterStartMonth, 1));
    const to = new Date(Date.UTC(year, quarterStartMonth + 3, 0));
    const fy = quarterStartMonth >= 6 ? year + 1 : year;
    const q = quarterStartMonth >= 6 ? (quarterStartMonth - 6) / 3 + 1 : quarterStartMonth / 3 + 3;
    out.push({ label: `Q${q} FY${fy} (${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)})`, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    quarterStartMonth -= 3;
    if (quarterStartMonth < 0) {
      quarterStartMonth = 9;
      year -= 1;
    }
  }
  return out;
}

export default function BasWorksheet({ onLodged }: { onLodged?: () => void }) {
  const quarters = recentQuarters();
  const [from, setFrom] = useState(quarters[0].from);
  const [to, setTo] = useState(quarters[0].to);
  const [organizationId, setOrganizationId] = useState('');
  const [sheet, setSheet] = useState<Worksheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [w1, setW1] = useState('');
  const [w2, setW2] = useState('');
  const [reference, setReference] = useState('');
  const [lodging, setLodging] = useState(false);
  const [lodged, setLodged] = useState<string | null>(null);
  const [showLines, setShowLines] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      const res = await api.get('/tax/bas', { params: { from, to, ...(organizationId ? { organizationId } : {}) } });
      setSheet(res.data?.data ?? null);
    } catch (e) {
      setProblem(errorMessage(e) || 'The worksheet could not be counted');
      setSheet(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const w2Amount = Math.max(0, Number(w2) || 0);
  const payable = sheet ? Math.round((sheet.net + w2Amount) * 100) / 100 : 0;

  const lodge = async () => {
    setLodging(true);
    setProblem(null);
    try {
      const res = await api.post('/tax/bas/lodge', {
        from,
        to,
        ...(organizationId ? { organizationId } : {}),
        ...(w1 ? { w1: Math.max(0, Number(w1) || 0) } : {}),
        ...(w2 ? { w2: w2Amount } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      setLodged(res.data?.data?.reference || 'Recorded');
      onLodged?.();
    } catch (e) {
      setProblem(errorMessage(e) || 'The lodgement could not be recorded');
    } finally {
      setLodging(false);
    }
  };

  const row = (code: string, label: string, value: number, note?: string) => (
    <tr key={code} className="border-t border-slate-100 dark:border-slate-800">
      <td className="py-2 pr-3 font-mono text-xs text-slate-500">{code}</td>
      <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
        {label}
        {note && <span className="ml-2 text-xs text-amber-600">{note}</span>}
      </td>
      <td className="py-2 text-right tabular-nums text-slate-900 dark:text-white">{aud(value)}</td>
    </tr>
  );

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Business activity statement</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Counted from posted journals by each account&apos;s tax treatment. Lodge through the ATO, then record it here.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Recount
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <select
          value={quarters.find((q) => q.from === from && q.to === to) ? `${from}|${to}` : 'custom'}
          onChange={(e) => {
            if (e.target.value === 'custom') return;
            const [f, t] = e.target.value.split('|');
            setFrom(f);
            setTo(t);
          }}
          aria-label="Quarter"
          className="input text-sm md:col-span-2"
        >
          {quarters.map((q) => (
            <option key={q.from} value={`${q.from}|${q.to}`}>
              {q.label}
            </option>
          ))}
          <option value="custom">Custom period</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="input text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="input text-sm" />
        <input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} placeholder="Organisation ID (blank for your own books)" aria-label="Organisation ID" className="input text-sm md:col-span-4" />
      </div>

      {problem && <p className="text-sm text-red-600">{problem}</p>}

      {loading && !sheet ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : sheet ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-1 pr-3">Label</th>
                  <th className="pb-1 pr-3">{sheet.period.label}</th>
                  <th className="pb-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {row('G1', 'Total sales (GST inclusive)', sheet.g1)}
                {row('G2', 'Export sales', sheet.g2)}
                {row('G3', 'Other GST-free sales', sheet.g3)}
                {row('G4', 'Input-taxed sales', sheet.g4)}
                {row('G10', 'Capital purchases', sheet.g10)}
                {row('G11', 'Non-capital purchases', sheet.g11)}
                {row('1A', 'GST on sales', sheet.oneA, sheet.oneAEstimated ? 'estimated at 10%: tag a GST collected account to count it' : undefined)}
                {row('1B', 'GST on purchases', sheet.oneB, sheet.oneBEstimated ? 'estimated at 10%: tag a GST paid account to count it' : undefined)}
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-500">W1</td>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">Total salary and wages paid (from payroll)</td>
                  <td className="py-2 text-right">
                    <input value={w1} onChange={(e) => setW1(e.target.value)} type="number" min={0} step="0.01" placeholder="0.00" aria-label="W1" className="input w-32 text-right text-sm" />
                  </td>
                </tr>
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-500">W2</td>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">Amount withheld from payments</td>
                  <td className="py-2 text-right">
                    <input value={w2} onChange={(e) => setW2(e.target.value)} type="number" min={0} step="0.01" placeholder="0.00" aria-label="W2" className="input w-32 text-right text-sm" />
                  </td>
                </tr>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-500">{payable >= 0 ? '9' : '8B'}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">{payable >= 0 ? 'Amount payable (1A − 1B + W2)' : 'Refund due (1B − 1A − W2)'}</td>
                  <td className="py-2 text-right text-lg font-bold tabular-nums text-slate-900 dark:text-white">{aud(Math.abs(payable))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">{sheet.basis} Report whole dollars on the statement itself.</p>

          <button type="button" onClick={() => setShowLines((v) => !v)} className="text-sm text-primary-600 hover:underline">
            {showLines ? 'Hide' : 'Show'} the accounts behind these figures ({sheet.lines.length})
          </button>
          {showLines && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
              {sheet.lines.length === 0 && <li className="p-3 text-slate-500">No posted journal lines in this period.</li>}
              {sheet.lines.map((l) => (
                <li key={l.accountId} className="flex items-center gap-3 p-2">
                  <span className="w-40 shrink-0 text-xs text-slate-500">{l.label}</span>
                  <span className="flex-1 truncate text-slate-800 dark:text-slate-200">
                    {l.code ? `${l.code} · ` : ''}
                    {l.name} <span className="text-xs text-slate-400">({l.taxTreatment.toLowerCase().replace(/_/g, ' ')})</span>
                  </span>
                  <span className="tabular-nums">{aud(l.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Lodge this statement in{' '}
              <a href={ATO_ONLINE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-600 underline">
                ATO Online Services for business <ExternalLink className="h-3 w-3" />
              </a>
              , then record it here. Direct lodgement from ATHENA needs an ATO-registered digital service provider, which this is not yet.
            </p>
            {lodged ? (
              <p className="mt-3 text-sm font-medium text-emerald-700">Recorded as lodged: {lodged}. It is in your tax returns below.</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ATO receipt number (optional)" aria-label="Reference" className="input text-sm" />
                <button type="button" onClick={lodge} disabled={lodging} className="btn-primary text-sm">
                  {lodging ? 'Recording…' : 'Record as lodged'}
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
