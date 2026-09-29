'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, TrendingUp, Users, Briefcase, Home, GraduationCap, DollarSign, ShieldCheck } from 'lucide-react';
import { impactApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { StaffImpactReports, COMMUNITY_OPTIONS } from './StaffImpactReports';

type CountField = 'totalUsersSupported' | 'employmentGained' | 'housingSecured' | 'qualificationsObtained' | 'businessesStarted' | 'safetyAchieved';

/**
 * A published report as the server gives it to the public. A count from one
 * to four comes back as null and is named in `suppressed`: the server will
 * not print a number small enough to point at a woman, and this page says
 * "fewer than five" in its place rather than a zero, which would be false.
 */
type ImpactReport = Record<CountField, number | null> & {
  id: string;
  reportPeriod: string;
  communityType?: string | null;
  region: string;
  avgIncomeIncrease?: number | null;
  totalEconomicImpact?: number | null;
  narrativeSummary?: string | null;
  suppressed?: CountField[];
  minPublishedCount?: number;
  basis?: {
    period: { description: string };
    outcomesRecorded: number;
    outcomesVerified: number;
    programmeMembers: number;
  } | null;
};

const communityLabel = (value?: string | null) =>
  value ? COMMUNITY_OPTIONS.find((c) => c.value === value)?.label ?? value : 'All communities';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);

/** A count as the public may read it. */
function Count({ value, floor }: { value: number | null; floor: number }) {
  if (value === null) return <span title="Withheld so nobody can be identified">Fewer than {floor}</span>;
  return <>{value.toLocaleString()}</>;
}

function Basis({ basis }: { basis: NonNullable<ImpactReport['basis']> }) {
  return (
    <p className="text-xs text-slate-500">
      Counted from ATHENA&rsquo;s records for {basis.period.description}: the outcomes women recorded for themselves ({basis.outcomesRecorded}
      {basis.outcomesVerified > 0 ? `, ${basis.outcomesVerified} of them verified by staff` : ''}) and the {basis.programmeMembers === 1 ? 'woman' : 'women'} who began or
      completed a community programme ({basis.programmeMembers}). Each woman is counted once per outcome.
    </p>
  );
}

export default function ReportsPage() {
  const isStaff = useAuthStore().user?.role === 'ADMIN';
  const [reports, setReports] = useState<ImpactReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCommunity, setFilterCommunity] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A failed request leaves the list empty, and the empty state below says
  // nothing has been published — which is not what a failure means.
  const [loadFailed, setLoadFailed] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const response = await impactApi.getReports({
        communityType: filterCommunity || undefined,
      });
      setReports(response.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load reports');
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCommunity]);

  /*
   * The tiles show the latest report, named, rather than a total across every
   * report listed. They used to add the reports up, which counted a woman
   * twice the moment an all-communities report and a community's own report
   * covered the same quarter, and turned periods of different lengths into
   * one number that described none of them.
   */
  const latest = reports[0];
  const floor = latest?.minPublishedCount ?? 5;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-indigo-600">
          <FileText className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Impact Reports</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
          Community Impact & Outcomes
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          What happened for women on ATHENA, counted a period at a time
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {/*
        With no report published, the page says so rather than showing seven
        tiles reading nought, which would claim ATHENA supported nobody. Staff
        publish a report for a period from the panel at the foot of this page
        (admins only); its figures are counted from the platform's records, not
        typed in.
      */}
      {!loading && !loadFailed && reports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white">No impact report has been published yet</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {filterCommunity
              ? 'Nothing has been published for this community. Try another filter.'
              : 'An impact report counts what actually happened over a period: women supported, jobs gained, housing secured, safety reached. None has been published, so rather than show you a row of zeros we are telling you plainly.'}
          </p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Your own progress is on the{' '}
            <Link href="/dashboard/impact" className="text-primary-600 hover:underline">
              Impact Hub
            </Link>
            , and it is counted from your record rather than from this.
          </p>
        </div>
      ) : null}

      {latest && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Latest report: <span className="font-semibold">{latest.reportPeriod}</span> · {communityLabel(latest.communityType)} · {latest.region}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium">Women supported</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white"><Count value={latest.totalUsersSupported} floor={floor} /></p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Briefcase className="w-4 h-4" />
                <span className="text-xs font-medium">Gained employment</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white"><Count value={latest.employmentGained} floor={floor} /></p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Home className="w-4 h-4" />
                <span className="text-xs font-medium">Secured housing</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white"><Count value={latest.housingSecured} floor={floor} /></p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-medium">Reached safety</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white"><Count value={latest.safetyAchieved} floor={floor} /></p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 text-center">
              <GraduationCap className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-800 dark:text-purple-200"><Count value={latest.qualificationsObtained} floor={floor} /></p>
              <p className="text-xs text-purple-600 dark:text-purple-400">Obtained a qualification</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
              <TrendingUp className="w-6 h-6 text-amber-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-800 dark:text-amber-200"><Count value={latest.businessesStarted} floor={floor} /></p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Started a business</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
              <DollarSign className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                {latest.avgIncomeIncrease === null || latest.avgIncomeIncrease === undefined ? 'Too few to average' : formatCurrency(latest.avgIncomeIncrease)}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Average income increase recorded</p>
            </div>
          </div>
          {latest.basis && <Basis basis={latest.basis} />}
        </>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label htmlFor="report-filter" className="text-sm text-slate-600 dark:text-slate-400">Filter by community:</label>
        <select
          id="report-filter"
          value={filterCommunity}
          onChange={(e) => setFilterCommunity(e.target.value)}
          className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All reports</option>
          {COMMUNITY_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading reports...
        </div>
      ) : reports.length === 0 ? null : (
        <div className="space-y-4">
          {reports.map((report) => {
            const reportFloor = report.minPublishedCount ?? 5;
            return (
              <div
                key={report.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{report.reportPeriod}</h3>
                    <p className="text-xs text-slate-500">
                      {communityLabel(report.communityType)} • {report.region}
                    </p>
                  </div>
                  {typeof report.totalEconomicImpact === 'number' && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(report.totalEconomicImpact)}</p>
                      <p className="text-xs text-slate-500">Total economic impact</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {(
                    [
                      ['totalUsersSupported', 'Women supported'],
                      ['employmentGained', 'Gained employment'],
                      ['housingSecured', 'Secured housing'],
                      ['safetyAchieved', 'Reached safety'],
                      ['qualificationsObtained', 'Obtained a qualification'],
                      ['businessesStarted', 'Started a business'],
                    ] as Array<[CountField, string]>
                  ).map(([field, label]) => (
                    <div key={field}>
                      <p className="text-slate-500 text-xs">{label}</p>
                      <p className="font-semibold text-slate-900 dark:text-white"><Count value={report[field]} floor={reportFloor} /></p>
                    </div>
                  ))}
                </div>

                {report.narrativeSummary && (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-4">
                    {report.narrativeSummary}
                  </p>
                )}
                {report.basis && (
                  <div className="mt-3">
                    <Basis basis={report.basis} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/*
        Staff only. The server refuses these routes to anyone else; this only
        keeps the panel off members' screens.
      */}
      {isStaff && <StaffImpactReports onPublished={() => loadData()} />}

      <div className="text-center">
        <Link href="/dashboard/impact" className="text-sm text-primary-600 hover:underline">
          ← Back to Impact Hub
        </Link>
      </div>
    </div>
  );
}
