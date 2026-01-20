/**
 * Compliance Custom Hooks - React hooks for regional compliance operations
 * Phase 4: UK/EU Market Launch
 */

import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';
import complianceService from '../services/compliance.service';
import type { RegionConfig, PricingTier } from '../services/compliance.service';

// Type aliases to match what the hook expects
type RegionInfo = RegionConfig & {
  region?: string;
  requiresGDPR?: boolean;
  requiresUKGDPR?: boolean;
  dataResidency?: string;
};
type PricingInfo = PricingTier;
type ComplianceStatus = 'compliant' | 'pending' | 'non-compliant';
type LegalDocument = {
  id: string;
  title: string;
  version: string;
  content: string;
  effectiveDate: string;
};

// Default region fallback
const DEFAULT_REGION: RegionInfo = {
  code: 'US',
  name: 'United States',
  region: 'United States',
  currency: 'USD',
  currencySymbol: '$',
  vatRate: 0,
  vatInclusive: false,
  gdprRequired: false,
  requiresGDPR: false,
  requiresUKGDPR: false,
  minAge: 13,
  regulations: [],
  dataResidency: 'us-east-1',
};

// Region Context for global region state
interface RegionContextValue {
  region: RegionInfo;
  loading: boolean;
  error: Error | null;
  setRegion: (regionCode: string) => Promise<void>;
  detectRegion: () => Promise<void>;
  formatPrice: (amount: number) => string;
  requiresGDPRConsent: boolean;
  isUK: boolean;
  isEU: boolean;
}

const RegionContext = createContext<RegionContextValue | null>(null);

/**
 * Region Provider - Wrap app to provide region context
 */
export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<RegionInfo>(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const detectRegion = useCallback(async () => {
    try {
      setLoading(true);
      const detectedCode = await complianceService.detectUserRegion();
      const regionConfig = await complianceService.getRegionConfig(detectedCode);
      setRegionState({
        ...regionConfig,
        region: regionConfig.name,
        requiresGDPR: regionConfig.gdprRequired,
        requiresUKGDPR: detectedCode === 'GB',
        dataResidency: detectedCode === 'GB' ? 'eu-west-2' : (regionConfig.gdprRequired ? 'eu-west-1' : 'us-east-1'),
      });
      setError(null);
    } catch (err) {
      // Fall back to checking localStorage or default
      const savedRegion = localStorage.getItem('athena_region');
      if (savedRegion) {
        try {
          const regionConfig = await complianceService.getRegionConfig(savedRegion);
          setRegionState({
            ...regionConfig,
            region: regionConfig.name,
            requiresGDPR: regionConfig.gdprRequired,
            requiresUKGDPR: savedRegion === 'GB',
            dataResidency: savedRegion === 'GB' ? 'eu-west-2' : (regionConfig.gdprRequired ? 'eu-west-1' : 'us-east-1'),
          });
        } catch {
          setRegionState(DEFAULT_REGION);
        }
      } else {
        setRegionState(DEFAULT_REGION);
      }
      setError(err instanceof Error ? err : new Error('Failed to detect region'));
    } finally {
      setLoading(false);
    }
  }, []);

  const setRegion = useCallback(async (regionCode: string) => {
    try {
      setLoading(true);
      const regionConfig = await complianceService.getRegionConfig(regionCode);
      const newRegion: RegionInfo = {
        ...regionConfig,
        region: regionConfig.name,
        requiresGDPR: regionConfig.gdprRequired,
        requiresUKGDPR: regionCode === 'GB',
        dataResidency: regionCode === 'GB' ? 'eu-west-2' : (regionConfig.gdprRequired ? 'eu-west-1' : 'us-east-1'),
      };
      setRegionState(newRegion);
      localStorage.setItem('athena_region', regionCode);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to set region'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    detectRegion();
  }, [detectRegion]);

  const formatPrice = useCallback(
    (amount: number) => {
      return complianceService.formatPrice(amount, region.code);
    },
    [region.code]
  );

  const requiresGDPRConsent = Boolean(region.requiresGDPR || region.requiresUKGDPR);
  const isUK = region.code === 'GB';
  const isEU = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'SE'].includes(region.code);

  const value = useMemo(
    () => ({
      region,
      loading,
      error,
      setRegion,
      detectRegion,
      formatPrice,
      requiresGDPRConsent,
      isUK,
      isEU,
    }),
    [region, loading, error, setRegion, detectRegion, formatPrice, requiresGDPRConsent, isUK, isEU]
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

/**
 * Hook to access region context
 */
export function useRegion() {
  const context = useContext(RegionContext);
  if (!context) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return context;
}

/**
 * Hook for localized pricing
 */
export function useLocalizedPricing(productId: string) {
  const { region } = useRegion();
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPricing() {
      try {
        setLoading(true);
        const pricingList = await complianceService.getRegionalPricing(region.code);
        // Find the pricing for this product/tier
        const data = pricingList.find(p => p.tier === productId) || pricingList[0];
        setPricing(data || null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch pricing'));
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchPricing();
    }
  }, [productId, region.code]);

  return { pricing, loading, error };
}

/**
 * Hook for user's compliance status
 */
export function useComplianceStatus() {
  const { region } = useRegion();
  const [status, setStatus] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      // Check GDPR status if in GDPR region
      if (complianceService.isGDPRRegion(region.code)) {
        // TODO: Implement proper compliance status check via API
        setStatus('compliant');
      } else {
        setStatus('compliant');
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch compliance status'));
    } finally {
      setLoading(false);
    }
  }, [region.code]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}

/**
 * Hook for legal documents
 */
export function useLegalDocuments() {
  const { region } = useRegion();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        setLoading(true);
        // TODO: Implement proper legal documents API endpoint
        // For now, return empty array - documents should be fetched from API
        setDocuments([]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch legal documents'));
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, [region.code]);

  const recordAgreement = useCallback(
    async (_documentType: string, _documentVersion: string) => {
      // TODO: Implement terms agreement recording via API
      console.log('Recording agreement - to be implemented');
    },
    []
  );

  return { documents, loading, error, recordAgreement };
}

/**
 * Hook for age verification (UK Online Safety Act)
 */
export function useAgeVerification() {
  const { isUK } = useRegion();
  const [required, setRequired] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function checkRequirement() {
      try {
        setLoading(true);
        // For UK users, age verification is required
        setRequired(isUK);
        setError(null);
      } catch (err) {
        setRequired(isUK); // Default to requiring for UK if check fails
        setError(err instanceof Error ? err : new Error('Failed to check age verification'));
      } finally {
        setLoading(false);
      }
    }

    checkRequirement();
  }, [isUK]);

  const verifyAge = useCallback(async (dateOfBirth: string) => {
    try {
      // Calculate age from date of birth
      const dob = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      const isVerified = age >= 18;
      setVerified(isVerified);
      return { verified: isVerified, age };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to verify age'));
      throw err;
    }
  }, []);

  return { required, verified, loading, error, verifyAge };
}

export default {
  RegionProvider,
  useRegion,
  useLocalizedPricing,
  useComplianceStatus,
  useLegalDocuments,
  useAgeVerification,
};
