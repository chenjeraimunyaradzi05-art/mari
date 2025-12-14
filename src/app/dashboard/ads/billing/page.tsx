import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ensureBillingAccount } from '@/lib/billing';

export default async function BillingPage() {
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

  const billingAccount = await ensureBillingAccount(user.organizationId);
  
  const transactions = await prisma.adTransaction.findMany({
    where: { billingAccountId: billingAccount.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const invoices = await prisma.adInvoice.findMany({
    where: { billingAccountId: billingAccount.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Billing & Payments</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Balance Card */}
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Current Balance</h3>
          <div className="text-3xl font-bold text-slate-900">
            ${(Number(billingAccount.balanceCents) / 100).toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Threshold: ${(Number(billingAccount.billingThreshold) / 100).toFixed(2)}
          </p>
          <div className="mt-4 w-full bg-slate-100 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${Math.min(100, (Number(billingAccount.balanceCents) / Number(billingAccount.billingThreshold)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Payment Method Card (Placeholder) */}
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Payment Method</h3>
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-6 bg-slate-200 rounded"></div>
            <span className="text-slate-700">•••• 4242</span>
          </div>
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Manage Payment Methods
          </button>
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Actions</h3>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
              Pay Now
            </button>
            <button className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-sm font-medium">
              Download Latest Invoice
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Transactions */}
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-6 py-3 text-slate-600">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-slate-900 font-medium">
                      {tx.description || tx.type}
                    </td>
                    <td className={`px-6 py-3 text-right font-medium ${tx.type === 'payment' ? 'text-green-600' : 'text-slate-900'}`}>
                      {tx.type === 'payment' ? '-' : ''}${ (Number(tx.amountCents) / 100).toFixed(2) }
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Invoices</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-3 text-slate-600">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-900 font-medium">
                      ${ (Number(inv.amountCents) / 100).toFixed(2) }
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button className="text-blue-600 hover:text-blue-800">PDF</button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
