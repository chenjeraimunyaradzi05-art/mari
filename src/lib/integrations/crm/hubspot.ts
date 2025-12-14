import { CRMService, CRMContact, CRMConfig } from "./types";

export class HubSpotAdapter implements CRMService {
  name = "HubSpot";
  private config: CRMConfig;

  constructor(config: CRMConfig) {
    this.config = config;
  }

  async syncContact(contact: CRMContact): Promise<boolean> {
    console.log(`[HubSpot] Syncing contact: ${contact.email} using API Key ending in ...${this.config.apiKey.slice(-4)}`);
    
    // Mock API latency
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Mock success
    return true;
  }

  async getContact(email: string): Promise<CRMContact | null> {
    console.log(`[HubSpot] Searching for contact: ${email}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return null;
  }
}
