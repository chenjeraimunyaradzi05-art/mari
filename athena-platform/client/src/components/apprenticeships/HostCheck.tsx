/**
 * Whether the host of an apprenticeship has been checked by ATHENA, said
 * honestly.
 *
 * An apprentice is often a young person starting a first job in a workplace
 * ATHENA has never seen. An organisation may place apprentices through ATHENA
 * only while it is verified and holds an approved host safety attestation, and
 * the server says which it is on every listing (hostVerified, hostSafetyChecked,
 * hostMayPlace).
 *
 * The label is not a guarantee, and it does not read as one. The attestation is
 * the organisation's own statement that it has a safety policy, workers'
 * compensation cover, supervision, incident reporting and a complaints route,
 * which a member of staff has read. ATHENA does not run or hold police or
 * background checks on anyone. A listing whose host has not been checked is shown
 * with that said, not hidden: the catalogue names training providers nobody here
 * has checked, and an honest label serves a visitor better than an empty page.
 *
 * `hostMayPlace` missing (a response from before the server said so) shows
 * nothing at all rather than guessing either way.
 */

import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Apprenticeship } from './types';

export const HOST_CHECKED_MEANING =
  "This host is a verified organisation, and has told ATHENA in a safety attestation that a member of staff has read: a safety policy, workers' compensation cover, supervision, incident reporting and a way to raise a complaint. It is the host's own statement. ATHENA does not run or hold police or background checks on anyone.";

export const HOST_NOT_CHECKED_NOTICE =
  'ATHENA has not safety-checked this host yet. You can read about the apprenticeship, but applications through ATHENA are not open until the host has been verified and its safety attestation approved.';

type HostFlags = Pick<Apprenticeship, 'hostMayPlace'>;

/** False only when the server said the host has not been checked. */
export const hostChecked = (a: HostFlags): boolean | null => (typeof a.hostMayPlace === 'boolean' ? a.hostMayPlace : null);

/** A small label for a card or a heading. */
export function HostCheckBadge({ apprenticeship, className }: { apprenticeship: HostFlags; className?: string }) {
  const checked = hostChecked(apprenticeship);
  if (checked === null) return null;

  return checked ? (
    <span
      title={HOST_CHECKED_MEANING}
      className={cn('inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', className)}
    >
      <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Safety-checked host
    </span>
  ) : (
    <span
      title={HOST_NOT_CHECKED_NOTICE}
      className={cn('inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300', className)}
    >
      <ShieldQuestion className="h-3 w-3" aria-hidden="true" /> Not yet safety-checked
    </span>
  );
}

/** The sentence under the label, for the detail page and the apply form. */
export function HostCheckNotice({ apprenticeship, className }: { apprenticeship: HostFlags; className?: string }) {
  const checked = hostChecked(apprenticeship);
  if (checked === null) return null;

  return (
    <p
      role={checked ? undefined : 'note'}
      className={cn(
        'rounded-lg p-3 text-sm leading-6',
        checked ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100',
        className
      )}
    >
      {checked ? HOST_CHECKED_MEANING : HOST_NOT_CHECKED_NOTICE}
    </p>
  );
}
