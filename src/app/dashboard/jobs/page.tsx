"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface Job {
  id: string;
  title: string;
  company?: { name: string };
  location?: string;
  salary?: number;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/jobs");
      if (!response.ok) throw new Error("Failed to fetch jobs");
      const data = await response.json();
      setJobs(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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
              <h1 className="text-2xl font-bold text-slate-900">Job Postings</h1>
            </div>
            <button
              className="rounded-lg px-4 py-2 font-medium text-white"
              style={{ background: 'linear-gradient(120deg,#e91e8c,#8b5cf6)', boxShadow: '0 10px 22px -14px rgba(233,30,140,0.55)' }}
            >
              Post Job
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading && (
          <div className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="text-slate-700">Loading jobs...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(233,30,140,0.35)', background: 'rgba(233,30,140,0.08)', color: '#7f1d4e' }}>
            Error: {error}
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="text-slate-600">No job postings found. Create your first job to get started.</p>
          </div>
        )}

        {!loading && jobs.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border p-6 backdrop-blur"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--card)',
                  boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)',
                }}
              >
                <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                <p className="mt-2 text-slate-600">{job.company?.name || "Unknown Company"}</p>
                <p className="mt-1 text-sm text-slate-500">{job.location || "Remote"}</p>
                {job.salary && (
                  <p className="mt-3 font-medium" style={{ color: '#9d174d' }}>${job.salary.toLocaleString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
