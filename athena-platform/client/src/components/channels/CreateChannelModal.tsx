'use client';

import { useState } from 'react';
import { X, Hash, Lock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description: string;
    type: 'public' | 'private';
  }) => void;
}

export function CreateChannelModal({ isOpen, onClose, onCreate }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }

    if (name.length < 2) {
      setError('Channel name must be at least 2 characters');
      return;
    }

    // Validate channel name format
    if (!/^[a-z0-9-]+$/.test(name.toLowerCase().replace(/\s/g, '-'))) {
      setError('Channel name can only contain letters, numbers, and hyphens');
      return;
    }

    onCreate({
      name: name.toLowerCase().replace(/\s+/g, '-'),
      description,
      type,
    });

    // Reset form
    setName('');
    setDescription('');
    setType('public');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create a Channel" size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Channels are where your community communicates. They're best when organized around a topic.
        </p>

        {/* Channel type */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Channel Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('public')}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border-2 transition-colors',
                type === 'public'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <Hash className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Public</p>
                <p className="text-xs text-gray-500">Anyone can join</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setType('private')}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border-2 transition-colors',
                type === 'private'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Private</p>
                <p className="text-xs text-gray-500">Invite only</p>
              </div>
            </button>
          </div>
        </div>

        {/* Channel name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Channel Name
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {type === 'public' ? '#' : '🔒'}
            </span>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. career-advice"
              className="pl-8"
              error={error}
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this channel about?"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create Channel</Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateChannelModal;
