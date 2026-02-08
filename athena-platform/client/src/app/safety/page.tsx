'use client';

import Link from 'next/link';
import { Shield, AlertTriangle, Phone, ArrowRight } from 'lucide-react';

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Safety &amp; Support
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Your safety is our top priority. Access resources, report concerns, and manage your privacy settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <Shield className="w-10 h-10 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Safety Centre</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Manage your safety settings, enable safe mode, and control who can see your profile.
            </p>
            <Link href="/safety-center" className="text-red-600 dark:text-red-400 text-sm font-medium inline-flex items-center hover:underline">
              Open Safety Centre <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Report a Concern</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Report harassment, inappropriate content, or any safety concerns confidentially.
            </p>
            <Link href="/report" className="text-amber-600 dark:text-amber-400 text-sm font-medium inline-flex items-center hover:underline">
              File a Report <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <Phone className="w-10 h-10 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Emergency Resources</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Access emergency helplines and support services available 24/7 in your region.
            </p>
            <Link href="/help" className="text-blue-600 dark:text-blue-400 text-sm font-medium inline-flex items-center hover:underline">
              Get Help Now <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-800 dark:text-red-300 font-medium mb-2">
            If you are in immediate danger, call emergency services.
          </p>
          <p className="text-red-700 dark:text-red-400 text-sm">
            Australia: 000 | UK: 999 | US: 911 | EU: 112
          </p>
        </div>
      </div>
    </div>
  );
}
