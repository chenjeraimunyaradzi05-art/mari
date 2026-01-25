import Link from 'next/link';
import { ArrowRight, Compass, Briefcase, GraduationCap, Users, Sparkles } from 'lucide-react';

export default function DiscoverPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <Compass className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Discover</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Discover opportunities</h1>
      <p className="mt-2 text-muted-foreground">
        Explore jobs, mentors, and learning paths curated for your growth.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/jobs" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Briefcase className="h-4 w-4" /> Jobs
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Find roles matched to your skills and goals.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Browse jobs <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/mentors" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Users className="h-4 w-4" /> Mentors
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Connect with experts for guidance and support.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Meet mentors <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/courses" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <GraduationCap className="h-4 w-4" /> Courses
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Upskill with curated courses and programs.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Start learning <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/community" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Community
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Join conversations and celebrate wins together.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Visit community <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
