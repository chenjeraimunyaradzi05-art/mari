'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { feedPreferencesApi, postApi, type ReactionType } from './api';

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** React with a meaning, change the reaction, or (type null) take it back. */
export function useReactToPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, type }: { postId: string; type: ReactionType | null }) =>
      type ? postApi.react(postId, type) : postApi.unlike(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save your reaction')),
  });
}

export function useVoteInPoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, optionId }: { postId: string; optionId: string }) => postApi.vote(postId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Your vote was not counted')),
  });
}

export function useToggleCommentLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, commentId, liked }: { postId: string; commentId: string; liked: boolean }) =>
      liked ? postApi.unlikeComment(postId, commentId) : postApi.likeComment(postId, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['post'] }),
    onError: (error) => toast.error(errorMessage(error, 'Could not update the like')),
  });
}

export function usePinPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, pinned }: { postId: string; pinned: boolean }) => postApi.pin(postId, pinned),
    onSuccess: (_res, { pinned }) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      toast.success(pinned ? 'Pinned to your profile' : 'Unpinned');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not pin that post')),
  });
}

export function useScheduledPosts(enabled = true) {
  return useQuery({
    queryKey: ['scheduled-posts'],
    queryFn: postApi.getScheduled,
    select: (response) => (Array.isArray(response.data?.data) ? response.data.data : []),
    enabled,
  });
}

/**
 * "See fewer posts from X": adds the author to the viewer's blocked creators
 * list, which the ranked feeds exclude. It is a feed preference, not a
 * block: the person can still message, follow and see you.
 */
export function useSeeFewerFrom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (authorId: string) => {
      const current = await feedPreferencesApi.get();
      const blocked: string[] = Array.isArray(current.data?.data?.blockedCreators) ? current.data.data.blockedCreators : [];
      if (blocked.includes(authorId)) return current;
      return feedPreferencesApi.update({ blockedCreators: [...blocked, authorId] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success('You will see fewer posts from them');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update your feed')),
  });
}
