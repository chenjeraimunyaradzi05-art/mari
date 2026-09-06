/**
 * Bank feeds.
 *
 * Two ways in. With BASIQ_API_KEY set, a person consents on Basiq's own
 * page (Basiq is a CDR-accredited data recipient in Australia) and the
 * platform pulls their accounts and transactions; no bank credential ever
 * touches ATHENA. Without it, or for a bank Basiq cannot reach, a statement
 * export can be pasted in. Either way the result is the same: bank accounts
 * with balances, and transactions that are categorised against the ledger
 * and posted as balanced journal entries.
 */

import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { createJournalEntry } from './accounting.service';

const BASIQ_BASE = 'https://au-api.basiq.io';
const BASIQ_CONSENT = 'https://consent.basiq.io/home';
const TIMEOUT_MS = 20000;
const PENDING_INSTITUTION = 'Awaiting bank consent';
export const MAX_IMPORT_ROWS = 5000;
const MAX_SYNC_TRANSACTIONS = 5000;

type FetchInit = Parameters<typeof fetch>[1];
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

export const isBasiqConfigured = () => Boolean(process.env.BASIQ_API_KEY);

const sha1 = (text: string) => crypto.createHash('sha1').update(text).digest('hex');

// ---------------------------------------------------------------------------
// Parsing helpers, shared by the Basiq mapping and the statement import
// ---------------------------------------------------------------------------

/** "1,200.00", "$4.50", "(12.00)", "12.00 DR" and plain numbers, to signed cents. */
export const toCents = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null;
  let text = String(value ?? '').trim();
  if (!text) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1);
  }
  if (/\bDR\b/i.test(text)) sign = -1;
  text = text.replace(/\b(DR|CR)\b/gi, '').replace(/[^0-9.-]/g, '');
  if (!text || text === '-' || text === '.') return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? Math.round(amount * 100) * sign : null;
};

const utcDate = (year: string, month: string, day: string): Date | null => {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) || date.getUTCMonth() !== Number(month) - 1 ? null : date;
};

/** ISO dates, and day-first dates as Australian banks export them. */
export const parseStatementDate = (value: unknown): Date | null => {
  const text = String(value ?? '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return utcDate(match[1], match[2], match[3]);
  match = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (match) return utcDate(match[3], match[2], match[1]);
  return null;
};

const maskAccountNo = (raw: unknown): { accountNumber: string | null; bsb: string | null } => {
  const text = String(raw ?? '').trim();
  if (!text) return { accountNumber: null, bsb: null };
  const withBsb = text.match(/^(\d{3})-?(\d{3})\s+(\S+)$/);
  const digits = (withBsb ? withBsb[3] : text).replace(/\D/g, '');
  return {
    accountNumber: digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null,
    bsb: withBsb ? `${withBsb[1]}-${withBsb[2]}` : null,
  };
};

const normaliseDescription = (text: string) => text.toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

// ---------------------------------------------------------------------------
// Basiq client
// ---------------------------------------------------------------------------

let serverToken: { value: string; expiresAt: number } | null = null;

async function fetchWithTimeout(url: string, init: FetchInit): Promise<FetchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: any) {
    throw new ApiError(502, error?.name === 'AbortError' ? 'The bank feed provider did not answer in time' : 'The bank feed provider could not be reached');
  } finally {
    clearTimeout(timer);
  }
}

async function basiqToken(scope: 'SERVER_ACCESS' | 'CLIENT_ACCESS', basiqUserId?: string): Promise<string> {
  if (scope === 'SERVER_ACCESS' && serverToken && serverToken.expiresAt > Date.now() + 60_000) return serverToken.value;
  const body = new URLSearchParams({ scope });
  if (basiqUserId) body.set('userId', basiqUserId);
  const response = await fetchWithTimeout(`${BASIQ_BASE}/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${process.env.BASIQ_API_KEY}`, 'basiq-version': '3.0', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json: any = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token) {
    logger.warn('Basiq token request failed', { status: response.status });
    throw new ApiError(502, 'The bank feed provider refused the server credentials');
  }
  if (scope === 'SERVER_ACCESS') {
    serverToken = { value: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  }
  return json.access_token as string;
}

async function basiq(path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const url = path.startsWith('http') ? path : `${BASIQ_BASE}${path}`;
  if (!url.startsWith(BASIQ_BASE)) throw new ApiError(502, 'The bank feed provider pointed somewhere unexpected');
  const token = await basiqToken('SERVER_ACCESS');
  const response = await fetchWithTimeout(url, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'basiq-version': '3.0',
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (response.status === 204) return null;
  const json: any = await response.json().catch(() => null);
  if (!response.ok) {
    logger.warn('Basiq request failed', { path, status: response.status });
    throw new ApiError(502, json?.data?.[0]?.detail || json?.data?.[0]?.title || `The bank feed provider answered with status ${response.status}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

async function ownedConnection(userId: string, connectionId: string) {
  const connection = await prisma.bankConnection.findFirst({ where: { id: connectionId, userId } });
  if (!connection) throw new ApiError(404, 'Bank connection not found');
  return connection;
}

async function ownedAccount(userId: string, accountId: string) {
  const account = await prisma.bankAccount.findFirst({ where: { id: accountId, connection: { userId } }, include: { connection: true } });
  if (!account) throw new ApiError(404, 'Bank account not found');
  return account;
}

async function ownedTransaction(userId: string, transactionId: string) {
  const transaction = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, bankAccount: { connection: { userId } } },
    include: { bankAccount: { include: { connection: true } } },
  });
  if (!transaction) throw new ApiError(404, 'Transaction not found');
  return transaction;
}

async function assertLedgerAccess(userId: string, ledgerAccountId: string, allowedTypes?: string[]) {
  const account = await prisma.accountingAccount.findUnique({ where: { id: ledgerAccountId } });
  if (!account) throw new ApiError(404, 'Ledger account not found');
  if (account.userId !== userId) {
    if (!account.organizationId) throw new ApiError(403, 'That ledger account is not yours');
    const membership = await prisma.organizationMember.findFirst({ where: { organizationId: account.organizationId, userId } });
    if (!membership) throw new ApiError(403, 'That ledger account is not yours');
  }
  if (allowedTypes && !allowedTypes.includes(account.type)) {
    throw new ApiError(400, `That ledger account has to be one of: ${allowedTypes.map((t) => t.toLowerCase()).join(', ')}`);
  }
  return account;
}

// ---------------------------------------------------------------------------
// Basiq consent and sync
// ---------------------------------------------------------------------------

async function basiqUserFor(userId: string): Promise<string> {
  const existing = await prisma.bankConnection.findFirst({ where: { userId, provider: 'BASIQ', providerUserId: { not: null } }, select: { providerUserId: true } });
  if (existing?.providerUserId) return existing.providerUserId;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new ApiError(404, 'User not found');
  const created = await basiq('/users', { method: 'POST', body: { email: user.email } });
  if (!created?.id) throw new ApiError(502, 'The bank feed provider did not create a user');
  return String(created.id);
}

/** Start a consent: the person finishes it on Basiq's page, then syncs. */
export async function startBasiqConsent(userId: string) {
  if (!isBasiqConfigured()) throw new ApiError(503, 'Bank feeds are not configured on this server; paste a statement export instead');
  const providerUserId = await basiqUserFor(userId);
  const placeholder = await prisma.bankConnection.findFirst({ where: { userId, provider: 'BASIQ', providerConnectionId: null } });
  if (!placeholder) {
    await prisma.bankConnection.create({ data: { userId, provider: 'BASIQ', institution: PENDING_INSTITUTION, status: 'PENDING', providerUserId } });
  }
  const clientToken = await basiqToken('CLIENT_ACCESS', providerUserId);
  return { consentUrl: `${BASIQ_CONSENT}?token=${encodeURIComponent(clientToken)}&action=connect` };
}

export async function syncBasiq(userId: string) {
  if (!isBasiqConfigured()) throw new ApiError(503, 'Bank feeds are not configured on this server');
  const anchor = await prisma.bankConnection.findFirst({ where: { userId, provider: 'BASIQ', providerUserId: { not: null } } });
  if (!anchor?.providerUserId) throw new ApiError(400, 'Connect a bank first');
  const providerUserId = anchor.providerUserId;

  const institutionNames = new Map<string, string>();
  const institutionName = async (id: string) => {
    if (!institutionNames.has(id)) {
      try {
        const institution = await basiq(`/institutions/${encodeURIComponent(id)}`);
        institutionNames.set(id, institution?.shortName || institution?.name || id);
      } catch {
        institutionNames.set(id, id);
      }
    }
    return institutionNames.get(id)!;
  };

  const remoteConnections: any[] = (await basiq(`/users/${providerUserId}/connections`))?.data ?? [];
  const connections: Array<{ id: string; providerConnectionId: string | null }> = [];
  for (const remote of remoteConnections) {
    const status = remote.status === 'active' ? 'ACTIVE' : remote.status === 'invalid' ? 'ERROR' : 'PENDING';
    const data = {
      institution: await institutionName(String(remote.institution?.id || 'unknown')),
      status: status as 'ACTIVE' | 'ERROR' | 'PENDING',
      providerUserId,
      providerConnectionId: String(remote.id),
      lastSyncedAt: new Date(),
      lastError: remote.status === 'invalid' ? 'The bank rejected the connection; reconnect to continue' : null,
    };
    const existing = await prisma.bankConnection.findFirst({ where: { userId, provider: 'BASIQ', providerConnectionId: String(remote.id) } });
    const placeholder = existing ? null : await prisma.bankConnection.findFirst({ where: { userId, provider: 'BASIQ', providerConnectionId: null } });
    const target = existing ?? placeholder;
    const row = target
      ? await prisma.bankConnection.update({ where: { id: target.id }, data })
      : await prisma.bankConnection.create({ data: { userId, provider: 'BASIQ', ...data } });
    connections.push({ id: row.id, providerConnectionId: row.providerConnectionId });
  }

  const remoteAccounts: any[] = (await basiq(`/users/${providerUserId}/accounts`))?.data ?? [];
  let transactionsImported = 0;
  for (const remote of remoteAccounts) {
    const connection = connections.find((c) => c.providerConnectionId === String(remote.connection));
    if (!connection) continue;
    const masked = maskAccountNo(remote.accountNo);
    const shape = {
      name: String(remote.name || remote.class?.product || 'Account').slice(0, 120),
      type: remote.class?.type ? String(remote.class.type) : null,
      currency: String(remote.currency || 'AUD').toUpperCase(),
      balanceCents: toCents(remote.balance) ?? 0,
      availableCents: toCents(remote.availableFunds),
    };
    const account = await prisma.bankAccount.upsert({
      where: { connectionId_providerAccountId: { connectionId: connection.id, providerAccountId: String(remote.id) } },
      create: { connectionId: connection.id, providerAccountId: String(remote.id), ...masked, ...shape },
      update: shape,
    });

    const batch: Array<{ bankAccountId: string; providerTransactionId: string; fingerprint: string; postedAt: Date; description: string; amountCents: number; category: string | null }> = [];
    let path: string | null = `/users/${providerUserId}/transactions?limit=500&filter=${encodeURIComponent(`account.id.eq('${remote.id}')`)}`;
    while (path && batch.length < MAX_SYNC_TRANSACTIONS) {
      const page: any = await basiq(path);
      for (const t of page?.data ?? []) {
        if (t.status && t.status !== 'posted') continue;
        let cents = toCents(t.amount);
        if (cents === null) continue;
        if (t.direction === 'debit') cents = -Math.abs(cents);
        if (t.direction === 'credit') cents = Math.abs(cents);
        const postedAt = new Date(t.postDate || t.transactionDate);
        if (Number.isNaN(postedAt.getTime())) continue;
        batch.push({
          bankAccountId: account.id,
          providerTransactionId: String(t.id),
          fingerprint: sha1(`basiq:${t.id}`),
          postedAt,
          description: String(t.description || 'Transaction').slice(0, 300),
          amountCents: cents,
          category: t.subClass?.title || t.class || null,
        });
      }
      const next = page?.links?.next;
      path = typeof next === 'string' && next !== path ? next : null;
    }
    if (batch.length) {
      const result = await prisma.bankTransaction.createMany({ data: batch, skipDuplicates: true });
      transactionsImported += result.count;
    }
  }

  return { connections: connections.length, accounts: remoteAccounts.length, transactionsImported };
}

// ---------------------------------------------------------------------------
// Statement import
// ---------------------------------------------------------------------------

export interface StatementRow {
  date: string | number;
  description: string;
  amount: string | number;
  balance?: string | number;
}

export async function importStatement(userId: string, input: { accountName: string; organizationId?: string; rows: StatementRow[] }) {
  const name = String(input.accountName || '').trim().slice(0, 120) || 'Imported account';
  if (!Array.isArray(input.rows) || input.rows.length === 0) throw new ApiError(400, 'There are no rows to import');
  if (input.rows.length > MAX_IMPORT_ROWS) throw new ApiError(400, `Import at most ${MAX_IMPORT_ROWS.toLocaleString('en-AU')} rows at a time`);

  const connection =
    (await prisma.bankConnection.findFirst({ where: { userId, provider: 'CSV' } })) ??
    (await prisma.bankConnection.create({ data: { userId, organizationId: input.organizationId ?? null, provider: 'CSV', institution: 'Imported statements', status: 'ACTIVE' } }));
  const providerAccountId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'account';
  const account = await prisma.bankAccount.upsert({
    where: { connectionId_providerAccountId: { connectionId: connection.id, providerAccountId } },
    create: { connectionId: connection.id, providerAccountId, name, type: 'transaction' },
    update: {},
  });

  const data: Array<{ bankAccountId: string; fingerprint: string; postedAt: Date; description: string; amountCents: number }> = [];
  let skipped = 0;
  let closingBalance: number | null = null;
  let closingDate = 0;
  for (const row of input.rows) {
    const postedAt = parseStatementDate(row.date);
    const amountCents = toCents(row.amount);
    const description = String(row.description || '').trim().slice(0, 300);
    if (!postedAt || amountCents === null || !description) {
      skipped += 1;
      continue;
    }
    data.push({
      bankAccountId: account.id,
      fingerprint: sha1(`${postedAt.toISOString().slice(0, 10)}|${description.toLowerCase()}|${amountCents}`),
      postedAt,
      description,
      amountCents,
    });
    if (row.balance !== undefined && row.balance !== '' && postedAt.getTime() >= closingDate) {
      const balance = toCents(row.balance);
      if (balance !== null) {
        closingBalance = balance;
        closingDate = postedAt.getTime();
      }
    }
  }

  const result = data.length ? await prisma.bankTransaction.createMany({ data, skipDuplicates: true }) : { count: 0 };
  if (closingBalance !== null) await prisma.bankAccount.update({ where: { id: account.id }, data: { balanceCents: closingBalance } });
  await prisma.bankConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: new Date() } });
  return { accountId: account.id, imported: result.count, duplicates: data.length - result.count, skipped };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function listConnections(userId: string) {
  return prisma.bankConnection.findMany({
    where: { userId },
    include: {
      accounts: {
        include: { ledgerAccount: { select: { id: true, name: true, code: true } }, _count: { select: { transactions: true } } },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listTransactions(
  userId: string,
  params: { accountId?: string; status?: string; from?: Date; to?: Date; limit?: number }
) {
  const postedAt = params.from || params.to ? { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } : undefined;
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccount: { connection: { userId }, ...(params.accountId ? { id: params.accountId } : {}) },
      ...(params.status ? { status: params.status as any } : {}),
      ...(postedAt ? { postedAt } : {}),
    },
    include: { bankAccount: { select: { id: true, name: true, ledgerAccountId: true } }, ledgerAccount: { select: { id: true, name: true, code: true } } },
    orderBy: { postedAt: 'desc' },
    take: Math.min(Math.max(params.limit ?? 200, 1), 1000),
  });

  // What this person chose last time for the same kind of line, as a suggestion.
  const unreviewed = transactions.filter((t) => t.status === 'UNREVIEWED');
  const suggestions = new Map<string, string>();
  if (unreviewed.length) {
    const previous = await prisma.bankTransaction.findMany({
      where: { bankAccount: { connection: { userId } }, status: { in: ['CATEGORISED', 'POSTED'] }, ledgerAccountId: { not: null } },
      select: { description: true, ledgerAccountId: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    for (const p of previous) {
      const key = normaliseDescription(p.description);
      if (key && p.ledgerAccountId && !suggestions.has(key)) suggestions.set(key, p.ledgerAccountId);
    }
  }
  return transactions.map((t) => ({
    ...t,
    suggestedLedgerAccountId: t.status === 'UNREVIEWED' ? suggestions.get(normaliseDescription(t.description)) ?? null : null,
  }));
}

// ---------------------------------------------------------------------------
// Categorising and posting
// ---------------------------------------------------------------------------

export async function linkLedgerAccount(userId: string, bankAccountId: string, ledgerAccountId: string | null) {
  await ownedAccount(userId, bankAccountId);
  if (ledgerAccountId) await assertLedgerAccess(userId, ledgerAccountId, ['ASSET', 'LIABILITY']);
  return prisma.bankAccount.update({ where: { id: bankAccountId }, data: { ledgerAccountId } });
}

export async function categoriseTransaction(
  userId: string,
  transactionId: string,
  data: { ledgerAccountId?: string | null; note?: string | null; status?: 'IGNORED' | 'UNREVIEWED' }
) {
  const transaction = await ownedTransaction(userId, transactionId);
  if (transaction.status === 'POSTED') throw new ApiError(400, 'This line is posted; void its journal entry first');
  if (data.ledgerAccountId) await assertLedgerAccess(userId, data.ledgerAccountId);
  const ledgerAccountId = data.ledgerAccountId === undefined ? transaction.ledgerAccountId : data.ledgerAccountId;
  const status = data.status ?? (ledgerAccountId ? 'CATEGORISED' : transaction.status === 'IGNORED' ? 'IGNORED' : 'UNREVIEWED');
  return prisma.bankTransaction.update({
    where: { id: transactionId },
    data: { ledgerAccountId, status, ...(data.note !== undefined ? { note: data.note } : {}) },
  });
}

/** One balanced journal entry per bank line: the bank account against the chosen account. */
export async function postTransaction(userId: string, transactionId: string) {
  const transaction = await ownedTransaction(userId, transactionId);
  if (transaction.status === 'POSTED') throw new ApiError(400, 'Already posted');
  if (!transaction.ledgerAccountId) throw new ApiError(400, 'Choose an account for this line first');
  const bankLedgerId = transaction.bankAccount.ledgerAccountId;
  if (!bankLedgerId) throw new ApiError(400, 'Link this bank account to a ledger account first');

  const amount = Math.abs(transaction.amountCents) / 100;
  const moneyIn = transaction.amountCents >= 0;
  const lines = moneyIn
    ? [
        { accountId: bankLedgerId, debit: amount },
        { accountId: transaction.ledgerAccountId, credit: amount },
      ]
    : [
        { accountId: transaction.ledgerAccountId, debit: amount },
        { accountId: bankLedgerId, credit: amount },
      ];
  const entry = await createJournalEntry({
    userId,
    organizationId: transaction.bankAccount.connection.organizationId ?? undefined,
    description: transaction.description,
    reference: `bank:${transaction.id}`,
    entryDate: transaction.postedAt,
    status: 'POSTED',
    lines,
  });
  return prisma.bankTransaction.update({ where: { id: transactionId }, data: { status: 'POSTED', journalEntryId: entry.id } });
}

export async function postAllCategorised(userId: string, accountId?: string) {
  const ready = await prisma.bankTransaction.findMany({
    where: { status: 'CATEGORISED', ledgerAccountId: { not: null }, bankAccount: { connection: { userId }, ...(accountId ? { id: accountId } : {}) } },
    select: { id: true },
    orderBy: { postedAt: 'asc' },
    take: 500,
  });
  let posted = 0;
  const failed: Array<{ id: string; message: string }> = [];
  for (const { id } of ready) {
    try {
      await postTransaction(userId, id);
      posted += 1;
    } catch (error: any) {
      failed.push({ id, message: error?.message || 'Could not post' });
    }
  }
  return { posted, failed };
}

export async function removeConnection(userId: string, connectionId: string) {
  const connection = await ownedConnection(userId, connectionId);
  if (connection.provider === 'BASIQ' && connection.providerUserId && connection.providerConnectionId && isBasiqConfigured()) {
    try {
      await basiq(`/users/${connection.providerUserId}/connections/${connection.providerConnectionId}`, { method: 'DELETE' });
    } catch (error: any) {
      logger.warn('Basiq connection could not be removed remotely', { connectionId, error: error?.message });
    }
  }
  await prisma.bankConnection.delete({ where: { id: connectionId } });
  return { removed: true };
}
