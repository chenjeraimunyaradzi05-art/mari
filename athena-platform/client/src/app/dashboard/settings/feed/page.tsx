'use client';

/**
 * Feed settings: everything that shapes the ranked feed, in one place and
 * undoable. The mix between people you follow and discovery, the creators
 * and topics you asked to see less of, the topics you follow, and a link to
 * muted words.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Hash, Loader2, Rss, Users, VolumeX, X } from 'lucide-react';
import { feedPreferencesApi, topicApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';

type Prefs = {
  inNetworkRatio: number;
  blockedCreators: string[];
  blockedHashtags: string[];
  followedHashtags: string[];
  blockedCreatorProfiles: Array<{ id: string; name: string; avatar: string | null; headline: string | null }>;
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

function Chip({ label, onRemove, removeLabel }: { label: string; onRemove: () => void; removeLabel: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {label}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export default function FeedSettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const [ratio, setRatio] = useState(0.3);
  const [newMuted, setNewMuted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['feed-preferences'],
    queryFn: feedPreferencesApi.get,
    enabled: isAuthenticated && !authLoading,
    select: (response) => {
      const p = response.data?.data ?? {};
      return {
        inNetworkRatio: typeof p.inNetworkRatio === 'number' ? p.inNetworkRatio : 0.3,
        blockedCreators: Array.isArray(p.blockedCreators) ? p.blockedCreators : [],
        blockedHashtags: Array.isArray(p.blockedHashtags) ? p.blockedHashtags : [],
        followedHashtags: Array.isArray(p.followedHashtags) ? p.followedHashtags : [],
        blockedCreatorProfiles: Array.isArray(p.blockedCreatorProfiles) ? p.blockedCreatorProfiles : [],
      } as Prefs;
    },
  });

  useEffect(() => {
    if (data) setRatio(data.inNetworkRatio);
  }, [data]);

  const update = useMutation({
    mutationFn: feedPreferencesApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['followed-topics'] });
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not save that'),
  });

  const unfollowTopic = useMutation({
    mutationFn: (tag: string) => topicApi.unfollow(tag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['followed-topics'] });
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not unfollow that topic'),
  });

  const saveRatio = () => {
    update.mutate({ inNetworkRatio: ratio }, { onSuccess: () => toast.success('Feed mix saved') });
  };

  const unmuteCreator = (id: string) => {
    if (!data) return;
    update.mutate(
      { blockedCreators: data.blockedCreators.filter((c) => c !== id) },
      { onSuccess: () => toast.success('You will see their posts again') }
    );
  };

  const unmuteTopic = (tag: string) => {
    if (!data) return;
    update.mutate({ blockedHashtags: data.blockedHashtags.filter((t) => t !== tag) }, { onSuccess: () => toast.success(`#${tag} unmuted`) });
  };

  const muteTopic = () => {
    const tag = newMuted.trim().replace(/^#+/, '').toLowerCase();
    if (!tag || !data) return;
    if (data.blockedHashtags.includes(tag)) {
      setNewMuted('');
      return;
    }
    update.mutate({ blockedHashtags: [...data.blockedHashtags, tag] }, { onSuccess: () => toast.success(`#${tag} muted`) });
    setNewMuted('');
  };

  const followPct = Math.round(ratio * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Rss className="h-6 w-6" /> Your feed
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          What shapes your feed, in one place. Everything here can be undone.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <section className="card space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Users className="h-5 w-5" /> Feed mix
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                How much of your feed comes from people you follow. The rest is discovery: members like you and what is trending.
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {followPct}% people you follow · {100 - followPct}% discovery
              </span>
              <input
                type="range"
                min={10}
                max={90}
                step={10}
                value={followPct}
                onChange={(event) => setRatio(Number(event.target.value) / 100)}
                aria-label="Share of the feed from people you follow"
                className="mt-2 w-full accent-rose-600"
              />
              <span className="mt-1 flex justify-between text-xs text-slate-400">
                <span>More discovery</span>
                <span>More people you follow</span>
              </span>
            </label>
            <button type="button" onClick={saveRatio} disabled={update.isPending || ratio === data.inNetworkRatio} className="btn-primary px-4 py-2 text-sm">
              Save mix
            </button>
          </section>

          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Hash className="h-5 w-5" /> Topics you follow
            </h2>
            {data.followedHashtags.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                None yet. Follow a topic from its page or the community rail and your feed leans towards it.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.followedHashtags.map((tag) => (
                  <Chip key={tag} label={`#${tag}`} removeLabel={`Unfollow #${tag}`} onRemove={() => unfollowTopic.mutate(tag)} />
                ))}
              </div>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <VolumeX className="h-5 w-5" /> Seeing less of
            </h2>
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Creators</h3>
              {data.blockedCreatorProfiles.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nobody. &ldquo;See fewer from&rdquo; on a post or reel adds them here.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                  {data.blockedCreatorProfiles.map((person) => (
                    <li key={person.id} className="flex items-center gap-3 py-2">
                      <Avatar src={person.avatar || undefined} alt={person.name} fallback={person.name.slice(0, 2).toUpperCase()} size="sm" />
                      <span className="min-w-0 flex-1">
                        <Link href={`/profile/${person.id}`} className="block truncate text-sm font-medium text-slate-900 hover:underline dark:text-white">
                          {person.name}
                        </Link>
                        {person.headline && <span className="block truncate text-xs text-slate-500">{person.headline}</span>}
                      </span>
                      <button type="button" onClick={() => unmuteCreator(person.id)} disabled={update.isPending} className="btn-outline px-3 py-1 text-xs">
                        Show again
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Topics</h3>
              {data.blockedHashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.blockedHashtags.map((tag) => (
                    <Chip key={tag} label={`#${tag}`} removeLabel={`Unmute #${tag}`} onRemove={() => unmuteTopic(tag)} />
                  ))}
                </div>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  muteTopic();
                }}
                className="mt-2 flex items-center gap-2"
              >
                <input
                  value={newMuted}
                  onChange={(event) => setNewMuted(event.target.value)}
                  maxLength={64}
                  placeholder="Mute a topic, e.g. #layoffs"
                  aria-label="Topic to mute"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button type="submit" disabled={update.isPending || !newMuted.trim()} className="btn-outline px-3 py-1.5 text-sm">
                  Mute
                </button>
              </form>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Muted words apply to posts and comments and live with your{' '}
              <Link href="/settings/privacy" className="text-primary-600 hover:underline">
                privacy settings
              </Link>
              .
            </p>
          </section>
        </>
      )}
    </div>
  );
}
