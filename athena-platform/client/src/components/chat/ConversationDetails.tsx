'use client';

import Link from 'next/link';
import { Info, ShieldCheck, User, Image as ImageIcon, Paperclip } from 'lucide-react';
import { useChatStore } from '@/lib/stores/chat.store';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ConversationDetails() {
  const { activeConversationId, conversations } = useChatStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const participant = conversation?.participants?.[0];

  if (!conversation || !participant) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-6">
        <Info className="w-8 h-8 mb-2" />
        <p className="text-sm">Select a conversation to see details.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="p-5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Avatar
            src={participant.avatar}
            fallback={participant.name?.slice(0, 2).toUpperCase() || 'U'}
            className="w-12 h-12"
          />
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {participant.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active now</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <ShieldCheck className="w-3 h-3 mr-1" /> Safety Verified
          </Badge>
          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <User className="w-3 h-3 mr-1" /> Community Member
          </Badge>
        </div>
      </div>

      <div className="p-5 space-y-6 overflow-y-auto">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 dark:text-gray-500">Actions</p>
          <div className="mt-3 space-y-2">
            <Link
              href={`/dashboard/profile/${participant.id}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <User className="w-4 h-4 mr-2" /> View Profile
            </Link>
            <Button variant="outline" className="w-full justify-start">
              <Paperclip className="w-4 h-4 mr-2" /> Share Files
            </Button>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 dark:text-gray-500">Shared Media</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="aspect-square rounded-lg border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400"
              >
                <ImageIcon className="w-4 h-4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
