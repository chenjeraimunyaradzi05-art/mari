"use strict";
/**
 * Phase 2 Backend Services Test Suite
 * Verifies all Phase 2 services are properly configured
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
// Import all Phase 2 services
const stripe_connect_service_1 = require("../services/stripe-connect.service");
const subscription_1 = require("../middleware/subscription");
const safety_score_service_1 = require("../services/safety-score.service");
const opportunity_verse_service_1 = require("../services/opportunity-verse.service");
const cold_start_service_1 = require("../services/cold-start.service");
const chat_storage_service_1 = require("../services/chat-storage.service");
const group_chat_service_1 = require("../services/group-chat.service");
const gdpr_worker_1 = require("../workers/gdpr.worker");
const formation_state_machine_service_1 = require("../services/formation-state-machine.service");
const invoice_service_1 = require("../services/invoice.service");
const reference_check_service_1 = require("../services/reference-check.service");
const i18n_service_1 = require("../services/i18n.service");
(0, globals_1.describe)('Phase 2: Backend Logic & Integrations', () => {
    (0, globals_1.describe)('Stripe Connect Service (Steps 21-22)', () => {
        (0, globals_1.test)('should export all required functions', () => {
            (0, globals_1.expect)(stripe_connect_service_1.stripeConnectService).toBeDefined();
            (0, globals_1.expect)(typeof stripe_connect_service_1.stripeConnectService.createConnectedAccount).toBe('function');
            (0, globals_1.expect)(typeof stripe_connect_service_1.stripeConnectService.createEscrowPayment).toBe('function');
            (0, globals_1.expect)(typeof stripe_connect_service_1.stripeConnectService.captureEscrowPayment).toBe('function');
            (0, globals_1.expect)(typeof stripe_connect_service_1.stripeConnectService.cancelEscrowPayment).toBe('function');
            (0, globals_1.expect)(typeof stripe_connect_service_1.stripeConnectService.getEarningsDashboard).toBe('function');
        });
    });
    (0, globals_1.describe)('Subscription Middleware (Step 23)', () => {
        (0, globals_1.test)('should export subscription enforcement functions', () => {
            (0, globals_1.expect)(typeof subscription_1.requireSubscription).toBe('function');
            (0, globals_1.expect)(typeof subscription_1.enforceSubscription).toBe('function');
        });
        (0, globals_1.test)('requireSubscription should return middleware', () => {
            const middleware = (0, subscription_1.requireSubscription)(['PREMIUM']);
            (0, globals_1.expect)(typeof middleware).toBe('function');
        });
    });
    (0, globals_1.describe)('Safety Score Service (Step 24)', () => {
        (0, globals_1.test)('should export all required functions', () => {
            (0, globals_1.expect)(safety_score_service_1.safetyScoreService).toBeDefined();
            (0, globals_1.expect)(typeof safety_score_service_1.safetyScoreService.calculateSafetyScore).toBe('function');
            (0, globals_1.expect)(typeof safety_score_service_1.safetyScoreService.handleUserReport).toBe('function');
            (0, globals_1.expect)(typeof safety_score_service_1.safetyScoreService.handleUserBlock).toBe('function');
        });
    });
    (0, globals_1.describe)('OpportunityVerse Feed Mixer (Step 28)', () => {
        (0, globals_1.test)('should export feed mixing functions', () => {
            (0, globals_1.expect)(opportunity_verse_service_1.opportunityVerseMixer).toBeDefined();
            (0, globals_1.expect)(typeof opportunity_verse_service_1.getMixedFeed).toBe('function');
        });
    });
    (0, globals_1.describe)('Cold Start Algorithm (Step 35)', () => {
        (0, globals_1.test)('should export cold start functions', () => {
            (0, globals_1.expect)(cold_start_service_1.coldStartAlgorithm).toBeDefined();
            (0, globals_1.expect)(typeof cold_start_service_1.coldStartAlgorithm.isUserColdStart).toBe('function');
            (0, globals_1.expect)(typeof cold_start_service_1.coldStartAlgorithm.getColdStartScore).toBe('function');
            (0, globals_1.expect)(typeof cold_start_service_1.coldStartAlgorithm.getColdStartRecommendations).toBe('function');
            (0, globals_1.expect)(typeof cold_start_service_1.coldStartAlgorithm.getOnboardingSuggestions).toBe('function');
        });
    });
    (0, globals_1.describe)('Chat Storage Service (Step 30)', () => {
        (0, globals_1.test)('should export chat storage functions', () => {
            (0, globals_1.expect)(chat_storage_service_1.chatStorageService).toBeDefined();
            (0, globals_1.expect)(typeof chat_storage_service_1.chatStorageService.storeMessage).toBe('function');
            (0, globals_1.expect)(typeof chat_storage_service_1.chatStorageService.getMessages).toBe('function');
            (0, globals_1.expect)(typeof chat_storage_service_1.chatStorageService.markAsRead).toBe('function');
            (0, globals_1.expect)(typeof chat_storage_service_1.chatStorageService.deleteMessage).toBe('function');
        });
    });
    (0, globals_1.describe)('Group Chat Service (Step 31)', () => {
        (0, globals_1.test)('should export group chat functions', () => {
            (0, globals_1.expect)(group_chat_service_1.groupChatService).toBeDefined();
            (0, globals_1.expect)(typeof group_chat_service_1.validatePermission).toBe('function');
            (0, globals_1.expect)(typeof group_chat_service_1.groupChatService.addMember).toBe('function');
            (0, globals_1.expect)(typeof group_chat_service_1.groupChatService.removeMember).toBe('function');
            (0, globals_1.expect)(typeof group_chat_service_1.groupChatService.muteMember).toBe('function');
            (0, globals_1.expect)(typeof group_chat_service_1.groupChatService.banMember).toBe('function');
        });
    });
    (0, globals_1.describe)('GDPR Worker (Steps 32-33)', () => {
        (0, globals_1.test)('should export GDPR functions', () => {
            (0, globals_1.expect)(gdpr_worker_1.gdprWorker).toBeDefined();
            (0, globals_1.expect)(typeof gdpr_worker_1.gdprWorker.processExportRequests).toBe('function');
            (0, globals_1.expect)(typeof gdpr_worker_1.gdprWorker.processDeletionRequests).toBe('function');
            (0, globals_1.expect)(typeof gdpr_worker_1.gdprWorker.cleanupExpiredExports).toBe('function');
        });
    });
    (0, globals_1.describe)('Formation State Machine (Step 34)', () => {
        (0, globals_1.test)('should export state machine functions', () => {
            (0, globals_1.expect)(formation_state_machine_service_1.formationStateMachine).toBeDefined();
            (0, globals_1.expect)(typeof formation_state_machine_service_1.formationStateMachine.transition).toBe('function');
            (0, globals_1.expect)(typeof formation_state_machine_service_1.getProgressPercentage).toBe('function');
            (0, globals_1.expect)(typeof formation_state_machine_service_1.getStateDescription).toBe('function');
        });
        (0, globals_1.test)('should calculate correct progress percentages', () => {
            (0, globals_1.expect)((0, formation_state_machine_service_1.getProgressPercentage)('DRAFT')).toBe(0);
            (0, globals_1.expect)((0, formation_state_machine_service_1.getProgressPercentage)('SUBMITTED')).toBe(10);
            (0, globals_1.expect)((0, formation_state_machine_service_1.getProgressPercentage)('COMPLETED')).toBe(100);
        });
        (0, globals_1.test)('should return state descriptions', () => {
            (0, globals_1.expect)((0, formation_state_machine_service_1.getStateDescription)('DRAFT')).toContain('draft');
            (0, globals_1.expect)((0, formation_state_machine_service_1.getStateDescription)('COMPLETED')).toContain('complete');
        });
    });
    (0, globals_1.describe)('Invoice Service (Step 38)', () => {
        (0, globals_1.test)('should export invoice functions', () => {
            (0, globals_1.expect)(invoice_service_1.invoiceService).toBeDefined();
            (0, globals_1.expect)(typeof invoice_service_1.invoiceService.generateInvoicePDF).toBe('function');
            (0, globals_1.expect)(typeof invoice_service_1.invoiceService.createInvoiceForPayment).toBe('function');
            (0, globals_1.expect)(typeof invoice_service_1.invoiceService.createInvoiceForSubscription).toBe('function');
            (0, globals_1.expect)(typeof invoice_service_1.invoiceService.getInvoice).toBe('function');
            (0, globals_1.expect)(typeof invoice_service_1.invoiceService.getUserInvoices).toBe('function');
        });
    });
    (0, globals_1.describe)('Reference Check Service (Step 39)', () => {
        (0, globals_1.test)('should export reference check functions', () => {
            (0, globals_1.expect)(reference_check_service_1.referenceCheckService).toBeDefined();
            (0, globals_1.expect)(typeof reference_check_service_1.referenceCheckService.createReferenceRequest).toBe('function');
            (0, globals_1.expect)(typeof reference_check_service_1.referenceCheckService.sendReferenceRequest).toBe('function');
            (0, globals_1.expect)(typeof reference_check_service_1.referenceCheckService.batchSendReferenceRequests).toBe('function');
            (0, globals_1.expect)(typeof reference_check_service_1.referenceCheckService.submitReferenceResponse).toBe('function');
            (0, globals_1.expect)(typeof reference_check_service_1.referenceCheckService.getCandidateReferenceSummary).toBe('function');
        });
    });
    (0, globals_1.describe)('i18n Service (Step 36)', () => {
        (0, globals_1.test)('should export i18n functions', () => {
            (0, globals_1.expect)(i18n_service_1.i18nService).toBeDefined();
            (0, globals_1.expect)(typeof i18n_service_1.i18nService.t).toBe('function');
            (0, globals_1.expect)(typeof i18n_service_1.i18nService.tSync).toBe('function');
            (0, globals_1.expect)(typeof i18n_service_1.i18nService.i18nError).toBe('function');
            (0, globals_1.expect)(typeof i18n_service_1.i18nService.i18nNotification).toBe('function');
        });
        (0, globals_1.test)('should have error keys defined', () => {
            (0, globals_1.expect)(i18n_service_1.i18nService.ERROR_KEYS).toBeDefined();
            (0, globals_1.expect)(i18n_service_1.i18nService.ERROR_KEYS.AUTH_INVALID_CREDENTIALS).toBe('errors.auth.invalidCredentials');
        });
        (0, globals_1.test)('should have notification keys defined', () => {
            (0, globals_1.expect)(i18n_service_1.i18nService.NOTIFICATION_KEYS).toBeDefined();
            (0, globals_1.expect)(i18n_service_1.i18nService.NOTIFICATION_KEYS.NEW_FOLLOWER).toBe('notifications.social.newFollower');
        });
        (0, globals_1.test)('should translate with parameters', () => {
            const result = i18n_service_1.i18nService.tSync('notifications.social.newFollower', { name: 'John' });
            (0, globals_1.expect)(result).toContain('John');
        });
    });
});
(0, globals_1.describe)('Phase 2 Service Integration', () => {
    (0, globals_1.test)('all services can be imported without errors', () => {
        // This test passes if all imports at the top succeed
        (0, globals_1.expect)(true).toBe(true);
    });
    (0, globals_1.test)('services export consistent interface patterns', () => {
        // All services should have consistent export patterns
        const services = [
            stripe_connect_service_1.stripeConnectService,
            safety_score_service_1.safetyScoreService,
            chat_storage_service_1.chatStorageService,
            group_chat_service_1.groupChatService,
            gdpr_worker_1.gdprWorker,
            formation_state_machine_service_1.formationStateMachine,
            invoice_service_1.invoiceService,
            reference_check_service_1.referenceCheckService,
            i18n_service_1.i18nService,
        ];
        services.forEach((service) => {
            (0, globals_1.expect)(service).toBeDefined();
            (0, globals_1.expect)(typeof service).toBe('object');
        });
    });
});
//# sourceMappingURL=phase2-services.test.js.map