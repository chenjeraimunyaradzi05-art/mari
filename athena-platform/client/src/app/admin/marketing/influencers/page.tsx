/**
 * Superseded by the lead register filtered by source.
 *
 * This page used to promise engagement, reach and ROI tracking for creator
 * partnerships; nothing measured any of that. Influencer contacts are leads
 * with source INFLUENCER at /admin/marketing/leads?source=INFLUENCER, and a
 * paid collaboration is a campaign on the hub with channel INFLUENCER. Old
 * bookmarks land on the register.
 */
import { redirect } from 'next/navigation';

export default function AdminMarketingInfluencersPage() {
  redirect('/admin/marketing/leads?source=INFLUENCER');
}
