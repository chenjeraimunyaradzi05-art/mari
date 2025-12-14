"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

type Member = {
  id: string;
  name?: string;
  user?: { email?: string };
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/members");
      if (!response.ok) throw new Error("Failed to fetch members");
      const data = await response.json();
      setMembers(data.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <header
        className="border-b backdrop-blur sticky top-0 z-50"
        style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.82)' }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="hover:underline" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                ← Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">Members</h1>
            </div>
            <button
              className="rounded-lg px-4 py-2 font-medium text-white"
              style={{ background: 'linear-gradient(120deg,#e91e8c,#8b5cf6)', boxShadow: '0 10px 22px -14px rgba(233,30,140,0.55)' }}
            >
              Add Member
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading && (
          <div className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="text-slate-700">Loading members...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(233,30,140,0.35)', background: 'rgba(233,30,140,0.08)', color: '#7f1d4e' }}>
            Error: {error}
          </div>
        )}

        {!loading && members.length === 0 && (
          <div className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="text-slate-600">No members found. Create your first member to get started.</p>
          </div>
        )}

        {!loading && members.length > 0 && (
          <div className="overflow-x-auto rounded-lg border backdrop-blur" style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-6 py-4 text-slate-700">{member.name}</td>
                    <td className="px-6 py-4 text-slate-700">{member.user?.email || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'rgba(233,30,140,0.12)', color: '#9d174d' }}>
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm cursor-pointer" style={{ color: 'var(--accent)' }}>
                      View
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
