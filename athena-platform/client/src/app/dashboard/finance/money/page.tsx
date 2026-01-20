'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function MoneyPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    organizationId: '',
    amount: '',
    currency: 'AUD',
    type: 'PAYMENT',
    status: 'PENDING',
    provider: '',
    reference: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState({
    status: 'PENDING',
    provider: '',
    reference: '',
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await api.get('/money/transactions');
        if (!isMounted) return;
        setTransactions(response.data?.data || []);
      } catch {
        if (!isMounted) return;
        setTransactions([]);
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
    const response = await api.get('/money/transactions');
    setTransactions(response.data?.data || []);
  };

  const handleCreate = async () => {
    const amountValue = Number(form.amount || 0);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    setFormError(null);
    const prevTransactions = transactions;
    setTransactions([
      {
        id: `tmp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        type: form.type,
        amount: amountValue,
        currency: form.currency,
        status: form.status,
      },
      ...transactions,
    ]);
    try {
      await api.post('/money/transactions', {
        organizationId: form.organizationId || undefined,
        amount: amountValue,
        currency: form.currency,
        type: form.type,
        status: form.status,
        provider: form.provider || undefined,
        reference: form.reference || undefined,
      });
      setForm({
        organizationId: '',
        amount: '',
        currency: 'AUD',
        type: 'PAYMENT',
        status: 'PENDING',
        provider: '',
        reference: '',
      });
      await reload();
    } catch (error: any) {
      setTransactions(prevTransactions);
      setFormError(error?.response?.data?.error || 'Failed to create transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const prevTransactions = transactions;
    setTransactions(
      transactions.map((tx) => (tx.id === id ? { ...tx, status } : tx))
    );
    try {
      await api.patch(`/money/transactions/${id}`, { status });
      await reload();
    } catch (error: any) {
      setTransactions(prevTransactions);
      setFormError(error?.response?.data?.error || 'Failed to update transaction');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    const prevTransactions = transactions;
    setTransactions(transactions.filter((tx) => tx.id !== id));
    try {
      await api.delete(`/money/transactions/${id}`);
      await reload();
    } catch (error: any) {
      setTransactions(prevTransactions);
      setFormError(error?.response?.data?.error || 'Failed to delete transaction');
    }
  };

  const startEdit = (tx: any) => {
    setEditingId(tx.id);
    setEditing({
      status: tx.status || 'PENDING',
      provider: tx.provider || '',
      reference: tx.reference || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const prevTransactions = transactions;
    setTransactions(
      transactions.map((tx) =>
        tx.id === editingId
          ? { ...tx, status: editing.status, provider: editing.provider, reference: editing.reference }
          : tx
      )
    );
    try {
      await api.patch(`/money/transactions/${editingId}`, {
        status: editing.status,
        provider: editing.provider || undefined,
        reference: editing.reference || undefined,
      });
      setEditingId(null);
      await reload();
    } catch (error: any) {
      setTransactions(prevTransactions);
      setFormError(error?.response?.data?.error || 'Failed to update transaction');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Money Ledger</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Review payments, payouts, and adjustments.
          </p>
        </div>
        <Link href="/dashboard/finance" className="text-sm text-primary-600 hover:underline">
          Back to Finance Hub
        </Link>
      </div>

      <div className="card">
        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Organization ID (optional)</label>
            <input
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Amount</label>
            <input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Currency</label>
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              {['PAYMENT', 'REFUND', 'PAYOUT', 'TRANSFER', 'ADJUSTMENT'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              {['PENDING', 'COMPLETED', 'FAILED', 'CANCELED'].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Provider</label>
            <input
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Reference</label>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button className="btn-primary" onClick={handleCreate} disabled={saving}>
          {saving ? 'Saving...' : 'Create Transaction'}
        </button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No transactions logged.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Amount</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 8).map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {tx.type}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {formatCurrency(tx.amount || 0, tx.currency || 'AUD')}
                    </td>
                    <td className="py-2 text-xs text-gray-500 dark:text-gray-400">
                      {editingId === tx.id ? (
                        <select
                          value={editing.status}
                          onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                          className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
                        >
                          {['PENDING', 'COMPLETED', 'FAILED', 'CANCELED'].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        tx.status
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === tx.id ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {tx.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleUpdateStatus(tx.id, 'COMPLETED')}
                                className="text-xs text-primary-600 hover:underline"
                              >
                                Mark Completed
                              </button>
                            )}
                            <button
                              onClick={() => startEdit(tx)}
                              className="text-xs text-gray-600 hover:underline"
                            >
                              Edit
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(tx.id)}
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
