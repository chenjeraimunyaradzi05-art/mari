"use client";

import Link from 'next/link';
import { useFormations } from '@/lib/hooks';
import { formatRelativeTime } from '@/lib/utils';

type Formation = {
  id: string;
  businessName?: string | null;
  type: string;
  status: string;
  updatedAt?: string | null;
};

export default function FormationLandingPage() {
  const { data: formations, isLoading } = useFormations();
  const formationList: Formation[] = Array.isArray(formations) ? (formations as Formation[]) : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formation Studio</h1>
          <p className="text-muted-foreground">
            Start, register, and grow your business in one place.
          </p>
        </div>
        <Link href="/dashboard/formation/new" className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
          Start New Business
        </Link>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Your Registrations</h2>
          <Link href="/dashboard/formation/new" className="text-sm text-primary hover:underline">
            New registration
          </Link>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && formationList.length === 0 && (
          <p className="text-sm text-muted-foreground">No registrations yet.</p>
        )}

        {!isLoading && formationList.length > 0 && (
          <div className="grid gap-3">
            {formationList.map((f) => (
              <Link
                key={f.id}
                href={`/dashboard/formation/${f.id}`}
                className="border rounded-md p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      {f.businessName || 'Untitled registration'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {f.type} • Updated {f.updatedAt ? formatRelativeTime(f.updatedAt) : 'recently'}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    {f.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="border rounded-lg p-6 space-y-4">
          <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xl">
            🚀
          </div>
          <h3 className="font-semibold text-xl">Register Business</h3>
          <p className="text-sm text-gray-500">
            Register your ABN, ACN, and business name in minutes with our ASIC-integrated wizard.
          </p>
          <ul className="text-sm gap-2 grid">
            <li className="flex items-center">✓ Sole Trader or Company</li>
            <li className="flex items-center">✓ Instant ABN Application</li>
            <li className="flex items-center">✓ Legal Document Generation</li>
          </ul>
        </div>

        <div className="border rounded-lg p-6 space-y-4">
          <div className="h-12 w-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-xl">
            📊
          </div>
          <h3 className="font-semibold text-xl">Tax Optimization</h3>
          <p className="text-sm text-gray-500">
            AI-powered expense tracking and tax planning to maximize your deductions.
          </p>
          <div className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded inline-block">Coming Soon</div>
        </div>

        <div className="border rounded-lg p-6 space-y-4">
          <div className="h-12 w-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-xl">
            💰
          </div>
          <h3 className="font-semibold text-xl">Grants & Capital</h3>
          <p className="text-sm text-gray-500">
            Find and apply for government grants and funding opportunities for women-led businesses.
          </p>
          <div className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded inline-block">Coming Soon</div>
        </div>
      </div>
    </div>
  );
}
