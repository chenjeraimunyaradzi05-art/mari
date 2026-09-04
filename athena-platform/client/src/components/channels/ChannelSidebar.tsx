'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BellOff,
  ChevronDown,
  ChevronRight,
  Compass,
  Hash,
  Lock,
  MessageSquare,
  Plus,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'direct';
  icon?: string;
  unreadCount: number;
  lastMessage?: {
    content: string;
    authorName: string;
    createdAt: string;
  };
  memberCount: number;
  isMuted: boolean;
  /** Whether the viewer belongs to it. Public channels are listed either way. */
  isMember?: boolean;
  ownerId?: string;
  allowReplies?: boolean;
}

interface ChannelSidebarProps {
  channels: Channel[];
  activeChannelId?: string;
  onChannelSelect: (channelId: string) => void;
  onCreateChannel: () => void;
  onDiscover?: () => void;
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  onChannelSelect,
  onCreateChannel,
  onDiscover,
}: ChannelSidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.trim().toLowerCase();
  const visible = channels.filter((c) => c.type !== 'direct' && (!query || c.name.toLowerCase().includes(query)));
  // The ones you belong to first, then the public rooms you could join.
  const joined = visible.filter((c) => c.isMember !== false);
  const open = visible.filter((c) => c.isMember === false);

  const getChannelIcon = (channel: Channel) => {
    if (channel.icon) {
      return <Avatar src={channel.icon} fallback={channel.name[0]} size="xs" />;
    }
    if (channel.type === 'private') {
      return <Lock className="w-4 h-4 text-slate-500" />;
    }
    return <Hash className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div
      className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full"
      data-testid="channel-sidebar"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Community</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreateChannel}
            aria-label="Create channel"
            data-testid="create-channel-button"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
            data-testid="channel-search"
          />
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="mb-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center px-4 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-200"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
            Channels
          </button>

          {expanded && (
            <div className="mt-1 space-y-0.5">
              {joined.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === activeChannelId}
                  onClick={() => onChannelSelect(channel.id)}
                  icon={getChannelIcon(channel)}
                />
              ))}
              {joined.length === 0 && (
                <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {query ? 'No channel by that name.' : 'You have not joined a channel yet.'}
                </p>
              )}
            </div>
          )}
        </div>

        {expanded && open.length > 0 && (
          <div className="mb-2">
            <p className="px-4 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Open to join
            </p>
            <div className="mt-1 space-y-0.5">
              {open.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === activeChannelId}
                  onClick={() => onChannelSelect(channel.id)}
                  icon={getChannelIcon(channel)}
                />
              ))}
            </div>
          </div>
        )}

        {/* One-to-one threads are a different product (Messages), not an
            always-empty "Direct Messages" section here. */}
        <div className="mt-4 px-2">
          <Link
            href="/dashboard/messages"
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          >
            <MessageSquare className="w-4 h-4 text-slate-500" />
            Direct messages
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {onDiscover && (
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={onDiscover}>
            <Compass className="w-4 h-4 mr-2" />
            Browse channels
          </Button>
        )}
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onCreateChannel}>
          <Plus className="w-4 h-4 mr-2" />
          Create channel
        </Button>
      </div>
    </div>
  );
}

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

function ChannelItem({ channel, isActive, onClick, icon }: ChannelItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-4 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
      aria-current={isActive ? 'true' : undefined}
      data-testid="channel-item"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{channel.name}</span>
      {channel.unreadCount > 0 && (
        <span className="flex-shrink-0 bg-primary-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
          {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
        </span>
      )}
      {channel.isMuted && (
        <BellOff className="w-3 h-3 text-slate-400 flex-shrink-0" />
      )}
    </button>
  );
}

export default ChannelSidebar;
