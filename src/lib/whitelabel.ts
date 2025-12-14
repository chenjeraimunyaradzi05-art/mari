import { prisma } from '@/lib/db';

export interface WhiteLabelConfig {
  enabled: boolean;
  domain?: string;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  customCss?: string;
}

export const DEFAULT_BRANDING: WhiteLabelConfig = {
  enabled: false,
  brandName: 'MoneyMan',
  primaryColor: '#2563eb', // blue-600
  secondaryColor: '#1e40af', // blue-800
};

export async function getWhiteLabelSettings(hostname: string): Promise<WhiteLabelConfig> {
  // In a real app, we would look up the organization by custom domain (hostname)
  // For now, we'll simulate a lookup based on a mock domain
  
  if (hostname === 'partner.demo.com') {
    return {
      enabled: true,
      domain: 'partner.demo.com',
      brandName: 'Partner Brand',
      logoUrl: '/partner-logo.png',
      primaryColor: '#dc2626', // red-600
      secondaryColor: '#991b1b', // red-800
    };
  }

  // Fallback to default branding
  return DEFAULT_BRANDING;
}

export async function getOrganizationBranding(organizationId: string): Promise<WhiteLabelConfig> {
  // Fetch organization metadata
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  // Cast to any because metadata might not be in the generated client yet
  const orgWithMeta = org as any;

  if (orgWithMeta?.metadata) {
    try {
      const meta = JSON.parse(orgWithMeta.metadata as string);
      if (meta.branding) {
        return { ...DEFAULT_BRANDING, ...meta.branding, enabled: true };
      }
    } catch {
      // Ignore parse errors
    }
  }

  return DEFAULT_BRANDING;
}
