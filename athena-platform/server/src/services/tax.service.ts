import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

const toDecimal = (value: number) => new Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const TAX_TYPES = ['GST', 'VAT', 'SALES_TAX', 'WITHHOLDING'] as const;
const REGIONS = ['ANZ', 'US', 'SEA', 'MEA', 'UK', 'EU'] as const;

export async function listTaxRates(params: { organizationId?: string; region?: string }) {
  return prisma.taxRate.findMany({
    where: {
      organizationId: params.organizationId || undefined,
      region: (params.region as any) || undefined,
      isActive: true,
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}

export async function createTaxRate(data: {
  organizationId?: string;
  name: string;
  type: 'GST' | 'VAT' | 'SALES_TAX' | 'WITHHOLDING';
  rate: number;
  region?: string;
  effectiveFrom?: string | Date;
  effectiveTo?: string | Date;
}) {
  if (!data.name || data.rate === undefined || data.rate === null) {
    throw new ApiError(400, 'Tax rate name and rate are required');
  }
  if (!TAX_TYPES.includes(data.type)) {
    throw new ApiError(400, 'Invalid tax rate type');
  }
  if (!Number.isFinite(data.rate) || data.rate < 0 || data.rate > 1) {
    throw new ApiError(400, 'Tax rate must be between 0 and 1');
  }
  if (data.region && !REGIONS.includes(data.region as any)) {
    throw new ApiError(400, 'Invalid region');
  }

  return prisma.taxRate.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      type: data.type,
      rate: toDecimal(data.rate),
      region: (data.region as any) || undefined,
      effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
    },
  });
}

export async function updateTaxRate(id: string, data: {
  name?: string;
  type?: 'GST' | 'VAT' | 'SALES_TAX' | 'WITHHOLDING';
  rate?: number;
  region?: string;
  isActive?: boolean;
  effectiveFrom?: string | Date;
  effectiveTo?: string | Date;
}) {
  if (data.type && !TAX_TYPES.includes(data.type)) {
    throw new ApiError(400, 'Invalid tax rate type');
  }
  if (data.rate !== undefined && (!Number.isFinite(data.rate) || data.rate < 0 || data.rate > 1)) {
    throw new ApiError(400, 'Tax rate must be between 0 and 1');
  }
  if (data.region && !REGIONS.includes(data.region as any)) {
    throw new ApiError(400, 'Invalid region');
  }
  return prisma.taxRate.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      rate: data.rate !== undefined ? toDecimal(data.rate) : undefined,
      region: (data.region as any) || undefined,
      isActive: data.isActive,
      effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
    },
  });
}

export async function listTaxReturns(params: { organizationId?: string; userId?: string }) {
  return prisma.taxReturn.findMany({
    where: {
      organizationId: params.organizationId || undefined,
      userId: params.userId || undefined,
    },
    orderBy: { periodEnd: 'desc' },
  });
}

export async function createTaxReturn(data: {
  organizationId?: string;
  userId?: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  currency?: string;
  totalSales?: number;
  totalTax?: number;
  reference?: string;
  metadata?: Record<string, any>;
}) {
  if (!data.periodStart || !data.periodEnd) {
    throw new ApiError(400, 'Period start and end are required');
  }
  const periodStart = new Date(data.periodStart);
  const periodEnd = new Date(data.periodEnd);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    throw new ApiError(400, 'Invalid period dates');
  }
  if (periodStart > periodEnd) {
    throw new ApiError(400, 'Period start must be before period end');
  }
  if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
    throw new ApiError(400, 'Currency must be a 3-letter ISO code');
  }
  if (data.totalSales !== undefined && data.totalSales < 0) {
    throw new ApiError(400, 'Total sales must be non-negative');
  }
  if (data.totalTax !== undefined && data.totalTax < 0) {
    throw new ApiError(400, 'Total tax must be non-negative');
  }

  return prisma.taxReturn.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      periodStart,
      periodEnd,
      currency: data.currency || 'AUD',
      totalSales: toDecimal(data.totalSales || 0),
      totalTax: toDecimal(data.totalTax || 0),
      reference: data.reference,
      metadata: data.metadata || undefined,
    },
  });
}

export async function updateTaxReturn(id: string, userId: string, data: {
  periodStart?: string | Date;
  periodEnd?: string | Date;
  currency?: string;
  totalSales?: number;
  totalTax?: number;
  reference?: string;
  metadata?: Record<string, any>;
}) {
  const record = await prisma.taxReturn.findUnique({ where: { id } });
  if (!record) throw new ApiError(404, 'Tax return not found');
  // Verify ownership
  if (record.userId !== userId) {
    throw new ApiError(403, 'Not authorized to update this tax return');
  }
  if (record.status !== 'DRAFT') {
    throw new ApiError(400, 'Only draft returns can be edited');
  }
  if (data.periodStart && Number.isNaN(new Date(data.periodStart).getTime())) {
    throw new ApiError(400, 'Invalid period start');
  }
  if (data.periodEnd && Number.isNaN(new Date(data.periodEnd).getTime())) {
    throw new ApiError(400, 'Invalid period end');
  }
  if (data.periodStart && data.periodEnd) {
    const start = new Date(data.periodStart);
    const end = new Date(data.periodEnd);
    if (start > end) {
      throw new ApiError(400, 'Period start must be before period end');
    }
  }
  if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
    throw new ApiError(400, 'Currency must be a 3-letter ISO code');
  }
  if (data.totalSales !== undefined && data.totalSales < 0) {
    throw new ApiError(400, 'Total sales must be non-negative');
  }
  if (data.totalTax !== undefined && data.totalTax < 0) {
    throw new ApiError(400, 'Total tax must be non-negative');
  }

  return prisma.taxReturn.update({
    where: { id },
    data: {
      periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
      periodEnd: data.periodEnd ? new Date(data.periodEnd) : undefined,
      currency: data.currency,
      totalSales: data.totalSales !== undefined ? toDecimal(data.totalSales) : undefined,
      totalTax: data.totalTax !== undefined ? toDecimal(data.totalTax) : undefined,
      reference: data.reference,
      metadata: data.metadata || undefined,
    },
  });
}

export async function submitTaxReturn(id: string, userId: string) {
  const record = await prisma.taxReturn.findUnique({ where: { id } });
  if (!record) throw new ApiError(404, 'Tax return not found');
  // Verify ownership
  if (record.userId !== userId) {
    throw new ApiError(403, 'Not authorized to submit this tax return');
  }

  if (record.status !== 'DRAFT') {
    throw new ApiError(400, 'Only draft returns can be submitted');
  }

  return prisma.taxReturn.update({
    where: { id },
    data: { status: 'SUBMITTED', filedAt: new Date() },
  });
}

export async function deleteTaxRate(id: string) {
  return prisma.taxRate.delete({
    where: { id },
  });
}

export async function deleteTaxReturn(id: string, userId: string) {
  const record = await prisma.taxReturn.findUnique({ where: { id } });
  if (!record) throw new ApiError(404, 'Tax return not found');
  // Verify ownership
  if (record.userId !== userId) {
    throw new ApiError(403, 'Not authorized to delete this tax return');
  }
  if (record.status !== 'DRAFT') {
    throw new ApiError(400, 'Only draft returns can be deleted');
  }

  return prisma.taxReturn.delete({
    where: { id },
  });
}
