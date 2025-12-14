import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function LeadsDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
  }

  // Find the user's organization or billing account
  // Assuming user is linked to an organization or we use their ID for now
  // For MVP, let's assume we fetch leads purchased by this user's billing account(s)
  
  // First, find billing accounts for this user
  const billingAccounts = await prisma.adBillingAccount.findMany({
    where: { organizationId: (session.user as any).organizationId },
  });

  const billingAccountIds = billingAccounts.map(ba => ba.id);

  // Find transactions for lead purchases
  const transactions = await prisma.adTransaction.findMany({
    where: {
      billingAccountId: { in: billingAccountIds },
      type: "LEAD_PURCHASE",
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Calculate stats
  const totalSpend = transactions.reduce((acc, tx) => acc + Number(tx.amountCents), 0); // Negative values
  const totalLeads = transactions.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Lead Performance</h1>
        <div className="flex gap-2">
          <a href="/business/leads/settings" className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 text-sm font-medium">
            Settings
          </a>
          <a href="/business/leads/marketplace" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium">
            Browse Marketplace
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500 text-sm">Total Leads Purchased</h3>
          <p className="text-2xl font-bold">{totalLeads}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500 text-sm">Total Spend</h3>
          <p className="text-2xl font-bold">${Math.abs(totalSpend / 100).toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-gray-500 text-sm">Avg Cost per Lead</h3>
          <p className="text-2xl font-bold">
            ${totalLeads > 0 ? (Math.abs(totalSpend / 100) / totalLeads).toFixed(2) : "0.00"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold">Recent Purchases</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {tx.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${Math.abs(Number(tx.amountCents) / 100).toFixed(2)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                  No leads purchased yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
