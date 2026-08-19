'use client';

import Link from 'next/link';
import { ArrowRight, Award, Calendar, CheckCircle, DollarSign, Loader2, Rocket, Users, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { businessApi } from '@/lib/api';
import { formatCurrency, formatDate, pluralize } from '@/lib/utils';

type AcceleratorCohort = {
  id: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  priceAud?: string | number | null;
  status: string;
  curriculum?: unknown;
  enrollmentCount?: number;
  sessionCount?: number;
  spotsRemaining?: number;
};

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function curriculumItems(curriculum: unknown): string[] {
  if (Array.isArray(curriculum)) {
    return curriculum
      .flatMap((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return [
            (item as any).title,
            ...(((item as any).topics || []) as unknown[]),
          ];
        }
        return [];
      })
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (curriculum && typeof curriculum === 'object') {
    return Object.values(curriculum as Record<string, unknown>)
      .flatMap((value) => {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
        return [];
      })
      .filter(Boolean);
  }

  return [];
}

export default function AcceleratorPage() {
  const [cohorts, setCohorts] = useState<AcceleratorCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCohorts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await businessApi.getAccelerators({ upcoming: true });

        if (!cancelled) {
          setCohorts(response.data?.data || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setCohorts([]);
          setError(err?.response?.data?.error || 'Unable to load accelerator cohorts right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCohorts();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const totalCapacity = cohorts.reduce((total, cohort) => total + (cohort.maxParticipants || 0), 0);
    const totalSessions = cohorts.reduce((total, cohort) => total + (cohort.sessionCount || 0), 0);
    const prices = cohorts.map((cohort) => toNumber(cohort.priceAud)).filter(Boolean);
    const nextCohort = [...cohorts].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

    return [
      { icon: Calendar, label: nextCohort ? formatDate(nextCohort.startDate) : 'TBD', description: 'Next start' },
      { icon: DollarSign, label: prices.length ? formatCurrency(Math.min(...prices)) : 'TBD', description: 'Starting price' },
      { icon: Users, label: totalCapacity ? totalCapacity.toString() : 'TBD', description: 'Published capacity' },
      { icon: Award, label: totalSessions ? pluralize(totalSessions, 'session') : 'TBD', description: 'Scheduled curriculum' },
    ];
  }, [cohorts]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <section className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white overflow-hidden">
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Rocket className="w-8 h-8" />
              <span className="text-orange-200 font-medium">ATHENA Accelerator</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Build inside live founder cohorts
            </h1>
            <p className="text-xl text-orange-100 mb-8">
              Explore published accelerator cohorts, compare dates and capacity, then continue enrollment from your dashboard.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard/accelerator"
                className="px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                View cohorts
              </Link>
              <Link
                href="/contact-sales"
                className="px-6 py-3 bg-orange-700 text-white font-semibold rounded-lg hover:bg-orange-800 transition"
              >
                Partner With Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((detail) => (
            <div key={detail.description} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <detail.icon className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{detail.label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{detail.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Published Cohorts
        </h2>

        {error && (
          <div className="mx-auto mb-6 max-w-5xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mx-auto flex max-w-5xl items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading accelerator cohorts...
          </div>
        ) : cohorts.length === 0 ? (
          <div className="mx-auto max-w-5xl rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <Rocket className="mx-auto mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No upcoming cohorts published</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Accelerator cohorts will appear here when enrollment opens.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {cohorts.map((cohort) => {
              const items = curriculumItems(cohort.curriculum).slice(0, 4);

              return (
                <div key={cohort.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-sm text-orange-600 font-medium">{formatStatus(cohort.status)}</span>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-1">{cohort.name}</h3>
                    </div>
                    <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                      {formatCurrency(toNumber(cohort.priceAud))}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
                    {cohort.description || 'Cohort details are still being finalized.'}
                  </p>
                  <div className="mt-5 grid gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-500" />
                      {formatDate(cohort.startDate)} - {formatDate(cohort.endDate)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-orange-500" />
                      {cohort.enrollmentCount ?? 0} enrolled, {cohort.spotsRemaining ?? 0} spots left
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-orange-500" />
                      {pluralize(cohort.sessionCount ?? 0, 'session')}
                    </div>
                  </div>
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Curriculum signals</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(items.length ? items : ['Curriculum details pending']).map((item) => (
                        <span key={item} className="inline-flex items-center gap-1 rounded bg-orange-50 px-2 py-1 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          <CheckCircle className="w-3 h-3" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href="/dashboard/accelerator"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
                  >
                    Continue in dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            What Cohorts Provide
          </h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              'Structured cohort sessions',
              'Founder accountability and peer learning',
              'Mentor and operator guidance',
              'Enrollment and payment tracking in the dashboard',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span className="text-gray-900 dark:text-white">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Accelerate?</h2>
          <p className="text-orange-100 mb-8 max-w-2xl mx-auto">
            Open your dashboard to review live cohort availability and start enrollment.
          </p>
          <Link
            href="/dashboard/accelerator"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            View Cohorts <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
