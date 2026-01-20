/**
 * Formation State Machine Service
 * Manages business registration workflow states
 * Phase 2: Backend Logic & Integrations
 */
export type FormationState = 'DRAFT' | 'DETAILS_COMPLETE' | 'PEOPLE_ADDED' | 'ADDRESS_VERIFIED' | 'DOCUMENTS_UPLOADED' | 'PAYMENT_PENDING' | 'PAYMENT_COMPLETE' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ADDITIONAL_INFO_REQUIRED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type FormationEvent = 'SAVE_DETAILS' | 'ADD_PEOPLE' | 'VERIFY_ADDRESS' | 'UPLOAD_DOCUMENTS' | 'INITIATE_PAYMENT' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'SUBMIT' | 'MARK_UNDER_REVIEW' | 'REQUEST_INFO' | 'PROVIDE_INFO' | 'APPROVE' | 'REJECT' | 'COMPLETE' | 'CANCEL';
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
export declare function canTransition(currentState: FormationState, event: FormationEvent): boolean;
/**
 * Get next state for a transition
 */
export declare function getNextState(currentState: FormationState, event: FormationEvent): FormationState | null;
/**
 * Execute a state transition
 */
export declare function transition(registrationId: string, event: FormationEvent, eventData?: Record<string, any>): Promise<TransitionResult>;
/**
 * Get available transitions from current state
 */
export declare function getAvailableTransitions(currentState: FormationState): FormationEvent[];
/**
 * Get progress percentage
 */
export declare function getProgressPercentage(state: FormationState): number;
/**
 * Get state description
 */
export declare function getStateDescription(state: FormationState): string;
/**
 * Check if state is terminal
 */
export declare function isTerminalState(state: FormationState): boolean;
export declare const formationStateMachine: {
    canTransition: typeof canTransition;
    getNextState: typeof getNextState;
    transition: typeof transition;
    getAvailableTransitions: typeof getAvailableTransitions;
    getProgressPercentage: typeof getProgressPercentage;
    getStateDescription: typeof getStateDescription;
    isTerminalState: typeof isTerminalState;
};
//# sourceMappingURL=formation-state-machine.service.d.ts.map