import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

const toDecimal = (value: number) => new Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELED'] as const;
const TYPES = ['PAYMENT', 'REFUND', 'PAYOUT', 'TRANSFER', 'ADJUSTMENT'] as const;

export async function listMoneyTransactions(params: { organizationId?: string; userId?: string }) {
  return prisma.moneyTransaction.findMany({
    where: {
      organizationId: params.organizationId || undefined,
      userId: params.userId || undefined,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createMoneyTransaction(data: {
  organizationId?: string;
  userId?: string;
  amount: number;
  currency?: string;
  type: 'PAYMENT' | 'REFUND' | 'PAYOUT' | 'TRANSFER' | 'ADJUSTMENT';
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  provider?: string;
  reference?: string;
  metadata?: Record<string, any>;
}) {
  if (!data.amount || !data.type) {
    throw new ApiError(400, 'Amount and type are required');
  }
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new ApiError(400, 'Amount must be greater than 0');
  }
  if (!TYPES.includes(data.type)) {
    throw new ApiError(400, 'Invalid transaction type');
  }
  if (data.status && !STATUSES.includes(data.status)) {
    throw new ApiError(400, 'Invalid transaction status');
  }
  if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
    throw new ApiError(400, 'Currency must be a 3-letter ISO code');
  }

  return prisma.moneyTransaction.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      amount: toDecimal(data.amount),
      currency: data.currency || 'AUD',
      type: data.type,
      status: data.status || 'PENDING',
      provider: data.provider,
      reference: data.reference,
      metadata: data.metadata || undefined,
    },
  });
}

export async function updateMoneyTransaction(id: string, userId: string, data: {
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  provider?: string;
  reference?: string;
  metadata?: Record<string, any>;
}) {
  if (data.status && !STATUSES.includes(data.status)) {
    throw new ApiError(400, 'Invalid transaction status');
  }
  
  // Verify ownership before updating
  const transaction = await prisma.moneyTransaction.findUnique({ where: { id } });
  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }
  if (transaction.userId !== userId) {
    throw new ApiError(403, 'Not authorized to update this transaction');
  }
  
  return prisma.moneyTransaction.update({
    where: { id },
    data: {
      status: data.status,
      provider: data.provider,
      reference: data.reference,
      metadata: data.metadata || undefined,
    },
  });
}

export async function deleteMoneyTransaction(id: string, userId: string) {
  // Verify ownership before deleting
  const transaction = await prisma.moneyTransaction.findUnique({ where: { id } });
  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }
  if (transaction.userId !== userId) {
    throw new ApiError(403, 'Not authorized to delete this transaction');
  }
  
  return prisma.moneyTransaction.delete({
    where: { id },
  });
}
