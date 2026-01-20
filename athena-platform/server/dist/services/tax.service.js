"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTaxRates = listTaxRates;
exports.createTaxRate = createTaxRate;
exports.updateTaxRate = updateTaxRate;
exports.listTaxReturns = listTaxReturns;
exports.createTaxReturn = createTaxReturn;
exports.updateTaxReturn = updateTaxReturn;
exports.submitTaxReturn = submitTaxReturn;
exports.deleteTaxRate = deleteTaxRate;
exports.deleteTaxReturn = deleteTaxReturn;
const client_1 = require("@prisma/client");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const toDecimal = (value) => new client_1.Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const TAX_TYPES = ['GST', 'VAT', 'SALES_TAX', 'WITHHOLDING'];
const REGIONS = ['ANZ', 'US', 'SEA', 'MEA', 'UK', 'EU'];
async function listTaxRates(params) {
    return prisma_1.prisma.taxRate.findMany({
        where: {
            organizationId: params.organizationId || undefined,
            region: params.region || undefined,
            isActive: true,
        },
        orderBy: { effectiveFrom: 'desc' },
    });
}
async function createTaxRate(data) {
    if (!data.name || data.rate === undefined || data.rate === null) {
        throw new errorHandler_1.ApiError(400, 'Tax rate name and rate are required');
    }
    if (!TAX_TYPES.includes(data.type)) {
        throw new errorHandler_1.ApiError(400, 'Invalid tax rate type');
    }
    if (!Number.isFinite(data.rate) || data.rate < 0 || data.rate > 1) {
        throw new errorHandler_1.ApiError(400, 'Tax rate must be between 0 and 1');
    }
    if (data.region && !REGIONS.includes(data.region)) {
        throw new errorHandler_1.ApiError(400, 'Invalid region');
    }
    return prisma_1.prisma.taxRate.create({
        data: {
            organizationId: data.organizationId,
            name: data.name,
            type: data.type,
            rate: toDecimal(data.rate),
            region: data.region || undefined,
            effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        },
    });
}
async function updateTaxRate(id, data) {
    if (data.type && !TAX_TYPES.includes(data.type)) {
        throw new errorHandler_1.ApiError(400, 'Invalid tax rate type');
    }
    if (data.rate !== undefined && (!Number.isFinite(data.rate) || data.rate < 0 || data.rate > 1)) {
        throw new errorHandler_1.ApiError(400, 'Tax rate must be between 0 and 1');
    }
    if (data.region && !REGIONS.includes(data.region)) {
        throw new errorHandler_1.ApiError(400, 'Invalid region');
    }
    return prisma_1.prisma.taxRate.update({
        where: { id },
        data: {
            name: data.name,
            type: data.type,
            rate: data.rate !== undefined ? toDecimal(data.rate) : undefined,
            region: data.region || undefined,
            isActive: data.isActive,
            effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        },
    });
}
async function listTaxReturns(params) {
    return prisma_1.prisma.taxReturn.findMany({
        where: {
            organizationId: params.organizationId || undefined,
            userId: params.userId || undefined,
        },
        orderBy: { periodEnd: 'desc' },
    });
}
async function createTaxReturn(data) {
    if (!data.periodStart || !data.periodEnd) {
        throw new errorHandler_1.ApiError(400, 'Period start and end are required');
    }
    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        throw new errorHandler_1.ApiError(400, 'Invalid period dates');
    }
    if (periodStart > periodEnd) {
        throw new errorHandler_1.ApiError(400, 'Period start must be before period end');
    }
    if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
        throw new errorHandler_1.ApiError(400, 'Currency must be a 3-letter ISO code');
    }
    if (data.totalSales !== undefined && data.totalSales < 0) {
        throw new errorHandler_1.ApiError(400, 'Total sales must be non-negative');
    }
    if (data.totalTax !== undefined && data.totalTax < 0) {
        throw new errorHandler_1.ApiError(400, 'Total tax must be non-negative');
    }
    return prisma_1.prisma.taxReturn.create({
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
async function updateTaxReturn(id, data) {
    const record = await prisma_1.prisma.taxReturn.findUnique({ where: { id } });
    if (!record)
        throw new errorHandler_1.ApiError(404, 'Tax return not found');
    if (record.status !== 'DRAFT') {
        throw new errorHandler_1.ApiError(400, 'Only draft returns can be edited');
    }
    if (data.periodStart && Number.isNaN(new Date(data.periodStart).getTime())) {
        throw new errorHandler_1.ApiError(400, 'Invalid period start');
    }
    if (data.periodEnd && Number.isNaN(new Date(data.periodEnd).getTime())) {
        throw new errorHandler_1.ApiError(400, 'Invalid period end');
    }
    if (data.periodStart && data.periodEnd) {
        const start = new Date(data.periodStart);
        const end = new Date(data.periodEnd);
        if (start > end) {
            throw new errorHandler_1.ApiError(400, 'Period start must be before period end');
        }
    }
    if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
        throw new errorHandler_1.ApiError(400, 'Currency must be a 3-letter ISO code');
    }
    if (data.totalSales !== undefined && data.totalSales < 0) {
        throw new errorHandler_1.ApiError(400, 'Total sales must be non-negative');
    }
    if (data.totalTax !== undefined && data.totalTax < 0) {
        throw new errorHandler_1.ApiError(400, 'Total tax must be non-negative');
    }
    return prisma_1.prisma.taxReturn.update({
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
async function submitTaxReturn(id) {
    const record = await prisma_1.prisma.taxReturn.findUnique({ where: { id } });
    if (!record)
        throw new errorHandler_1.ApiError(404, 'Tax return not found');
    if (record.status !== 'DRAFT') {
        throw new errorHandler_1.ApiError(400, 'Only draft returns can be submitted');
    }
    return prisma_1.prisma.taxReturn.update({
        where: { id },
        data: { status: 'SUBMITTED', filedAt: new Date() },
    });
}
async function deleteTaxRate(id) {
    return prisma_1.prisma.taxRate.delete({
        where: { id },
    });
}
async function deleteTaxReturn(id) {
    const record = await prisma_1.prisma.taxReturn.findUnique({ where: { id } });
    if (!record)
        throw new errorHandler_1.ApiError(404, 'Tax return not found');
    if (record.status !== 'DRAFT') {
        throw new errorHandler_1.ApiError(400, 'Only draft returns can be deleted');
    }
    return prisma_1.prisma.taxReturn.delete({
        where: { id },
    });
}
//# sourceMappingURL=tax.service.js.map