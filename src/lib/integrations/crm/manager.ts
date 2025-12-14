import { prisma } from "@/lib/prisma";
import { createCRMService } from "@/lib/integrations/crm/factory";

export async function syncLeadToCRM(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) return;

    // Mock: Fetch CRM config from organization metadata or a separate table
    // For now, we'll assume a default config if the lead source is "partner_api"
    // or just random for demo purposes.
    
    const crmConfig = {
      apiKey: "mock-api-key",
      apiUrl: "https://api.mock-crm.com"
    };

    // Randomly choose a provider for demo
    const provider = Math.random() > 0.5 ? "salesforce" : "hubspot";
    const crmService = createCRMService(provider, crmConfig);

    await crmService.syncContact({
      email: lead.email,
      firstName: lead.firstName || undefined,
      lastName: lead.lastName || undefined,
      phone: lead.phone || undefined,
      source: lead.source || "Mari Platform",
      customFields: {
        score: lead.score,
        tier: lead.tier
      }
    });

    console.log(`[CRM] Successfully synced lead ${leadId} to ${provider}`);

  } catch (error) {
    console.error(`[CRM] Failed to sync lead ${leadId}`, error);
  }
}
