'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateGroup, useGroups } from '@/lib/hooks';

type Group = {
  id: string;
  name: string;
  description: string;
  privacy: 'public' | 'private';
  memberCount: number;
  isMember: boolean;
};

export default function GroupsPage() {
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');

  const { data: groups = [], isLoading } = useGroups({ q: q || undefined });
  const createGroup = useCreateGroup();

  const list: Group[] = useMemo(() => (Array.isArray(groups) ? groups : []), [groups]);

  const handleCreate = () => {
    createGroup.mutate(
      { name, description, privacy },
      {
        onSuccess: () => {
          setShowCreate(false);
          setName('');
          setDescription('');
          setPrivacy('public');
        },
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Groups</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Discover and join communities.
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="w-4 h-4" />
          <span>Create</span>
        </button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search groups"
            className="w-full bg-transparent outline-none text-sm text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {showCreate && (
        <div className="card p-4 space-y-3">
          <div className="font-medium text-gray-900 dark:text-white">Create a group</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="w-full input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full input h-24"
          />
          <div className="flex items-center gap-2">
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as any)}
              className="input max-w-[160px]"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <button
              className="btn-primary"
              disabled={createGroup.isPending || !name.trim() || !description.trim()}
              onClick={handleCreate}
            >
              {createGroup.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              className="btn-outline"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="text-gray-500">Loading…</div>
        ) : list.length === 0 ? (
          <div className="text-gray-500">No groups found.</div>
        ) : (
          list.map((g) => (
            <Link
              key={g.id}
              href={`/dashboard/groups/${g.id}`}
              className={cn('card p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition')}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{g.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                    {g.description}
                  </div>
                </div>
                <div className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-600 dark:text-gray-300">
                  {g.privacy}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>{g.memberCount} members</span>
                {g.isMember && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                    Joined
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
