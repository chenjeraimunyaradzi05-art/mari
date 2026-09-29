/**
 * Report status lookup
 *
 * "Keep your reference number" is what the report confirmation and the
 * acknowledgment email both tell a reporter, and until this page there was
 * nowhere to use it: the server has answered GET
 * /api/compliance/report-status/:reference since the reference was introduced,
 * but no screen asked it. The reporter who most needs this is the one who filed
 * without an account and has no other way to see what happened.
 *
 * It shows only what the server chose to disclose — status, a plain-language
 * outcome and the review deadline — never a moderator's notes.
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '@/lib/api';

interface ReportStatus {
  reference: string;
  status: string;
  outcome: string | null;
  reviewDeadline: string | null;
  lastUpdated: string;
}

const STATUS_WORDS: Record<string, string> = {
  PENDING: 'Waiting for a reviewer',
  REVIEWING: 'Being reviewed',
  RESOLVED: 'Decided',
  DISMISSED: 'Decided',
};

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
}

export default function ReportStatusPage() {
  return (
    <Suspense fallback={null}>
      <ReportStatusLookup />
    </Suspense>
  );
}

function ReportStatusLookup() {
  const searchParams = useSearchParams();
  const prefilled = searchParams.get('reference') ?? '';

  const [reference, setReference] = useState(prefilled);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookUp = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.get(`/compliance/report-status/${encodeURIComponent(trimmed)}`, {
        validateStatus: () => true,
      });
      if (response.status === 404) {
        throw new Error('We could not find a report with that reference. Check it against your confirmation email.');
      }
      if (response.status === 429) {
        throw new Error('Too many lookups from here just now. Please try again in a few minutes.');
      }
      if (response.status >= 400 || !response.data?.data) {
        throw new Error(response.data?.error || 'We could not check this report just now. Please try again shortly.');
      }
      setResult(response.data.data as ReportStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not check this report just now. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  // A link from the confirmation screen carries the reference; look it up
  // straight away rather than making her press the button.
  useEffect(() => {
    if (prefilled) void lookUp(prefilled);
    // Only on arrival: later lookups come from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deadline = formatWhen(result?.reviewDeadline ?? null);
  const updated = formatWhen(result?.lastUpdated ?? null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-rose-50/40 to-white text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white">
      <main id="main-content" tabIndex={-1} className="max-w-xl mx-auto px-4 py-12">
        <Link
          href="/report"
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to reporting
        </Link>

        <h1 className="text-2xl font-bold mb-2">Check on a report</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Enter the reference from your confirmation screen or email. It starts with RPT-.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookUp(reference);
          }}
          className="flex gap-2 mb-6"
        >
          <label htmlFor="report-reference" className="sr-only">
            Report reference
          </label>
          <input
            id="report-reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="RPT-..."
            maxLength={100}
            className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !reference.trim()}
            className="inline-flex items-center px-5 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Search className="w-4 h-4 mr-2" />
            {loading ? 'Checking…' : 'Check'}
          </button>
        </form>

        {error && (
          <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5 space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Reference <span className="font-mono font-semibold text-slate-900 dark:text-white">{result.reference}</span>
            </p>
            <p className="text-lg font-semibold">{STATUS_WORDS[result.status] ?? result.status}</p>
            {result.outcome && <p className="text-slate-700 dark:text-slate-300">{result.outcome}</p>}
            {deadline && (result.status === 'PENDING' || result.status === 'REVIEWING') && (
              <p className="text-sm text-slate-600 dark:text-slate-400">A person will have looked at it by {deadline}.</p>
            )}
            {updated && <p className="text-xs text-slate-500">Last updated {updated}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
