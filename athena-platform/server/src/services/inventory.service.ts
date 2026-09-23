import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { assertOrgMembership, memberOrganizationIds } from '../utils/org-scope';

const toDecimal = (value: number) => new Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;

/**
 * Who a row of stock belongs to.
 *
 * A sole trader's items and locations carry her userId and no organisation; an
 * organisation's carry its id and are shared by its members. Nothing is scoped
 * by the query string: an organizationId narrows the caller's own scope and is
 * refused unless she is a member. The lists used to pass the parameter straight
 * to Prisma, where an absent one drops the constraint, so every tenant's SKUs —
 * with cost and sell price, therefore margins — went to anyone signed in.
 *
 * Rows written before the owner column existed carry neither id and so match
 * nobody. That is the safe direction: invisible rather than world-readable, and
 * guessing an owner for them would be worse than leaving them to be re-created.
 */
interface OwnerScope {
  organizationId?: string;
  OR?: Array<{ userId: string } | { organizationId: { in: string[] } }>;
}

async function ownerScope(params: { userId: string; organizationId?: string }): Promise<OwnerScope> {
  if (params.organizationId) {
    await assertOrgMembership(params.organizationId, params.userId);
    return { organizationId: params.organizationId };
  }
  return {
    OR: [{ userId: params.userId }, { organizationId: { in: await memberOrganizationIds(params.userId) } }],
  };
}

/**
 * Whether one row is the caller's to read or change. Ownership first, then
 * membership; a row with neither owner belongs to no one and is refused, which
 * is what an organisationless item used to skip past entirely.
 */
async function assertOwned(
  row: { organizationId: string | null; userId: string | null },
  userId: string
): Promise<void> {
  if (row.userId === userId) {
    return;
  }
  if (!row.organizationId) {
    throw new ApiError(403, 'Access denied');
  }
  await assertOrgMembership(row.organizationId, userId);
}

/**
 * Verify user has access to an inventory item (through organization membership or ownership)
 */
async function verifyItemAccess(itemId: string, userId: string): Promise<void> {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: { organizationId: true, userId: true },
  });
  if (!item) {
    throw new ApiError(404, 'Item not found');
  }
  await assertOwned(item, userId);
}

/**
 * Verify user has access to an inventory location
 */
async function verifyLocationAccess(locationId: string, userId: string): Promise<void> {
  const location = await prisma.inventoryLocation.findUnique({
    where: { id: locationId },
    select: { organizationId: true, userId: true },
  });
  if (!location) {
    throw new ApiError(404, 'Location not found');
  }
  await assertOwned(location, userId);
}

/**
 * Verify user has access to an inventory transaction
 */
async function verifyTransactionAccess(transactionId: string, userId: string): Promise<void> {
  const transaction = await prisma.inventoryTransaction.findUnique({
    where: { id: transactionId },
    select: { item: { select: { organizationId: true, userId: true } } },
  });
  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }
  await assertOwned(transaction.item, userId);
}

function normalizeQuantity(type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN', quantity: number) {
  const absQty = Math.abs(quantity);
  if (type === 'SALE' || type === 'TRANSFER') {
    return -absQty;
  }
  return absQty;
}

export async function listItems(params: { userId: string; organizationId?: string }) {
  return prisma.inventoryItem.findMany({
    where: await ownerScope(params),
    orderBy: { name: 'asc' },
  });
}

export async function createItem(data: {
  userId: string;
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
  if (data.organizationId) {
    await assertOrgMembership(data.organizationId, data.userId);
  }

  return prisma.inventoryItem.create({
    data: {
      organizationId: data.organizationId,
      // An organisation's stock belongs to the organisation and is shared by
      // its members; only a sole trader's row carries a personal owner.
      userId: data.organizationId ? null : data.userId,
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

export async function listLocations(params: { userId: string; organizationId?: string }) {
  return prisma.inventoryLocation.findMany({
    where: await ownerScope(params),
    orderBy: { name: 'asc' },
  });
}

export async function createLocation(data: {
  userId: string;
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
  if (data.organizationId) {
    await assertOrgMembership(data.organizationId, data.userId);
  }

  return prisma.inventoryLocation.create({
    data: {
      organizationId: data.organizationId,
      userId: data.organizationId ? null : data.userId,
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

export async function listTransactions(params: { userId: string; itemId?: string; organizationId?: string }) {
  return prisma.inventoryTransaction.findMany({
    where: {
      itemId: params.itemId || undefined,
      // Movements are scoped by the stock they move, so the same rule covers
      // them: without this the whole table's purchase costs were readable.
      item: await ownerScope(params),
    },
    include: { item: true, location: true },
    orderBy: { occurredAt: 'desc' },
  });
}

/**
 * Stock and the place it sits have to be in the same books. Otherwise a member
 * of one organisation could park its stock in her own warehouse, and the same
 * movement would be counted in two sets of stock levels.
 */
async function assertSameBooks(itemId: string, locationId: string) {
  const [item, location] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { organizationId: true, userId: true } }),
    prisma.inventoryLocation.findUnique({ where: { id: locationId }, select: { organizationId: true, userId: true } }),
  ]);
  if (!item) throw new ApiError(404, 'Item not found');
  if (!location) throw new ApiError(404, 'Location not found');
  if (item.organizationId !== location.organizationId || item.userId !== location.userId) {
    throw new ApiError(400, 'That location belongs to a different set of books than the item');
  }
}

export async function createTransaction(data: {
  itemId: string;
  locationId?: string;
  createdByUserId: string;
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

  // A movement is a write against someone's stock, so it earns the same check
  // the item's own edit endpoints make. Without it any signed-in account could
  // post purchases and sales against any item id on the platform.
  await verifyItemAccess(data.itemId, data.createdByUserId);
  if (data.locationId) {
    await verifyLocationAccess(data.locationId, data.createdByUserId);
    await assertSameBooks(data.itemId, data.locationId);
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
  if (data.locationId) {
    await verifyLocationAccess(data.locationId, userId);
    const existing = await prisma.inventoryTransaction.findUnique({ where: { id }, select: { itemId: true } });
    if (!existing) {
      throw new ApiError(404, 'Transaction not found');
    }
    await assertSameBooks(existing.itemId, data.locationId);
  }
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

export async function getStockLevels(params: { userId: string; organizationId?: string }) {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { item: await ownerScope(params) },
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
