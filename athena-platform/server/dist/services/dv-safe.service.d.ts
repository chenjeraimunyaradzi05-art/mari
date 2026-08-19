/**
 * DV-Safe (Domestic Violence Safety) Features Service
 * Privacy-first features for survivors of domestic violence
 *
 * Note: Currently uses in-memory storage. When SafetySettings and UserBlock
 * models are added to the Prisma schema, DB persistence can be enabled.
 */
export interface SafetySettings {
    userId: string;
    isSafeMode: boolean;
    hideFromSearch: boolean;
    allowMessages: boolean;
    safeExitEnabled: boolean;
    safeExitUrl: string;
    hiddenChats: string[];
    blockedUsers: string[];
    emergencyContacts: EmergencyContact[];
    panicButtonEnabled: boolean;
    activityLogEnabled: boolean;
    disguisedAppIcon: boolean;
    notificationsSafe: boolean;
}
export interface EmergencyContact {
    id: string;
    name: string;
    phone: string;
    email?: string;
    relationship: string;
    notifyOnPanic: boolean;
}
export interface SafeChat {
    id: string;
    userId: string;
    name: string;
    disguisedName: string;
    participants: string[];
    isHidden: boolean;
    accessPin?: string;
    lastActivity: Date;
    messages: SafeMessage[];
}
export interface SafeMessage {
    id: string;
    senderId: string;
    content: string;
    isEncrypted: boolean;
    autoDeleteAt?: Date;
    createdAt: Date;
}
/**
 * Get or create safety settings for a user
 */
export declare function getSafetySettings(userId: string): Promise<SafetySettings>;
/**
 * Update safety settings
 */
export declare function updateSafetySettings(userId: string, updates: Partial<SafetySettings>): Promise<SafetySettings>;
/**
 * Enable Safe Mode (quick activation)
 */
export declare function enableSafeMode(userId: string): Promise<SafetySettings>;
/**
 * Create a hidden/safe chat room
 */
export declare function createSafeChat(userId: string, options: {
    name: string;
    disguisedName?: string;
    participants?: string[];
    accessPin?: string;
    autoDeleteHours?: number;
}): Promise<SafeChat>;
/**
 * Get user's safe chats
 */
export declare function getSafeChats(userId: string, accessPin?: string): SafeChat[];
/**
 * Access safe chat with PIN verification
 */
export declare function accessSafeChat(userId: string, chatId: string, pin?: string): SafeChat | null;
/**
 * Send message to safe chat (auto-encrypted)
 */
export declare function sendSafeChatMessage(userId: string, chatId: string, content: string, autoDeleteHours?: number): SafeMessage | null;
/**
 * Trigger panic button - notify emergency contacts
 */
export declare function triggerPanicButton(userId: string): Promise<{
    success: boolean;
    notifiedContacts: string[];
    timestamp: Date;
}>;
/**
 * Add emergency contact
 */
export declare function addEmergencyContact(userId: string, contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact>;
/**
 * Remove emergency contact
 */
export declare function removeEmergencyContact(userId: string, contactId: string): Promise<boolean>;
/**
 * Block user (for DV safety)
 */
export declare function blockUser(userId: string, blockedUserId: string): Promise<boolean>;
/**
 * Check if user should be visible to searcher
 */
export declare function isUserVisible(targetUserId: string, searcherUserId?: string): Promise<boolean>;
/**
 * Get safe notification content (no sensitive info)
 */
export declare function getSafeNotificationContent(settings: SafetySettings, originalTitle: string, originalMessage: string): {
    title: string;
    message: string;
};
/**
 * Delete all activity traces (for safety)
 */
export declare function clearActivityTraces(userId: string): Promise<boolean>;
/**
 * Get DV resources and hotlines by region
 */
export declare function getDVResources(region?: string): DVResource[];
export interface DVResource {
    name: string;
    phone: string;
    website: string;
    description: string;
    available: string;
}
declare const _default: {
    getSafetySettings: typeof getSafetySettings;
    updateSafetySettings: typeof updateSafetySettings;
    enableSafeMode: typeof enableSafeMode;
    createSafeChat: typeof createSafeChat;
    getSafeChats: typeof getSafeChats;
    accessSafeChat: typeof accessSafeChat;
    sendSafeChatMessage: typeof sendSafeChatMessage;
    triggerPanicButton: typeof triggerPanicButton;
    addEmergencyContact: typeof addEmergencyContact;
    removeEmergencyContact: typeof removeEmergencyContact;
    blockUser: typeof blockUser;
    isUserVisible: typeof isUserVisible;
    getSafeNotificationContent: typeof getSafeNotificationContent;
    clearActivityTraces: typeof clearActivityTraces;
    getDVResources: typeof getDVResources;
};
export default _default;
//# sourceMappingURL=dv-safe.service.d.ts.map