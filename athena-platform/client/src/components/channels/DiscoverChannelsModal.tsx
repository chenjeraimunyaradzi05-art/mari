'use client';

import { useEffect, useState } from 'react';
import { Hash, Loader2, Users } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { channelApi } from '@/lib/api-extensions';

export interface DiscoverableChannel {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  memberCount: number;
  isPublic: boolean;
  owner?: { id: string; displayName?: string | null } | null;
}

interface DiscoverChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves once the join has been recorded; the row then reads "Joined". */
  onJoin: (channel: DiscoverableChannel) => Promise<void>;
}

/**
 * Public channels the member has not joined. GET /channels/discover already
 * excluded the ones they belong to; nothing on the page ever called it, so the
 * only channels anyone could see were the ones they had been added to.
 */
export function DiscoverChannelsModal({ isOpen, onClose, onJoin }: DiscoverChannelsModalProps) {
  const [channels, setChannels] = useState<DiscoverableChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    channelApi
      .discover()
      .then((response) => {
        if (cancelled) return;
        const rows = response.data?.data;
        setChannels(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const join = async (channel: DiscoverableChannel) => {
    setJoining(channel.id);
    try {
      await onJoin(channel);
      setJoined((prev) => new Set(prev).add(channel.id));
    } finally {
      setJoining(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Browse channels"
      description="Public channels anyone can join."
      size="lg"
    >
      <div className="max-h-[60vh] overflow-y-auto p-6 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : failed ? (
          <p className="py-6 text-center text-sm text-slate-500">Could not load channels right now.</p>
        ) : channels.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Nothing new to join. You are already in every public channel.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {channels.map((channel) => {
              const isJoined = joined.has(channel.id);
              return (
                <li key={channel.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 rounded-md bg-slate-100 p-2 text-slate-500 dark:bg-slate-800">
                    <Hash className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{channel.name}</p>
                    {channel.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{channel.description}</p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Users className="w-3 h-3" />
                      {channel.memberCount} {channel.memberCount === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isJoined ? 'outline' : 'default'}
                    disabled={isJoined || joining === channel.id}
                    onClick={() => join(channel)}
                  >
                    {isJoined ? 'Joined' : joining === channel.id ? 'Joining...' : 'Join'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default DiscoverChannelsModal;
