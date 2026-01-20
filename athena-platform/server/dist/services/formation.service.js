"use strict";
/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRegistration = createRegistration;
exports.updateRegistration = updateRegistration;
exports.submitRegistration = submitRegistration;
exports.getUserRegistrations = getUserRegistrations;
exports.getRegistration = getRegistration;
exports.adminUpdateStatus = adminUpdateStatus;
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
function asRecord(value) {
    if (value && typeof value === 'object' && !Array.isArray(value))
        return value;
    return {};
}
function nonEmptyString(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function hasNonEmptyArray(data, keys) {
    return keys.some((key) => Array.isArray(data[key]) && data[key].length > 0);
}
function hasNonEmptyObject(data, keys) {
    return keys.some((key) => {
        const v = data[key];
        return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0;
    });
}
function validateRegistrationForSubmission(registration) {
    if (registration.status !== 'DRAFT' && registration.status !== 'NEEDS_INFO') {
        throw new errorHandler_1.ApiError(400, 'Cannot submit registration in this status');
    }
    const data = asRecord(registration.data);
    const businessName = nonEmptyString(registration.businessName) || nonEmptyString(data.businessName) || null;
    if (!businessName) {
        throw new errorHandler_1.ApiError(400, 'Business name is required to submit');
    }
    // NOTE: The JSON `data` shape can evolve with the client; these checks are
    // intentionally flexible (accepting multiple possible keys) while still
    // preventing clearly incomplete submissions.
    if (registration.type === 'COMPANY') {
        const hasPeople = hasNonEmptyArray(data, ['directors', 'people', 'participants', 'members']);
        const hasAddress = hasNonEmptyObject(data, [
            'registeredAddress',
            'businessAddress',
            'principalPlaceOfBusiness',
            'address',
        ]);
        if (!hasPeople || !hasAddress) {
            throw new errorHandler_1.ApiError(400, 'Company registrations require director/participant details and a registered address');
        }
    }
    if (registration.type === 'PARTNERSHIP') {
        const hasPartners = hasNonEmptyArray(data, ['partners', 'people', 'participants', 'members']);
        if (!hasPartners) {
            throw new errorHandler_1.ApiError(400, 'Partnership registrations require partner details');
        }
    }
    if (registration.type === 'TRUST') {
        const hasTrustees = hasNonEmptyArray(data, ['trustees', 'people', 'participants', 'members']);
        const hasTrusteeObject = hasNonEmptyObject(data, ['trustee']);
        if (!hasTrustees && !hasTrusteeObject) {
            throw new errorHandler_1.ApiError(400, 'Trust registrations require trustee details');
        }
    }
}
async function createRegistration(userId, type, businessName) {
    return prisma_1.prisma.businessRegistration.create({
        data: {
            userId,
            type,
            businessName,
            status: 'DRAFT',
            data: {}, // Initialize empty data
        },
    });
}
async function updateRegistration(userId, registrationId, data) {
    const registration = await prisma_1.prisma.businessRegistration.findUnique({
        where: { id: registrationId },
    });
    if (!registration) {
        throw new errorHandler_1.ApiError(404, 'Registration not found');
    }
    if (registration.userId !== userId) {
        throw new errorHandler_1.ApiError(403, 'Not authorized');
    }
    if (registration.status !== 'DRAFT' && registration.status !== 'NEEDS_INFO') {
        throw new errorHandler_1.ApiError(400, 'Cannot update registration in this status');
    }
    return prisma_1.prisma.businessRegistration.update({
        where: { id: registrationId },
        data: {
            data: data, // Updates the JSON blob
            businessName: data.businessName || registration.businessName,
        },
    });
}
async function submitRegistration(userId, registrationId) {
    const registration = await prisma_1.prisma.businessRegistration.findUnique({
        where: { id: registrationId },
    });
    if (!registration) {
        throw new errorHandler_1.ApiError(404, 'Registration not found');
    }
    if (registration.userId !== userId) {
        throw new errorHandler_1.ApiError(403, 'Not authorized');
    }
    validateRegistrationForSubmission(registration);
    // TODO: Integrate Stripe Payment here (Phase 4)
    return prisma_1.prisma.businessRegistration.update({
        where: { id: registrationId },
        data: {
            status: 'SUBMITTED',
            submittedAt: new Date(),
        },
    });
}
async function getUserRegistrations(userId) {
    return prisma_1.prisma.businessRegistration.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
}
async function getRegistration(userId, registrationId) {
    const registration = await prisma_1.prisma.businessRegistration.findUnique({
        where: { id: registrationId },
    });
    if (!registration) {
        throw new errorHandler_1.ApiError(404, 'Registration not found');
    }
    if (registration.userId !== userId) {
        throw new errorHandler_1.ApiError(403, 'Not authorized');
    }
    return registration;
}
// Admin function
async function adminUpdateStatus(registrationId, status, abn, acn) {
    return prisma_1.prisma.businessRegistration.update({
        where: { id: registrationId },
        data: {
            status,
            abn,
            acn,
            approvedAt: status === 'APPROVED' ? new Date() : undefined,
        },
    });
}
//# sourceMappingURL=formation.service.js.map