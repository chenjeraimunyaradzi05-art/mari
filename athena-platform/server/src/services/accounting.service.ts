import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { assertOrgMembership } from '../utils/org-scope';

const toDecimal = (value: number) => new Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
export const TAX_TREATMENTS = ['GST', 'GST_FREE', 'EXPORT', 'INPUT_TAXED', 'BAS_EXCLUDED', 'CAPITAL', 'GST_COLLECTED', 'GST_PAID'] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

/**
 * Which set of books a caller may work in.
 *
 * An organisation's books need membership; personal books are the caller's own
 * rows with no organisation on them. Every read and write in this file that
 * accepts an organizationId resolves it through here, so that an id off the
 * wire can only narrow the caller's scope. Journal entries and accounts used to
 * take it on trust, which let anyone file into anyone's ledger.
 */
export type BooksScope =
  | { organizationId: string; userId?: undefined }
  | { organizationId: null; userId: string };

export async function booksScope(params: { organizationId?: string; userId: string }): Promise<BooksScope> {
  if (params.organizationId) {
    await assertOrgMembership(params.organizationId, params.userId);
    return { organizationId: params.organizationId };
  }
  return { userId: params.userId, organizationId: null };
}

/**
 * Verify user has access to an accounting account
 */
async function verifyAccountAccess(accountId: string, userId: string): Promise<void> {
  const account = await prisma.accountingAccount.findUnique({
    where: { id: accountId },
    select: { organizationId: true, userId: true },
  });
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  // Check if user owns the account directly
  if (account.userId === userId) {
    return;
  }
  // Check organization membership
  if (account.organizationId) {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: account.organizationId, userId },
    });
    if (!membership) {
      throw new ApiError(403, 'Access denied');
    }
  } else {
    // Personal account not owned by this user
    throw new ApiError(403, 'Access denied');
  }
}

/**
 * Verify user has access to a journal entry
 */
async function verifyJournalAccess(journalId: string, userId: string): Promise<void> {
  const journal = await prisma.journalEntry.findUnique({
    where: { id: journalId },
    select: { organizationId: true, userId: true },
  });
  if (!journal) {
    throw new ApiError(404, 'Journal entry not found');
  }
  // Check if user owns the journal directly
  if (journal.userId === userId) {
    return;
  }
  // Check organization membership
  if (journal.organizationId) {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: journal.organizationId, userId },
    });
    if (!membership) {
      throw new ApiError(403, 'Access denied');
    }
  } else {
    // Personal journal not owned by this user
    throw new ApiError(403, 'Access denied');
  }
}

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface JournalEntryInput {
  organizationId?: string;
  userId: string;
  description: string;
  reference?: string;
  entryDate?: string | Date;
  status?: 'DRAFT' | 'POSTED';
  lines: JournalLineInput[];
}

export async function listAccounts(params: {
  organizationId?: string;
  userId: string;
}) {
  // An organisation's chart of accounts is shared by its members, which is why
  // this lists the scope rather than the caller's own rows within it: the
  // reports below already read the whole organisation, and a chart that
  // disagreed with the trial balance was the confusing half of that.
  const scope = await booksScope(params);
  return prisma.accountingAccount.findMany({
    where: scope,
    orderBy: { name: 'asc' },
  });
}

export async function createAccount(data: {
  organizationId?: string;
  userId: string;
  name: string;
  code?: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  currency?: string;
  taxTreatment?: TaxTreatment;
}) {
  if (!data.name || !data.type) {
    throw new ApiError(400, 'Account name and type are required');
  }
  if (!ACCOUNT_TYPES.includes(data.type)) {
    throw new ApiError(400, 'Invalid account type');
  }
  if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
    throw new ApiError(400, 'Currency must be a 3-letter ISO code');
  }
  if (data.code !== undefined && data.code.trim().length === 0) {
    throw new ApiError(400, 'Account code cannot be empty');
  }
  if (data.taxTreatment && !TAX_TREATMENTS.includes(data.taxTreatment)) {
    throw new ApiError(400, 'Invalid tax treatment');
  }

  const scope = await booksScope(data);

  return prisma.accountingAccount.create({
    data: {
      organizationId: data.organizationId,
      // An organisation's account belongs to the organisation, not to whoever
      // typed it in, so only personal books carry an owner. Stamping both would
      // leave a member who has since left the organisation still able to edit it
      // through verifyAccountAccess's ownership branch.
      userId: scope.userId ?? null,
      name: data.name,
      code: data.code,
      type: data.type,
      currency: data.currency || 'AUD',
      taxTreatment: data.taxTreatment || 'GST',
    },
  });
}

export async function updateAccount(id: string, userId: string, data: {
  name?: string;
  code?: string;
  type?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  currency?: string;
  isActive?: boolean;
  taxTreatment?: TaxTreatment;
}) {
  await verifyAccountAccess(id, userId);
  if (data.taxTreatment && !TAX_TREATMENTS.includes(data.taxTreatment)) {
    throw new ApiError(400, 'Invalid tax treatment');
  }
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new ApiError(400, 'Account name cannot be empty');
  }
  if (data.type && !ACCOUNT_TYPES.includes(data.type)) {
    throw new ApiError(400, 'Invalid account type');
  }
  if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
    throw new ApiError(400, 'Currency must be a 3-letter ISO code');
  }
  if (data.code !== undefined && data.code.trim().length === 0) {
    throw new ApiError(400, 'Account code cannot be empty');
  }
  return prisma.accountingAccount.update({
    where: { id },
    data,
  });
}

export async function deleteAccount(id: string, userId: string) {
  await verifyAccountAccess(id, userId);
  return prisma.accountingAccount.delete({
    where: { id },
  });
}

function validateJournalLines(lines: JournalLineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new ApiError(400, 'Journal entry requires at least one line');
  }

  let debitTotal = 0;
  let creditTotal = 0;

  lines.forEach((line) => {
    if (!line.accountId || line.accountId.trim().length === 0) {
      throw new ApiError(400, 'Each line must include an account');
    }
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);

    if (debit < 0 || credit < 0) {
      throw new ApiError(400, 'Debit and credit must be non-negative');
    }
    if (debit === 0 && credit === 0) {
      throw new ApiError(400, 'Each line must have a debit or credit');
    }

    debitTotal += debit;
    creditTotal += credit;
  });

  if (Number(debitTotal.toFixed(2)) !== Number(creditTotal.toFixed(2))) {
    throw new ApiError(400, 'Total debits must equal total credits');
  }
}

/**
 * Every line has to cite an account out of the same set of books the entry is
 * being filed into. Scoping the entry alone is not enough: a balanced entry
 * could name any account id it liked and the organisation's trial balance,
 * which reads posted lines by account, would count it.
 */
async function assertLinesInScope(lines: JournalLineInput[], scope: BooksScope) {
  const accountIds = Array.from(new Set(lines.map((line) => line.accountId)));
  const accounts = await prisma.accountingAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, organizationId: true, userId: true },
  });
  if (accounts.length !== accountIds.length) {
    throw new ApiError(404, 'Account not found');
  }
  const belongs = (account: { organizationId: string | null; userId: string | null }) =>
    scope.organizationId
      ? account.organizationId === scope.organizationId
      : account.organizationId === null && account.userId === scope.userId;
  if (!accounts.every(belongs)) {
    throw new ApiError(403, 'Every line has to use an account from the same books the entry is filed into');
  }
}

export async function createJournalEntry(input: JournalEntryInput) {
  if (!input.description) {
    throw new ApiError(400, 'Journal description is required');
  }

  validateJournalLines(input.lines);

  const scope = await booksScope(input);
  await assertLinesInScope(input.lines, scope);

  const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();
  const status = input.status === 'POSTED' ? 'POSTED' : 'DRAFT';

  return prisma.journalEntry.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      description: input.description,
      reference: input.reference,
      entryDate,
      status,
      postedAt: status === 'POSTED' ? new Date() : undefined,
      lines: {
        create: input.lines.map((line) => ({
          accountId: line.accountId,
          debit: toDecimal(line.debit || 0),
          credit: toDecimal(line.credit || 0),
          description: line.description,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function listJournalEntries(params: {
  organizationId?: string;
  userId: string;
  status?: 'DRAFT' | 'POSTED' | 'VOID';
}) {
  // The organisation's journal, not the caller's slice of it. ANDing the
  // caller's own id used to hide every entry a member had not written
  // themselves — including anything filed into the books by someone who was
  // never a member — while the reports went on counting all of it.
  const scope = await booksScope(params);
  return prisma.journalEntry.findMany({
    where: {
      ...scope,
      status: params.status || undefined,
    },
    include: { lines: true },
    orderBy: { entryDate: 'desc' },
  });
}

export async function getJournalEntry(id: string, userId: string) {
  await verifyJournalAccess(id, userId);
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!entry) throw new ApiError(404, 'Journal entry not found');
  return entry;
}

export async function postJournalEntry(id: string, userId: string) {
  await verifyJournalAccess(id, userId);
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!entry) throw new ApiError(404, 'Journal entry not found');
  if (entry.status === 'POSTED') return entry;

  validateJournalLines(
    entry.lines.map((line) => ({
      accountId: line.accountId,
      debit: Number(line.debit),
      credit: Number(line.credit),
      description: line.description || undefined,
    }))
  );

  return prisma.journalEntry.update({
    where: { id },
    data: { status: 'POSTED', postedAt: new Date() },
    include: { lines: true },
  });
}

export async function voidJournalEntry(id: string, userId: string) {
  await verifyJournalAccess(id, userId);
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
  });
  if (!entry) throw new ApiError(404, 'Journal entry not found');

  return prisma.journalEntry.update({
    where: { id },
    data: { status: 'VOID' },
  });
}

export async function updateJournalEntry(id: string, userId: string, data: {
  description?: string;
  reference?: string;
  entryDate?: string | Date;
}) {
  await verifyJournalAccess(id, userId);
  const entry = await prisma.journalEntry.findUnique({ where: { id } });
  if (!entry) throw new ApiError(404, 'Journal entry not found');
  if (entry.status !== 'DRAFT') {
    throw new ApiError(400, 'Only draft journal entries can be edited');
  }

  return prisma.journalEntry.update({
    where: { id },
    data: {
      description: data.description,
      reference: data.reference,
      entryDate: data.entryDate ? new Date(data.entryDate) : undefined,
    },
    include: { lines: true },
  });
}

// ===========================================
// REPORTS
// ===========================================
// Every report reads the same way: posted journal lines, inside the books the
// caller may see, which is what booksScope above resolves.

export interface AccountTotal {
  accountId: string;
  code: string | null;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Debits and credits summed per account, over posted entries dated in the window.
async function accountTotals(
  scope: { organizationId?: string | null; userId?: string },
  range: { from?: Date; to?: Date }
): Promise<AccountTotal[]> {
  const entryDate =
    range.from || range.to ? { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } : undefined;
  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { status: 'POSTED', ...scope, ...(entryDate ? { entryDate } : {}) } },
    include: { account: { select: { id: true, name: true, code: true, type: true } } },
  });

  const totals = new Map<string, AccountTotal>();
  for (const line of lines) {
    const existing = totals.get(line.accountId) ?? {
      accountId: line.accountId,
      code: line.account.code ?? null,
      name: line.account.name,
      type: line.account.type,
      debit: 0,
      credit: 0,
    };
    existing.debit = round2(existing.debit + Number(line.debit || 0));
    existing.credit = round2(existing.credit + Number(line.credit || 0));
    totals.set(line.accountId, existing);
  }
  return Array.from(totals.values()).sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name));
}

export async function getTrialBalance(params: { organizationId?: string; userId: string }) {
  const scope = await booksScope(params);
  return accountTotals(scope, {});
}

/**
 * Revenue less expenses over a period. Revenue accounts carry credit
 * balances and expense accounts debit balances, so each side is signed to
 * read as a positive amount.
 */
export async function getProfitAndLoss(params: { organizationId?: string; userId: string; from?: Date; to?: Date }) {
  const scope = await booksScope(params);
  const totals = await accountTotals(scope, { from: params.from, to: params.to });
  const revenue = totals.filter((t) => t.type === 'REVENUE').map((t) => ({ ...t, amount: round2(t.credit - t.debit) }));
  const expenses = totals.filter((t) => t.type === 'EXPENSE').map((t) => ({ ...t, amount: round2(t.debit - t.credit) }));
  const totalRevenue = round2(revenue.reduce((n, r) => n + r.amount, 0));
  const totalExpenses = round2(expenses.reduce((n, e) => n + e.amount, 0));
  return {
    period: { from: params.from ?? null, to: params.to ?? null },
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netProfit: round2(totalRevenue - totalExpenses),
  };
}

/**
 * What is owned, owed and left over as at a date. Profit to date that has not
 * been closed to an equity account is shown as retained earnings, which is
 * what makes the two sides balance.
 */
export async function getBalanceSheet(params: { organizationId?: string; userId: string; asOf?: Date }) {
  const scope = await booksScope(params);
  const totals = await accountTotals(scope, { to: params.asOf });
  const assets = totals.filter((t) => t.type === 'ASSET').map((t) => ({ ...t, amount: round2(t.debit - t.credit) }));
  const liabilities = totals.filter((t) => t.type === 'LIABILITY').map((t) => ({ ...t, amount: round2(t.credit - t.debit) }));
  const equity = totals.filter((t) => t.type === 'EQUITY').map((t) => ({ ...t, amount: round2(t.credit - t.debit) }));
  const retainedEarnings = round2(
    totals.filter((t) => t.type === 'REVENUE').reduce((n, t) => n + (t.credit - t.debit), 0) -
      totals.filter((t) => t.type === 'EXPENSE').reduce((n, t) => n + (t.debit - t.credit), 0)
  );
  const totalAssets = round2(assets.reduce((n, a) => n + a.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((n, l) => n + l.amount, 0));
  const totalEquity = round2(equity.reduce((n, e) => n + e.amount, 0) + retainedEarnings);
  return {
    asOf: params.asOf ?? null,
    assets,
    liabilities,
    equity,
    retainedEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    // Zero when every posted entry balanced, which the posting step enforces.
    difference: round2(totalAssets - totalLiabilities - totalEquity),
  };
}
