/**
 * Superseded by the lead register filtered by source.
 *
 * This page used to say "publish updates to the press kit"; there is no press
 * kit tool. Media enquiries arrive through the public /press form as leads
 * with source PRESS and are worked at /admin/marketing/leads?source=PRESS.
 * Old bookmarks land there.
 */
import { redirect } from 'next/navigation';

export default function AdminMarketingPressPage() {
  redirect('/admin/marketing/leads?source=PRESS');
}
