'use client';

import { usePathname } from 'next/navigation';
import ConversationList from '@/components/chat/ConversationList';
import ConversationDetails from '@/components/chat/ConversationDetails';
import { cn } from '@/lib/utils';

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // A phone has room for one pane: the list until a thread is opened, then
  // the thread, with the back arrow in its header returning to the list.
  // Wider screens show both, and the details pane joins them from xl up.
  const threadOpen = pathname.startsWith('/dashboard/messages/');

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div
        className={cn(
          'w-full md:w-80 flex-shrink-0 h-full border-r border-slate-200 dark:border-slate-800',
          threadOpen && 'hidden md:block'
        )}
      >
        <ConversationList />
      </div>
      <div className={cn('flex-1 min-w-0 h-full relative', !threadOpen && 'hidden md:block')}>
        {children}
      </div>
      <div className="hidden xl:block w-80 flex-shrink-0 h-full">
        <ConversationDetails />
      </div>
    </div>
  );
}
