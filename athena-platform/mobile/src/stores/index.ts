/**
 * Mobile Stores Index
 * Phase 5: Mobile Parity
 *
 * NOT WIRED. Nothing in the app imports this directory. Auth state lives in
 * context/AuthContext.tsx, and every screen keeps its own list state next to
 * the services/api.ts helper it calls; these Zustand stores describe an app
 * that was never assembled and carry the same stale endpoints as ../hooks.
 * A new screen must not build on them. Kept compiling under tsc rather than
 * deleted, following the supersession-header convention in
 * server/src/routes/salary.routes.ts; server/scripts/check-api-contract.js
 * skips this directory for the same reason.
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
