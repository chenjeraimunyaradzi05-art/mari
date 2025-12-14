"use client";

import React, { useEffect, useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, History, Plus, CreditCard } from 'lucide-react';

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  type: 'TIP' | 'DEPOSIT' | 'WITHDRAWAL' | 'SUBSCRIPTION';
  status: string;
  createdAt: string;
  sender: { firstName: string; lastName: string; profileImage: string | null };
  receiver: { firstName: string; lastName: string; profileImage: string | null };
  senderId: string;
  receiverId: string;
};

type WalletData = {
  id: string;
  balance: number;
  currency: string;
};

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/social/wallet');
      const data = await res.json();
      if (data.wallet) {
        setWallet(data.wallet);
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error("Failed to load wallet", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleDeposit = async () => {
    const amountStr = window.prompt("Enter amount to deposit (USD):", "50.00");
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Invalid amount");
      return;
    }

    setDepositing(true);
    try {
      const res = await fetch('/api/social/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully deposited $${amount}!`);
        fetchWallet(); // Refresh
      } else {
        alert(`Deposit failed: ${data.error}`);
      }
    } catch (e) {
      alert("Error depositing funds");
    } finally {
      setDepositing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading wallet...</div>;
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Wallet className="w-8 h-8 text-pink-600" />
          Creator Wallet
        </h1>
        <p className="text-slate-600 mt-2">Manage your earnings, tips, and platform credits.</p>
      </header>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <CreditCard className="w-32 h-32" />
        </div>
        
        <div className="relative z-10">
          <p className="text-slate-400 font-medium mb-2">Total Balance</p>
          <div className="text-5xl font-bold mb-6">
            ${wallet?.balance.toFixed(2)} <span className="text-2xl text-slate-400 font-normal">{wallet?.currency}</span>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleDeposit}
              disabled={depositing}
              className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Funds
            </button>
            <button className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors">
              <ArrowUpRight className="w-5 h-5" />
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Recent Transactions
        </h2>
        
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const isDeposit = tx.type === 'DEPOSIT';
                const isTip = tx.type === 'TIP';
                // Determine if money is coming in or going out
                // For deposits: In
                // For tips: If I am receiver -> In, If I am sender -> Out
                // Since we don't have "me" easily here without session, we can infer from type or just show raw.
                // Actually, the API returns transactions where I am sender OR receiver.
                // Let's just show the type and amount for now.
                
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isDeposit ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'
                      }`}>
                        {isDeposit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {isDeposit ? 'Funds Added' : isTip ? 'Tip' : tx.type}
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isDeposit ? 'text-green-600' : 'text-slate-900'}`}>
                        {isDeposit ? '+' : ''}${tx.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-400">{tx.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
