/**
 * The words the processing register and the impact assessments share.
 *
 * The values are the server's enums (LegalBasis and DataCategory in the
 * schema, and the DPIA vocabularies gdpr.routes.ts validates against); the
 * labels are how a privacy officer reads them. Both screens take them from
 * here so an activity and the assessment behind it describe the same data in
 * the same words.
 *
 * This folder begins with an underscore so the app router never treats it as
 * a page.
 */

export type Option<T extends string = string> = { value: T; label: string; hint?: string };

export const LEGAL_BASES: Option[] = [
  { value: 'CONSENT', label: 'Consent', hint: 'She agreed, and can withdraw' },
  { value: 'CONTRACT', label: 'Contract', hint: 'Needed to give her the service she signed up for' },
  { value: 'LEGAL_OBLIGATION', label: 'Legal obligation', hint: 'A law requires it' },
  { value: 'VITAL_INTERESTS', label: 'Vital interests', hint: 'To protect someone’s life or safety' },
  { value: 'PUBLIC_TASK', label: 'Public task' },
  { value: 'LEGITIMATE_INTERESTS', label: 'Legitimate interests', hint: 'Our interest, weighed against hers' },
];

export const DATA_CATEGORIES: Option[] = [
  { value: 'PII', label: 'Identity and contact details' },
  { value: 'SENSITIVE', label: 'Sensitive information', hint: 'Health, safety, sexuality, beliefs' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'UGC', label: 'What members write and post' },
  { value: 'BIOMETRIC', label: 'Biometric', hint: 'Identity verification' },
  { value: 'BEHAVIORAL', label: 'How the platform is used' },
  { value: 'TECHNICAL', label: 'Devices, addresses and logs' },
];

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export const RISK_LEVELS: Option<RiskLevel>[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

export type DpiaStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export const DPIA_STATUSES: Option<DpiaStatus>[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Awaiting sign-off' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Not approved' },
];

export type MitigationStatus = 'PLANNED' | 'IN_PROGRESS' | 'IN_PLACE';
export const MITIGATION_STATUSES: Option<MitigationStatus>[] = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'IN_PROGRESS', label: 'Under way' },
  { value: 'IN_PLACE', label: 'In place' },
];

export const labelOf = (options: Option[], value: string | null | undefined): string =>
  options.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, ' ').toLowerCase() : '');

/** A textarea of one entry per line, as the list columns store it. */
export const toLines = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter(Boolean);
export const fromLines = (values: string[] | null | undefined): string => (values ?? []).join('\n');

export const errorMessage = (e: unknown): string | undefined =>
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error;

export const longDate = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** A date input's value from a stored date, in the admin's own time zone. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A date input's value as a timestamp at noon that day, so no time zone moves it to another day. */
export function fromDateInput(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toISOString();
}
