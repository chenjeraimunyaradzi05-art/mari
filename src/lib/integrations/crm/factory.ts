import { CRMService, CRMConfig } from "./types";
import { SalesforceAdapter } from "./salesforce";
import { HubSpotAdapter } from "./hubspot";

export type CRMProvider = "salesforce" | "hubspot";

export function createCRMService(provider: CRMProvider, config: CRMConfig): CRMService {
  switch (provider) {
    case "salesforce":
      return new SalesforceAdapter(config);
    case "hubspot":
      return new HubSpotAdapter(config);
    default:
      throw new Error(`Unsupported CRM provider: ${provider}`);
  }
}
