"use client";

import Link from 'next/link';
import { Check, Landmark, Receipt, Rocket } from 'lucide-react';
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

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!isLoading && formationList.length === 0 && (
          <p className="text-sm text-muted-foreground">No registrations yet.</p>
        )}

        {!isLoading && formationList.length > 0 && (
          <div className="grid gap-3">
            {formationList.map((formation) => (
              <Link
                key={formation.id}
                href={`/dashboard/formation/${formation.id}`}
                className="border rounded-md p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      {formation.businessName || 'Untitled registration'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formation.type} - Updated {formation.updatedAt ? formatRelativeTime(formation.updatedAt) : 'recently'}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    {formation.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="border rounded-lg p-6 space-y-4">
          <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <Rocket className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-xl">Register Business</h3>
          <p className="text-sm text-slate-500">
            Create and submit business-registration drafts with the connected formation workflow.
          </p>
          <ul className="text-sm gap-2 grid">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-blue-600" />
              Sole trader or company
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-blue-600" />
              Participant and address validation
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-blue-600" />
              Payment and submission status
            </li>
          </ul>
          <Link href="/dashboard/formation/new" className="inline-flex text-sm font-medium text-primary hover:underline">
            Start registration
          </Link>
        </div>

        <div className="border rounded-lg p-6 space-y-4">
          <div className="h-12 w-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
            <Receipt className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-xl">Tax Optimization</h3>
          <p className="text-sm text-slate-500">
            Configure tax rates, deductions, and return planning from the finance workspace.
          </p>
          <Link href="/dashboard/finance/tax" className="inline-flex text-sm font-medium text-primary hover:underline">
            Open tax workspace
          </Link>
        </div>

        <div className="border rounded-lg p-6 space-y-4">
          <div className="h-12 w-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
            <Landmark className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-xl">Grants & Capital</h3>
          <p className="text-sm text-slate-500">
            Track grant opportunities and investor outreach through connected business workflows.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/grants" className="inline-flex text-sm font-medium text-primary hover:underline">
              Open grants
            </Link>
            <Link href="/dashboard/investors" className="inline-flex text-sm font-medium text-primary hover:underline">
              Open investors
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
