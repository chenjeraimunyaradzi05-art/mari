/**
 * Formation State Machine Service
 * Manages business registration workflow states
 * Phase 2: Backend Logic & Integrations
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { NotificationService } from './notification.service';

const notificationService = new NotificationService();

// ==========================================
// STATE DEFINITIONS
// ==========================================

export type FormationState =
  | 'DRAFT'
  | 'DETAILS_COMPLETE'
  | 'PEOPLE_ADDED'
  | 'ADDRESS_VERIFIED'
  | 'DOCUMENTS_UPLOADED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COMPLETE'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ADDITIONAL_INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';

export type FormationEvent =
  | 'SAVE_DETAILS'
  | 'ADD_PEOPLE'
  | 'VERIFY_ADDRESS'
  | 'UPLOAD_DOCUMENTS'
  | 'INITIATE_PAYMENT'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SUBMIT'
  | 'MARK_UNDER_REVIEW'
  | 'REQUEST_INFO'
  | 'PROVIDE_INFO'
  | 'APPROVE'
  | 'REJECT'
  | 'COMPLETE'
  | 'CANCEL';

// State transition rules
const STATE_TRANSITIONS: Record<FormationState, Partial<Record<FormationEvent, FormationState>>> = {
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
const STATE_REQUIREMENTS: Record<FormationState, string[]> = {
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

// ==========================================
// STATE MACHINE
// ==========================================

export interface FormationContext {
  registrationId: string;
  currentState: FormationState;
  data: Record<string, any>;
  userId: string;
}

export interface TransitionResult {
  success: boolean;
  previousState: FormationState;
  currentState: FormationState;
  errors?: string[];
}

/**
 * Check if a transition is valid
 */
export function canTransition(
  currentState: FormationState,
  event: FormationEvent
): boolean {
  return STATE_TRANSITIONS[currentState]?.[event] !== undefined;
}

/**
 * Get next state for a transition
 */
export function getNextState(
  currentState: FormationState,
  event: FormationEvent
): FormationState | null {
  return STATE_TRANSITIONS[currentState]?.[event] || null;
}

/**
 * Validate data for a state
 */
function validateStateData(
  state: FormationState,
  data: Record<string, any>
): string[] {
  const required = STATE_REQUIREMENTS[state] || [];
  const errors: string[] = [];
  
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
export async function transition(
  registrationId: string,
  event: FormationEvent,
  eventData?: Record<string, any>
): Promise<TransitionResult> {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
    include: { user: { select: { id: true, email: true, firstName: true } } },
  });
  
  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }
  
  const currentState = registration.status as FormationState;
  const nextState = getNextState(currentState, event);
  
  if (!nextState) {
    throw new ApiError(400, `Invalid transition: ${event} from ${currentState}`);
  }
  
  // Merge existing data with event data
  const mergedData = {
    ...(registration.data as Record<string, any> || {}),
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
  const history = (registration.stateHistory as any[]) || [];
  history.push({
    from: currentState,
    to: nextState,
    event,
    timestamp: new Date().toISOString(),
    data: eventData,
  });
  
  // Update registration
  await prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      status: nextState,
      data: mergedData,
      stateHistory: history,
      updatedAt: new Date(),
    },
  });
  
  logger.info('Formation state transition', {
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
async function handleTransitionSideEffects(
  userId: string,
  registrationId: string,
  fromState: FormationState,
  toState: FormationState,
  event: FormationEvent
): Promise<void> {
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
export function getAvailableTransitions(currentState: FormationState): FormationEvent[] {
  const transitions = STATE_TRANSITIONS[currentState];
  return transitions ? (Object.keys(transitions) as FormationEvent[]) : [];
}

/**
 * Get progress percentage
 */
export function getProgressPercentage(state: FormationState): number {
  const stateProgress: Record<FormationState, number> = {
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
export function getStateDescription(state: FormationState): string {
  const descriptions: Record<FormationState, string> = {
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
export function isTerminalState(state: FormationState): boolean {
  return state === 'COMPLETED' || state === 'REJECTED';
}

export const formationStateMachine = {
  canTransition,
  getNextState,
  transition,
  getAvailableTransitions,
  getProgressPercentage,
  getStateDescription,
  isTerminalState,
};
