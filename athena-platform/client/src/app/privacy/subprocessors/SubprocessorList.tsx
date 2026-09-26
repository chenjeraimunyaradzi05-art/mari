'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type DpaStatus = 'SIGNED' | 'EXPIRED' | 'NOT_RECORDED';

interface Subprocessor {
  name: string;
  purpose: string | null;
  location: string;
  isEUAdequate: boolean;
  transferMechanism: string | null;
  dataCategories: string[];
  securityCertifications: string[];
  dpaStatus: DpaStatus;
  dpaSignedAt: string | null;
}

interface SubprocessorResponse {
  subprocessors: Subprocessor[];
  lastUpdated: string | null;
  published: boolean;
}

const DPA_LABEL: Record<DpaStatus, string> = {
  SIGNED: 'Data processing agreement in place',
  EXPIRED: 'Data processing agreement has expired',
  NOT_RECORDED: 'No data processing agreement on record',
};

const CATEGORY_LABEL: Record<string, string> = {
  PII: 'contact and account details',
  SENSITIVE: 'sensitive information',
  FINANCIAL: 'payment information',
  UGC: 'what you post and send',
  BIOMETRIC: 'biometric information',
  BEHAVIORAL: 'how you use the platform',
  TECHNICAL: 'device and log information',
};

export function SubprocessorList() {
  const register = useQuery<SubprocessorResponse>({
    queryKey: ['public-subprocessors'],
    queryFn: async () => {
      const response = await api.get('/compliance/subprocessors');
      return {
        subprocessors: (response.data?.data?.subprocessors ?? []) as Subprocessor[],
        lastUpdated: response.data?.data?.lastUpdated ?? null,
        published: response.data?.meta?.status === 'published',
      };
    },
  });

  if (register.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading the list of providers" />
      </div>
    );
  }

  if (register.isError || !register.data) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-100">
        The list of providers could not be loaded just now. That does not mean there are none — please try again, or ask
        us through the{' '}
        <Link href="/privacy-center" className="underline">
          Privacy Center
        </Link>
        .
      </p>
    );
  }

  if (!register.data.published) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm leading-6 text-muted-foreground">
        We have not published our list of providers yet. That is a gap on our side, not a sign that no one else handles
        your information: hosting, payments, email and push notifications are all run by outside providers. Until the list
        is here, you can ask us who they are and where they hold data through the{' '}
        <Link href="/privacy-center" className="text-primary hover:underline">
          Privacy Center
        </Link>
        , and we will answer within 30 days.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {register.data.subprocessors.map((provider) => (
        <section key={provider.name} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{provider.name}</h2>
            <span className="text-sm text-muted-foreground">Holds data in {provider.location}</span>
          </div>
          {provider.purpose && <p className="mt-2 text-sm leading-6 text-muted-foreground">{provider.purpose}</p>}
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {provider.dataCategories.length > 0 && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">What it handles</dt>
                <dd>{provider.dataCategories.map((c) => CATEGORY_LABEL[c] ?? c.toLowerCase()).join(', ')}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contract</dt>
              <dd>{DPA_LABEL[provider.dpaStatus]}</dd>
            </div>
            {provider.transferMechanism && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Overseas transfer basis</dt>
                <dd>{provider.transferMechanism}</dd>
              </div>
            )}
            {provider.securityCertifications.length > 0 && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Certifications</dt>
                <dd>{provider.securityCertifications.join(', ')}</dd>
              </div>
            )}
          </dl>
        </section>
      ))}
      {register.data.lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last changed {new Date(register.data.lastUpdated).toLocaleDateString('en-AU')}.
        </p>
      )}
    </div>
  );
}
