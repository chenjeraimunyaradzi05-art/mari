import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCreatorEarnings } from '@/lib/gifting';
import { redirect } from 'next/navigation';
import { StreamManager } from '@/components/streaming/StreamManager';

export default async function CreatorDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;
  
  // Check if user is a creator (SubscriptionTier check)
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub?.tier !== 'creator') {
    return (
      <div className="p-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Creator Access Required</h1>
        <p className="mb-6">You need a Creator subscription to access this dashboard.</p>
        <a href="/pricing" className="text-blue-600 hover:underline">Upgrade Now</a>
      </div>
    );
  }

  const totalEarningsCents = await getCreatorEarnings(userId);
  
  const recentStreams = await prisma.liveStream.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Creator Studio</h1>
      
      <StreamManager />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Total Earnings</h3>
          <div className="text-3xl font-bold text-green-600">
            ${(totalEarningsCents / 100).toFixed(2)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Followers</h3>
          <div className="text-3xl font-bold text-slate-900">
            1,234 {/* Mock */}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Stream Key</h3>
          <div className="text-sm font-mono bg-slate-100 p-2 rounded truncate">
            sk_********************
          </div>
          <button className="text-xs text-blue-600 mt-2">Reveal</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Recent Streams</h3>
          <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium">
            Go Live
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Viewers</th>
                <th className="px-6 py-3 font-medium text-right">Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentStreams.map((stream) => (
                <tr key={stream.id}>
                  <td className="px-6 py-3 text-slate-600">
                    {new Date(stream.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-slate-900 font-medium">
                    {stream.title}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      stream.status === 'live' ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {stream.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-slate-600">
                    {stream.viewerCount}
                  </td>
                  <td className="px-6 py-3 text-right text-green-600 font-medium">
                    ${(Number(stream.creatorEarnings) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
              {recentStreams.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No streams yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
