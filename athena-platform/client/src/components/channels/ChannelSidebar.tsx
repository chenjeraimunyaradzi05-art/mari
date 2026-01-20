'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Hash, 
  Lock, 
  Plus, 
  Search, 
  Settings, 
  Users, 
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Bell,
  BellOff,
  MoreHorizontal
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
}

interface ChannelSidebarProps {
  channels: Channel[];
  activeChannelId?: string;
  onChannelSelect: (channelId: string) => void;
  onCreateChannel: () => void;
  onSearchClick?: () => void;
}

export function ChannelSidebar({
  channels,
  activeChannelId,
  onChannelSelect,
  onCreateChannel,
  onSearchClick,
}: ChannelSidebarProps) {
  const [expandedSections, setExpandedSections] = useState({
    channels: true,
    directMessages: true,
  });
  const [searchQuery, setSearchQuery] = useState('');

  const publicChannels = channels.filter((c) => c.type === 'public');
  const privateChannels = channels.filter((c) => c.type === 'private');
  const directMessages = channels.filter((c) => c.type === 'direct');

  const filteredChannels = (list: Channel[]) =>
    list.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const toggleSection = (section: 'channels' | 'directMessages') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.type === 'direct') {
      return (
        <Avatar
          src={channel.icon}
          fallback={channel.name[0]}
          size="sm"
        />
      );
    }
    if (channel.type === 'private') {
      return <Lock className="w-4 h-4 text-gray-500" />;
    }
    return <Hash className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Community</h2>
          <Button variant="ghost" size="icon" onClick={onCreateChannel}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Public Channels */}
        <div className="mb-2">
          <button
            onClick={() => toggleSection('channels')}
            className="w-full flex items-center px-4 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
          >
            {expandedSections.channels ? (
              <ChevronDown className="w-3 h-3 mr-1" />
            ) : (
              <ChevronRight className="w-3 h-3 mr-1" />
            )}
            Channels
          </button>
          
          {expandedSections.channels && (
            <div className="mt-1 space-y-0.5">
              {filteredChannels([...publicChannels, ...privateChannels]).map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === activeChannelId}
                  onClick={() => onChannelSelect(channel.id)}
                  icon={getChannelIcon(channel)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Direct Messages */}
        <div>
          <button
            onClick={() => toggleSection('directMessages')}
            className="w-full flex items-center px-4 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
          >
            {expandedSections.directMessages ? (
              <ChevronDown className="w-3 h-3 mr-1" />
            ) : (
              <ChevronRight className="w-3 h-3 mr-1" />
            )}
            Direct Messages
          </button>
          
          {expandedSections.directMessages && (
            <div className="mt-1 space-y-0.5">
              {filteredChannels(directMessages).map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === activeChannelId}
                  onClick={() => onChannelSelect(channel.id)}
                  icon={getChannelIcon(channel)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={onCreateChannel}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Channel
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
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{channel.name}</span>
      {channel.unreadCount > 0 && (
        <span className="flex-shrink-0 bg-primary-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
          {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
        </span>
      )}
      {channel.isMuted && (
        <BellOff className="w-3 h-3 text-gray-400 flex-shrink-0" />
      )}
    </button>
  );
}

export default ChannelSidebar;
