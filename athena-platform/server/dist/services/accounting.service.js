"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAccounts = listAccounts;
exports.createAccount = createAccount;
exports.updateAccount = updateAccount;
exports.deleteAccount = deleteAccount;
exports.createJournalEntry = createJournalEntry;
exports.listJournalEntries = listJournalEntries;
exports.getJournalEntry = getJournalEntry;
exports.postJournalEntry = postJournalEntry;
exports.voidJournalEntry = voidJournalEntry;
exports.updateJournalEntry = updateJournalEntry;
exports.getTrialBalance = getTrialBalance;
const client_1 = require("@prisma/client");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const toDecimal = (value) => new client_1.Prisma.Decimal(value);
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
async function listAccounts(params) {
    return prisma_1.prisma.accountingAccount.findMany({
        where: {
            organizationId: params.organizationId || undefined,
            userId: params.userId || undefined,
        },
        orderBy: { name: 'asc' },
    });
}
async function createAccount(data) {
    if (!data.name || !data.type) {
        throw new errorHandler_1.ApiError(400, 'Account name and type are required');
    }
    if (!ACCOUNT_TYPES.includes(data.type)) {
        throw new errorHandler_1.ApiError(400, 'Invalid account type');
    }
    if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
        throw new errorHandler_1.ApiError(400, 'Currency must be a 3-letter ISO code');
    }
    if (data.code !== undefined && data.code.trim().length === 0) {
        throw new errorHandler_1.ApiError(400, 'Account code cannot be empty');
    }
    return prisma_1.prisma.accountingAccount.create({
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
async function updateAccount(id, data) {
    if (data.name !== undefined && data.name.trim().length === 0) {
        throw new errorHandler_1.ApiError(400, 'Account name cannot be empty');
    }
    if (data.type && !ACCOUNT_TYPES.includes(data.type)) {
        throw new errorHandler_1.ApiError(400, 'Invalid account type');
    }
    if (data.currency && !CURRENCY_REGEX.test(data.currency)) {
        throw new errorHandler_1.ApiError(400, 'Currency must be a 3-letter ISO code');
    }
    if (data.code !== undefined && data.code.trim().length === 0) {
        throw new errorHandler_1.ApiError(400, 'Account code cannot be empty');
    }
    return prisma_1.prisma.accountingAccount.update({
        where: { id },
        data,
    });
}
async function deleteAccount(id) {
    return prisma_1.prisma.accountingAccount.delete({
        where: { id },
    });
}
function validateJournalLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
        throw new errorHandler_1.ApiError(400, 'Journal entry requires at least one line');
    }
    let debitTotal = 0;
    let creditTotal = 0;
    lines.forEach((line) => {
        if (!line.accountId || line.accountId.trim().length === 0) {
            throw new errorHandler_1.ApiError(400, 'Each line must include an account');
        }
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        if (debit < 0 || credit < 0) {
            throw new errorHandler_1.ApiError(400, 'Debit and credit must be non-negative');
        }
        if (debit === 0 && credit === 0) {
            throw new errorHandler_1.ApiError(400, 'Each line must have a debit or credit');
        }
        debitTotal += debit;
        creditTotal += credit;
    });
    if (Number(debitTotal.toFixed(2)) !== Number(creditTotal.toFixed(2))) {
        throw new errorHandler_1.ApiError(400, 'Total debits must equal total credits');
    }
}
async function createJournalEntry(input) {
    if (!input.description) {
        throw new errorHandler_1.ApiError(400, 'Journal description is required');
    }
    validateJournalLines(input.lines);
    const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();
    const status = input.status === 'POSTED' ? 'POSTED' : 'DRAFT';
    return prisma_1.prisma.journalEntry.create({
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
async function listJournalEntries(params) {
    return prisma_1.prisma.journalEntry.findMany({
        where: {
            organizationId: params.organizationId || undefined,
            userId: params.userId || undefined,
            status: params.status || undefined,
        },
        include: { lines: true },
        orderBy: { entryDate: 'desc' },
    });
}
async function getJournalEntry(id) {
    const entry = await prisma_1.prisma.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
    });
    if (!entry)
        throw new errorHandler_1.ApiError(404, 'Journal entry not found');
    return entry;
}
async function postJournalEntry(id) {
    const entry = await prisma_1.prisma.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
    });
    if (!entry)
        throw new errorHandler_1.ApiError(404, 'Journal entry not found');
    if (entry.status === 'POSTED')
        return entry;
    validateJournalLines(entry.lines.map((line) => ({
        accountId: line.accountId,
        debit: Number(line.debit),
        credit: Number(line.credit),
        description: line.description || undefined,
    })));
    return prisma_1.prisma.journalEntry.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date() },
        include: { lines: true },
    });
}
async function voidJournalEntry(id) {
    const entry = await prisma_1.prisma.journalEntry.findUnique({
        where: { id },
    });
    if (!entry)
        throw new errorHandler_1.ApiError(404, 'Journal entry not found');
    return prisma_1.prisma.journalEntry.update({
        where: { id },
        data: { status: 'VOID' },
    });
}
async function updateJournalEntry(id, data) {
    const entry = await prisma_1.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry)
        throw new errorHandler_1.ApiError(404, 'Journal entry not found');
    if (entry.status !== 'DRAFT') {
        throw new errorHandler_1.ApiError(400, 'Only draft journal entries can be edited');
    }
    return prisma_1.prisma.journalEntry.update({
        where: { id },
        data: {
            description: data.description,
            reference: data.reference,
            entryDate: data.entryDate ? new Date(data.entryDate) : undefined,
        },
        include: { lines: true },
    });
}
async function getTrialBalance(params) {
    const lines = await prisma_1.prisma.journalLine.findMany({
        where: {
            journalEntry: {
                status: 'POSTED',
                organizationId: params.organizationId || undefined,
                userId: params.userId || undefined,
            },
        },
        include: { account: true },
    });
    const balances = new Map();
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
//# sourceMappingURL=accounting.service.js.map