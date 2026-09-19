'use client';

/**
 * A group's admins tend it here: the name, what it is for, and whether
 * anyone can join or people ask first. Closing the group sits at the
 * bottom, quiet and confirmed, because it takes the posts and the chat with
 * it. Featuring, pinning and hiding stay with the operator console.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDeleteGroup, useUpdateGroup } from '@/lib/hooks';

type Privacy = 'public' | 'private';

type GroupForSettings = {
  id: string;
  name: string;
  description?: string | null;
  privacy: Privacy;
  memberCount: number;
};

const NAME_MAX = 100;
const DESCRIPTION_MAX = 2000;

export function GroupSettings({ group }: { group: GroupForSettings }) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [privacy, setPrivacy] = useState<Privacy>(group.privacy);
  const update = useUpdateGroup();
  const close = useDeleteGroup();

  const savedDescription = group.description ?? '';
  const changes: { name?: string; description?: string; privacy?: Privacy } = {};
  if (name.trim() !== group.name) changes.name = name.trim();
  if (description.trim() !== savedDescription) changes.description = description.trim();
  if (privacy !== group.privacy) changes.privacy = privacy;
  const dirty = Object.keys(changes).length > 0;
  const canSave = dirty && name.trim().length >= 3 && description.trim().length > 0 && !update.isPending;

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    update.mutate({ groupId: group.id, ...changes });
  };

  const undo = () => {
    setName(group.name);
    setDescription(savedDescription);
    setPrivacy(group.privacy);
  };

  const closeGroup = () => {
    const who = group.memberCount <= 1 ? 'You are the only member.' : `Its ${group.memberCount} members lose it too.`;
    if (!window.confirm(`Close ${group.name}? ${who} The posts and chat go with it, and there is no undo.`)) return;
    close.mutate(group.id, { onSuccess: () => router.push('/dashboard/groups') });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card space-y-4 p-6">
        <div>
          <label htmlFor="group-settings-name" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Name
          </label>
          <input
            id="group-settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX}
            className="input mt-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="group-settings-description" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            What it is for
          </label>
          <textarea
            id="group-settings-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            className="input mt-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="group-settings-privacy" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Who can join
          </label>
          <select
            id="group-settings-privacy"
            value={privacy}
            onChange={(event) => setPrivacy(event.target.value === 'private' ? 'private' : 'public')}
            className="input mt-1 max-w-xs"
          >
            <option value="public">Anyone can join</option>
            <option value="private">People ask, and an admin says yes</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={!canSave}>
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
          {dirty && (
            <button type="button" className="btn-outline" onClick={undo}>
              Undo
            </button>
          )}
        </div>
      </form>

      <div className="card p-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Done with this group? Closing it removes it for everyone, along with its posts and chat.
        </p>
        <button
          type="button"
          onClick={closeGroup}
          disabled={close.isPending}
          className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
        >
          {close.isPending ? 'Closing…' : 'Close this group'}
        </button>
      </div>
    </div>
  );
}

export default GroupSettings;
