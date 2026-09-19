/**
 * Staff re-issue of tax invoices. Invoices are normally filed by the Stripe
 * webhook (invoice.paid for a membership period, payment_intent.succeeded for
 * a Payment row); these are for when that did not happen or a member asks
 * for hers again. Both routes are idempotent: an invoice that already exists
 * comes back with alreadyIssued true, never as a second number.
 */

import { api } from './api';

export type IssuedInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  alreadyIssued: boolean;
};

export const adminInvoiceApi = {
  /** The invoice for a Payment row (mentor session, formation fee, ...). */
  issueForPayment: (paymentId: string) =>
    api.post<{ success: boolean; data: IssuedInvoice }>(`/invoices/payment/${paymentId}`),

  /** The invoice for a membership's latest paid period, from Stripe's figures. */
  issueForSubscription: (subscriptionId: string) =>
    api.post<{ success: boolean; data: IssuedInvoice }>(`/invoices/subscription/${subscriptionId}`),
};
