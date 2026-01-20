import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

const toDecimal = (value: number) => new Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface JournalEntryInput {
  organizationId?: string;
  userId?: string;
  description: string;
  reference?: string;
  entryDate?: string | Date;
  status?: 'DRAFT' | 'POSTED';
  lines: JournalLineInput[];
}

export async function listAccounts(params: {
  organizationId?: string;
  userId?: string;
}) {
  return prisma.accountingAccount.findMany({
    where: {
      organizationId: params.organizationId || undefined,
      userId: params.userId || undefined,
    },
    orderBy: { name: 'asc' },
  });
}

export async function createAccount(data: {
  organizationId?: string;
  userId?: string;
  name: string;
  code?: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  currency?: string;
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

  return prisma.accountingAccount.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      name: data.name,
      code: data.code,
      type: data.type,
      currency: data.currency || 'AUD',
    },
  });
}

export async function updateAccount(id: string, data: {
  name?: string;
  code?: string;
  type?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  currency?: string;
  isActive?: boolean;
}) {
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

export async function deleteAccount(id: string) {
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

export async function createJournalEntry(input: JournalEntryInput) {
  if (!input.description) {
    throw new ApiError(400, 'Journal description is required');
  }

  validateJournalLines(input.lines);

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
  userId?: string;
  status?: 'DRAFT' | 'POSTED' | 'VOID';
}) {
  return prisma.journalEntry.findMany({
    where: {
      organizationId: params.organizationId || undefined,
      userId: params.userId || undefined,
      status: params.status || undefined,
    },
    include: { lines: true },
    orderBy: { entryDate: 'desc' },
  });
}

export async function getJournalEntry(id: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!entry) throw new ApiError(404, 'Journal entry not found');
  return entry;
}

export async function postJournalEntry(id: string) {
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

export async function voidJournalEntry(id: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
  });
  if (!entry) throw new ApiError(404, 'Journal entry not found');

  return prisma.journalEntry.update({
    where: { id },
    data: { status: 'VOID' },
  });
}

export async function updateJournalEntry(id: string, data: {
  description?: string;
  reference?: string;
  entryDate?: string | Date;
}) {
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

export async function getTrialBalance(params: {
  organizationId?: string;
  userId?: string;
}) {
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        status: 'POSTED',
        organizationId: params.organizationId || undefined,
        userId: params.userId || undefined,
      },
    },
    include: { account: true },
  });

  const balances = new Map<string, { accountId: string; name: string; type: string; debit: number; credit: number }>();

  lines.forEach((line) => {
    const key = line.accountId;
    const existing = balances.get(key) || {
      accountId: line.accountId,
      name: line.account.name,
      type: line.account.type,
      debit: 0,
      credit: 0,
    };

    existing.debit += Number(line.debit || 0);
    existing.credit += Number(line.credit || 0);
    balances.set(key, existing);
  });

  return Array.from(balances.values());
}
