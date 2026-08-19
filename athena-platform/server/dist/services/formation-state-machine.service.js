"use strict";
/**
 * Formation State Machine Service
 * Manages business registration workflow states
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formationStateMachine = void 0;
exports.canTransition = canTransition;
exports.getNextState = getNextState;
exports.transition = transition;
exports.getAvailableTransitions = getAvailableTransitions;
exports.getProgressPercentage = getProgressPercentage;
exports.getStateDescription = getStateDescription;
exports.isTerminalState = isTerminalState;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../middleware/errorHandler");
const notification_service_1 = require("./notification.service");
const notificationService = new notification_service_1.NotificationService();
// State transition rules
const STATE_TRANSITIONS = {
    DRAFT: {
        SAVE_DETAILS: 'DETAILS_COMPLETE',
        CANCEL: 'DRAFT', // Stay in draft but mark canceled
    },
    DETAILS_COMPLETE: {
        ADD_PEOPLE: 'PEOPLE_ADDED',
        SAVE_DETAILS: 'DETAILS_COMPLETE', // Allow updates
        CANCEL: 'DRAFT',
    },
    PEOPLE_ADDED: {
        VERIFY_ADDRESS: 'ADDRESS_VERIFIED',
        ADD_PEOPLE: 'PEOPLE_ADDED', // Allow updates
        CANCEL: 'DRAFT',
    },
    ADDRESS_VERIFIED: {
        UPLOAD_DOCUMENTS: 'DOCUMENTS_UPLOADED',
        VERIFY_ADDRESS: 'ADDRESS_VERIFIED', // Allow updates
        CANCEL: 'DRAFT',
    },
    DOCUMENTS_UPLOADED: {
        INITIATE_PAYMENT: 'PAYMENT_PENDING',
        UPLOAD_DOCUMENTS: 'DOCUMENTS_UPLOADED', // Allow updates
        CANCEL: 'DRAFT',
    },
    PAYMENT_PENDING: {
        PAYMENT_SUCCESS: 'PAYMENT_COMPLETE',
        PAYMENT_FAILED: 'DOCUMENTS_UPLOADED', // Go back
        CANCEL: 'DOCUMENTS_UPLOADED',
    },
    PAYMENT_COMPLETE: {
        SUBMIT: 'SUBMITTED',
    },
    SUBMITTED: {
        MARK_UNDER_REVIEW: 'UNDER_REVIEW',
    },
    UNDER_REVIEW: {
        REQUEST_INFO: 'ADDITIONAL_INFO_REQUIRED',
        APPROVE: 'APPROVED',
        REJECT: 'REJECTED',
    },
    ADDITIONAL_INFO_REQUIRED: {
        PROVIDE_INFO: 'UNDER_REVIEW',
    },
    APPROVED: {
        COMPLETE: 'COMPLETED',
    },
    REJECTED: {
    // Terminal state - can appeal by creating new registration
    },
    COMPLETED: {
    // Terminal state
    },
};
// Required fields per state
const STATE_REQUIREMENTS = {
    DRAFT: [],
    DETAILS_COMPLETE: ['businessName', 'businessType', 'industry'],
    PEOPLE_ADDED: ['directors', 'shareholders'],
    ADDRESS_VERIFIED: ['registeredAddress'],
    DOCUMENTS_UPLOADED: ['identityDocuments'],
    PAYMENT_PENDING: [],
    PAYMENT_COMPLETE: ['paymentId'],
    SUBMITTED: [],
    UNDER_REVIEW: [],
    ADDITIONAL_INFO_REQUIRED: [],
    APPROVED: ['registrationNumber'],
    REJECTED: ['rejectionReason'],
    COMPLETED: ['certificateUrl'],
};
/**
 * Check if a transition is valid
 */
function canTransition(currentState, event) {
    return STATE_TRANSITIONS[currentState]?.[event] !== undefined;
}
/**
 * Get next state for a transition
 */
function getNextState(currentState, event) {
    return STATE_TRANSITIONS[currentState]?.[event] || null;
}
/**
 * Validate data for a state
 */
function validateStateData(state, data) {
    const required = STATE_REQUIREMENTS[state] || [];
    const errors = [];
    for (const field of required) {
        if (!data[field] || (Array.isArray(data[field]) && data[field].length === 0)) {
            errors.push(`${field} is required for ${state} state`);
        }
    }
    return errors;
}
/**
 * Execute a state transition
 */
async function transition(registrationId, event, eventData) {
    const registration = await prisma_1.prisma.businessRegistration.findUnique({
        where: { id: registrationId },
        include: { user: { select: { id: true, email: true, firstName: true } } },
    });
    if (!registration) {
        throw new errorHandler_1.ApiError(404, 'Registration not found');
    }
    const currentState = registration.status;
    const nextState = getNextState(currentState, event);
    if (!nextState) {
        throw new errorHandler_1.ApiError(400, `Invalid transition: ${event} from ${currentState}`);
    }
    // Merge existing data with event data
    const mergedData = {
        ...(registration.data || {}),
        ...eventData,
    };
    // Validate data for next state
    const errors = validateStateData(nextState, mergedData);
    if (errors.length > 0) {
        return {
            success: false,
            previousState: currentState,
            currentState,
            errors,
        };
    }
    // Record state history
    const history = registration.stateHistory || [];
    history.push({
        from: currentState,
        to: nextState,
        event,
        timestamp: new Date().toISOString(),
        data: eventData,
    });
    // Update registration
    await prisma_1.prisma.businessRegistration.update({
        where: { id: registrationId },
        data: {
            status: nextState,
            data: mergedData,
            stateHistory: history,
            updatedAt: new Date(),
        },
    });
    logger_1.logger.info('Formation state transition', {
        registrationId,
        from: currentState,
        to: nextState,
        event,
    });
    // Trigger side effects
    await handleTransitionSideEffects(registration.user.id, registrationId, currentState, nextState, event);
    return {
        success: true,
        previousState: currentState,
        currentState: nextState,
    };
}
/**
 * Handle side effects of state transitions
 */
async function handleTransitionSideEffects(userId, registrationId, fromState, toState, event) {
    switch (toState) {
        case 'SUBMITTED':
            await notificationService.notify({
                userId,
                type: 'SYSTEM',
                title: 'Registration Submitted',
                message: 'Your business registration has been submitted for review.',
                link: `/formation/${registrationId}`,
                channels: ['in-app', 'email'],
            });
            break;
        case 'ADDITIONAL_INFO_REQUIRED':
            await notificationService.notify({
                userId,
                type: 'SYSTEM',
                title: 'Additional Information Required',
                message: 'Please provide additional information for your registration.',
                link: `/formation/${registrationId}`,
                channels: ['in-app', 'email'],
                priority: 'high',
            });
            break;
        case 'APPROVED':
            await notificationService.notify({
                userId,
                type: 'ACHIEVEMENT',
                title: 'Registration Approved! 🎉',
                message: 'Congratulations! Your business registration has been approved.',
                link: `/formation/${registrationId}`,
                channels: ['in-app', 'email', 'push'],
                priority: 'high',
            });
            break;
        case 'REJECTED':
            await notificationService.notify({
                userId,
                type: 'SYSTEM',
                title: 'Registration Update',
                message: 'Your business registration requires attention.',
                link: `/formation/${registrationId}`,
                channels: ['in-app', 'email'],
                priority: 'high',
            });
            break;
        case 'COMPLETED':
            await notificationService.notify({
                userId,
                type: 'ACHIEVEMENT',
                title: 'Business Registration Complete! 🏢',
                message: 'Your business is now officially registered.',
                link: `/formation/${registrationId}/certificate`,
                channels: ['in-app', 'email', 'push'],
                priority: 'high',
            });
            break;
    }
}
// ==========================================
// HELPER FUNCTIONS
// ==========================================
/**
 * Get available transitions from current state
 */
function getAvailableTransitions(currentState) {
    const transitions = STATE_TRANSITIONS[currentState];
    return transitions ? Object.keys(transitions) : [];
}
/**
 * Get progress percentage
 */
function getProgressPercentage(state) {
    const stateProgress = {
        DRAFT: 0,
        DETAILS_COMPLETE: 15,
        PEOPLE_ADDED: 30,
        ADDRESS_VERIFIED: 45,
        DOCUMENTS_UPLOADED: 60,
        PAYMENT_PENDING: 70,
        PAYMENT_COMPLETE: 80,
        SUBMITTED: 85,
        UNDER_REVIEW: 90,
        ADDITIONAL_INFO_REQUIRED: 85,
        APPROVED: 95,
        REJECTED: 0,
        COMPLETED: 100,
    };
    return stateProgress[state] || 0;
}
/**
 * Get state description
 */
function getStateDescription(state) {
    const descriptions = {
        DRAFT: 'Registration started',
        DETAILS_COMPLETE: 'Business details completed',
        PEOPLE_ADDED: 'Directors/shareholders added',
        ADDRESS_VERIFIED: 'Registered address verified',
        DOCUMENTS_UPLOADED: 'Required documents uploaded',
        PAYMENT_PENDING: 'Awaiting payment',
        PAYMENT_COMPLETE: 'Payment received',
        SUBMITTED: 'Submitted for review',
        UNDER_REVIEW: 'Under review by ASIC',
        ADDITIONAL_INFO_REQUIRED: 'Additional information requested',
        APPROVED: 'Registration approved',
        REJECTED: 'Registration rejected',
        COMPLETED: 'Registration complete',
    };
    return descriptions[state] || state;
}
/**
 * Check if state is terminal
 */
function isTerminalState(state) {
    return state === 'COMPLETED' || state === 'REJECTED';
}
exports.formationStateMachine = {
    canTransition,
    getNextState,
    transition,
    getAvailableTransitions,
    getProgressPercentage,
    getStateDescription,
    isTerminalState,
};
//# sourceMappingURL=formation-state-machine.service.js.map