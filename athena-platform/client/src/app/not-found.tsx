import Link from 'next/link';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        {/* Illustration */}
        <div className="w-64 h-64 mx-auto mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/20 dark:to-purple-900/20 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl font-bold bg-gradient-to-r from-primary-500 to-purple-500 bg-clip-text text-transparent">
              404
            </span>
          </div>
        </div>

        {/* Content */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Page Not Found
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="flex items-center space-x-2 px-6 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition"
          >
            <Home className="w-5 h-5" />
            <span>Go Home</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center space-x-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Search Suggestion */}
        <div className="mt-12">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Or try searching for what you need:
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Here are some helpful links:
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link
              href="/dashboard/jobs"
              className="text-primary-500 hover:text-primary-600 hover:underline"
            >
              Browse Jobs
            </Link>
            <Link
              href="/dashboard/learn"
              className="text-primary-500 hover:text-primary-600 hover:underline"
            >
              Explore Courses
            </Link>
            <Link
              href="/dashboard/mentors"
              className="text-primary-500 hover:text-primary-600 hover:underline"
            >
              Find Mentors
            </Link>
            <Link
              href="/dashboard/settings/help"
              className="text-primary-500 hover:text-primary-600 hover:underline"
            >
              Get Help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
