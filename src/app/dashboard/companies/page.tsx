"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/companies");
        if (!response.ok) throw new Error("Failed to fetch companies");
        const data = await response.json();
        setCompanies(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchCompanies();
  }, []);

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
              <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
            </div>
            <button
              className="rounded-lg px-4 py-2 font-medium text-white"
              style={{ background: 'linear-gradient(120deg,#e91e8c,#8b5cf6)', boxShadow: '0 10px 22px -14px rgba(233,30,140,0.55)' }}
            >
              Add Company
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading && <div className="rounded-lg border p-6" style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>Loading...</div>}
        {error && <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(233,30,140,0.35)', background: 'rgba(233,30,140,0.08)', color: '#7f1d4e' }}>Error: {error}</div>}
        {!loading && companies.length === 0 && (
          <div className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="text-slate-600">No companies found</p>
          </div>
        )}
      </div>
    </div>
  );
}
