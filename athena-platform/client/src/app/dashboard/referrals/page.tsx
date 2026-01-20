'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Gift, 
  Users, 
  Copy, 
  Check,
  Share2,
  Trophy,
  Coins,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface ReferralData {
  referralCode: string;
  referralLink: string;
  stats: {
    totalReferrals: number;
    pendingReferrals: number;
    completedReferrals: number;
    creditsEarned: number;
  };
  referrals: Array<{
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    referred: {
      id: string;
      firstName: string;
      lastName: string;
      avatar: string | null;
    };
  }>;
}

interface ShareLinks {
  referralLink: string;
  whatsapp: string;
  twitter: string;
  linkedin: string;
  facebook: string;
  email: string;
  copyText: string;
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar: string | null;
  referrals: number;
  credits: number;
}

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'leaderboard'>('overview');

  const { data: referralData, isLoading: referralLoading } = useQuery<ReferralData>({
    queryKey: ['my-referrals'],
    queryFn: async () => {
      const response = await api.get('/referrals/me');
      return response.data;
    },
  });

  const { data: shareLinks } = useQuery<ShareLinks>({
    queryKey: ['share-links'],
    queryFn: async () => {
      const response = await api.get('/referrals/share-links');
      return response.data;
    },
    enabled: !!referralData?.referralCode,
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ['referral-leaderboard'],
    queryFn: async () => {
      const response = await api.get('/referrals/leaderboard');
      return response.data;
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (referralLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Gift className="h-7 w-7 text-purple-600" />
          Referral Program
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Invite friends and earn rewards together!
        </p>
      </div>

      {/* Referral Code Card */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 mb-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-purple-100 text-sm">Your Referral Code</p>
            <p className="text-3xl font-bold tracking-wider">{referralData?.referralCode}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => copyToClipboard(referralData?.referralLink || '')}
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white/10 rounded-lg">
          <p className="text-sm text-purple-100 truncate">{referralData?.referralLink}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-gray-500">Total Referrals</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {referralData?.stats.totalReferrals || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="h-4 w-4 text-green-500" />
            <span className="text-sm text-gray-500">Completed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {referralData?.stats.completedReferrals || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">⏳</span>
            <span className="text-sm text-gray-500">Pending</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {referralData?.stats.pendingReferrals || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-gray-500">Credits Earned</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {referralData?.stats.creditsEarned || 0}
          </p>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share Your Link
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <a
            href={shareLinks?.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <span>WhatsApp</span>
          </a>
          <a
            href={shareLinks?.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
          >
            <span>Twitter</span>
          </a>
          <a
            href={shareLinks?.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>LinkedIn</span>
          </a>
          <a
            href={shareLinks?.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <span>Facebook</span>
          </a>
          <a
            href={shareLinks?.email}
            className="flex items-center justify-center gap-2 p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span>Email</span>
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          How It Works
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Referral History
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'leaderboard'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Trophy className="h-4 w-4 inline mr-1" />
          Leaderboard
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">How Referrals Work</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">1. Share Your Link</h4>
                <p className="text-sm text-gray-500">Share your unique referral link with friends via social media, email, or messaging.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-pink-600" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">2. Friend Joins</h4>
                <p className="text-sm text-gray-500">When your friend signs up using your link and completes their profile.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Gift className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">3. Both Get Rewarded</h4>
                <p className="text-sm text-gray-500">You both earn 100 credits that can be used for premium features!</p>
              </div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mt-6">
              <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">💡 Pro Tips</h4>
              <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                <li>• Share on LinkedIn for professional connections</li>
                <li>• Post in women-focused communities and groups</li>
                <li>• Add your referral link to your email signature</li>
                <li>• No limit on how many friends you can refer!</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Your Referrals</h3>
            {referralData?.referrals && referralData.referrals.length > 0 ? (
              <div className="space-y-3">
                {referralData.referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {referral.referred.avatar ? (
                        <img
                          src={referral.referred.avatar}
                          alt={referral.referred.firstName}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-purple-600 font-medium">
                            {referral.referred.firstName[0]}{referral.referred.lastName[0]}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {referral.referred.firstName} {referral.referred.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          Joined {new Date(referral.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        referral.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {referral.status === 'COMPLETED' ? '✓ Completed' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No referrals yet. Share your link to get started!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Referrers
            </h3>
            {leaderboard && leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      entry.rank <= 3
                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20'
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        entry.rank === 2 ? 'bg-gray-300 text-gray-700' :
                        entry.rank === 3 ? 'bg-amber-600 text-white' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {entry.rank}
                      </div>
                      {entry.avatar ? (
                        <img src={entry.avatar} alt={entry.name} className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-purple-600 font-medium">
                            {entry.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      )}
                      <p className="font-medium text-gray-900 dark:text-white">{entry.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">{entry.referrals}</p>
                      <p className="text-xs text-gray-500">referrals</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Be the first to top the leaderboard!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
