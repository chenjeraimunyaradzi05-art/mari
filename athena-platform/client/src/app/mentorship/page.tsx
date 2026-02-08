'use client';

import Link from 'next/link';
import { Users, Calendar, Star, ArrowRight } from 'lucide-react';

export default function MentorshipPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
            <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Mentorship
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Connect with experienced mentors who can guide your career journey, or become a mentor and empower the next generation of women leaders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <Users className="w-10 h-10 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Find a Mentor</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Browse our curated network of mentors matched to your career goals and industry.
            </p>
            <Link href="/mentors" className="text-purple-600 dark:text-purple-400 text-sm font-medium inline-flex items-center hover:underline">
              Browse Mentors <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <Calendar className="w-10 h-10 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Book Sessions</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Schedule 1-on-1 sessions with your mentor for personalised career guidance.
            </p>
            <Link href="/dashboard" className="text-purple-600 dark:text-purple-400 text-sm font-medium inline-flex items-center hover:underline">
              My Sessions <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <Star className="w-10 h-10 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Become a Mentor</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Share your expertise, earn income, and make a lasting impact on women&apos;s careers.
            </p>
            <Link href="/mentor-agreement" className="text-purple-600 dark:text-purple-400 text-sm font-medium inline-flex items-center hover:underline">
              Apply Now <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/mentors"
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            Explore Mentors
          </Link>
        </div>
      </div>
    </div>
  );
}
