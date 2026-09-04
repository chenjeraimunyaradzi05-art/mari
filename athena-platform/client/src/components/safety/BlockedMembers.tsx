'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { safetyApi } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';

/**
 * The members this account has blocked, with a way to undo it. Blocking was
 * possible from a profile but nothing listed the blocks afterwards, so a block
 * made in anger was permanent.
 */

type BlockRow = {
  blockedUserId: string;
  reason?: string | null;
  createdAt?: string;
  user?: { id: string; displayName?: string | null; avatar?: string | null; headline?: string | null } | null;
};

export function BlockedMembers() {
  const [blocks, setBlocks] = useState<BlockRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    safetyApi
      .getBlocks()
      .then((response) => {
        if (cancelled) return;
        const rows = response.data?.data;
        setBlocks(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unblock = async (row: BlockRow) => {
    const name = row.user?.displayName?.trim() || 'this member';
    if (!window.confirm(`Unblock ${name}? They will be able to message you and see your posts again.`)) return;
    setBusy(row.blockedUserId);
    try {
      await safetyApi.unblockUser(row.blockedUserId);
      setBlocks((prev) => (prev ?? []).filter((b) => b.blockedUserId !== row.blockedUserId));
      toast.success(`${name} is unblocked`);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not unblock this member');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <div className="flex items-start space-x-4">
        <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
          <Ban className="w-5 h-5 text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Blocked members</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Blocked members cannot message you, and you will not see each other&apos;s posts.
          </p>

          <div className="mt-4">
            {failed ? (
              <p className="text-sm text-slate-500">Could not load your blocked members right now.</p>
            ) : blocks === null ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : blocks.length === 0 ? (
              <p className="text-sm text-slate-500">You have not blocked anyone.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {blocks.map((row) => {
                  const name = row.user?.displayName?.trim() || 'Member';
                  return (
                    <li key={row.blockedUserId} className="flex items-center gap-3 py-3">
                      <Avatar src={row.user?.avatar ?? undefined} alt={name} fallback={name.slice(0, 2).toUpperCase()} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${row.blockedUserId}`}
                          className="block truncate text-sm font-medium text-slate-900 hover:underline dark:text-white"
                        >
                          {name}
                        </Link>
                        {row.user?.headline && (
                          <p className="truncate text-xs text-slate-500">{row.user.headline}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => unblock(row)}
                        disabled={busy === row.blockedUserId}
                        className="btn-outline px-3 py-1.5 text-sm"
                      >
                        {busy === row.blockedUserId ? 'Unblocking...' : 'Unblock'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlockedMembers;
