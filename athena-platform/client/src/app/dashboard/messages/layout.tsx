'use client';

import ConversationList from '@/components/chat/ConversationList';
import ConversationDetails from '@/components/chat/ConversationDetails';

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden"> 
      {/* Assuming 64px is header height, adjust if needed */}
      <div className="w-80 flex-shrink-0 h-full border-r border-gray-200 dark:border-gray-800">
        <ConversationList />
      </div>
      <div className="flex-1 h-full relative">
        {children}
      </div>
      <div className="hidden xl:block w-80 flex-shrink-0 h-full">
        <ConversationDetails />
      </div>
    </div>
  );
}
