'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function TaxPage() {
  const [rates, setRates] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState({
    organizationId: '',
    name: '',
    type: 'GST',
    rate: '',
    region: '',
    effectiveFrom: '',
  });
  const [returnForm, setReturnForm] = useState({
    organizationId: '',
    periodStart: '',
    periodEnd: '',
    currency: 'AUD',
    totalSales: '',
    totalTax: '',
    reference: '',
  });
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState({
    name: '',
    type: 'GST',
    rate: '',
    region: '',
  });
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);
  const [editingReturn, setEditingReturn] = useState({
    periodStart: '',
    periodEnd: '',
    currency: 'AUD',
    totalSales: '',
    totalTax: '',
    reference: '',
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [ratesRes, returnsRes] = await Promise.all([
          api.get('/tax/rates'),
          api.get('/tax/returns'),
        ]);

        if (!isMounted) return;
        setRates(ratesRes.data?.data || []);
        setReturns(returnsRes.data?.data || []);
      } catch {
        if (!isMounted) return;
        setRates([]);
        setReturns([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const reload = async () => {
    const [ratesRes, returnsRes] = await Promise.all([
      api.get('/tax/rates'),
      api.get('/tax/returns'),
    ]);
    setRates(ratesRes.data?.data || []);
    setReturns(returnsRes.data?.data || []);
  };

  const handleCreateRate = async () => {
    if (!rateForm.name.trim()) {
      setFormError('Tax rate name is required');
      return;
    }
    const rateValue = Number(rateForm.rate || 0);
    if (!Number.isFinite(rateValue) || rateValue < 0) {
      setFormError('Rate must be a valid number');
      return;
    }
    setSaving(true);
    setFormError(null);
    const prevRates = rates;
    setRates([
      {
        id: `tmp-${Date.now()}`,
        name: rateForm.name,
        type: rateForm.type,
        rate: rateValue / 100,
        region: rateForm.region,
      },
      ...rates,
    ]);
    try {
      await api.post('/tax/rates', {
        organizationId: rateForm.organizationId || undefined,
        name: rateForm.name,
        type: rateForm.type,
        rate: rateValue,
        region: rateForm.region || undefined,
        effectiveFrom: rateForm.effectiveFrom || undefined,
      });
      setRateForm({
        organizationId: '',
        name: '',
        type: 'GST',
        rate: '',
        region: '',
        effectiveFrom: '',
      });
      await reload();
    } catch (error: any) {
      setRates(prevRates);
      setFormError(error?.response?.data?.error || 'Failed to create tax rate');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateReturn = async () => {
    if (!returnForm.periodStart || !returnForm.periodEnd) {
      setFormError('Return period start and end are required');
      return;
    }
    setSaving(true);
    setFormError(null);
    const prevReturns = returns;
    setReturns([
      {
        id: `tmp-${Date.now()}`,
        periodStart: returnForm.periodStart,
        periodEnd: returnForm.periodEnd,
        currency: returnForm.currency || 'AUD',
        totalSales: Number(returnForm.totalSales || 0),
        totalTax: Number(returnForm.totalTax || 0),
        status: 'DRAFT',
      },
      ...returns,
    ]);
    try {
      await api.post('/tax/returns', {
        organizationId: returnForm.organizationId || undefined,
        periodStart: returnForm.periodStart,
        periodEnd: returnForm.periodEnd,
        currency: returnForm.currency,
        totalSales: Number(returnForm.totalSales || 0),
        totalTax: Number(returnForm.totalTax || 0),
        reference: returnForm.reference || undefined,
      });
      setReturnForm({
        organizationId: '',
        periodStart: '',
        periodEnd: '',
        currency: 'AUD',
        totalSales: '',
        totalTax: '',
        reference: '',
      });
      await reload();
    } catch (error: any) {
      setReturns(prevReturns);
      setFormError(error?.response?.data?.error || 'Failed to create tax return');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReturn = async (id: string) => {
    const prevReturns = returns;
    setReturns(
      returns.map((entry) =>
        entry.id === id ? { ...entry, status: 'SUBMITTED' } : entry
      )
    );
    try {
      await api.post(`/tax/returns/${id}/submit`);
      await reload();
    } catch (error: any) {
      setReturns(prevReturns);
      setFormError(error?.response?.data?.error || 'Failed to submit tax return');
    }
  };

  const handleDeleteReturn = async (id: string) => {
    if (!confirm('Delete this tax return?')) return;
    const prevReturns = returns;
    setReturns(returns.filter((entry) => entry.id !== id));
    try {
      await api.delete(`/tax/returns/${id}`);
      await reload();
    } catch (error: any) {
      setReturns(prevReturns);
      setFormError(error?.response?.data?.error || 'Failed to delete tax return');
    }
  };

  const handleDeleteRate = async (id: string) => {
    if (!confirm('Delete this tax rate?')) return;
    const prevRates = rates;
    setRates(rates.filter((rate) => rate.id !== id));
    try {
      await api.delete(`/tax/rates/${id}`);
      await reload();
    } catch (error: any) {
      setRates(prevRates);
      setFormError(error?.response?.data?.error || 'Failed to delete tax rate');
    }
  };

  const startEditRate = (rate: any) => {
    setEditingRateId(rate.id);
    setEditingRate({
      name: rate.name || '',
      type: rate.type || 'GST',
      rate: rate.rate ? String(Number(rate.rate) * 100) : '',
      region: rate.region || '',
    });
  };

  const handleUpdateRate = async () => {
    if (!editingRateId) return;
    if (!editingRate.name.trim()) {
      setFormError('Tax rate name is required');
      return;
    }
    const rateValue = Number(editingRate.rate || 0);
    if (!Number.isFinite(rateValue) || rateValue < 0) {
      setFormError('Rate must be a valid number');
      return;
    }
    const prevRates = rates;
    setRates(
      rates.map((rate) =>
        rate.id === editingRateId
          ? { ...rate, name: editingRate.name, type: editingRate.type, rate: rateValue / 100, region: editingRate.region }
          : rate
      )
    );
    try {
      await api.patch(`/tax/rates/${editingRateId}`, {
        name: editingRate.name,
        type: editingRate.type,
        rate: rateValue / 100,
        region: editingRate.region || undefined,
      });
      setEditingRateId(null);
      await reload();
    } catch (error: any) {
      setRates(prevRates);
      setFormError(error?.response?.data?.error || 'Failed to update tax rate');
    }
  };

  const startEditReturn = (entry: any) => {
    setEditingReturnId(entry.id);
    setEditingReturn({
      periodStart: entry.periodStart ? new Date(entry.periodStart).toISOString().slice(0, 10) : '',
      periodEnd: entry.periodEnd ? new Date(entry.periodEnd).toISOString().slice(0, 10) : '',
      currency: entry.currency || 'AUD',
      totalSales: entry.totalSales ? String(entry.totalSales) : '',
      totalTax: entry.totalTax ? String(entry.totalTax) : '',
      reference: entry.reference || '',
    });
  };

  const handleUpdateReturn = async () => {
    if (!editingReturnId) return;
    if (!editingReturn.periodStart || !editingReturn.periodEnd) {
      setFormError('Return period start and end are required');
      return;
    }
    const prevReturns = returns;
    setReturns(
      returns.map((entry) =>
        entry.id === editingReturnId
          ? {
              ...entry,
              periodStart: editingReturn.periodStart,
              periodEnd: editingReturn.periodEnd,
              currency: editingReturn.currency,
              totalSales: Number(editingReturn.totalSales || 0),
              totalTax: Number(editingReturn.totalTax || 0),
            }
          : entry
      )
    );
    try {
      await api.patch(`/tax/returns/${editingReturnId}`, {
        periodStart: editingReturn.periodStart,
        periodEnd: editingReturn.periodEnd,
        currency: editingReturn.currency,
        totalSales: Number(editingReturn.totalSales || 0),
        totalTax: Number(editingReturn.totalTax || 0),
        reference: editingReturn.reference || undefined,
      });
      setEditingReturnId(null);
      await reload();
    } catch (error: any) {
      setReturns(prevReturns);
      setFormError(error?.response?.data?.error || 'Failed to update tax return');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax & Returns</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Maintain tax rates and prepare returns.
          </p>
        </div>
        <Link href="/dashboard/finance" className="text-sm text-primary-600 hover:underline">
          Back to Finance Hub
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active Rates</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {loading ? '—' : rates.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Returns</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {loading ? '—' : returns.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {loading ? 'Loading' : 'Ready'}
          </p>
        </div>
      </div>

      {formError && (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Tax Rate</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Organization ID (optional)</label>
              <input
                value={rateForm.organizationId}
                onChange={(e) => setRateForm({ ...rateForm, organizationId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Name</label>
              <input
                value={rateForm.name}
                onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="GST Standard"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Type</label>
              <select
                value={rateForm.type}
                onChange={(e) => setRateForm({ ...rateForm, type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                {['GST', 'VAT', 'SALES_TAX', 'WITHHOLDING'].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Rate (%)</label>
              <input
                value={rateForm.rate}
                onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="10"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Region</label>
              <input
                value={rateForm.region}
                onChange={(e) => setRateForm({ ...rateForm, region: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="ANZ"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Effective From</label>
              <input
                type="date"
                value={rateForm.effectiveFrom}
                onChange={(e) => setRateForm({ ...rateForm, effectiveFrom: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button className="btn-primary" onClick={handleCreateRate} disabled={saving}>
            {saving ? 'Saving...' : 'Create Tax Rate'}
          </button>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Tax Return</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Organization ID (optional)</label>
              <input
                value={returnForm.organizationId}
                onChange={(e) => setReturnForm({ ...returnForm, organizationId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Currency</label>
              <input
                value={returnForm.currency}
                onChange={(e) => setReturnForm({ ...returnForm, currency: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="AUD"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Period Start</label>
              <input
                type="date"
                value={returnForm.periodStart}
                onChange={(e) => setReturnForm({ ...returnForm, periodStart: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Period End</label>
              <input
                type="date"
                value={returnForm.periodEnd}
                onChange={(e) => setReturnForm({ ...returnForm, periodEnd: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Total Sales</label>
              <input
                value={returnForm.totalSales}
                onChange={(e) => setReturnForm({ ...returnForm, totalSales: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Total Tax</label>
              <input
                value={returnForm.totalTax}
                onChange={(e) => setReturnForm({ ...returnForm, totalTax: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Reference</label>
              <input
                value={returnForm.reference}
                onChange={(e) => setReturnForm({ ...returnForm, reference: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button className="btn-primary" onClick={handleCreateReturn} disabled={saving}>
            {saving ? 'Saving...' : 'Create Tax Return'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tax Returns</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading returns...</p>
        ) : returns.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No returns filed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Period</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Total Tax</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {returns.slice(0, 6).map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">
                      {editingReturnId === entry.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="date"
                            value={editingReturn.periodStart}
                            onChange={(e) => setEditingReturn({ ...editingReturn, periodStart: e.target.value })}
                            className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                          />
                          <input
                            type="date"
                            value={editingReturn.periodEnd}
                            onChange={(e) => setEditingReturn({ ...editingReturn, periodEnd: e.target.value })}
                            className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                          />
                        </div>
                      ) : (
                        `${formatDate(entry.periodStart)} - ${formatDate(entry.periodEnd)}`
                      )}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {editingReturnId === entry.id ? (
                        <input
                          value={editingReturn.totalTax}
                          onChange={(e) => setEditingReturn({ ...editingReturn, totalTax: e.target.value })}
                          className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      ) : (
                        formatCurrency(entry.totalTax || 0, entry.currency || 'AUD')
                      )}
                    </td>
                    <td className="py-2 text-xs text-gray-500 dark:text-gray-400">
                      {entry.status}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingReturnId === entry.id ? (
                          <>
                            <button
                              onClick={handleUpdateReturn}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingReturnId(null)}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          entry.status === 'DRAFT' && (
                            <button
                              onClick={() => startEditReturn(entry)}
                              className="text-xs text-gray-600 hover:underline"
                            >
                              Edit
                            </button>
                          )
                        )}
                        {entry.status === 'DRAFT' && (
                          <button
                            onClick={() => handleSubmitReturn(entry.id)}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            Submit
                          </button>
                        )}
                        {entry.status === 'DRAFT' && (
                          <button
                            onClick={() => handleDeleteReturn(entry.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tax Rates</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading rates...</p>
        ) : rates.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No tax rates configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Name</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Rate</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.slice(0, 6).map((rate) => (
                  <tr key={rate.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">
                      {editingRateId === rate.id ? (
                        <input
                          value={editingRate.name}
                          onChange={(e) => setEditingRate({ ...editingRate, name: e.target.value })}
                          className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      ) : (
                        rate.name
                      )}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {editingRateId === rate.id ? (
                        <select
                          value={editingRate.type}
                          onChange={(e) => setEditingRate({ ...editingRate, type: e.target.value })}
                          className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        >
                          {['GST', 'VAT', 'SALES_TAX', 'WITHHOLDING'].map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      ) : (
                        rate.type
                      )}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {editingRateId === rate.id ? (
                        <input
                          value={editingRate.rate}
                          onChange={(e) => setEditingRate({ ...editingRate, rate: e.target.value })}
                          className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      ) : (
                        `${Number(rate.rate) * 100}%`
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingRateId === rate.id ? (
                          <>
                            <button
                              onClick={handleUpdateRate}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRateId(null)}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEditRate(rate)}
                            className="text-xs text-gray-600 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRate(rate.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
