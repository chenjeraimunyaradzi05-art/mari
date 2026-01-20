"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listItems = listItems;
exports.createItem = createItem;
exports.updateItem = updateItem;
exports.deleteItem = deleteItem;
exports.listLocations = listLocations;
exports.createLocation = createLocation;
exports.updateLocation = updateLocation;
exports.deleteLocation = deleteLocation;
exports.listTransactions = listTransactions;
exports.createTransaction = createTransaction;
exports.updateTransaction = updateTransaction;
exports.deleteTransaction = deleteTransaction;
exports.getStockLevels = getStockLevels;
const client_1 = require("@prisma/client");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const toDecimal = (value) => new client_1.Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;
function normalizeQuantity(type, quantity) {
    const absQty = Math.abs(quantity);
    if (type === 'SALE' || type === 'TRANSFER') {
        return -absQty;
    }
    return absQty;
}
async function listItems(params) {
    return prisma_1.prisma.inventoryItem.findMany({
        where: { organizationId: params.organizationId || undefined },
        orderBy: { name: 'asc' },
    });
}
async function createItem(data) {
    if (!data.sku || !data.name) {
        throw new errorHandler_1.ApiError(400, 'SKU and name are required');
    }
    if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
        throw new errorHandler_1.ApiError(400, 'Currency must be a 3-letter ISO code');
    }
    if (data.cost !== undefined && data.cost < 0) {
        throw new errorHandler_1.ApiError(400, 'Cost must be non-negative');
    }
    if (data.price !== undefined && data.price < 0) {
        throw new errorHandler_1.ApiError(400, 'Price must be non-negative');
    }
    return prisma_1.prisma.inventoryItem.create({
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
async function updateItem(id, data) {
    if (data.sku !== undefined && data.sku.trim().length === 0) {
        throw new errorHandler_1.ApiError(400, 'SKU cannot be empty');
    }
    if (data.name !== undefined && data.name.trim().length === 0) {
        throw new errorHandler_1.ApiError(400, 'Name cannot be empty');
    }
    if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
        throw new errorHandler_1.ApiError(400, 'Currency must be a 3-letter ISO code');
    }
    if (data.cost !== undefined && data.cost < 0) {
        throw new errorHandler_1.ApiError(400, 'Cost must be non-negative');
    }
    if (data.price !== undefined && data.price < 0) {
        throw new errorHandler_1.ApiError(400, 'Price must be non-negative');
    }
    return prisma_1.prisma.inventoryItem.update({
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
async function deleteItem(id) {
    return prisma_1.prisma.inventoryItem.delete({
        where: { id },
    });
}
async function listLocations(params) {
    return prisma_1.prisma.inventoryLocation.findMany({
        where: { organizationId: params.organizationId || undefined },
        orderBy: { name: 'asc' },
    });
}
async function createLocation(data) {
    if (!data.name || !data.code) {
        throw new errorHandler_1.ApiError(400, 'Location name and code are required');
    }
    if (data.code.trim().length === 0) {
        throw new errorHandler_1.ApiError(400, 'Location code cannot be empty');
    }
    return prisma_1.prisma.inventoryLocation.create({
        data: {
            organizationId: data.organizationId,
            name: data.name,
            code: data.code,
            address: data.address,
        },
    });
}
async function updateLocation(id, data) {
    if (data.name !== undefined && data.name.trim().length === 0) {
        throw new errorHandler_1.ApiError(400, 'Location name cannot be empty');
    }
    if (data.code !== undefined && data.code.trim().length === 0) {
        throw new errorHandler_1.ApiError(400, 'Location code cannot be empty');
    }
    return prisma_1.prisma.inventoryLocation.update({
        where: { id },
        data,
    });
}
async function deleteLocation(id) {
    return prisma_1.prisma.inventoryLocation.delete({
        where: { id },
    });
}
async function listTransactions(params) {
    return prisma_1.prisma.inventoryTransaction.findMany({
        where: {
            itemId: params.itemId || undefined,
            item: params.organizationId ? { organizationId: params.organizationId } : undefined,
        },
        include: { item: true, location: true },
        orderBy: { occurredAt: 'desc' },
    });
}
async function createTransaction(data) {
    if (!data.itemId || !data.type || data.quantity === undefined) {
        throw new errorHandler_1.ApiError(400, 'Item, type, and quantity are required');
    }
    const quantity = Number(data.quantity);
    if (Number.isNaN(quantity) || quantity === 0) {
        throw new errorHandler_1.ApiError(400, 'Quantity must be a non-zero number');
    }
    const unitCost = data.unitCost !== undefined ? Number(data.unitCost) : undefined;
    if (unitCost !== undefined && unitCost < 0) {
        throw new errorHandler_1.ApiError(400, 'Unit cost must be non-negative');
    }
    const totalCost = data.totalCost !== undefined
        ? Number(data.totalCost)
        : unitCost !== undefined
            ? unitCost * quantity
            : undefined;
    if (totalCost !== undefined && totalCost < 0) {
        throw new errorHandler_1.ApiError(400, 'Total cost must be non-negative');
    }
    const normalizedQuantity = normalizeQuantity(data.type, quantity);
    return prisma_1.prisma.inventoryTransaction.create({
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
async function updateTransaction(id, data) {
    if (data.quantity !== undefined && Number(data.quantity) === 0) {
        throw new errorHandler_1.ApiError(400, 'Quantity must be non-zero');
    }
    if (data.unitCost !== undefined && data.unitCost < 0) {
        throw new errorHandler_1.ApiError(400, 'Unit cost must be non-negative');
    }
    if (data.totalCost !== undefined && data.totalCost < 0) {
        throw new errorHandler_1.ApiError(400, 'Total cost must be non-negative');
    }
    const normalizedQuantity = data.quantity !== undefined && data.type
        ? normalizeQuantity(data.type, Number(data.quantity))
        : data.quantity !== undefined
            ? Number(data.quantity)
            : undefined;
    return prisma_1.prisma.inventoryTransaction.update({
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
async function deleteTransaction(id) {
    return prisma_1.prisma.inventoryTransaction.delete({
        where: { id },
    });
}
async function getStockLevels(params) {
    const transactions = await prisma_1.prisma.inventoryTransaction.findMany({
        where: {
            item: params.organizationId ? { organizationId: params.organizationId } : undefined,
        },
        include: { item: true, location: true },
    });
    const levels = new Map();
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
//# sourceMappingURL=inventory.service.js.map