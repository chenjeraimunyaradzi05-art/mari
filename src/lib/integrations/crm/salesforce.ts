import { CRMService, CRMContact, CRMConfig } from "./types";

export class SalesforceAdapter implements CRMService {
  name = "Salesforce";
  private config: CRMConfig;

  constructor(config: CRMConfig) {
    this.config = config;
  }

  async syncContact(contact: CRMContact): Promise<boolean> {
    console.log(`[Salesforce] Syncing contact: ${contact.email} to Org ${this.config.orgId || "Default"}`);
    
    // Mock API latency
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Mock success
    return true;
  }

  async getContact(email: string): Promise<CRMContact | null> {
    console.log(`[Salesforce] Searching for contact: ${email}`);
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Mock not found for now
    return null;
  }
}
