'use client';

import { useEffect, useState } from 'react';
import { Share2, CheckCircle2, Copy, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { channelApi } from '@/lib/api-extensions';
import { postApi } from '@/lib/api';

interface ChannelOption {
  id: string;
  name: string;
  description?: string | null;
}

interface CrossModuleShareProps {
  title: string;
  url: string;
  description?: string;
  entityType?: 'job' | 'video' | 'course' | 'resource';
  entityId?: string;
}

export function CrossModuleShareButton({ title, url, description, entityType }: CrossModuleShareProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Share2 className="h-4 w-4 mr-2" /> Share
      </Button>
      <CrossModuleShareDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        url={url}
        description={description}
        entityType={entityType}
      />
    </>
  );
}

interface DialogProps extends CrossModuleShareProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CrossModuleShareDialog({
  isOpen,
  onClose,
  title,
  url,
  description,
  entityType = 'resource',
  entityId,
}: DialogProps) {
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingChannels(true);
    channelApi
      .getMyChannels()
      .then((response) => {
        const channelData = response.data.data?.channels || [];
        setChannels(channelData.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
        })));
      })
      .catch(() => {
        setChannels([]);
      })
      .finally(() => setLoadingChannels(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prefix = entityType === 'job' ? 'Job' : entityType === 'video' ? 'Video' : 'Resource';
    const baseMessage = `${prefix} share: ${title}`;
    const detail = description ? `\n${description}` : '';
    setMessage(`${baseMessage}${detail}\n${url}`);
    setSelected([]);
  }, [isOpen, title, description, url, entityType]);

  if (!isOpen) return null;

  const toggleChannel = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      await postApi.shareToFeed({
        title,
        url,
        description,
        message,
        entityType,
        entityId,
      });

      if (selected.length) {
        await Promise.all(
          selected.map((channelId) =>
            channelApi.sendMessage(channelId, { content: message })
          )
        );
      }
      onClose();
    } finally {
      setSharing(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <Card
        className="bg-white dark:bg-gray-900 w-full max-w-xl mx-4 p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Share across ATHENA</h3>
            <p className="text-sm text-gray-500">Send this to channels or copy the link.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Share to Channels</p>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="ml-2">Copy Link</span>
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2">
              {loadingChannels && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading channels...
                </div>
              )}
              {!loadingChannels && channels.length === 0 && (
                <p className="text-sm text-gray-500">You are not part of any channels yet.</p>
              )}
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => toggleChannel(channel.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                    selected.includes(channel.id)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{channel.name}</p>
                    {channel.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">{channel.description}</p>
                    )}
                  </div>
                  {selected.includes(channel.id) && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleShare} disabled={sharing}>
              {sharing ? 'Sharing...' : 'Share'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
