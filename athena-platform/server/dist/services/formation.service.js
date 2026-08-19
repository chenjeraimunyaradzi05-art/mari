"use strict";
/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRegistration = createRegistration;
exports.updateRegistration = updateRegistration;
exports.submitRegistration = submitRegistration;
exports.confirmFormationPayment = confirmFormationPayment;
exports.getUserRegistrations = getUserRegistrations;
exports.getRegistration = getRegistration;
exports.adminUpdateStatus = adminUpdateStatus;
const stripe_1 = __importDefault(require("stripe"));
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
    ? new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
    : null;
const isProduction = process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';
const allowStripeSimulation = process.env.ALLOW_STRIPE_SIMULATION === 'true';
// Formation fee amounts in cents by business type
const FORMATION_FEES = {
    SOLE_TRADER: 4900, // $49 AUD
    PARTNERSHIP: 9900, // $99 AUD
    COMPANY: 49900, // $499 AUD
    TRUST: 69900, // $699 AUD
};
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
    // Create Stripe payment intent for formation fee
    const feeAmount = FORMATION_FEES[registration.type];
    let paymentIntentId = null;
    if (stripe) {
        try {
            const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
            const paymentIntent = await stripe.paymentIntents.create({
                amount: feeAmount,
                currency: 'aud',
                metadata: {
                    registrationId,
                    userId,
                    businessType: registration.type,
                    businessName: registration.businessName || 'Unknown',
                },
                description: `Business Formation: ${registration.type} - ${registration.businessName}`,
                receipt_email: user?.email || undefined,
            });
            paymentIntentId = paymentIntent.id;
            logger_1.logger.info('Created formation payment intent', { registrationId, paymentIntentId, amount: feeAmount });
        }
        catch (error) {
            logger_1.logger.error('Failed to create Stripe payment intent', { error, registrationId });
            throw new errorHandler_1.ApiError(500, 'Payment processing failed. Please try again.');
        }
    }
    else {
        if (isProduction && !allowStripeSimulation) {
            logger_1.logger.error('Stripe not configured in production for formation payments', { registrationId });
            throw new errorHandler_1.ApiError(500, 'Payment processing is unavailable. Please contact support.');
        }
        // Development mode without Stripe
        paymentIntentId = `mock_pi_${registrationId}`;
        logger_1.logger.info('Mock formation payment (Stripe not configured)', { registrationId, amount: feeAmount });
    }
    return prisma_1.prisma.businessRegistration.update({
        where: { id: registrationId },
        data: {
            status: 'PAYMENT_PENDING',
            submittedAt: new Date(),
            data: { ...asRecord(registration.data), stripePaymentIntentId: paymentIntentId },
        },
    });
}
/**
 * Confirm formation payment after Stripe checkout
 */
async function confirmFormationPayment(userId, registrationId, paymentIntentId) {
    const registration = await prisma_1.prisma.businessRegistration.findUnique({
        where: { id: registrationId },
    });
    if (!registration) {
        throw new errorHandler_1.ApiError(404, 'Registration not found');
    }
    if (registration.userId !== userId) {
        throw new errorHandler_1.ApiError(403, 'Not authorized');
    }
    if (registration.status !== 'PAYMENT_PENDING') {
        throw new errorHandler_1.ApiError(400, 'Registration is not awaiting payment');
    }
    // Verify payment with Stripe
    if (stripe) {
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (paymentIntent.status !== 'succeeded') {
                throw new errorHandler_1.ApiError(400, `Payment not successful. Status: ${paymentIntent.status}`);
            }
        }
        catch (error) {
            if (error instanceof errorHandler_1.ApiError)
                throw error;
            logger_1.logger.error('Failed to verify payment', { error, paymentIntentId });
            throw new errorHandler_1.ApiError(500, 'Payment verification failed');
        }
    }
    else if (isProduction && !allowStripeSimulation) {
        logger_1.logger.error('Stripe not configured in production for formation payment confirmation', {
            registrationId,
            paymentIntentId,
        });
        throw new errorHandler_1.ApiError(500, 'Payment verification is unavailable. Please contact support.');
    }
    return prisma_1.prisma.businessRegistration.update({
        where: { id: registrationId },
        data: {
            status: 'PAID',
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