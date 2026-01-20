import React, { useEffect } from 'react';
import { useConversations } from '@/lib/hooks';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useChatStore, Conversation as StoreConversation } from '@/lib/stores/chat.store';
import { Skeleton } from '@/components/ui/loading';

export default function ConversationList() {
  const { data: apiConversations, isLoading } = useConversations();
  const { conversations, setConversations, activeConversationId } = useChatStore();
  const pathname = usePathname();

  // Sync API data to Global Store
  useEffect(() => {
    if (apiConversations) {
      const mappedConversations: StoreConversation[] = apiConversations.map((c: {
        id: string;
        participant: { id: string; firstName: string; lastName: string; avatar?: string };
        lastMessage?: { senderId: string; content: string; createdAt: string };
        unreadCount: number;
        updatedAt: string;
      }) => ({
        id: c.id,
        participants: [c.participant].map(p => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          avatar: p.avatar || undefined,
        })),
        lastMessage: c.lastMessage ? {
          id: 'temp-id', // API might not be returning ID on the list view
          senderId: c.lastMessage.senderId,
          content: c.lastMessage.content,
          createdAt: c.lastMessage.createdAt,
          type: 'text', // simplification
        } : undefined,
        unreadCount: c.unreadCount,
        updatedAt: c.updatedAt,
      }));
      setConversations(mappedConversations);
    }
  }, [apiConversations, setConversations]);

  if (isLoading && conversations.length === 0) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return <div className="p-4 text-gray-500">No conversations yet.</div>;
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-full max-w-xs overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Messages</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const isActive = pathname === `/dashboard/messages/${conversation.id}` || activeConversationId === conversation.id;
          const participant = conversation.participants[0] || { name: 'Unknown', avatar: undefined };
          const initials = participant.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <Link
              key={conversation.id}
              href={`/dashboard/messages/${conversation.id}`}
              className={`block p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                isActive ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                    {participant.avatar ? (
                        <img 
                            src={participant.avatar} 
                            alt={participant.name} 
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
                            {initials}
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {participant.name}
                    </h3>
                    {conversation.lastMessage && (
                        <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: false })}
                        </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                        {conversation.lastMessage ? conversation.lastMessage.content : 'Started a conversation'}
                    </p>
                    {conversation.unreadCount > 0 && (
                        <span className="ml-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {conversation.unreadCount}
                        </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
