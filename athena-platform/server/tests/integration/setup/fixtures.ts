/**
 * Two organisations with everything an organisation keeps, and the people who
 * are, and are not, in them. What tenant-isolation.test.ts runs against.
 *
 * ## The people
 *
 *   a   accepted OWNER of X. Files and edits its books; reads its applicants.
 *   a2  accepted VIEWER of X. A colleague: in the books, not among the hiring staff.
 *   b   accepted OWNER of Y, the other tenant.
 *   c   invited to X as an ADMIN with posting and team rights, and has not answered.
 *       The membership row exists, which is exactly the trap: it grants nothing.
 *   d   a bookkeeper who filed X's journal entries and its draft return, and was
 *       then removed. Her id is still stamped on those rows.
 *   zx  an applicant to X's listing and to X's apprenticeship, with a résumé on disk.
 *   zy  the same for Y.
 *
 * ## What each organisation keeps
 *
 * A chart of accounts, a posted and a draft journal entry, an item of stock with
 * a location and a movement, a draft tax return, a money record, a job with an
 * application carrying a cover letter and a résumé, an apprenticeship with an
 * application, and the team itself. Every free-text field of every row carries
 * the organisation's sentinel, so a response that shows another tenant's data
 * is recognised by a substring and not by a judgement about structure.
 *
 * Nothing here is mocked and nothing is shared between the two sides: X and Y are
 * built by the same function from different people, so a refusal that works one
 * way and not the other shows up as a difference.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '../../../src/utils/prisma';
import { createMember } from './harness';

export type Member = Awaited<ReturnType<typeof createMember>>;
export type Side = 'x' | 'y';

/** Words that exist only in one organisation's rows. */
export const SENTINEL: Record<Side, string> = {
  x: 'zebra-ledger-x-4417',
  y: 'zebra-ledger-y-9052',
};

export interface OrganisationRows {
  side: Side;
  organizationId: string;
  sentinel: string;
  ownerId: string;
  ownerEmail: string;
  /** Who filed the draft return and the journal entries: the owner for Y, the removed bookkeeper for X. */
  filerId: string;
  cashAccountId: string;
  salesAccountId: string;
  postedJournalId: string;
  draftJournalId: string;
  itemId: string;
  locationId: string;
  stockMovementId: string;
  taxReturnId: string;
  moneyTransactionId: string;
  jobId: string;
  jobApplicationId: string;
  apprenticeshipId: string;
  apprenticeshipApplicationId: string;
  applicantId: string;
  resumeKey: string;
  /** The row that says a member is on the team, for a probe that tries to remove one. */
  teamMemberRowId: string;
}

export interface TenantWorld {
  members: { a: Member; a2: Member; b: Member; c: Member; d: Member; zx: Member; zy: Member };
  x: OrganisationRows;
  y: OrganisationRows;
  /** A's own invoice, kept personally: an organisation colleague has no claim on it. */
  invoiceId: string;
  invoiceNumber: string;
}

const PERIOD_START = new Date('2026-07-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-09-30T23:59:59.000Z');
const ENTRY_DATE = new Date('2026-08-15T00:00:00.000Z');

async function createOrganisation(label: string) {
  return prisma.organization.create({
    data: { name: `${label} Pty Ltd`, slug: `${label.toLowerCase()}-${randomUUID()}`, type: 'company' },
  });
}

export const resumeFilePath = (key: string) => path.resolve(process.cwd(), 'uploads', key);

async function seedOrganisation(params: {
  side: Side;
  organizationId: string;
  owner: Member;
  filer: Member;
  applicant: Member;
}): Promise<OrganisationRows> {
  const { side, organizationId, owner, filer, applicant } = params;
  const sentinel = SENTINEL[side];

  const cash = await prisma.accountingAccount.create({
    data: { organizationId, name: `Cash ${sentinel}`, code: '1000', type: 'ASSET' },
  });
  const sales = await prisma.accountingAccount.create({
    data: { organizationId, name: `Sales ${sentinel}`, code: '4000', type: 'REVENUE' },
  });

  const balancedLines = (amount: number) => ({
    create: [
      { accountId: cash.id, debit: amount, credit: 0 },
      { accountId: sales.id, debit: 0, credit: amount },
    ],
  });
  const posted = await prisma.journalEntry.create({
    data: {
      organizationId,
      userId: filer.id,
      description: `${sentinel} sale`,
      status: 'POSTED',
      postedAt: ENTRY_DATE,
      entryDate: ENTRY_DATE,
      lines: balancedLines(110),
    },
  });
  const draft = await prisma.journalEntry.create({
    data: {
      organizationId,
      userId: filer.id,
      description: `${sentinel} draft`,
      status: 'DRAFT',
      entryDate: ENTRY_DATE,
      lines: balancedLines(55),
    },
  });

  const item = await prisma.inventoryItem.create({
    data: { organizationId, userId: null, sku: `SKU-${sentinel}`, name: `Widget ${sentinel}`, cost: 12, price: 30 },
  });
  const location = await prisma.inventoryLocation.create({
    data: { organizationId, userId: null, name: `Warehouse ${sentinel}`, code: 'WH1' },
  });
  const movement = await prisma.inventoryTransaction.create({
    data: {
      itemId: item.id,
      locationId: location.id,
      createdByUserId: owner.id,
      type: 'PURCHASE',
      quantity: 10,
      unitCost: 12,
      totalCost: 120,
      reference: `PO ${sentinel}`,
    },
  });

  const taxReturn = await prisma.taxReturn.create({
    data: {
      organizationId,
      userId: filer.id,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      totalSales: 1000,
      totalTax: 100,
      reference: `BAS ${sentinel}`,
    },
  });

  const money = await prisma.moneyTransaction.create({
    data: { organizationId, userId: owner.id, amount: 25, type: 'PAYMENT', reference: `Receipt ${sentinel}` },
  });

  // A résumé on disk, under the key the upload route would give it, and attached to both applications.
  const resumeKey = `resumes/${applicant.id}/cv-${sentinel}.pdf`;
  await fs.promises.mkdir(path.dirname(resumeFilePath(resumeKey)), { recursive: true });
  await fs.promises.writeFile(resumeFilePath(resumeKey), `%PDF-1.4 ${sentinel}`);
  const resumeUrl = `http://localhost:5000/api/media/local/${resumeKey}`;

  const job = await prisma.job.create({
    data: {
      title: `Engineer ${sentinel}`,
      slug: `engineer-${side}-${randomUUID()}`,
      description: 'Build things.',
      organizationId,
      postedById: owner.id,
      status: 'ACTIVE',
    },
  });
  const jobApplication = await prisma.jobApplication.create({
    data: {
      jobId: job.id,
      userId: applicant.id,
      status: 'PENDING',
      coverLetter: `${sentinel} cover letter`,
      resumeUrl,
    },
  });

  const apprenticeship = await prisma.apprenticeship.create({
    data: {
      title: `Apprentice ${sentinel}`,
      slug: `apprentice-${side}-${randomUUID()}`,
      description: 'Learn the trade.',
      framework: 'ICT',
      level: 'CERTIFICATE_IV',
      durationMonths: 24,
      rtoId: organizationId,
      status: 'OPEN',
      positions: 2,
    },
  });
  const apprenticeshipApplication = await prisma.apprenticeshipApplication.create({
    data: {
      apprenticeshipId: apprenticeship.id,
      userId: applicant.id,
      status: 'SUBMITTED',
      coverLetter: `${sentinel} apprenticeship letter`,
      resumeUrl,
    },
  });

  const teamRow = await prisma.organizationMember.findFirstOrThrow({
    where: { organizationId, userId: owner.id },
    select: { id: true },
  });

  return {
    side,
    organizationId,
    sentinel,
    ownerId: owner.id,
    ownerEmail: owner.email,
    filerId: filer.id,
    cashAccountId: cash.id,
    salesAccountId: sales.id,
    postedJournalId: posted.id,
    draftJournalId: draft.id,
    itemId: item.id,
    locationId: location.id,
    stockMovementId: movement.id,
    taxReturnId: taxReturn.id,
    moneyTransactionId: money.id,
    jobId: job.id,
    jobApplicationId: jobApplication.id,
    apprenticeshipId: apprenticeship.id,
    apprenticeshipApplicationId: apprenticeshipApplication.id,
    applicantId: applicant.id,
    resumeKey,
    teamMemberRowId: teamRow.id,
  };
}

export async function seedTenantWorld(passwordHash: string): Promise<TenantWorld> {
  const person = (label: string) =>
    createMember({
      email: `${label}-${randomUUID()}@athena.test`.toLowerCase(),
      firstName: label,
      emailVerified: true,
      passwordHash,
    });

  const [a, a2, b, c, d, zx, zy] = await Promise.all([
    person('Ada'),
    person('Alma'),
    person('Bea'),
    person('Cleo'),
    person('Dot'),
    person('Zoe'),
    person('Zara'),
  ]);

  const orgX = await createOrganisation('Xylo');
  const orgY = await createOrganisation('Yarra');

  const accepted = new Date('2026-06-01T00:00:00.000Z');
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: orgX.id, userId: a.id, role: 'OWNER', canPostJobs: true, canManageTeam: true, acceptedAt: accepted },
      { organizationId: orgX.id, userId: a2.id, role: 'VIEWER', acceptedAt: accepted },
      // The bookkeeper is a member while she files, and is removed below.
      { organizationId: orgX.id, userId: d.id, role: 'ADMIN', canPostJobs: true, acceptedAt: accepted },
      // Invited with every right, and has not said yes.
      { organizationId: orgX.id, userId: c.id, role: 'ADMIN', canPostJobs: true, canManageTeam: true, acceptedAt: null },
      { organizationId: orgY.id, userId: b.id, role: 'OWNER', canPostJobs: true, canManageTeam: true, acceptedAt: accepted },
    ],
  });

  const x = await seedOrganisation({ side: 'x', organizationId: orgX.id, owner: a, filer: d, applicant: zx });
  const y = await seedOrganisation({ side: 'y', organizationId: orgY.id, owner: b, filer: b, applicant: zy });

  // She leaves. What she filed keeps her id.
  await prisma.organizationMember.deleteMany({ where: { organizationId: orgX.id, userId: d.id } });

  const invoiceNumber = `INV-${SENTINEL.x}`;
  const invoice = await prisma.invoice.create({
    data: { invoiceNumber, userId: a.id, amount: 120, currency: 'AUD', status: 'PAID', issuedAt: new Date() },
  });

  return { members: { a, a2, b, c, d, zx, zy }, x, y, invoiceId: invoice.id, invoiceNumber };
}

/** Removes the résumé files a world wrote. */
export async function removeResumeFiles(world: TenantWorld | undefined): Promise<void> {
  if (!world) return;
  for (const rows of [world.x, world.y]) {
    await fs.promises.rm(path.resolve(process.cwd(), 'uploads', 'resumes', rows.applicantId), {
      recursive: true,
      force: true,
    });
  }
}

/**
 * Every row of every table an organisation keeps, with the columns an attack
 * would change, as one string. Taken before the refusals and after, so "refused"
 * is shown to mean "nothing happened" and not only "answered 403".
 */
export async function snapshotTenantRows(): Promise<string> {
  const [
    accounts,
    journals,
    lines,
    items,
    locations,
    movements,
    returns,
    money,
    jobs,
    jobApplications,
    apprenticeships,
    apprenticeshipApplications,
    members,
  ] = await Promise.all([
    prisma.accountingAccount.findMany({ orderBy: { id: 'asc' } }),
    prisma.journalEntry.findMany({ orderBy: { id: 'asc' } }),
    prisma.journalLine.findMany({ orderBy: { id: 'asc' } }),
    prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } }),
    prisma.inventoryLocation.findMany({ orderBy: { id: 'asc' } }),
    prisma.inventoryTransaction.findMany({ orderBy: { id: 'asc' } }),
    prisma.taxReturn.findMany({ orderBy: { id: 'asc' } }),
    prisma.moneyTransaction.findMany({ orderBy: { id: 'asc' } }),
    prisma.job.findMany({ orderBy: { id: 'asc' } }),
    prisma.jobApplication.findMany({ orderBy: { id: 'asc' } }),
    prisma.apprenticeship.findMany({ orderBy: { id: 'asc' } }),
    prisma.apprenticeshipApplication.findMany({ orderBy: { id: 'asc' } }),
    prisma.organizationMember.findMany({ orderBy: { id: 'asc' } }),
  ]);

  return JSON.stringify({
    accounts,
    journals,
    lines,
    items,
    locations,
    movements,
    returns,
    money,
    jobs,
    jobApplications,
    apprenticeships,
    apprenticeshipApplications,
    members,
  });
}
