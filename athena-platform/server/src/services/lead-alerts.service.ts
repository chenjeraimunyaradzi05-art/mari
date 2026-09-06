/**
 * When an enquiry arrives, the people who answer enquiries hear about it.
 *
 * Every admin gets an in-app notification that opens the lead register on
 * the right source. If LEAD_ALERT_EMAIL is set, the same goes out as an
 * email, so a sales or press enquiry is not sitting unseen in a table.
 * Waitlist signups are not alerted; they are counted, not answered.
 */

import { prisma } from '../utils/prisma';
import { sendEmail } from '../utils/email';
import { logger } from '../utils/logger';

export interface LeadForAlert {
  id: string;
  email: string;
  source: string;
  name?: string | null;
  organisation?: string | null;
  role?: string | null;
  interest?: string | null;
  message?: string | null;
}

const LABELS: Record<string, string> = {
  CONTACT_SALES: 'Sales enquiry',
  PARTNER: 'Partnership enquiry',
  PRESS: 'Press enquiry',
  INFLUENCER: 'Creator enquiry',
};

/** Sources that someone has to answer, as opposed to count. */
export const ALERTED_SOURCES = new Set(Object.keys(LABELS));

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export async function alertStaffOfLead(lead: LeadForAlert): Promise<{ notified: number; emailed: boolean }> {
  const label = LABELS[lead.source] ?? 'New lead';
  const who = [lead.name, lead.organisation].filter(Boolean).join(', ') || lead.email;
  const summary = (lead.message || lead.interest || lead.email).slice(0, 200);
  const link = `/admin/marketing/leads?source=${encodeURIComponent(lead.source)}`;

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      prisma.notification.create({
        data: { userId: admin.id, type: 'SYSTEM', title: `${label} from ${who}`, message: summary, link, data: { leadId: lead.id, source: lead.source } },
      })
    )
  );

  const to = process.env.LEAD_ALERT_EMAIL?.trim();
  let emailed = false;
  if (to) {
    const lines = [
      `${label} from ${who}`,
      `Email: ${lead.email}`,
      lead.role ? `Role: ${lead.role}` : null,
      lead.interest ? `Interest: ${lead.interest}` : null,
      lead.message ? `\n${lead.message}` : null,
      `\nOpen the lead register: ${link}`,
    ].filter((l): l is string => l !== null);
    emailed = await sendEmail({
      to,
      subject: `${label}: ${who}`,
      text: lines.join('\n'),
      html: `<p>${lines.map((l) => escapeHtml(l).replace(/\n/g, '<br>')).join('</p><p>')}</p>`,
    });
  }

  logger.info('Lead alert sent', { leadId: lead.id, source: lead.source, notified: admins.length, emailed });
  return { notified: admins.length, emailed };
}
