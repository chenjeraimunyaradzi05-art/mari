'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Users } from 'lucide-react';
import { useAuth, useUpdateProfile } from '@/lib/hooks';
import { PERSONA_LABELS } from '@/lib/utils';

/**
 * Where a new member lands right after registering (see app/register/page.tsx).
 *
 * Her own persona comes first and opens her dashboard; the others are there
 * to explore, or to make hers. Choosing saves through PATCH /users/me, the
 * same call the profile settings page uses, so the account really changes
 * rather than the page just navigating. There are no counts on this page:
 * the per-persona dashboards carry the live numbers.
 */

const personaHref = (persona: string) => `/dashboard/persona/${persona.toLowerCase()}`;

export default function PersonaIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  const current = user?.persona && PERSONA_LABELS[user.persona] ? user.persona : null;
  const others = Object.keys(PERSONA_LABELS).filter((key) => key !== current);

  // Saves the choice, then opens that dashboard. The mutation's own toast and
  // store update (useUpdateProfile) cover success and failure messaging.
  const choose = (persona: string, navigateAfter: boolean) => {
    if (persona === current || updateProfile.isPending) return;
    updateProfile.mutate(
      { persona },
      navigateAfter ? { onSuccess: () => router.push(personaHref(persona)) } : undefined
    );
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Persona Dashboards</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {current
            ? 'ATHENA is shaped around your persona. Explore the others any time, or make one yours.'
            : 'Pick the one that fits you best. You can change it whenever you like.'}
        </p>
      </div>

      {current && (
        <section aria-labelledby="your-persona-heading">
          <h2
            id="your-persona-heading"
            className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300"
          >
            Your persona
          </h2>
          <Link
            href={personaHref(current)}
            className="group mt-3 flex items-center justify-between gap-4 rounded-xl border-2 border-primary-500 bg-primary-50/60 p-6 shadow-sm transition hover:bg-primary-50 dark:border-primary-500 dark:bg-primary-950/20 dark:hover:bg-primary-950/40"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary-100 p-3 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
                <Users className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  {PERSONA_LABELS[current]}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Open your dashboard</div>
              </div>
            </div>
            <ArrowRight
              className="h-5 w-5 text-primary-500 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </section>
      )}

      <section aria-labelledby="explore-personas-heading">
        <h2
          id="explore-personas-heading"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          {current ? 'Explore' : 'Choose your persona'}
        </h2>

        <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {others.map((key) => {
            const label = PERSONA_LABELS[key];
            const href = personaHref(key);
            return (
              <div
                key={key}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-4 w-fit rounded-full bg-primary-50 p-3 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{label}</h3>
                <p className="mt-1 flex-1 text-sm text-slate-500 dark:text-slate-400">
                  {current
                    ? `See what ATHENA looks like for ${label}.`
                    : `Make ATHENA feel like it was built for ${label}.`}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  {current ? (
                    <>
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300"
                      >
                        Take a look
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => choose(key, true)}
                        disabled={updateProfile.isPending}
                        className="text-sm font-medium text-slate-500 hover:text-primary-700 hover:underline disabled:opacity-50 dark:text-slate-400 dark:hover:text-primary-300"
                      >
                        Make this mine
                      </button>
                    </>
                  ) : (
                    // A link so the dashboard opens straight away; the save
                    // runs alongside and reports through its own toast.
                    <Link
                      href={href}
                      onClick={() => choose(key, false)}
                      className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Choose {label}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
