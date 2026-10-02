'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gift,
  Plus,
  Receipt,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { adminInvoiceApi } from '@/lib/admin-invoice-api';

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

interface Subscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface SubscriptionsResponse {
  subscriptions: Subscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantTier, setGrantTier] = useState('PRO');
  const [grantDuration, setGrantDuration] = useState('30');

  const { data, isLoading } = useQuery<SubscriptionsResponse>({
    queryKey: ['admin-subscriptions', page, tierFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (tierFilter) params.append('tier', tierFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await api.get(`/admin/subscriptions?${params.toString()}`);
      return response.data;
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ subId, updates }: { subId: string; updates: any }) => {
      await api.patch(`/admin/subscriptions/${subId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
  });

  // Ending a membership, and giving a payment back, are done at Stripe, with a
  // reason that goes in the audit log. Editing ATHENA's own row ended nothing
  // for a membership Stripe is billing: she went on being charged and the next
  // update from Stripe wrote her plan back.
  type MembershipAction = { kind: 'cancel' | 'refund' | 'end'; sub: Subscription };
  const [action, setAction] = useState<MembershipAction | null>(null);
  const [cancelMode, setCancelMode] = useState<'period_end' | 'now'>('period_end');
  const [reason, setReason] = useState('');

  const closeAction = () => {
    setAction(null);
    setCancelMode('period_end');
    setReason('');
  };

  const membershipActionMutation = useMutation({
    mutationFn: async ({ kind, sub }: MembershipAction) => {
      if (kind === 'cancel') {
        return api.post(`/admin/subscriptions/${sub.id}/cancel`, { mode: cancelMode, reason: reason.trim() || undefined });
      }
      if (kind === 'refund') {
        return api.post(`/admin/subscriptions/${sub.id}/refund`, { reason: reason.trim() });
      }
      // A membership staff granted has no Stripe subscription: ending it is an edit.
      return api.patch(`/admin/subscriptions/${sub.id}`, { status: 'CANCELED' });
    },
    onSuccess: (response, { kind, sub }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      const data = response?.data?.data;
      if (kind === 'refund') {
        toast.success(
          data?.status === 'already_refunded'
            ? `That payment was already refunded; ${sub.user.email}'s records are now in line.`
            : `Refunded ${data?.currency ?? ''} ${data?.amount ?? ''} to ${sub.user.email}.`
        );
      } else if (kind === 'cancel') {
        toast.success(
          cancelMode === 'now'
            ? `${sub.user.email}'s membership has ended.`
            : `${sub.user.email}'s membership will end at the end of the period they have paid for.`
        );
      } else {
        toast.success(`${sub.user.email}'s membership has ended.`);
      }
      closeAction();
    },
    onError: (error) => toast.error(errorMessage(error) || 'That did not go through. Nothing was changed.'),
  });

  const grantSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, tier, durationDays }: { userId: string; tier: string; durationDays: number }) => {
      await api.post('/admin/subscriptions/grant', { userId, tier, durationDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setShowGrantModal(false);
      setGrantEmail('');
    },
  });

  // Tax invoices are filed by the Stripe webhook as memberships are paid.
  // These re-issue one when that did not happen: the routes are idempotent,
  // so pressing twice returns the same invoice number.
  const [paymentIdToInvoice, setPaymentIdToInvoice] = useState('');
  const [issuingFor, setIssuingFor] = useState<string | null>(null);

  const reportIssued = (label: string, issued: { invoiceNumber: string; alreadyIssued: boolean }) => {
    if (issued.alreadyIssued) {
      toast.success(`${label} already has invoice ${issued.invoiceNumber}.`);
    } else {
      toast.success(`Invoice ${issued.invoiceNumber} issued for ${label}.`);
    }
  };

  const issueSubscriptionInvoice = async (sub: Subscription) => {
    setIssuingFor(sub.id);
    try {
      const res = await adminInvoiceApi.issueForSubscription(sub.id);
      reportIssued(sub.user.email, res.data.data);
    } catch (error) {
      toast.error(errorMessage(error) || 'The invoice could not be issued.');
    } finally {
      setIssuingFor(null);
    }
  };

  const issuePaymentInvoice = async () => {
    const paymentId = paymentIdToInvoice.trim();
    if (!paymentId) return;
    setIssuingFor(`payment:${paymentId}`);
    try {
      const res = await adminInvoiceApi.issueForPayment(paymentId);
      reportIssued(`payment ${paymentId}`, res.data.data);
      setPaymentIdToInvoice('');
    } catch (error) {
      toast.error(errorMessage(error) || 'The invoice could not be issued.');
    } finally {
      setIssuingFor(null);
    }
  };

  const tiers = ['FREE', 'PRO', 'BUSINESS'];
  const statuses = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED'];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'BUSINESS':
        return 'bg-purple-100 text-purple-800';
      case 'PRO':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'TRIALING':
        return 'bg-green-100 text-green-800';
      case 'PAST_DUE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELED':
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-slate-500 hover:text-slate-700">
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subscription Management</h1>
                <p className="text-slate-600 dark:text-slate-400">
                  {data?.pagination.total.toLocaleString()} subscriptions
                </p>
              </div>
            </div>
            <Button onClick={() => setShowGrantModal(true)}>
              <Gift className="h-4 w-4 mr-2" />
              Grant Subscription
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700"
            >
              <option value="">All Tiers</option>
              {tiers.map((tier) => (
                <option key={tier} value={tier}>{tier}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700"
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data?.subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {sub.user.firstName} {sub.user.lastName}
                        </p>
                        <p className="text-sm text-slate-500">{sub.user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={sub.tier}
                        onChange={(e) => updateSubscriptionMutation.mutate({ 
                          subId: sub.id, 
                          updates: { tier: e.target.value } 
                        })}
                        className={`text-sm px-2 py-1 rounded border-0 ${getTierColor(sub.tier)}`}
                      >
                        {tiers.map((tier) => (
                          <option key={tier} value={tier}>{tier}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {/* Read-only. A status changed here changed ATHENA's row and
                          not Stripe's, so it never stopped any billing; ending a
                          membership is the button on the right. */}
                      <span className={`text-sm px-2 py-1 rounded ${getStatusColor(sub.status)}`}>{sub.status}</span>
                      {sub.cancelAtPeriodEnd && sub.currentPeriodEnd && (
                        <p className="mt-1 text-xs text-slate-500">
                          Ends {new Date(sub.currentPeriodEnd).toLocaleDateString('en-AU')}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      <div>{sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString('en-AU') : '-'} -</div>
                      <div>{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-AU') : '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={issuingFor === sub.id}
                          title={sub.stripeSubscriptionId ? 'Issue the invoice for the latest paid period' : 'Granted by staff; nothing was paid, so there is no invoice to issue'}
                          onClick={() => issueSubscriptionInvoice(sub)}
                        >
                          <Receipt className="h-4 w-4 mr-1" />
                          {issuingFor === sub.id ? 'Issuing…' : 'Issue invoice'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newEnd = new Date(sub.currentPeriodEnd ?? Date.now());
                            newEnd.setDate(newEnd.getDate() + 30);
                            updateSubscriptionMutation.mutate({
                              subId: sub.id,
                              updates: { periodEnd: newEnd.toISOString() }
                            });
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          +30 days
                        </Button>
                        {sub.stripeSubscriptionId ? (
                          <>
                            {sub.status !== 'CANCELED' && (
                              <Button variant="outline" size="sm" onClick={() => setAction({ kind: 'cancel', sub })}>
                                Cancel at Stripe
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => setAction({ kind: 'refund', sub })}>
                              Refund latest payment
                            </Button>
                          </>
                        ) : (
                          sub.status !== 'CANCELED' && (
                            <Button variant="outline" size="sm" onClick={() => setAction({ kind: 'end', sub })}>
                              End membership
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Re-issue for a one-off payment. Membership invoices come from the
              Stripe webhook; a Payment row (a session, a fee) is invoiced here
              by its id when the webhook missed it. */}
          <form
            className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              issuePaymentInvoice();
            }}
          >
            <div className="flex-1 min-w-[16rem]">
              <label htmlFor="invoice-payment-id" className="block text-xs font-medium text-slate-500 mb-1">
                Issue an invoice for a payment
              </label>
              <Input
                id="invoice-payment-id"
                value={paymentIdToInvoice}
                onChange={(e) => setPaymentIdToInvoice(e.target.value)}
                placeholder="Payment id"
                aria-describedby="invoice-payment-help"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={!paymentIdToInvoice.trim() || issuingFor?.startsWith('payment:') === true}>
              <Receipt className="h-4 w-4 mr-1" />
              {issuingFor?.startsWith('payment:') ? 'Issuing…' : 'Issue invoice'}
            </Button>
            <p id="invoice-payment-help" className="w-full text-xs text-slate-500">
              Memberships paid through Stripe are invoiced by the webhook as each period is paid; a second press returns the invoice already filed.
            </p>
          </form>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="bg-white dark:bg-slate-800 px-4 py-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">
                Page {page} of {data.pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === data.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {action && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-action-title"
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md"
          >
            <h2 id="membership-action-title" className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              {action.kind === 'cancel' ? 'Cancel at Stripe' : action.kind === 'refund' ? 'Refund the latest payment' : 'End membership'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">{action.sub.user.email}</p>

            {action.kind === 'cancel' && (
              <fieldset className="mb-4 space-y-2">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">When it ends</legend>
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="radio" name="cancel-mode" checked={cancelMode === 'period_end'} onChange={() => setCancelMode('period_end')} className="mt-1" />
                  <span>At the end of the period the member has paid for. They keep it until then and are not charged again.</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="radio" name="cancel-mode" checked={cancelMode === 'now'} onChange={() => setCancelMode('now')} className="mt-1" />
                  <span>Now. She loses it straight away, with no credit for the unused time. A refund is separate.</span>
                </label>
              </fieldset>
            )}

            {action.kind === 'refund' && (
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                This gives back the whole of the most recent payment, through Stripe, and cancels the ATHENA invoice for it. It does not end the membership; cancel it separately if the member is leaving.
              </p>
            )}

            {action.kind === 'end' && (
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                Staff granted this membership, so there is no Stripe billing to stop. It ends here.
              </p>
            )}

            {action.kind !== 'end' && (
              <div className="mb-4">
                <label htmlFor="membership-action-reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason {action.kind === 'cancel' && cancelMode === 'period_end' ? '(optional)' : '(kept in the audit log)'}
                </label>
                <textarea
                  id="membership-action-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-700 text-sm"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeAction} disabled={membershipActionMutation.isPending}>
                Keep it as it is
              </Button>
              <Button
                disabled={
                  membershipActionMutation.isPending ||
                  (action.kind === 'refund' && reason.trim().length < 3) ||
                  (action.kind === 'cancel' && cancelMode === 'now' && !reason.trim())
                }
                onClick={() => membershipActionMutation.mutate(action)}
              >
                {membershipActionMutation.isPending
                  ? 'Working…'
                  : action.kind === 'refund'
                    ? 'Refund the payment'
                    : action.kind === 'cancel'
                      ? cancelMode === 'now'
                        ? 'End it now'
                        : 'Cancel at period end'
                      : 'End membership'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Subscription Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Grant Subscription
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  User Email
                </label>
                <Input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tier
                </label>
                <select
                  value={grantTier}
                  onChange={(e) => setGrantTier(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-700"
                >
                  <option value="PRO">PRO</option>
                  <option value="BUSINESS">BUSINESS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Duration (days)
                </label>
                <Input
                  type="number"
                  value={grantDuration}
                  onChange={(e) => setGrantDuration(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowGrantModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // Would need to look up userId by email first
                  // For now, simplified - in production you'd call an API to find user
                  alert('Feature requires user lookup API. Use user ID directly for now.');
                }}
              >
                Grant
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
