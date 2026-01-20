"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        businessRegistration: {
            findUnique: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
        },
    },
}));
const prisma_1 = require("../../utils/prisma");
const formation_service_1 = require("../formation.service");
(0, globals_1.describe)('submitRegistration validation', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('throws 404 when registration not found', async () => {
        prisma_1.prisma.businessRegistration.findUnique.mockResolvedValue(null);
        await (0, globals_1.expect)((0, formation_service_1.submitRegistration)('user-1', 'reg-1')).rejects.toMatchObject({
            statusCode: 404,
        });
    });
    (0, globals_1.it)('throws 403 when user does not own registration', async () => {
        prisma_1.prisma.businessRegistration.findUnique.mockResolvedValue({
            id: 'reg-1',
            userId: 'someone-else',
            type: 'SOLE_TRADER',
            status: 'DRAFT',
            businessName: 'Acme',
            data: {},
        });
        await (0, globals_1.expect)((0, formation_service_1.submitRegistration)('user-1', 'reg-1')).rejects.toMatchObject({
            statusCode: 403,
        });
    });
    (0, globals_1.it)('throws 400 when status is not submittable', async () => {
        prisma_1.prisma.businessRegistration.findUnique.mockResolvedValue({
            id: 'reg-1',
            userId: 'user-1',
            type: 'SOLE_TRADER',
            status: 'SUBMITTED',
            businessName: 'Acme',
            data: {},
        });
        await (0, globals_1.expect)((0, formation_service_1.submitRegistration)('user-1', 'reg-1')).rejects.toMatchObject({
            statusCode: 400,
        });
    });
    (0, globals_1.it)('throws 400 when business name is missing', async () => {
        prisma_1.prisma.businessRegistration.findUnique.mockResolvedValue({
            id: 'reg-1',
            userId: 'user-1',
            type: 'SOLE_TRADER',
            status: 'DRAFT',
            businessName: null,
            data: {},
        });
        await (0, globals_1.expect)((0, formation_service_1.submitRegistration)('user-1', 'reg-1')).rejects.toMatchObject({
            statusCode: 400,
        });
    });
    (0, globals_1.it)('throws 400 for COMPANY when missing people/address details', async () => {
        prisma_1.prisma.businessRegistration.findUnique.mockResolvedValue({
            id: 'reg-1',
            userId: 'user-1',
            type: 'COMPANY',
            status: 'DRAFT',
            businessName: 'Acme Pty Ltd',
            data: {},
        });
        await (0, globals_1.expect)((0, formation_service_1.submitRegistration)('user-1', 'reg-1')).rejects.toMatchObject({
            statusCode: 400,
        });
    });
    (0, globals_1.it)('submits COMPANY when minimum details are present', async () => {
        const reg = {
            id: 'reg-1',
            userId: 'user-1',
            type: 'COMPANY',
            status: 'DRAFT',
            businessName: 'Acme Pty Ltd',
            data: {
                directors: [{ name: 'Director One' }],
                registeredAddress: { line1: '123 Test St', city: 'Sydney' },
            },
        };
        prisma_1.prisma.businessRegistration.findUnique.mockResolvedValue(reg);
        prisma_1.prisma.businessRegistration.update.mockResolvedValue({
            ...reg,
            status: 'SUBMITTED',
            submittedAt: new Date('2026-01-01'),
        });
        const result = await (0, formation_service_1.submitRegistration)('user-1', 'reg-1');
        (0, globals_1.expect)(prisma_1.prisma.businessRegistration.update).toHaveBeenCalled();
        (0, globals_1.expect)(result.status).toBe('SUBMITTED');
    });
});
//# sourceMappingURL=formation.submit.validation.test.js.map