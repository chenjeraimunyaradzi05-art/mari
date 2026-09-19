/**
 * Mobile Hooks Index
 * Phase 5: Mobile Parity
 *
 * NOT WIRED. Nothing in the app imports this directory: there is no
 * QueryClientProvider in App.tsx, and every screen reads the server through
 * services/api.ts and services/api-extensions.ts with local state and
 * AuthContext. The hooks below were written against an API that was never
 * built (`/conversations`, `/jobs/featured`, `/videos/*`, `/users/profile`
 * and so on), so a new screen must not reach for them; use the helpers in
 * services/ instead, which server/scripts/check-api-contract.js verifies
 * against the routes that exist. That check skips this directory for the
 * same reason. Kept compiling under tsc rather than deleted, following the
 * supersession-header convention in server/src/routes/salary.routes.ts.
 *
 * Central export for all React Query hooks
 */

// Auth Hooks
export {
  useCurrentUser,
  useLogin,
  useRegister,
  useLogout,
  useRefreshToken,
  useResetPassword,
  useUpdatePassword,
  useUpdateProfile,
  useSocialLogin,
  useDeleteAccount,
  useCheckEmail,
  useVerifyEmail,
  useResendVerification,
  secureStorage,
  authKeys,
} from './useAuth';

// Video Hooks
export {
  useVideoFeed,
  useVideo,
  useUserVideos,
  useLikeVideo,
  useSaveVideo,
  useFollowCreator,
  useShareVideo,
  useReportVideo,
  useAddComment,
  useVideoComments,
  useSearchVideos,
  useTrendingVideos,
  useHashtagVideos,
  useLikedVideos,
  useSavedVideos,
  useTrackView,
  videoKeys,
} from './useVideos';

// Jobs Hooks
export {
  useJobSearch,
  useJob,
  useFeaturedJobs,
  useRecommendedJobs,
  useSaveJob,
  useSavedJobs,
  useApplications,
  useApplication,
  useApplyToJob,
  useWithdrawApplication,
  useUpdateApplication,
  useSaveDraft,
  useCompany,
  useCompanyJobs,
  useQuickApply,
  useSimilarJobs,
  useSkillsMatch,
  useSetJobAlert,
  jobKeys,
} from './useJobs';

// Chat Hooks
export {
  useConversations,
  useConversation,
  useMessages,
  useSendMessage,
  useCreateConversation,
  useMarkAsRead,
  useSendTyping,
  useDeleteMessage,
  useEditMessage,
  useReactToMessage,
  useTogglePinConversation,
  useToggleMuteConversation,
  useArchiveConversation,
  useSearchMessages,
  useUploadMedia,
  useLeaveConversation,
  useAddParticipants,
  chatKeys,
} from './useChat';

// Notifications Hooks
export {
  useNotifications,
  useUnreadCount,
  useMarkAsRead as useMarkNotificationAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useArchiveNotification,
  useNotificationPreferences,
  useUpdatePreferences,
  useRegisterPushToken,
  useUnregisterPushToken,
  useTestPushNotification,
  useHandleNotificationAction,
  scheduleLocalNotification,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  getBadgeCount,
  setBadgeCount,
  clearAllDeliveredNotifications,
  requestPushPermissions,
  getPushToken,
  notificationKeys,
} from './useNotifications';
