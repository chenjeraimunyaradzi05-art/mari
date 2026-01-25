import Link from 'next/link';
import { ArrowRight, GraduationCap, Sparkles, Shield, BookOpen } from 'lucide-react';

export default function LearningPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <GraduationCap className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Learning</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Your learning hub</h1>
      <p className="mt-2 text-muted-foreground">
        Track your progress, discover new courses, and earn certifications.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/learn" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <BookOpen className="h-4 w-4" /> My learning
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Resume your courses and see progress.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Open dashboard <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/courses" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Courses
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Browse curated courses and programs.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Browse courses <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/certifications" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Shield className="h-4 w-4" /> Certifications
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Earn badges and showcase your credentials.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            View certifications <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/skills-marketplace" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Skills marketplace
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Discover in-demand skills and mentors.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Explore skills <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
