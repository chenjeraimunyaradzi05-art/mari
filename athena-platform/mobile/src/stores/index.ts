/**
 * Mobile Stores Index
 * Phase 5: Mobile Parity
 * 
 * Central export for all Zustand stores
 */

// Auth Store
export {
  useAuthStore,
  selectUser,
  selectIsAuthenticated,
  selectIsSessionValid,
  type User,
  type AuthTokens,
} from './auth.store';

// Video Store
export {
  useVideoStore,
  selectCurrentVideo,
  selectHasNextVideo,
  selectHasPreviousVideo,
  selectWatchedVideos,
  type VideoPost,
  type FeedType,
} from './video.store';

// Chat Store
export {
  useChatStore,
  selectSelectedConversation,
  selectConversationMessages,
  selectTypingUsers,
  selectUnreadCount,
  selectPinnedConversations,
  selectArchivedConversations,
  type Message,
  type Conversation,
  type ChatParticipant,
  type TypingIndicator,
} from './chat.store';

// Jobs Store
export {
  useJobsStore,
  selectSelectedJob,
  selectApplicationsByStatus,
  selectPendingApplications,
  selectActiveApplicationsCount,
  selectSavedJobsCount,
  selectDraftApplicationsCount,
  type Job,
  type JobApplication,
  type Company,
  type JobFilters,
  type SavedSearch,
  type JobType,
  type ExperienceLevel,
  type WorkLocation,
  type ApplicationStatus,
} from './jobs.store';

// Notifications Store
export {
  useNotificationsStore,
  selectUnreadNotifications,
  selectNotificationsByCategory,
  selectArchivedNotifications,
  selectHighPriorityNotifications,
  selectTotalBadgeCount,
  selectIsQuietHoursActive,
  type Notification,
  type NotificationGroup,
  type NotificationPreferences,
  type NotificationType,
  type NotificationCategory,
} from './notifications.store';
