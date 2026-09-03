'use client';

import { use, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStartConversation } from '@/lib/hooks';
import { Loading } from '@/components/ui/loading';

/**
 * The conversation index. "Message" buttons elsewhere in the app link here with
 * ?user=<id> rather than a conversation id, because the thread may not exist
 * yet — so this page resolves that id into a conversation and hands over to it.
 */
export default function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string | string[] }>;
}) {
  const { user } = use(searchParams);
  const targetUserId = Array.isArray(user) ? user[0] : user;

  const router = useRouter();
  const startConversation = useStartConversation();
  // Guards against React re-running the effect and opening the thread twice.
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!targetUserId || requestedFor.current === targetUserId) return;
    requestedFor.current = targetUserId;

    startConversation.mutate(targetUserId, {
      onSuccess: (response) => {
        const conversationId = response.data?.data?.id;
        if (conversationId) {
          // replace, not push: backing out should return to the profile the
          // reader came from, not bounce through this resolver again.
          router.replace(`/dashboard/messages/${conversationId}`);
        }
      },
    });
  }, [targetUserId, router, startConversation]);

  if (targetUserId && !startConversation.isError) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-950">
        <Loading message="Opening conversation..." />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
      <div className="text-center px-6">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">
          {startConversation.isError ? 'Could not open that conversation' : 'Select a conversation'}
        </h3>
        <p className="mt-1">
          {startConversation.isError
            ? 'They may not be accepting messages right now.'
            : 'Choose a conversation from the list to start chatting.'}
        </p>
      </div>
    </div>
  );
}
