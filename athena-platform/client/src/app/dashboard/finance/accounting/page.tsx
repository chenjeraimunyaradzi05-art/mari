'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function AccountingPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({
    organizationId: '',
    name: '',
    code: '',
    type: 'ASSET',
    currency: 'AUD',
  });
  const [journalForm, setJournalForm] = useState({
    organizationId: '',
    description: '',
    reference: '',
    entryDate: '',
    status: 'DRAFT',
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
  });
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState({
    name: '',
    code: '',
    type: 'ASSET',
    currency: 'AUD',
  });
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [editingJournal, setEditingJournal] = useState({
    description: '',
    reference: '',
    entryDate: '',
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [accountsRes, journalsRes] = await Promise.all([
          api.get('/accounting/accounts'),
          api.get('/accounting/journals'),
        ]);

        if (!isMounted) return;
        setAccounts(accountsRes.data?.data || []);
        setJournals(journalsRes.data?.data || []);
      } catch {
        if (!isMounted) return;
        setAccounts([]);
        setJournals([]);
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
    const [accountsRes, journalsRes] = await Promise.all([
      api.get('/accounting/accounts'),
      api.get('/accounting/journals'),
    ]);
    setAccounts(accountsRes.data?.data || []);
    setJournals(journalsRes.data?.data || []);
  };

  const handleCreateAccount = async () => {
    if (!accountForm.name.trim()) {
      setFormError('Account name is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    const optimisticId = `tmp-${Date.now()}`;
    const prevAccounts = accounts;
    setAccounts([
      {
        id: optimisticId,
        name: accountForm.name,
        code: accountForm.code,
        type: accountForm.type,
        currency: accountForm.currency || 'AUD',
      },
      ...accounts,
    ]);
    try {
      await api.post('/accounting/accounts', {
        organizationId: accountForm.organizationId || undefined,
        name: accountForm.name,
        code: accountForm.code || undefined,
        type: accountForm.type,
        currency: accountForm.currency || undefined,
      });
      setAccountForm({
        organizationId: '',
        name: '',
        code: '',
        type: 'ASSET',
        currency: 'AUD',
      });
      await reload();
    } catch (error: any) {
      setAccounts(prevAccounts);
      setFormError(error?.response?.data?.error || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateJournal = async () => {
    if (!journalForm.description.trim()) {
      setFormError('Journal description is required');
      return;
    }
    if (!journalForm.debitAccountId || !journalForm.creditAccountId) {
      setFormError('Debit and credit accounts are required');
      return;
    }
    const amountValue = Number(journalForm.amount || 0);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    setFormError(null);
    const prevJournals = journals;
    setJournals([
      {
        id: `tmp-${Date.now()}`,
        description: journalForm.description,
        entryDate: journalForm.entryDate || new Date().toISOString(),
        status: journalForm.status,
      },
      ...journals,
    ]);
    try {
      await api.post('/accounting/journals', {
        organizationId: journalForm.organizationId || undefined,
        description: journalForm.description,
        reference: journalForm.reference || undefined,
        entryDate: journalForm.entryDate || undefined,
        status: journalForm.status,
        lines: [
          {
            accountId: journalForm.debitAccountId,
            debit: amountValue,
            credit: 0,
          },
          {
            accountId: journalForm.creditAccountId,
            debit: 0,
            credit: amountValue,
          },
        ],
      });
      setJournalForm({
        organizationId: '',
        description: '',
        reference: '',
        entryDate: '',
        status: 'DRAFT',
        debitAccountId: '',
        creditAccountId: '',
        amount: '',
      });
      await reload();
    } catch (error: any) {
      setJournals(prevJournals);
      setFormError(error?.response?.data?.error || 'Failed to create journal entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Delete this account?')) return;
    const prevAccounts = accounts;
    setAccounts(accounts.filter((account) => account.id !== id));
    try {
      await api.delete(`/accounting/accounts/${id}`);
      await reload();
    } catch (error: any) {
      setAccounts(prevAccounts);
      setFormError(error?.response?.data?.error || 'Failed to delete account');
    }
  };

  const startEditAccount = (account: any) => {
    setEditingAccountId(account.id);
    setEditingAccount({
      name: account.name || '',
      code: account.code || '',
      type: account.type || 'ASSET',
      currency: account.currency || 'AUD',
    });
  };

  const handleUpdateAccount = async () => {
    if (!editingAccountId) return;
    if (!editingAccount.name.trim()) {
      setFormError('Account name is required');
      return;
    }
    const prevAccounts = accounts;
    setAccounts(
      accounts.map((account) =>
        account.id === editingAccountId
          ? { ...account, ...editingAccount }
          : account
      )
    );
    try {
      await api.patch(`/accounting/accounts/${editingAccountId}`, {
        name: editingAccount.name,
        code: editingAccount.code || undefined,
        type: editingAccount.type,
        currency: editingAccount.currency,
      });
      setEditingAccountId(null);
      await reload();
    } catch (error: any) {
      setAccounts(prevAccounts);
      setFormError(error?.response?.data?.error || 'Failed to update account');
    }
  };

  const handlePostJournal = async (id: string) => {
    const prevJournals = journals;
    setJournals(
      journals.map((entry) =>
        entry.id === id ? { ...entry, status: 'POSTED' } : entry
      )
    );
    try {
      await api.post(`/accounting/journals/${id}/post`);
      await reload();
    } catch (error: any) {
      setJournals(prevJournals);
      setFormError(error?.response?.data?.error || 'Failed to post journal entry');
    }
  };

  const handleVoidJournal = async (id: string) => {
    if (!confirm('Void this journal entry?')) return;
    const prevJournals = journals;
    setJournals(
      journals.map((entry) =>
        entry.id === id ? { ...entry, status: 'VOID' } : entry
      )
    );
    try {
      await api.post(`/accounting/journals/${id}/void`);
      await reload();
    } catch (error: any) {
      setJournals(prevJournals);
      setFormError(error?.response?.data?.error || 'Failed to void journal entry');
    }
  };

  const startEditJournal = (entry: any) => {
    setEditingJournalId(entry.id);
    setEditingJournal({
      description: entry.description || '',
      reference: entry.reference || '',
      entryDate: entry.entryDate ? new Date(entry.entryDate).toISOString().slice(0, 10) : '',
    });
  };

  const handleUpdateJournal = async () => {
    if (!editingJournalId) return;
    if (!editingJournal.description.trim()) {
      setFormError('Journal description is required');
      return;
    }
    const prevJournals = journals;
    setJournals(
      journals.map((entry) =>
        entry.id === editingJournalId
          ? { ...entry, description: editingJournal.description }
          : entry
      )
    );
    try {
      await api.patch(`/accounting/journals/${editingJournalId}`, {
        description: editingJournal.description,
        reference: editingJournal.reference || undefined,
        entryDate: editingJournal.entryDate || undefined,
      });
      setEditingJournalId(null);
      await reload();
    } catch (error: any) {
      setJournals(prevJournals);
      setFormError(error?.response?.data?.error || 'Failed to update journal entry');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accounting</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your chart of accounts and journal entries.
          </p>
        </div>
        <Link href="/dashboard/finance" className="text-sm text-primary-600 hover:underline">
          Back to Finance Hub
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Accounts</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {loading ? '—' : accounts.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Journal Entries</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {loading ? '—' : journals.length}
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Organization ID (optional)</label>
              <input
                value={accountForm.organizationId}
                onChange={(e) => setAccountForm({ ...accountForm, organizationId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="org_123"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Account Name</label>
              <input
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="Cash on Hand"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Account Code</label>
              <input
                value={accountForm.code}
                onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="1000"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Type</label>
              <select
                value={accountForm.type}
                onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Currency</label>
              <input
                value={accountForm.currency}
                onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="AUD"
              />
            </div>
          </div>
          <button className="btn-primary" onClick={handleCreateAccount} disabled={saving}>
            {saving ? 'Saving...' : 'Create Account'}
          </button>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Journal Entry</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Organization ID (optional)</label>
              <input
                value={journalForm.organizationId}
                onChange={(e) => setJournalForm({ ...journalForm, organizationId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="org_123"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Description</label>
              <input
                value={journalForm.description}
                onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="Monthly subscription revenue"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Reference</label>
              <input
                value={journalForm.reference}
                onChange={(e) => setJournalForm({ ...journalForm, reference: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="INV-1001"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Entry Date</label>
              <input
                type="date"
                value={journalForm.entryDate}
                onChange={(e) => setJournalForm({ ...journalForm, entryDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Debit Account</label>
              <select
                value={journalForm.debitAccountId}
                onChange={(e) => setJournalForm({ ...journalForm, debitAccountId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Credit Account</label>
              <select
                value={journalForm.creditAccountId}
                onChange={(e) => setJournalForm({ ...journalForm, creditAccountId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Amount</label>
              <input
                value={journalForm.amount}
                onChange={(e) => setJournalForm({ ...journalForm, amount: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Status</label>
              <select
                value={journalForm.status}
                onChange={(e) => setJournalForm({ ...journalForm, status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="POSTED">POSTED</option>
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={handleCreateJournal} disabled={saving}>
            {saving ? 'Saving...' : 'Create Journal Entry'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Journal Entries
          </h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading entries...</p>
        ) : journals.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No journal entries yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {journals.slice(0, 6).map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">
                      {formatDate(entry.entryDate || entry.createdAt)}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {editingJournalId === entry.id ? (
                        <input
                          value={editingJournal.description}
                          onChange={(e) => setEditingJournal({ ...editingJournal, description: e.target.value })}
                          className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      ) : (
                        entry.description
                      )}
                    </td>
                    <td className="py-2 text-xs text-gray-500 dark:text-gray-400">
                      {entry.status}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingJournalId === entry.id ? (
                          <>
                            <button
                              onClick={handleUpdateJournal}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingJournalId(null)}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          entry.status === 'DRAFT' && (
                            <button
                              onClick={() => startEditJournal(entry)}
                              className="text-xs text-gray-600 hover:underline"
                            >
                              Edit
                            </button>
                          )
                        )}
                        {entry.status === 'DRAFT' && (
                          <button
                            onClick={() => handlePostJournal(entry.id)}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            Post
                          </button>
                        )}
                        {entry.status === 'POSTED' && (
                          <button
                            onClick={() => handleVoidJournal(entry.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Void
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Accounts
          </h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Name</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Currency</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.slice(0, 8).map((account) => (
                  <tr key={account.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">
                      {editingAccountId === account.id ? (
                        <input
                          value={editingAccount.name}
                          onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                          className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      ) : (
                        account.name
                      )}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {editingAccountId === account.id ? (
                        <select
                          value={editingAccount.type}
                          onChange={(e) => setEditingAccount({ ...editingAccount, type: e.target.value })}
                          className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        >
                          {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      ) : (
                        account.type
                      )}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {editingAccountId === account.id ? (
                        <input
                          value={editingAccount.currency}
                          onChange={(e) => setEditingAccount({ ...editingAccount, currency: e.target.value.toUpperCase() })}
                          className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                        />
                      ) : (
                        account.currency
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingAccountId === account.id ? (
                          <>
                            <button
                              onClick={handleUpdateAccount}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingAccountId(null)}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEditAccount(account)}
                            className="text-xs text-gray-600 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAccount(account.id)}
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

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Trial Balance Snapshot
          </h2>
          <button className="btn-outline text-sm" disabled>
            Refresh (coming soon)
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Trial balance will appear once journal entries are posted.
        </p>
      </div>
    </div>
  );
}
