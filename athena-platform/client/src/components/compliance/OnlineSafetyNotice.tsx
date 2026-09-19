'use client';

/**
 * One warm sentence about the online-safety law behind the report, appeal and
 * transparency pages.
 *
 * Those pages used to carry a "UK Online Safety Act" banner each, which told a
 * Queensland member reporting harassment that the mechanism was a British
 * one. ATHENA is an Australian company: the home regime is the Online Safety
 * Act 2021 and the eSafety Commissioner, with the UK Act layered on for
 * members there. The regulator link follows the detected region, read from
 * GET /api/compliance/online-safety so the names and addresses live in one
 * place on the server.
 */

import { useEffect, useState } from 'react';
import { Shield, ExternalLink } from 'lucide-react';
import complianceService from '@/lib/services/compliance.service';
import type { OnlineSafetyInfo } from '@/lib/services/compliance.service';
import { getStoredPreference } from '@/lib/utils';

type Regulator = { name: string; url: string };

/**
 * Enough to draw the link before the server answers, or if it never does. The
 * server is the source of truth; this is the same two entries it serves.
 */
const FALLBACK_REGULATORS: Record<'ANZ' | 'UK', Regulator> = {
  ANZ: { name: 'eSafety Commissioner', url: 'https://www.esafety.gov.au/' },
  UK: { name: 'Ofcom', url: 'https://www.ofcom.org.uk/' },
};

const LEADS = {
  report: 'Reporting content',
  appeal: 'Your right to appeal',
  transparency: 'Why we publish this',
} as const;

const BODIES = {
  report:
    'Wherever you are, a report reaches the same Trust & Safety team.',
  appeal:
    'Every appeal is read by a moderator who was not involved in the original decision.',
  transparency:
    'The numbers on this page are the same ones we would show either regulator.',
} as const;

export function detectSafetyRegion(): string {
  const stored = getStoredPreference('athena.region', '');
  return stored || complianceService.detectUserRegion();
}

interface OnlineSafetyNoticeProps {
  variant: keyof typeof LEADS;
  className?: string;
}

export default function OnlineSafetyNotice({ variant, className = '' }: OnlineSafetyNoticeProps) {
  const [applicable, setApplicable] = useState<'ANZ' | 'UK'>('ANZ');
  const [regulator, setRegulator] = useState<Regulator>(FALLBACK_REGULATORS.ANZ);

  useEffect(() => {
    let cancelled = false;
    const region = detectSafetyRegion();
    const guess: 'ANZ' | 'UK' = region === 'UK' || region === 'GB' ? 'UK' : 'ANZ';
    setApplicable(guess);
    setRegulator(FALLBACK_REGULATORS[guess]);

    complianceService
      .getOnlineSafetyInfo(region)
      .then((info: OnlineSafetyInfo) => {
        if (cancelled || !info?.regime?.regulator) return;
        setApplicable(info.applicable);
        setRegulator({ name: info.regime.regulator.name, url: info.regime.regulator.url });
      })
      .catch(() => {
        // The fallback link is already on screen; nothing to add.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-amber-50 p-4 dark:border-rose-900/40 dark:from-rose-950/30 dark:to-amber-950/20 ${className}`}
    >
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500 dark:text-rose-300" />
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{LEADS[variant]}</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            In Australia this is how we meet the Online Safety Act 2021 and the eSafety
            Commissioner&apos;s expectations; in the UK, the Online Safety Act 2023 and Ofcom.{' '}
            {BODIES[variant]}
          </p>
          <p className="mt-2 text-sm">
            <a
              href={regulator.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-rose-700 hover:underline dark:text-rose-300"
            >
              {applicable === 'UK' ? 'Your regulator is Ofcom' : `Your regulator is the ${regulator.name}`}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
