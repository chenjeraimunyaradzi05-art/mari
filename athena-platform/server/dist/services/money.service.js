"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMoneyTransactions = listMoneyTransactions;
exports.createMoneyTransaction = createMoneyTransaction;
exports.updateMoneyTransaction = updateMoneyTransaction;
exports.deleteMoneyTransaction = deleteMoneyTransaction;
const client_1 = require("@prisma/client");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const toDecimal = (value) => new client_1.Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELED'];
const TYPES = ['PAYMENT', 'REFUND', 'PAYOUT', 'TRANSFER', 'ADJUSTMENT'];
async function listMoneyTransactions(params) {
    return prisma_1.prisma.moneyTransaction.findMany({
        where: {
            organizationId: params.organizationId || undefined,
            userId: params.userId || undefined,
        },
        orderBy: { createdAt: 'desc' },
    });
}
async function createMoneyTransaction(data) {
    if (!data.amount || !data.type) {
        throw new errorHandler_1.ApiError(400, 'Amount and type are required');
    }
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new errorHandler_1.ApiError(400, 'Amount must be greater than 0');
    }
    if (!TYPES.includes(data.type)) {
        throw new errorHandler_1.ApiError(400, 'Invalid transaction type');
    }
    if (data.status && !STATUSES.includes(data.status)) {
        throw new errorHandler_1.ApiError(400, 'Invalid transaction status');
    }
    if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
        throw new errorHandler_1.ApiError(400, 'Currency must be a 3-letter ISO code');
    }
    return prisma_1.prisma.moneyTransaction.create({
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
async function updateMoneyTransaction(id, data) {
    if (data.status && !STATUSES.includes(data.status)) {
        throw new errorHandler_1.ApiError(400, 'Invalid transaction status');
    }
    return prisma_1.prisma.moneyTransaction.update({
        where: { id },
        data: {
            status: data.status,
            provider: data.provider,
            reference: data.reference,
            metadata: data.metadata || undefined,
        },
    });
}
async function deleteMoneyTransaction(id) {
    return prisma_1.prisma.moneyTransaction.delete({
        where: { id },
    });
}
//# sourceMappingURL=money.service.js.map