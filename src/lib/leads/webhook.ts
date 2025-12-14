import { prisma } from '@/lib/db';
import { deliverWithRetries } from './delivery';

export async function deliverLeadWebhook(leadId: string, webhookUrl: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) return;

  const result = await deliverWithRetries({
    destinationUrl: webhookUrl,
    payload: {
      event: 'lead.purchased',
      data: lead,
      timestamp: new Date().toISOString(),
    },
    retries: 3,
    timeoutMs: 5000,
  });

  if (result.status === 'failed') {
    console.error(`Failed to deliver lead ${leadId} to ${webhookUrl}`, result.lastError);
  } else {
    console.log(`Lead ${leadId} delivered to ${webhookUrl} in ${result.latencyMs}ms`);
  }
}
