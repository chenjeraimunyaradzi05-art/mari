/**
 * Staff's view of money that has come back to a cardholder: card disputes
 * (chargebacks) as Stripe reports them, and what ATHENA did about each. ADMIN-only
 * on the server.
 */

import { api } from './api';

export type DisputeOutcome = 'OPEN' | 'WON' | 'LOST' | 'CLOSED';

export type AdminDispute = {
  id: string;
  stripeDisputeId: string;
  /** In the currency's minor units, as Stripe reports it. */
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  outcome: DisputeOutcome;
  evidenceDueBy: string | null;
  openedAt: string;
  closedAt: string | null;
  /** The money is out of ATHENA's Stripe balance while it is decided. */
  fundsWithdrawn: boolean;
  kind: string | null;
  kindLabel: string;
  member: { id: string; name: string } | null;
  /** What was done about it, in words; empty until it is lost. */
  applied: string[];
  /** How many creators' withdrawals it is still holding. */
  creatorsHeld: number;
  paymentIntentId: string | null;
};

export type DisputePage = { disputes: AdminDispute[]; nextCursor: string | null };

/** An hour booked on a listing that the buyer says was not given. Money is whole dollars. */
export type DisputedBooking = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  totalAmount: number;
  platformFee: number;
  providerPayout: number;
  clientNotes: string | null;
  disputedAt: string | null;
  /** What the buyer said; null when no reason was given. */
  disputeReason: string | null;
  service: { id: string; title: string; provider: { id: string; displayName: string | null } | null };
  client: { id: string; displayName: string | null };
  /** Whether there is still money to move, and until when. Null when nothing was ever held. */
  hold: { status: string; lapsesAt: string | null } | null;
};

export const adminPaymentsApi = {
  disputes: (params?: { outcome?: DisputeOutcome; cursor?: string; limit?: number }) =>
    api.get<{ success: boolean; data: DisputePage }>('/payments/admin/disputes', { params }),

  /** Bookings the buyer says were not given, oldest first. */
  disputedBookings: (params?: { page?: number; limit?: number }) =>
    api.get<{ success: boolean; data: DisputedBooking[] }>('/skills-marketplace/admin/bookings/disputed', { params }),

  /** Releases the money to the provider, or gives it back to the buyer's card. */
  settleBooking: (bookingId: string, outcome: 'release' | 'return', note?: string) =>
    api.post(`/skills-marketplace/admin/bookings/${bookingId}/settle`, { outcome, ...(note ? { note } : {}) }),

  /** Ends the pause on withdrawals a decided dispute put on creators. */
  releaseDisputeHolds: (disputeId: string) =>
    api.post<{ success: boolean; data: { released: number } }>(`/payments/admin/disputes/${disputeId}/release-holds`),
};
