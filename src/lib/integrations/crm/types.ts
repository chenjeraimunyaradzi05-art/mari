export interface CRMContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  source?: string;
  customFields?: Record<string, any>;
}

export interface CRMService {
  name: string;
  syncContact(contact: CRMContact): Promise<boolean>;
  getContact(email: string): Promise<CRMContact | null>;
}

export interface CRMConfig {
  apiKey: string;
  apiUrl?: string;
  orgId?: string;
}
