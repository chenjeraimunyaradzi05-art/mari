import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function LeadsDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return <div>Please create an organization first.</div>;
  }

  // Fetch acquired leads (mocking 'acquired' by checking organizationId match, 
  // assuming leads are assigned to org when purchased/generated)
  const leads = await prisma.lead.findMany({
    where: {
      organizationId: user.organizationId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Lead Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Total Leads</h3>
          <div className="text-3xl font-bold text-slate-900">{leads.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Avg Quality Score</h3>
          <div className="text-3xl font-bold text-slate-900">
            {leads.length > 0 
              ? Math.round(leads.reduce((acc, l) => acc + l.score, 0) / leads.length) 
              : 0}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Hot Leads</h3>
          <div className="text-3xl font-bold text-red-600">
            {leads.filter(l => l.tier === 'hot').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Recent Leads</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Score</th>
                <th className="px-6 py-3 font-medium">Tier</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-6 py-3 text-slate-600">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-slate-900 font-medium">
                    {lead.firstName} {lead.lastName}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {lead.email}
                  </td>
                  <td className="px-6 py-3 text-slate-900 font-medium">
                    {lead.score}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lead.tier === 'hot' ? 'bg-red-100 text-red-800' :
                      lead.tier === 'warm' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {lead.tier.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600 capitalize">
                    {lead.status}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No leads found.
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
