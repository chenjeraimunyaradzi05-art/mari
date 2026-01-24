import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

const toDecimal = (value: number) => new Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;

/**
 * Verify user has access to an inventory item (through organization membership or ownership)
 */
async function verifyItemAccess(itemId: string, userId: string): Promise<void> {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: { organizationId: true },
  });
  if (!item) {
    throw new ApiError(404, 'Item not found');
  }
  if (item.organizationId) {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: item.organizationId, userId },
    });
    if (!membership) {
      throw new ApiError(403, 'Access denied');
    }
  }
}

/**
 * Verify user has access to an inventory location
 */
async function verifyLocationAccess(locationId: string, userId: string): Promise<void> {
  const location = await prisma.inventoryLocation.findUnique({
    where: { id: locationId },
    select: { organizationId: true },
  });
  if (!location) {
    throw new ApiError(404, 'Location not found');
  }
  if (location.organizationId) {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: location.organizationId, userId },
    });
    if (!membership) {
      throw new ApiError(403, 'Access denied');
    }
  }
}

/**
 * Verify user has access to an inventory transaction
 */
async function verifyTransactionAccess(transactionId: string, userId: string): Promise<void> {
  const transaction = await prisma.inventoryTransaction.findUnique({
    where: { id: transactionId },
    select: { item: { select: { organizationId: true } } },
  });
  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }
  if (transaction.item.organizationId) {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: transaction.item.organizationId, userId },
    });
    if (!membership) {
      throw new ApiError(403, 'Access denied');
    }
  }
}

function normalizeQuantity(type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN', quantity: number) {
  const absQty = Math.abs(quantity);
  if (type === 'SALE' || type === 'TRANSFER') {
    return -absQty;
  }
  return absQty;
}

export async function listItems(params: { organizationId?: string }) {
  return prisma.inventoryItem.findMany({
    where: { organizationId: params.organizationId || undefined },
    orderBy: { name: 'asc' },
  });
}

export async function createItem(data: {
  organizationId?: string;
  sku: string;
  name: string;
  description?: string;
  unit?: string;
  valuationMethod?: 'FIFO' | 'LIFO' | 'AVERAGE';
  currency?: string;
  cost?: number;
  price?: number;
}) {
  if (!data.sku || !data.name) {
    throw new ApiError(400, 'SKU and name are required');
  }
  if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
    throw new ApiError(400, 'Currency must be a 3-letter ISO code');
  }
  if (data.cost !== undefined && data.cost < 0) {
    throw new ApiError(400, 'Cost must be non-negative');
  }
  if (data.price !== undefined && data.price < 0) {
    throw new ApiError(400, 'Price must be non-negative');
  }

  return prisma.inventoryItem.create({
    data: {
      organizationId: data.organizationId,
      sku: data.sku.trim(),
      name: data.name,
      description: data.description,
      unit: data.unit || 'unit',
      valuationMethod: data.valuationMethod || 'FIFO',
      currency: data.currency || 'AUD',
      cost: toDecimal(data.cost || 0),
      price: toDecimal(data.price || 0),
    },
  });
}

export async function updateItem(id: string, userId: string, data: {
  sku?: string;
  name?: string;
  description?: string;
  unit?: string;
  valuationMethod?: 'FIFO' | 'LIFO' | 'AVERAGE';
  currency?: string;
  cost?: number;
  price?: number;
  isActive?: boolean;
}) {
  await verifyItemAccess(id, userId);
  if (data.sku !== undefined && data.sku.trim().length === 0) {
    throw new ApiError(400, 'SKU cannot be empty');
  }
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new ApiError(400, 'Name cannot be empty');
  }
  if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
    throw new ApiError(400, 'Currency must be a 3-letter ISO code');
  }
  if (data.cost !== undefined && data.cost < 0) {
    throw new ApiError(400, 'Cost must be non-negative');
  }
  if (data.price !== undefined && data.price < 0) {
    throw new ApiError(400, 'Price must be non-negative');
  }
  return prisma.inventoryItem.update({
    where: { id },
    data: {
      sku: data.sku ? data.sku.trim() : undefined,
      name: data.name,
      description: data.description,
      unit: data.unit,
      valuationMethod: data.valuationMethod,
      currency: data.currency,
      cost: data.cost !== undefined ? toDecimal(data.cost) : undefined,
      price: data.price !== undefined ? toDecimal(data.price) : undefined,
      isActive: data.isActive,
    },
  });
}

export async function deleteItem(id: string, userId: string) {
  await verifyItemAccess(id, userId);
  return prisma.inventoryItem.delete({
    where: { id },
  });
}

export async function listLocations(params: { organizationId?: string }) {
  return prisma.inventoryLocation.findMany({
    where: { organizationId: params.organizationId || undefined },
    orderBy: { name: 'asc' },
  });
}

export async function createLocation(data: {
  organizationId?: string;
  name: string;
  code: string;
  address?: string;
}) {
  if (!data.name || !data.code) {
    throw new ApiError(400, 'Location name and code are required');
  }
  if (data.code.trim().length === 0) {
    throw new ApiError(400, 'Location code cannot be empty');
  }

  return prisma.inventoryLocation.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      code: data.code,
      address: data.address,
    },
  });
}

export async function updateLocation(id: string, userId: string, data: {
  name?: string;
  code?: string;
  address?: string;
  isActive?: boolean;
}) {
  await verifyLocationAccess(id, userId);
  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new ApiError(400, 'Location name cannot be empty');
  }
  if (data.code !== undefined && data.code.trim().length === 0) {
    throw new ApiError(400, 'Location code cannot be empty');
  }
  return prisma.inventoryLocation.update({
    where: { id },
    data,
  });
}

export async function deleteLocation(id: string, userId: string) {
  await verifyLocationAccess(id, userId);
  return prisma.inventoryLocation.delete({
    where: { id },
  });
}

export async function listTransactions(params: { itemId?: string; organizationId?: string }) {
  return prisma.inventoryTransaction.findMany({
    where: {
      itemId: params.itemId || undefined,
      item: params.organizationId ? { organizationId: params.organizationId } : undefined,
    },
    include: { item: true, location: true },
    orderBy: { occurredAt: 'desc' },
  });
}

export async function createTransaction(data: {
  itemId: string;
  locationId?: string;
  createdByUserId?: string;
  type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  reference?: string;
  occurredAt?: string | Date;
}) {
  if (!data.itemId || !data.type || data.quantity === undefined) {
    throw new ApiError(400, 'Item, type, and quantity are required');
  }

  const quantity = Number(data.quantity);
  if (Number.isNaN(quantity) || quantity === 0) {
    throw new ApiError(400, 'Quantity must be a non-zero number');
  }

  const unitCost = data.unitCost !== undefined ? Number(data.unitCost) : undefined;
  if (unitCost !== undefined && unitCost < 0) {
    throw new ApiError(400, 'Unit cost must be non-negative');
  }
  const totalCost = data.totalCost !== undefined
    ? Number(data.totalCost)
    : unitCost !== undefined
      ? unitCost * quantity
      : undefined;
  if (totalCost !== undefined && totalCost < 0) {
    throw new ApiError(400, 'Total cost must be non-negative');
  }
  const normalizedQuantity = normalizeQuantity(data.type, quantity);

  return prisma.inventoryTransaction.create({
    data: {
      itemId: data.itemId,
      locationId: data.locationId,
      createdByUserId: data.createdByUserId,
      type: data.type,
      quantity: toDecimal(normalizedQuantity),
      unitCost: unitCost !== undefined ? toDecimal(unitCost) : undefined,
      totalCost: totalCost !== undefined ? toDecimal(totalCost) : undefined,
      reference: data.reference,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
    },
  });
}

export async function updateTransaction(id: string, userId: string, data: {
  locationId?: string;
  type?: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
  quantity?: number;
  unitCost?: number;
  totalCost?: number;
  reference?: string;
  occurredAt?: string | Date;
}) {
  await verifyTransactionAccess(id, userId);
  if (data.quantity !== undefined && Number(data.quantity) === 0) {
    throw new ApiError(400, 'Quantity must be non-zero');
  }
  if (data.unitCost !== undefined && data.unitCost < 0) {
    throw new ApiError(400, 'Unit cost must be non-negative');
  }
  if (data.totalCost !== undefined && data.totalCost < 0) {
    throw new ApiError(400, 'Total cost must be non-negative');
  }
  const normalizedQuantity = data.quantity !== undefined && data.type
    ? normalizeQuantity(data.type, Number(data.quantity))
    : data.quantity !== undefined
      ? Number(data.quantity)
      : undefined;
  return prisma.inventoryTransaction.update({
    where: { id },
    data: {
      locationId: data.locationId,
      type: data.type,
      quantity: normalizedQuantity !== undefined ? toDecimal(Number(normalizedQuantity)) : undefined,
      unitCost: data.unitCost !== undefined ? toDecimal(Number(data.unitCost)) : undefined,
      totalCost: data.totalCost !== undefined ? toDecimal(Number(data.totalCost)) : undefined,
      reference: data.reference,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : undefined,
    },
  });
}

export async function deleteTransaction(id: string, userId: string) {
  await verifyTransactionAccess(id, userId);
  return prisma.inventoryTransaction.delete({
    where: { id },
  });
}

export async function getStockLevels(params: { organizationId?: string }) {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      item: params.organizationId ? { organizationId: params.organizationId } : undefined,
    },
    include: { item: true, location: true },
  });

  const levels = new Map<string, { itemId: string; sku: string; name: string; locationId?: string; location?: string; quantity: number }>();

  transactions.forEach((tx) => {
    const key = `${tx.itemId}:${tx.locationId || 'none'}`;
    const existing = levels.get(key) || {
      itemId: tx.itemId,
      sku: tx.item.sku,
      name: tx.item.name,
      locationId: tx.locationId || undefined,
      location: tx.location?.name || undefined,
      quantity: 0,
    };

    existing.quantity += Number(tx.quantity);
    levels.set(key, existing);
  });

  return Array.from(levels.values());
}
