/**
 * Superseded by the lead register filtered by source.
 *
 * This page used to promise partner outreach tracking that was never built.
 * Partnership enquiries are leads with source PARTNER, kept with a status,
 * an owner and notes at /admin/marketing/leads?source=PARTNER, which the
 * marketing hub already links to. Old bookmarks land there.
 */
import { redirect } from 'next/navigation';

export default function AdminMarketingPartnershipsPage() {
  redirect('/admin/marketing/leads?source=PARTNER');
}
