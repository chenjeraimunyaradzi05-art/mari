'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Loader2, Users, ExternalLink, BookOpen } from 'lucide-react';
import { communitySupportApi } from '@/lib/api';

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
  const [resourceType, setResourceType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [communitiesRes, resourcesRes] = await Promise.all([
        communitySupportApi.getIndigenousCommunities(),
        communitySupportApi.getIndigenousResources({ type: resourceType || undefined }),
      ]);
      setCommunities(communitiesRes.data?.data || []);
      setResources(resourcesRes.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-amber-600">
          <Heart className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">First Nations</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Indigenous Women Empowerment
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
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
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {/* Communities */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Women&apos;s Communities
            </h2>
            {communities.length === 0 ? (
              <p className="text-sm text-gray-500">No communities available yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {communities.map((community) => (
                  <div
                    key={community.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{community.name}</h3>
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
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{community.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {community.membersCount} members
                      </span>
                      {community.isWomenOnly && (
                        <span className="text-amber-600">Women only</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleJoin(community.id)}
                      disabled={joining === community.id}
                      className="w-full btn-primary text-sm"
                    >
                      {joining === community.id ? 'Joining...' : 'Join community'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Resources */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Resources & Support
              </h2>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                {Object.entries(resourceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {resources.length === 0 ? (
              <p className="text-sm text-gray-500">No resources available in this category.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map((resource) => (
                  <div
                    key={resource.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-amber-600">
                        {resourceTypeLabels[resource.type] || resource.type}
                      </span>
                      {resource.isNational && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 px-2 py-1 rounded-full">
                          National
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{resource.title}</h3>

                    {resource.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{resource.description}</p>
                    )}

                    {resource.partnerOrg && (
                      <p className="text-xs text-gray-500 mb-3">
                        <BookOpen className="w-3 h-3 inline mr-1" />
                        {resource.partnerOrg}
                      </p>
                    )}

                    {resource.url && (
                      <a
                        href={resource.url}
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
          </section>
        </>
      )}

      {/* Partner Organizations */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Our Partners
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4">
            <p className="font-medium text-gray-900 dark:text-white">Reconciliation Australia</p>
            <p className="text-xs text-gray-500">National reconciliation</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-gray-900 dark:text-white">Indigenous Mentors</p>
            <p className="text-xs text-gray-500">Career guidance</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-gray-900 dark:text-white">First Australians Capital</p>
            <p className="text-xs text-gray-500">Business funding</p>
          </div>
          <div className="p-4">
            <p className="font-medium text-gray-900 dark:text-white">NIAA</p>
            <p className="text-xs text-gray-500">Government support</p>
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
