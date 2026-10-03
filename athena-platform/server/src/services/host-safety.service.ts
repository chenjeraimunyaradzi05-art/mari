/**
 * What a host employer tells ATHENA about how it keeps an apprentice safe, and
 * what staff decide about it.
 *
 * An apprentice is often a young person starting a first job, placed in a
 * workplace ATHENA has never seen. Until this module nothing in the placement
 * path asked who the host was: any organisation member with posting rights
 * could publish a listing and take applications, and the one organisation check
 * that existed (the verified badge) was not read by anything that placed anyone.
 *
 * The rule now is that an organisation may place apprentices through ATHENA only
 * while it is verified (Organization.isVerified, set by the existing badge
 * review) AND holds an approved attestation that has not run out
 * (hiring-access.service, hostMayPlaceApprentices). This module is the second
 * half: the questions, the owner's or admin's answer to them, and staff's
 * decision.
 *
 * ## What is checked, and what is not
 *
 * Organisation-level facts only. The organisation says, in yes or no, that it has
 * a work health and safety policy, workers' compensation cover, supervision,
 * incident reporting, a complaints route that does not run through the
 * supervisor, and that it will meet the working-with-children obligations of its
 * state. It names a safety contact. It gives an ABN, which is checksum-checked
 * and, when a lookup is configured, looked up on the Australian Business Register
 * (only the entity name and the ABN's status are kept).
 *
 * Staff read that, and write down what they did to satisfy themselves (called
 * the safety contact, looked the ABN up, asked for a policy). They are not
 * shown, and ATHENA never collects, an individual's police or background check:
 * that is sensitive information under the Privacy Act 1988 (APP 3), needs the
 * person's informed consent and a lawful basis, and is not something a platform
 * should hold. docs/security/host-employer-checks.md says the same.
 *
 * An attestation is a statement by the organisation, not a finding by ATHENA, and
 * the product says so wherever it shows the result.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { digitsOnly, formatAbn, isConfigured as abrConfigured, isValidAbn, lookupAbn } from './abr.service';

/** Bumped when the questions change, so an old attestation can be read against the wording it was given for. */
export const HOST_SAFETY_VERSION = 1;

/** How long an approved attestation stands unless staff say otherwise. A year. */
export const HOST_ATTESTATION_DEFAULT_DAYS = 365;
/** The longest staff may set one for. */
export const HOST_ATTESTATION_MAX_DAYS = 730;
/** An organisation may renew, and staff are shown, attestations that end within this many days. */
export const HOST_ATTESTATION_RENEWAL_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HostSafetyQuestion {
  id: string;
  statement: string;
}

/** The statements an organisation affirms. Every one has to be true before ATHENA will look at the request. */
export const HOST_SAFETY_QUESTIONS: readonly HostSafetyQuestion[] = [
  { id: 'whsPolicy', statement: 'We have a written work health and safety policy that covers apprentices.' },
  { id: 'workersCompensation', statement: "We hold workers' compensation insurance that covers apprentices, as the law of our state requires." },
  { id: 'supervision', statement: 'Every apprentice works under a named, experienced person, and is not left to do work they have not been trained for.' },
  { id: 'induction', statement: 'Every apprentice has a safety induction before their first shift, and the protective equipment the work needs.' },
  { id: 'incidentReporting', statement: 'We record and report workplace incidents and injuries as the law requires, and apprentices know who to tell.' },
  {
    id: 'complaintsRoute',
    statement: 'An apprentice can raise a complaint about harassment, bullying or an unsafe workplace with someone other than the person supervising them, and will not be penalised for it.',
  },
  {
    id: 'youngWorkers',
    statement:
      "Where an apprentice is under 18, we will meet our state's obligations for people who work with children and young people (for example a Blue Card in Queensland). Those checks stay between us and the people they concern.",
  },
];

const QUESTION_IDS = HOST_SAFETY_QUESTIONS.map((q) => q.id);

/** What the organisation is told when staff will not look at a request until every statement is true. */
const NOT_AFFIRMED = (statements: string[]) =>
  `ATHENA can look at a request only when every one of these is true for your organisation. Not yet affirmed: ${statements.join(' ')} If something is not in place yet, put it in place first and send the request then.`;

export type HostStanding = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

type StandingSource = { status: string; expiresAt?: Date | string | null };

/**
 * Where an attestation stands right now. An approved attestation with no end
 * date, or one whose end date has passed, is EXPIRED whatever the stored status
 * says: nothing writes EXPIRED, so the answer is always read from the date.
 */
export function attestationStanding(row: StandingSource | null | undefined, now: Date = new Date()): HostStanding {
  if (!row) return 'NONE';
  if (row.status === 'APPROVED') {
    const ends = row.expiresAt ? new Date(row.expiresAt).getTime() : NaN;
    return Number.isFinite(ends) && ends > now.getTime() ? 'APPROVED' : 'EXPIRED';
  }
  if (row.status === 'PENDING' || row.status === 'REJECTED') return row.status;
  return 'NONE';
}

// ------------------------------------------------------------- what an organisation says

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(max).optional());

/** The organisation's attestation as it arrives. */
export const hostAttestationSchema = z
  .object({
    answers: z.record(z.boolean(), { invalid_type_error: 'is the yes or no for each statement' }).default({}),
    safetyContactName: z.string({ required_error: 'is required' }).trim().min(2, 'is required').max(120, 'is at most 120 characters'),
    safetyContactEmail: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().trim().email('is not an email address').max(200).optional()
    ),
    safetyContactPhone: optionalText(30),
    abn: z
      .string({ required_error: 'is required' })
      .trim()
      .refine((v) => isValidAbn(v), 'is not a valid ABN. It is 11 digits.'),
  })
  .superRefine((value, ctx) => {
    if (!value.safetyContactEmail && !value.safetyContactPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['safetyContactEmail'], message: 'or a phone number is needed, so an apprentice has someone to tell' });
    }
  });

export type HostAttestationInput = z.infer<typeof hostAttestationSchema>;

/** A zod refusal as a 400 naming the field. */
export function parseHostInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'request'} ${issue.message}` : 'Invalid request');
  }
  return parsed.data;
}

/** The answers as stored: one boolean per known question, nothing else. Throws unless every one is true. */
export function affirmedAnswers(answers: Record<string, boolean>): Record<string, true> {
  const missing = HOST_SAFETY_QUESTIONS.filter((q) => answers[q.id] !== true).map((q) => q.statement);
  if (missing.length > 0) throw new ApiError(400, NOT_AFFIRMED(missing));
  return Object.fromEntries(QUESTION_IDS.map((id) => [id, true as const]));
}

/**
 * What the ABR said about the ABN, if a lookup is configured. Only the entity
 * name and the ABN's status are kept: that is what a reviewer compares against
 * the organisation's name, and the rest of the record is the ABR's to publish.
 * A lookup that cannot be made is recorded as such, never as a pass.
 */
export async function abnCheck(abn: string, now: Date = new Date()) {
  const digits = digitsOnly(abn);
  if (!abrConfigured()) return { lookup: 'NOT_CONFIGURED' as const, abn: digits, checkedAt: now.toISOString() };
  try {
    const entity = await lookupAbn(digits);
    if (!entity) return { lookup: 'NOT_FOUND' as const, abn: digits, checkedAt: now.toISOString() };
    return { lookup: 'FOUND' as const, abn: digits, entityName: entity.entityName, abnStatus: entity.abnStatus, checkedAt: now.toISOString() };
  } catch (error) {
    logger.warn('The ABR could not be asked about a host employer', { error: error instanceof Error ? error.message : String(error) });
    return { lookup: 'UNAVAILABLE' as const, abn: digits, checkedAt: now.toISOString() };
  }
}

type AttestationRow = {
  id: string;
  organizationId: string;
  version: number;
  answers: unknown;
  safetyContactName: string;
  safetyContactEmail: string | null;
  safetyContactPhone: string | null;
  abn: string | null;
  abnCheck: unknown;
  attestedAt: Date;
  status: string;
  reviewedAt: Date | null;
  reviewNote: string | null;
  expiresAt: Date | null;
};

/**
 * What the organisation may read of its own attestation. The reviewer's note is
 * shown: for a refusal it is the reason, and for an approval it is what ATHENA
 * did, which the organisation is entitled to know.
 */
export function presentAttestation(row: AttestationRow | null, now: Date = new Date()) {
  const standing = attestationStanding(row, now);
  if (!row) return { standing, canSubmit: true, renewable: false };
  const ends = row.expiresAt ? row.expiresAt.getTime() : null;
  const renewable = standing === 'APPROVED' && ends !== null && ends - now.getTime() <= HOST_ATTESTATION_RENEWAL_WINDOW_DAYS * DAY_MS;
  return {
    id: row.id,
    standing,
    // A request can be sent unless one stands (outside its last month) or one is already waiting.
    canSubmit: standing === 'NONE' || standing === 'REJECTED' || standing === 'EXPIRED' || renewable,
    renewable,
    version: row.version,
    safetyContactName: row.safetyContactName,
    safetyContactEmail: row.safetyContactEmail,
    safetyContactPhone: row.safetyContactPhone,
    abn: row.abn ? formatAbn(row.abn) : null,
    attestedAt: row.attestedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    reviewNote: row.reviewNote,
  };
}

/** The attestation a staff reviewer reads: the answers and the ABR's reply as well. */
export function presentForReviewer(row: AttestationRow & { organization?: unknown }, now: Date = new Date()) {
  return {
    ...presentAttestation(row, now),
    answers: row.answers,
    abnCheck: row.abnCheck ?? null,
    organizationId: row.organizationId,
    organization: row.organization ?? null,
  };
}

/** The most recent attestation for an organisation, whatever its state. */
export async function latestAttestation(organizationId: string) {
  return prisma.hostEmployerSafetyAttestation.findFirst({ where: { organizationId }, orderBy: { attestedAt: 'desc' } });
}

/**
 * Take an organisation's attestation. One waiting request at a time: sending
 * again while one waits corrects it in place. A standing approval may be renewed
 * only in its last month, so there is nothing to renew before then. The ABN is
 * looked up first; one the ABR does not know is refused, because it is almost
 * always a typo the organisation can fix in a minute.
 */
export async function submitHostAttestation(
  organizationId: string,
  attestedById: string,
  input: HostAttestationInput,
  now: Date = new Date()
) {
  const answers = affirmedAnswers(input.answers);

  const [existingPending, standing] = await Promise.all([
    prisma.hostEmployerSafetyAttestation.findFirst({ where: { organizationId, status: 'PENDING' }, orderBy: { attestedAt: 'desc' } }),
    prisma.hostEmployerSafetyAttestation.findFirst({ where: { organizationId, status: 'APPROVED', expiresAt: { gt: now } }, orderBy: { expiresAt: 'desc' } }),
  ]);

  if (standing && !existingPending && standing.expiresAt && standing.expiresAt.getTime() - now.getTime() > HOST_ATTESTATION_RENEWAL_WINDOW_DAYS * DAY_MS) {
    throw new ApiError(
      409,
      `Your organisation's safety attestation stands until ${standing.expiresAt.toLocaleDateString('en-AU', { dateStyle: 'long', timeZone: 'Australia/Brisbane' })}. You can renew it in the month before it ends.`
    );
  }

  const check = await abnCheck(input.abn, now);
  if (check.lookup === 'NOT_FOUND') {
    throw new ApiError(400, 'That ABN is not on the Australian Business Register. Check the number and try again.');
  }

  const data = {
    version: HOST_SAFETY_VERSION,
    answers: answers as Prisma.InputJsonValue,
    safetyContactName: input.safetyContactName,
    safetyContactEmail: input.safetyContactEmail ?? null,
    safetyContactPhone: input.safetyContactPhone ?? null,
    abn: digitsOnly(input.abn),
    abnCheck: check as Prisma.InputJsonValue,
    attestedById,
    attestedAt: now,
  };

  if (existingPending) {
    return prisma.hostEmployerSafetyAttestation.update({ where: { id: existingPending.id }, data });
  }
  return prisma.hostEmployerSafetyAttestation.create({ data: { organizationId, status: 'PENDING', ...data } });
}

// ------------------------------------------------------------- what staff decide

/** A staff decision on an attestation. */
export const hostDecisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    // What staff did to satisfy themselves (approve), or why not (reject, shown to the organisation).
    note: z
      .string({ required_error: 'is required' })
      .trim()
      .min(10, 'needs at least a sentence: what you checked, or why not')
      .max(1000, 'is at most 1000 characters'),
    validForDays: z.coerce.number().int().min(1).max(HOST_ATTESTATION_MAX_DAYS).optional(),
  })
  .strict();

export type HostDecision = z.infer<typeof hostDecisionSchema>;

/**
 * Write staff's decision. Approval starts the end date and records the ABN on
 * the organisation; both are one write, so an organisation is never left with an
 * approved attestation and no ABN. Only a waiting attestation can be approved;
 * a waiting or a standing one can be refused, which is how an approval is
 * withdrawn. The update is conditional on the status read, so two reviewers
 * deciding at once cannot both win. Refusing an approval that stands refuses
 * every approval the organisation holds, so a withdrawal leaves nothing standing.
 */
export async function decideHostAttestation(attestationId: string, decision: HostDecision, reviewerId: string, now: Date = new Date()) {
  const row = await prisma.hostEmployerSafetyAttestation.findUnique({ where: { id: attestationId } });
  if (!row) throw new ApiError(404, 'Attestation not found');

  const approving = decision.decision === 'APPROVE';
  if (approving && row.status !== 'PENDING') {
    throw new ApiError(409, row.status === 'APPROVED' ? 'This attestation is already approved.' : 'This attestation was refused. The organisation has to send a new one.');
  }
  if (!approving && row.status === 'REJECTED') throw new ApiError(409, 'This attestation was already refused.');

  const days = decision.validForDays ?? HOST_ATTESTATION_DEFAULT_DAYS;
  const data = {
    status: approving ? ('APPROVED' as const) : ('REJECTED' as const),
    reviewedById: reviewerId,
    reviewedAt: now,
    reviewNote: decision.note,
    expiresAt: approving ? new Date(now.getTime() + days * DAY_MS) : null,
  };

  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.hostEmployerSafetyAttestation.updateMany({
      where: { id: attestationId, status: row.status as 'PENDING' | 'APPROVED' },
      data,
    });
    // The ABN goes onto the organisation only by the decision that won.
    if (result.count > 0 && approving && row.abn) {
      await tx.organization.update({ where: { id: row.organizationId }, data: { abn: row.abn } });
    }
    // Withdrawing an approval withdraws the organisation's standing, not one row
    // of it. A renewal approved in the last month leaves the old approval standing
    // beside the new one, and refusing only the row the reviewer opened would
    // leave the other one letting the organisation place apprentices, with the
    // reviewer told it was withdrawn.
    if (result.count > 0 && !approving && row.status === 'APPROVED') {
      await tx.hostEmployerSafetyAttestation.updateMany({
        where: { organizationId: row.organizationId, status: 'APPROVED', expiresAt: { gt: now }, id: { not: attestationId } },
        data,
      });
    }
    return result;
  });
  if (claimed.count === 0) throw new ApiError(409, 'Another member of staff has already decided this attestation.');

  return { before: row, after: { ...row, ...data } };
}
