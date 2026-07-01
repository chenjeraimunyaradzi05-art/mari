import Link from 'next/link';
import { ArrowRight, BookOpen, Braces, KeyRound, MessagesSquare, Sparkles, Users } from 'lucide-react';

const endpointGroups = [
  {
    title: 'Authentication',
    icon: KeyRound,
    description: 'Issue and refresh tokens, protect server-to-server requests, and manage session-aware access.',
    endpoints: [
      'POST /api/auth/login',
      'POST /api/auth/google',
      'POST /api/auth/refresh',
      'POST /api/auth/logout',
    ],
  },
  {
    title: 'Jobs and opportunity discovery',
    icon: Braces,
    description: 'Search listings, fetch role details, and connect external workflows to ATHENA opportunity surfaces.',
    endpoints: [
      'GET /api/jobs',
      'GET /api/jobs/:id',
      'GET /api/jobs/recommendations/for-me',
      'POST /api/jobs/:id/apply',
    ],
  },
  {
    title: 'Mentorship and profiles',
    icon: Users,
    description: 'Read public-facing profile data, mentor discovery surfaces, and related engagement signals.',
    endpoints: [
      'GET /api/users/:id',
      'GET /api/mentors',
      'GET /api/mentors/:id',
      'GET /api/users/:id/followers',
    ],
  },
  {
    title: 'Messaging and community',
    icon: MessagesSquare,
    description: 'Integrate community notifications, messaging entry points, and collaboration flows.',
    endpoints: [
      'GET /api/conversations',
      'GET /api/messages',
      'POST /api/messages',
      'GET /api/feed',
    ],
  },
  {
    title: 'AI assistance',
    icon: Sparkles,
    description: 'Embed AI-adjacent experiences such as coaching, resume support, and opportunity matching.',
    endpoints: [
      'POST /api/ai/chat',
      'POST /api/ai/resume/analyze',
      'POST /api/ai/interview/practice',
      'GET /api/ai/recommendations',
    ],
  },
];

const authNotes = [
  'Use ATHENA credentials only from trusted server environments. Do not expose private credentials in the browser.',
  'Google sign-in uses the existing ATHENA JWT + refresh-cookie session model, not a parallel auth system.',
  'When integrating from a web app, prefer your server as the caller and pass user intent through your backend.',
];

export default function ApiReferencePage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
      <section className="border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/40 dark:text-primary-300">
            <BookOpen className="h-4 w-4" />
            API reference overview
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
            The current ATHENA API surface, mapped to real product workflows.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-600 dark:text-gray-300">
            This reference is designed for partner teams, enterprise buyers, and internal developers who need a clear
            view of the platform surfaces currently available for integration.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-2xl font-semibold">Authentication notes</h2>
            <div className="mt-6 space-y-4">
              {authNotes.map((note) => (
                <div
                  key={note}
                  className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 text-sm leading-7 text-gray-700 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-300"
                >
                  {note}
                </div>
              ))}
            </div>
            <Link
              href="/developers/console"
              className="mt-6 inline-flex items-center text-sm font-semibold text-primary-700 dark:text-primary-300"
            >
              Open console preview
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-6">
            {endpointGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                    <group.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">{group.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300">{group.description}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  {group.endpoints.map((endpoint) => (
                    <div
                      key={endpoint}
                      className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 font-mono text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-200"
                    >
                      {endpoint}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
