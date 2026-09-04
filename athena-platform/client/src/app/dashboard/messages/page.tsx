'use client';

import { use, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useStartConversation } from '@/lib/hooks';
import { Loading } from '@/components/ui/loading';

/**
 * The conversation index. "Message" buttons elsewhere in the app link here with
 * ?user=<id> rather than a conversation id, because the thread may not exist
 * yet — so this page resolves that id into a conversation and hands over to it.
 *
 * The hand-over reads the mutation's own result rather than a callback passed
 * to mutate(): those callbacks are dropped if the page re-mounts while the
 * request is in flight, which is exactly what happens here while the session
 * is being restored, and the reader was left on "Opening conversation..."
 * for ever with the thread already created behind them.
 */
export default function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string | string[] }>;
}) {
  const { user } = use(searchParams);
  const targetUserId = Array.isArray(user) ? user[0] : user;

  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const startConversation = useStartConversation();
  const { mutate: openConversation } = startConversation;
  // Guards against React re-running the effect and opening the thread twice.
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    // Wait for the session: fired earlier this is a 401, a refresh and a retry.
    if (!targetUserId || authLoading || requestedFor.current === targetUserId) return;
    requestedFor.current = targetUserId;
    openConversation(targetUserId);
  }, [targetUserId, authLoading, openConversation]);

  const conversationId: string | undefined = startConversation.data?.data?.data?.id;
  useEffect(() => {
    if (!conversationId) return;
    // replace, not push: backing out should return to the profile the reader
    // came from, not bounce through this resolver again.
    router.replace(`/dashboard/messages/${conversationId}`);
  }, [conversationId, router]);

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
