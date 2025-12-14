"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ReportRow = {
  campaignId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spendCents: number;
  conversionValue: number;
};

type ReportSummary = {
  impressions: number;
  clicks: number;
  conversions: number;
  spendCents: number;
  conversionValue: number;
};

export default function AdsReportingPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await fetch('/api/me/organization');
        if (res.ok) {
          const data = await res.json();
          if (data.organizationId) {
            setOrganizationId(data.organizationId);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrg();
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      if (!organizationId) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          organizationId,
          startDate: dateRange.start,
          endDate: dateRange.end,
        });
        const res = await fetch(`/api/ads/reporting?${params}`);
        if (res.ok) {
          const json = await res.json();
          setReportData(json.data || []);
          setSummary(json.summary || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchReport();
    }
  }, [organizationId, dateRange]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-AU').format(num);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/dashboard/ads" className="text-sm text-pink-600 hover:underline mb-2 block">
            &larr; Back to Campaigns
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Campaign Performance</h1>
          <p className="text-slate-500 mt-1">Track impressions, clicks, and spend across your campaigns.</p>
        </div>
        <div className="flex gap-4">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 border rounded-lg"
          />
          <span className="self-center text-slate-400">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">Total Spend</div>
          <div className="text-2xl font-bold text-slate-900">
            {summary ? formatCurrency(summary.spendCents) : '-'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">Impressions</div>
          <div className="text-2xl font-bold text-slate-900">
            {summary ? formatNumber(summary.impressions) : '-'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">Clicks</div>
          <div className="text-2xl font-bold text-slate-900">
            {summary ? formatNumber(summary.clicks) : '-'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">CTR</div>
          <div className="text-2xl font-bold text-slate-900">
            {summary && summary.impressions > 0
              ? ((summary.clicks / summary.impressions) * 100).toFixed(2) + '%'
              : '0.00%'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">Conversions</div>
          <div className="text-2xl font-bold text-slate-900">
            {summary ? formatNumber(summary.conversions) : '-'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">Conversion Value</div>
          <div className="text-2xl font-bold text-slate-900">
            {summary ? formatCurrency(summary.conversionValue || 0) : '-'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">ROAS</div>
          <div className="text-2xl font-bold text-slate-900">
            {summary && summary.spendCents > 0
              ? ((summary.conversionValue || 0) / summary.spendCents).toFixed(2) + 'x'
              : '-'}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-900">Campaign Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 font-medium text-slate-500">Campaign ID</th>
                <th className="px-6 py-3 font-medium text-slate-500 text-right">Impressions</th>
                <th className="px-6 py-3 font-medium text-slate-500 text-right">Clicks</th>
                <th className="px-6 py-3 font-medium text-slate-500 text-right">CTR</th>
                <th className="px-6 py-3 font-medium text-slate-500 text-right">Conversions</th>
                <th className="px-6 py-3 font-medium text-slate-500 text-right">Conv. Value</th>
                <th className="px-6 py-3 font-medium text-slate-500 text-right">ROAS</th>
                <th className="px-6 py-3 font-medium text-slate-500 text-right">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">Loading data...</td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">No data found for this period.</td>
                </tr>
              ) : (
                reportData.map((row) => (
                  <tr key={row.campaignId} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{row.campaignId}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{formatNumber(row.impressions)}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{formatNumber(row.clicks)}</td>
                    <td className="px-6 py-3 text-right text-slate-600">
                      {row.impressions > 0 ? ((row.clicks / row.impressions) * 100).toFixed(2) + '%' : '0.00%'}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-600">{formatNumber(row.conversions)}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(row.conversionValue || 0)}</td>
                    <td className="px-6 py-3 text-right text-slate-600">
                      {row.spendCents > 0 ? ((row.conversionValue || 0) / row.spendCents).toFixed(2) + 'x' : '-'}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(row.spendCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
