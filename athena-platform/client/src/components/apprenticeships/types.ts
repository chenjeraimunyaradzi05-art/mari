/**
 * The apprenticeship shape the API actually returns.
 *
 * The previous interface was written against a mock: it declared
 * `organization`, `industry`, `duration: string`, `location: string`,
 * `salary: {min,max,currency,period}`, `skills`, `requirements`, `benefits`,
 * `spotsAvailable`/`totalSpots` and a lowercase `level` union. None of those
 * columns exist. `GET /api/apprenticeships` serves the Prisma row, which names
 * an RTO and a host employer separately, measures duration in months, splits
 * the wage into two integers and levels by AQF certificate.
 *
 * Kept in one file because the card, the filter bar, the browse page and the
 * detail page all have to agree with the server, and previously did not.
 */

/** AQF levels, exactly as `enum ApprenticeshipLevel` in schema.prisma. */
export const APPRENTICESHIP_LEVELS = [
  'CERTIFICATE_I',
  'CERTIFICATE_II',
  'CERTIFICATE_III',
  'CERTIFICATE_IV',
  'DIPLOMA',
  'ADVANCED_DIPLOMA',
] as const;

export type ApprenticeshipLevel = (typeof APPRENTICESHIP_LEVELS)[number];

/**
 * The enum value goes to the server; the label goes on screen. Sending the
 * label is what previously made Prisma reject the filter and return a 500
 * rather than an empty list.
 */
export const LEVEL_LABELS: Record<ApprenticeshipLevel, string> = {
  CERTIFICATE_I: 'Certificate I',
  CERTIFICATE_II: 'Certificate II',
  CERTIFICATE_III: 'Certificate III',
  CERTIFICATE_IV: 'Certificate IV',
  DIPLOMA: 'Diploma',
  ADVANCED_DIPLOMA: 'Advanced Diploma',
};

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level as ApprenticeshipLevel] ?? level.replace(/_/g, ' ');
}

export interface ApprenticeshipOrg {
  id: string;
  name: string;
  logo?: string | null;
}

export interface Apprenticeship {
  id: string;
  title: string;
  slug: string;
  description: string;
  /** The training package, e.g. "Electrotechnology". There is no category column. */
  framework: string;
  level: ApprenticeshipLevel | string;
  durationMonths: number;
  wageMin?: number | null;
  wageMax?: number | null;
  wagePostCompletion?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isRemote: boolean;
  /** Free-form JSON: the units of competency for the qualification. */
  competencies?: unknown;
  completionRate?: number | null;
  employmentRate?: number | null;
  womenEnrolled?: number | null;
  totalEnrolled?: number | null;
  positions: number;
  positionsFilled: number;
  startDate?: string | null;
  applicationDeadline?: string | null;
  isFeatured?: boolean;
  status?: string;
  createdAt: string;

  /** The registered training organisation awarding the qualification. */
  rto?: ApprenticeshipOrg | null;
  /** The employer hosting the placement. Either may be absent. */
  hostEmployer?: ApprenticeshipOrg | null;

  /** Added by the server for a signed-in viewer; absent when signed out. */
  isBookmarked?: boolean;
}

/** Whichever organisation is the public face of the listing. */
export function primaryOrg(a: Apprenticeship): ApprenticeshipOrg | null {
  return a.hostEmployer ?? a.rto ?? null;
}

export function locationLabel(a: Apprenticeship): string {
  if (a.isRemote) return 'Remote';
  const parts = [a.city, a.state].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return a.country || 'Australia';
}

export function durationLabel(months: number): string {
  if (!months) return '';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = months / 12;
  const rounded = Number.isInteger(years) ? years : Math.round(years * 10) / 10;
  return `${rounded} year${rounded === 1 ? '' : 's'}`;
}

/**
 * Apprentice wages are stored as whole dollars per year. Formatted in the
 * listing's own country currency rather than USD, which the old card hardcoded.
 */
export function wageLabel(a: Apprenticeship): string | null {
  const { wageMin, wageMax } = a;
  if (!wageMin && !wageMax) return null;

  const currency = a.country === 'New Zealand' ? 'NZD' : 'AUD';
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  if (wageMin && wageMax && wageMin !== wageMax) return `${fmt(wageMin)} – ${fmt(wageMax)} a year`;
  return `${fmt((wageMin || wageMax) as number)} a year`;
}

/** Places still open. Never negative, even if the data says more filled than exist. */
export function positionsLeft(a: Apprenticeship): number {
  return Math.max(0, (a.positions ?? 0) - (a.positionsFilled ?? 0));
}

export function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
