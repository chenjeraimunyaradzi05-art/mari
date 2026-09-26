'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Loader2, Users, ExternalLink, BookOpen } from 'lucide-react';
import { api, communitySupportApi } from '@/lib/api';
import { safeHref } from '@/lib/safe-href';

type IndigenousCommunity = {
  id: string;
  name: string;
  description?: string;
  region?: string;
  nation?: string;
  isWomenOnly: boolean;
  membersCount: number;
  isVerified: boolean;
  culturalProtocols?: string;
  /** Present when she is signed in: whether she already belongs to it. */
  isMember?: boolean;
};

type IndigenousResource = {
  id: string;
  title: string;
  description?: string;
  type: string;
  url?: string;
  partnerOrg?: string;
  isNational: boolean;
};

const resourceTypeLabels: Record<string, string> = {
  FUNDING: 'Funding',
  MENTORSHIP: 'Mentorship',
  JOB_BOARD: 'Jobs',
  TRAINING: 'Training',
  CULTURAL: 'Cultural',
};

export default function IndigenousPage() {
  const [communities, setCommunities] = useState<IndigenousCommunity[]>([]);
  const [resources, setResources] = useState<IndigenousResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  // A failed load leaves both lists empty; this keeps that from reading as
  // "no communities yet" and "no resources".
  const [loadFailed, setLoadFailed] = useState(false);
  const [resourceType, setResourceType] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Both catalogues are paged server-side, fifty to a page, and this page only
  // ever asked for the first one — so a fifty-first community or resource could
  // not be reached at all. Each list gets its own "Show more", which fetches the
  // next page and adds it to what is already on screen. hasMore is the server's
  // own answer: a response without a pagination block offers no button rather
  // than guessing from how many rows came back.
  const [communityPage, setCommunityPage] = useState(1);
  const [hasMoreCommunities, setHasMoreCommunities] = useState(false);
  const [loadingMoreCommunities, setLoadingMoreCommunities] = useState(false);
  const [resourcePage, setResourcePage] = useState(1);
  const [hasMoreResources, setHasMoreResources] = useState(false);
  const [loadingMoreResources, setLoadingMoreResources] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const [communitiesRes, resourcesRes] = await Promise.all([
        communitySupportApi.getIndigenousCommunities({ page: 1 }),
        communitySupportApi.getIndigenousResources({ type: resourceType || undefined, page: 1 }),
      ]);
      setCommunities(communitiesRes.data?.data || []);
      setCommunityPage(1);
      setHasMoreCommunities(Boolean(communitiesRes.data?.pagination?.hasMore));
      setResources(resourcesRes.data?.data || []);
      setResourcePage(1);
      setHasMoreResources(Boolean(resourcesRes.data?.pagination?.hasMore));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load data');
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreCommunities = async () => {
    setLoadingMoreCommunities(true);
    setError(null);
    try {
      const next = communityPage + 1;
      const res = await communitySupportApi.getIndigenousCommunities({ page: next });
      const more: IndigenousCommunity[] = res.data?.data || [];
      setCommunities((current) => [...current, ...more]);
      setCommunityPage(next);
      setHasMoreCommunities(Boolean(res.data?.pagination?.hasMore));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load more communities');
    } finally {
      setLoadingMoreCommunities(false);
    }
  };

  const loadMoreResources = async () => {
    setLoadingMoreResources(true);
    setError(null);
    try {
      const next = resourcePage + 1;
      const res = await communitySupportApi.getIndigenousResources({ type: resourceType || undefined, page: next });
      const more: IndigenousResource[] = res.data?.data || [];
      setResources((current) => [...current, ...more]);
      setResourcePage(next);
      setHasMoreResources(Boolean(res.data?.pagination?.hasMore));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load more resources');
    } finally {
      setLoadingMoreResources(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceType]);

  const handleJoin = async (communityId: string) => {
    setJoining(communityId);
    setError(null);
    try {
      await communitySupportApi.joinIndigenousCommunity(communityId);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to join community');
    } finally {
      setJoining(null);
    }
  };

  /*
   * Leaving a community. The server has had a leave route, but this page
   * offered only "Join", so a woman who joined the wrong community — or who no
   * longer wants her name on a cultural community's member list — had to
   * write to someone. The API module has no method for it, so the shared
   * client is called directly: DELETE /community-support/indigenous/communities/:id/join.
   */
  const handleLeave = async (community: IndigenousCommunity) => {
    if (!window.confirm(`Leave ${community.name}?`)) return;
    setLeaving(community.id);
    setError(null);
    try {
      await api.delete(`/community-support/indigenous/communities/${community.id}/join`);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Could not leave that community. Please try again.');
    } finally {
      setLeaving(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-amber-600">
          <Heart className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">First Nations</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
          Indigenous Women Empowerment
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Connect with First Nations communities, mentors, and resources
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {/* Cultural Acknowledgement */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
          Acknowledgement of Country
        </h2>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          We acknowledge the Traditional Custodians of the lands on which we work and live.
          We pay our respects to Elders past, present, and emerging, and recognize their
          continuing connection to land, waters, and culture.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : loadFailed ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-sm text-slate-500">
          We could not load communities and resources just now.{' '}
          <button type="button" onClick={loadData} className="font-medium text-primary-600 hover:underline">
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Communities */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Women&apos;s Communities
            </h2>
            {communities.length === 0 ? (
              <p className="text-sm text-slate-500">No communities available yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {communities.map((community) => (
                  <div
                    key={community.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{community.name}</h3>
                        {community.nation && (
                          <p className="text-xs text-amber-600">{community.nation}</p>
                        )}
                      </div>
                      {community.isVerified && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                          Verified
                        </span>
                      )}
                    </div>

                    {community.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{community.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {community.membersCount} members
                      </span>
                      {community.isWomenOnly && (
                        <span className="text-amber-600">Women only</span>
                      )}
                    </div>

                    {community.isMember ? (
                      <button
                        onClick={() => handleLeave(community)}
                        disabled={leaving === community.id}
                        className="w-full btn-secondary text-sm"
                      >
                        {leaving === community.id ? 'Leaving...' : 'Leave community'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoin(community.id)}
                        disabled={joining === community.id}
                        className="w-full btn-primary text-sm"
                      >
                        {joining === community.id ? 'Joining...' : 'Join community'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {hasMoreCommunities && (
              <div className="text-center mt-4">
                <button onClick={loadMoreCommunities} disabled={loadingMoreCommunities} className="btn-secondary">
                  {loadingMoreCommunities ? 'Loading more...' : 'Show more communities'}
                </button>
              </div>
            )}
          </section>

          {/* Resources */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Resources & Support
              </h2>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                {Object.entries(resourceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {resources.length === 0 ? (
              <p className="text-sm text-slate-500">No resources available in this category.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map((resource) => (
                  <div
                    key={resource.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-amber-600">
                        {resourceTypeLabels[resource.type] || resource.type}
                      </span>
                      {resource.isNational && (
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 px-2 py-1 rounded-full">
                          National
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{resource.title}</h3>

                    {resource.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{resource.description}</p>
                    )}

                    {resource.partnerOrg && (
                      <p className="text-xs text-slate-500 mb-3">
                        <BookOpen className="w-3 h-3 inline mr-1" />
                        {resource.partnerOrg}
                      </p>
                    )}

                    {resource.url && (
                      <a
                        href={safeHref(resource.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto inline-flex items-center gap-1 text-sm text-amber-600 hover:underline"
                      >
                        Learn more <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            {hasMoreResources && (
              <div className="text-center mt-4">
                <button onClick={loadMoreResources} disabled={loadingMoreResources} className="btn-secondary">
                  {loadingMoreResources ? 'Loading more...' : 'Show more resources'}
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {/* Partner Organizations */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Our Partners
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4">
            <p className="font-medium text-slate-900 dark:text-white">Reconciliation Australia</p>
            <p className="text-xs text-slate-500">National reconciliation</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-slate-900 dark:text-white">Indigenous Mentors</p>
            <p className="text-xs text-slate-500">Career guidance</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-slate-900 dark:text-white">First Australians Capital</p>
            <p className="text-xs text-slate-500">Business funding</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-slate-900 dark:text-white">NIAA</p>
            <p className="text-xs text-slate-500">Government support</p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link href="/dashboard/impact" className="text-sm text-primary-600 hover:underline">
          ← Back to Impact Hub
        </Link>
      </div>
    </div>
  );
}
