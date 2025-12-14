import { prisma } from '@/lib/db';

export interface CRMAdapter {
  name: string;
  syncLead(lead: any): Promise<boolean>;
  syncCampaign(campaign: any): Promise<boolean>;
}

export class SalesforceAdapter implements CRMAdapter {
  name = 'salesforce';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async syncLead(lead: any): Promise<boolean> {
    console.log(`[Salesforce] Syncing lead ${lead.email} using key ${this.apiKey}`);
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  }

  async syncCampaign(campaign: any): Promise<boolean> {
    console.log(`[Salesforce] Syncing campaign ${campaign.name}`);
    return true;
  }
}

export class HubSpotAdapter implements CRMAdapter {
  name = 'hubspot';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async syncLead(lead: any): Promise<boolean> {
    console.log(`[HubSpot] Syncing lead ${lead.email}`);
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 300));
    return true;
  }

  async syncCampaign(campaign: any): Promise<boolean> {
    console.log(`[HubSpot] Syncing campaign ${campaign.name}`);
    return true;
  }
}

export class CRMFactory {
  static getAdapter(type: 'salesforce' | 'hubspot', credentials: any): CRMAdapter {
    switch (type) {
      case 'salesforce':
        return new SalesforceAdapter(credentials.apiKey);
      case 'hubspot':
        return new HubSpotAdapter(credentials.accessToken);
      default:
        throw new Error(`Unsupported CRM type: ${type}`);
    }
  }
}

export async function syncLeadToCRM(leadId: string, organizationId: string) {
  // 1. Fetch organization settings to see if CRM is configured
  // In a real app, we'd store this in a dedicated table or JSON field
  // For now, we'll mock the configuration lookup
  
  const mockConfig = {
    enabled: true,
    type: 'salesforce' as const,
    credentials: { apiKey: 'sf_mock_key_123' }
  };

  if (!mockConfig.enabled) return;

  // 2. Fetch Lead
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  // 3. Get Adapter
  const adapter = CRMFactory.getAdapter(mockConfig.type, mockConfig.credentials);

  // 4. Sync
  try {
    await adapter.syncLead(lead);
    // Update lead status or metadata to indicate sync success
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        dataJson: JSON.stringify({ ...JSON.parse(lead.dataJson || '{}'), crmSynced: true, crmSyncedAt: new Date() })
      }
    });
  } catch (error) {
    console.error('CRM Sync Failed', error);
  }
}
