'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  authApi, 
  userApi, 
  jobApi, 
  postApi, 
  notificationApi, 
  messageApi, 
  aiApi,
  mentorApi,
  courseApi,
  subscriptionApi,
  educationApi,
  formationApi,
  eventsApi,
  groupsApi,
  statusApi,
} from './api';
import { useAuthStore, useUIStore, useNotificationStore, useMessageStore } from './store';
import { getAccessToken } from './auth';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

// Re-export stores for convenience
export { useAuthStore, useUIStore, useNotificationStore, useMessageStore };

// ============================================
// UTILITY HOOKS
// ============================================
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================
// AUTH HOOKS
// ============================================
export function useAuth() {
  const { user, isAuthenticated, isLoading, login, logout, setUser, setLoading } = useAuthStore();
  const queryClient = useQueryClient();

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token && !user) {
        try {
          const response = await authApi.me();
          setUser(response.data.data);
        } catch (error) {
          logout();
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (response) => {
      const { user, accessToken, refreshToken } = response.data.data;
      login(user, accessToken, refreshToken);
      queryClient.invalidateQueries();
      toast.success('Welcome back!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Login failed');
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (response) => {
      const { user, accessToken, refreshToken } = response.data.data;
      login(user, accessToken, refreshToken);
      queryClient.invalidateQueries();
      toast.success('Welcome to ATHENA!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Registration failed');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      logout();
      queryClient.clear();
      toast.success('See you soon!');
    },
    onError: () => {
      logout();
      queryClient.clear();
    },
  });

  return {
    user,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginPending: loginMutation.isPending,
    isRegisterPending: registerMutation.isPending,
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      logout();
      queryClient.clear();
      toast.success('See you soon!');
    },
    onError: () => {
      logout();
      queryClient.clear();
    },
  });
}

// ============================================
// USER HOOKS
// ============================================
export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => userApi.getProfile(userId!),
    enabled: !!userId,
    select: (response) => response.data.data,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { updateUser } = useAuthStore();

  return useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (response) => {
      updateUser(response.data.data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    },
  });
}

// ============================================
// SKILLS HOOKS
// ============================================
export function useMySkills() {
  return useQuery({
    queryKey: ['my-skills'],
    queryFn: userApi.getMySkills,
    select: (response) => response.data.data,
  });
}

export function useAddSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ skillName, level }: { skillName: string; level?: number }) =>
      userApi.addSkill(skillName, level),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-skills'] });
      toast.success('Skill added');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add skill');
    },
  });
}

export function useRemoveSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (skillId: string) => userApi.removeSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-skills'] });
      toast.success('Skill removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove skill');
    },
  });
}

export function useFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.follow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Following!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to follow');
    },
  });
}

export function useUnfollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.unfollow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Unfollowed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to unfollow');
    },
  });
}

// Aliases for follow/unfollow
export function useFollowUser() {
  return useFollow();
}

export function useUnfollowUser() {
  return useUnfollow();
}

// ============================================
// PRIVACY / DSAR HOOKS
// ============================================
export function useExportMyData() {
  return useMutation({
    mutationFn: userApi.exportMyData,
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to export data');
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: userApi.deleteAccount,
    onSuccess: () => {
      logout();
      queryClient.clear();
      toast.success('Account deleted');
      window.location.href = '/';
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete account');
    },
  });
}

// ============================================
// JOB HOOKS
// ============================================
export function useJobs(params?: any) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => jobApi.search(params),
    select: (response) => response.data.data,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => jobApi.getById(id),
    enabled: !!id,
    select: (response) => response.data.data,
  });
}

export function useJobRecommendations() {
  return useQuery({
    queryKey: ['job-recommendations'],
    queryFn: jobApi.getRecommendations,
    select: (response) => response.data.data,
  });
}

export function useApplyToJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: any }) => 
      jobApi.apply(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job'] });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      toast.success('Application submitted!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to apply');
    },
  });
}

export function useMyApplications() {
  return useQuery({
    queryKey: ['my-applications'],
    queryFn: jobApi.getMyApplications,
    select: (response) => response.data.data,
  });
}

export function useSavedJobs() {
  return useQuery({
    queryKey: ['saved-jobs'],
    queryFn: jobApi.getSavedJobs,
    select: (response) => response.data.data,
  });
}

// ============================================
// EDUCATION (Week 10) HOOKS
// ============================================

export type EducationProvider = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  type?: string | null;
  isVerified?: boolean;
};

export type EducationProviderListResponse = {
  data: EducationProvider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export function useEducationProviders(params?: {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
}) {
  return useQuery({
    queryKey: ['education-providers', params],
    queryFn: () => educationApi.listProviders(params),
    select: (response): EducationProviderListResponse => response.data,
  });
}

export function useEducationProvider(slug?: string) {
  return useQuery({
    queryKey: ['education-provider', slug],
    queryFn: () => educationApi.getProviderBySlug(slug!),
    enabled: !!slug,
    select: (response) => response.data.data,
  });
}

export function useMyEducationApplications() {
  return useQuery({
    queryKey: ['my-education-applications'],
    queryFn: educationApi.getMyApplications,
    select: (response) => response.data.data,
  });
}

export function useCreateEducationApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: educationApi.createApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-education-applications'] });
      toast.success('Application created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create application');
    },
  });
}

// ============================================
// FORMATION HOOKS
// ============================================
export function useFormations() {
  return useQuery({
    queryKey: ['formations'],
    queryFn: formationApi.list,
    select: (response) => response.data,
  });
}

export function useFormation(id?: string) {
  return useQuery({
    queryKey: ['formation', id],
    queryFn: () => formationApi.getById(id as string),
    enabled: Boolean(id),
    select: (response) => response.data,
  });
}

export function useCreateFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: formationApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
      toast.success('Formation created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to create formation');
    },
  });
}

export function useUpdateFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      formationApi.update(id, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
      queryClient.invalidateQueries({ queryKey: ['formation', variables.id] });
      toast.success('Formation updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to update formation');
    },
  });
}

export function useSubmitFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => formationApi.submit(id),
    onSuccess: (_response, id) => {
      queryClient.invalidateQueries({ queryKey: ['formations'] });
      queryClient.invalidateQueries({ queryKey: ['formation', id] });
      toast.success('Formation submitted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to submit formation');
    },
  });
}

export function useSaveJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: jobApi.saveJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job saved!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save job');
    },
  });
}

export function useUnsaveJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: jobApi.unsaveJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job removed from saved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to unsave job');
    },
  });
}

// ============================================
// POST HOOKS
// ============================================
export function useFeed(params?: any) {
  return useQuery({
    queryKey: ['feed', params],
    queryFn: () => postApi.getFeed(params),
    select: (response) => response.data.data,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => postApi.getById(id),
    enabled: !!id,
    select: (response) => response.data.data,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Post created!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create post');
    },
  });
}

export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postApi.like,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    },
  });
}

export function useUnlikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postApi.unlike,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      toast.success('Post deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete post');
    },
  });
}

export function useCommentOnPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      postApi.comment(postId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post'] });
      toast.success('Comment added!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to comment');
    },
  });
}

// ============================================
// EVENTS HOOKS
// ============================================

export function useEvents(params?: { type?: string; q?: string }) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => eventsApi.list(params),
    select: (response) => response.data.data,
  });
}

export function useRegisterEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: eventsApi.register,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to register');
    },
  });
}

export function useUnregisterEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: eventsApi.unregister,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to unregister');
    },
  });
}

export function useSaveEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: eventsApi.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save event');
    },
  });
}

export function useUnsaveEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: eventsApi.unsave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to unsave event');
    },
  });
}

// ============================================
// GROUPS HOOKS
// ============================================

export function useGroups(params?: { q?: string }) {
  return useQuery({
    queryKey: ['groups', params],
    queryFn: () => groupsApi.list(params),
    select: (response) => response.data.data,
  });
}

export function useGroup(id?: string) {
  return useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.getById(id!),
    enabled: !!id,
    select: (response) => response.data.data,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create group');
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsApi.join,
    onSuccess: (res, id) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group', id] });

      const status = (res as any)?.data?.data?.status;
      if (status === 'pending') {
        toast.success('Request sent');
      } else {
        toast.success('Joined group');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to join group');
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsApi.leave,
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast.success('Left group');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to leave group');
    },
  });
}

export function useMyGroupJoinRequest(groupId?: string) {
  return useQuery({
    queryKey: ['group-join-request', groupId],
    queryFn: () => groupsApi.getMyJoinRequest(groupId!),
    enabled: !!groupId,
    select: (response) => response.data.data,
    retry: false,
  });
}

export function useCancelMyGroupJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsApi.cancelMyJoinRequest,
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ['group-join-request', id] });
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast.success('Request cancelled');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel request');
    },
  });
}

export function useGroupPosts(groupId?: string) {
  return useQuery({
    queryKey: ['group-posts', groupId],
    queryFn: () => groupsApi.listPosts(groupId!),
    enabled: !!groupId,
    select: (response) => response.data.data,
  });
}

export function useCreateGroupPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, content }: { groupId: string; content: string }) =>
      groupsApi.createPost(groupId, content),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['group-posts', vars.groupId] });
      toast.success('Posted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to post');
    },
  });
}

// ============================================
// STATUS / STORIES HOOKS
// ============================================

export function useStatusFeed() {
  return useQuery({
    queryKey: ['status', 'feed'],
    queryFn: statusApi.feed,
    select: (response) => response.data.data,
    refetchInterval: 30000,
  });
}

export function useCreateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: statusApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status', 'feed'] });
      toast.success('Story posted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to post story');
    },
  });
}

export function useDeleteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: statusApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status', 'feed'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete story');
    },
  });
}



// ============================================
// NOTIFICATION HOOKS
// ============================================
export function useNotifications(params?: any) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationApi.getAll(params),
    select: (response) => response.data.data,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ============================================
// MESSAGE HOOKS
// ============================================
export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: messageApi.getConversations,
    select: (response) => response.data.data,
    refetchInterval: 30000,
  });
}

export function useMessages(userId: string) {
  return useQuery({
    queryKey: ['messages', userId],
    queryFn: () => messageApi.getMessages(userId),
    enabled: !!userId,
    select: (response) => response.data.data,
    refetchInterval: 5000, // Refetch every 5 seconds for active chat
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ receiverId, content }: { receiverId: string; content: string }) =>
      messageApi.send(receiverId, content),
    onSuccess: (_, { receiverId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', receiverId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send message');
    },
  });
}

export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ['unread-messages'],
    queryFn: messageApi.getUnreadCount,
    select: (response) => response.data.data.count,
    refetchInterval: 30000,
  });
}

// ============================================
// AI HOOKS
// ============================================
export function useOpportunityRadar() {
  return useQuery({
    queryKey: ['opportunity-radar'],
    queryFn: aiApi.opportunityRadar,
    select: (response) => response.data.data,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useScanOpportunities() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await aiApi.scanOpportunities(data);
      return response.data.data || response.data;
    },
    onSuccess: () => {
      toast.success('Opportunities scanned!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to scan opportunities');
    },
  });
}

export function useResumeOptimizer() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await aiApi.resumeOptimizer(data);
      return response.data.data || response.data;
    },
    onSuccess: () => {
      toast.success('Resume analysis complete!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to analyze resume');
    },
  });
}

export function useInterviewCoach() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await aiApi.interviewCoach(data);
      return response.data.data || response.data;
    },
    onSuccess: () => {
      toast.success('Interview questions generated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate questions');
    },
  });
}

export function useCareerPath() {
  return useQuery({
    queryKey: ['career-path'],
    queryFn: aiApi.careerPath,
    select: (response) => response.data.data,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useGenerateCareerPath() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await aiApi.generateCareerPath(data);
      return response.data.data || response.data;
    },
    onSuccess: () => {
      toast.success('Career path generated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate career path');
    },
  });
}

export function useAIChat() {
  return useMutation({
    mutationFn: async ({ message, context }: { message: string; context?: any[] }) => {
      const response = await aiApi.chat(message, context);
      return response.data.data || response.data;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'AI chat failed');
    },
  });
}

export function useContentGenerator() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await aiApi.contentGenerator(data);
      return response.data.data || response.data;
    },
     onSuccess: () => {
      toast.success('Content generated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate content');
    },
  });
}

export function useIdeaValidator() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await aiApi.ideaValidator(data);
      return response.data.data || response.data;
    },
     onSuccess: () => {
      toast.success('Idea validated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to validate idea');
    },
  });
}

// ============================================
// MENTOR HOOKS
// ============================================
export function useMentors(params?: any) {
  return useQuery({
    queryKey: ['mentors', params],
    queryFn: () => mentorApi.getAll(params),
    select: (response) => response.data.data,
  });
}

export function useMentor(id: string) {
  return useQuery({
    queryKey: ['mentor', id],
    queryFn: () => mentorApi.getById(id),
    enabled: !!id,
    select: (response) => response.data.data,
  });
}

export function useBecomeMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mentorApi.become,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Mentor application submitted!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to apply');
    },
  });
}

export function useBookMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => 
      mentorApi.bookSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentor'] });
      toast.success('Session booked successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to book session');
    },
  });
}

// ============================================
// COURSE HOOKS
// ============================================
export function useCourses(params?: any) {
  return useQuery({
    queryKey: ['courses', params],
    queryFn: () => courseApi.getAll(params),
    select: (response) => ({
      courses: response.data.data,
      totalCourses: response.data.pagination?.total ?? response.data.data?.length ?? 0,
      totalPages: response.data.pagination?.pages ?? 1,
      pagination: response.data.pagination,
    }),
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => courseApi.getById(id),
    enabled: !!id,
    select: (response) => response.data.data,
  });
}

export function useMyCourses() {
  return useQuery({
    queryKey: ['my-courses'],
    queryFn: courseApi.getMyCourses,
    select: (response) => response.data.data,
  });
}

export function useEnrollCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: courseApi.enroll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-courses'] });
      queryClient.invalidateQueries({ queryKey: ['course'] });
      toast.success('Enrolled successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to enroll');
    },
  });
}

// ============================================
// SUBSCRIPTION HOOKS
// ============================================
export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionApi.getCurrent,
    select: (response) => response.data.data,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: subscriptionApi.createCheckout,
    onSuccess: (response) => {
      if (response.data.data.url) {
        window.location.href = response.data.data.url;
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create checkout');
    },
  });
}

export function useManageBilling() {
  return useMutation({
    mutationFn: async () => {
      const response = await subscriptionApi.createPortal();
      return response.data.data || response.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to open billing portal');
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscriptionApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast.success('Subscription cancelled');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel subscription');
    },
  });
}

// ============================================
// NOTIFICATION PREFERENCES HOOKS
// ============================================
export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationApi.getPreferences,
    select: (response) => response.data.data,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationApi.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferences updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    },
  });
}

// ============================================
// REFERRAL HOOKS
// ============================================
export function useMyReferrals() {
  return useQuery({
    queryKey: ['my-referrals'],
    queryFn: async () => {
      const { referralApi } = await import('./api');
      const response = await referralApi.getMyReferrals();
      return response.data;
    },
  });
}

export function useValidateReferralCode(code: string | null) {
  return useQuery({
    queryKey: ['validate-referral', code],
    queryFn: async () => {
      if (!code) return null;
      const { referralApi } = await import('./api');
      const response = await referralApi.validateCode(code);
      return response.data;
    },
    enabled: !!code,
    retry: false,
  });
}

export function useReferralLeaderboard() {
  return useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn: async () => {
      const { referralApi } = await import('./api');
      const response = await referralApi.getLeaderboard();
      return response.data;
    },
  });
}

export function useReferralShareLinks() {
  return useQuery({
    queryKey: ['referral-share-links'],
    queryFn: async () => {
      const { referralApi } = await import('./api');
      const response = await referralApi.getShareLinks();
      return response.data;
    },
  });
}

export function useTrackReferral() {
  return useMutation({
    mutationFn: async (data: { referralCode: string; newUserId: string; source?: string }) => {
      const { referralApi } = await import('./api');
      const response = await referralApi.trackReferral(data);
      return response.data;
    },
    onError: (error: any) => {
      console.error('Failed to track referral:', error);
    },
  });
}

// ============================================
// EMPLOYER HOOKS
// ============================================
export function useMyOrganizations() {
  return useQuery({
    queryKey: ['my-organizations'],
    queryFn: async () => {
      const { employerApi } = await import('./api');
      const response = await employerApi.getMyOrganizations();
      return response.data;
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      type?: string;
      description?: string;
      website?: string;
      industry?: string;
      size?: string;
      location?: string;
      brandColor?: string;
    }) => {
      const { employerApi } = await import('./api');
      const response = await employerApi.createOrganization(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-organizations'] });
      toast.success('Organization created!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create organization');
    },
  });
}

export function useOrganizationDashboard(orgId: string) {
  return useQuery({
    queryKey: ['org-dashboard', orgId],
    queryFn: async () => {
      const { employerApi } = await import('./api');
      const response = await employerApi.getOrganizationDashboard(orgId);
      return response.data;
    },
    enabled: !!orgId,
  });
}

export function useOrganizationJobs(orgId: string, status?: string) {
  return useQuery({
    queryKey: ['org-jobs', orgId, status],
    queryFn: async () => {
      const { employerApi } = await import('./api');
      const response = await employerApi.getOrganizationJobs(orgId, { status });
      return response.data;
    },
    enabled: !!orgId,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, data }: { orgId: string; data: any }) => {
      const { employerApi } = await import('./api');
      const response = await employerApi.createJob(orgId, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-jobs', variables.orgId] });
      toast.success('Job posted!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to post job');
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, data }: { jobId: string; data: any }) => {
      const { employerApi } = await import('./api');
      const response = await employerApi.updateJob(jobId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-jobs'] });
      toast.success('Job updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update job');
    },
  });
}

export function useOrganizationApplications(orgId: string, params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['org-applications', orgId, params],
    queryFn: async () => {
      const { employerApi } = await import('./api');
      const response = await employerApi.getOrganizationApplications(orgId, params);
      return response.data;
    },
    enabled: !!orgId,
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: string }) => {
      const { employerApi } = await import('./api');
      const response = await employerApi.updateApplicationStatus(applicationId, status);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-applications'] });
      toast.success('Application status updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update status');
    },
  });
}

export function useOrganizationTeam(orgId: string) {
  return useQuery({
    queryKey: ['org-team', orgId],
    queryFn: async () => {
      const { employerApi } = await import('./api');
      const response = await employerApi.getOrganizationTeam(orgId);
      return response.data;
    },
    enabled: !!orgId,
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, email, role }: { orgId: string; email: string; role: string }) => {
      const { employerApi } = await import('./api');
      const response = await employerApi.inviteTeamMember(orgId, { email, role });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-team', variables.orgId] });
      toast.success('Team member invited!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to invite member');
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, memberId }: { orgId: string; memberId: string }) => {
      const { employerApi } = await import('./api');
      const response = await employerApi.removeTeamMember(orgId, memberId);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-team', variables.orgId] });
      toast.success('Team member removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    },
  });
}

export function useOrganizationAnalytics(orgId: string) {
  return useQuery({
    queryKey: ['org-analytics', orgId],
    queryFn: async () => {
      const { employerApi } = await import('./api');
      const response = await employerApi.getOrganizationAnalytics(orgId);
      return response.data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
