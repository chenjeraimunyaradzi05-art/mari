/**
 * Superseded by the lead register filtered by source.
 *
 * This page used to say "Sync waitlist data to see signup velocity and invite
 * cohorts", as if a sync existed. It never did. The waitlist is the leads the
 * public /waitlist form posts to POST /api/marketing/leads with source
 * WAITLIST, and the register at /admin/marketing/leads?source=WAITLIST shows
 * them with a status, an owner and notes; signup velocity is on
 * /admin/marketing/funnel. Old bookmarks land on the real data.
 */
import { redirect } from 'next/navigation';

export default function AdminMarketingWaitlistPage() {
  redirect('/admin/marketing/leads?source=WAITLIST');
}
