'use client';

import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
          <WifiOff className="w-10 h-10 text-gray-400 dark:text-gray-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          You&apos;re Offline
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          It looks like you&apos;ve lost your internet connection. Some features may be unavailable until you&apos;re back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-6 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Try Again
        </button>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
          Check your Wi-Fi or mobile data settings, then try refreshing.
        </p>
      </div>
    </div>
  );
}
