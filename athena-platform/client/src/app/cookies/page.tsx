'use client';

import Link from 'next/link';
import { Cookie, Shield, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface CookieInfo {
  name: string;
  purpose: string;
  duration: string;
  type: string;
}

interface CookieCategory {
  id: string;
  title: string;
  description: string;
  required: boolean;
  cookies: CookieInfo[];
}

const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: 'essential',
    title: 'Essential Cookies',
    description: 'These cookies are necessary for the website to function and cannot be switched off. They are usually set in response to actions you take, such as setting your privacy preferences, logging in, or filling in forms.',
    required: true,
    cookies: [
      { name: 'athena_session', purpose: 'Maintains your login session securely', duration: 'Session', type: 'First-party' },
      { name: 'csrf_token', purpose: 'Protects against cross-site request forgery attacks', duration: 'Session', type: 'First-party' },
      { name: 'athena_cookie_consent', purpose: 'Stores your cookie consent preferences', duration: '1 year', type: 'First-party' },
      { name: 'athena_visitor_id', purpose: 'Anonymous visitor identifier for consent tracking', duration: '1 year', type: 'First-party' },
      { name: '__cf_bm', purpose: 'Cloudflare bot management', duration: '30 minutes', type: 'Third-party' },
    ],
  },
  {
    id: 'functional',
    title: 'Functional Cookies',
    description: 'These cookies enable enhanced functionality and personalization, such as remembering your preferences. If you disable these cookies, some services may not function properly.',
    required: false,
    cookies: [
      { name: 'athena_locale', purpose: 'Remembers your language preference', duration: '1 year', type: 'First-party' },
      { name: 'athena_theme', purpose: 'Stores your theme preference (light/dark)', duration: '1 year', type: 'First-party' },
      { name: 'athena_region', purpose: 'Remembers your region for localized content', duration: '1 year', type: 'First-party' },
      { name: 'athena_recent_searches', purpose: 'Stores your recent search queries', duration: '30 days', type: 'First-party' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics Cookies',
    description: 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our services.',
    required: false,
    cookies: [
      { name: '_ga', purpose: 'Google Analytics - Distinguishes unique users', duration: '2 years', type: 'Third-party' },
      { name: '_ga_*', purpose: 'Google Analytics - Maintains session state', duration: '2 years', type: 'Third-party' },
      { name: '_gid', purpose: 'Google Analytics - Distinguishes users', duration: '24 hours', type: 'Third-party' },
      { name: 'athena_analytics', purpose: 'Internal analytics for platform improvement', duration: '1 year', type: 'First-party' },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing Cookies',
    description: 'These cookies are used to track visitors across websites to display relevant advertisements. They are also used to limit the number of times you see an ad and help measure the effectiveness of advertising campaigns.',
    required: false,
    cookies: [
      { name: '_fbp', purpose: 'Facebook Pixel - Tracks conversions from Facebook ads', duration: '3 months', type: 'Third-party' },
      { name: '_gcl_au', purpose: 'Google Ads - Stores conversion data', duration: '3 months', type: 'Third-party' },
      { name: 'li_sugr', purpose: 'LinkedIn - Tracks conversions and retargeting', duration: '3 months', type: 'Third-party' },
    ],
  },
];

export default function CookiesPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('essential');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <Cookie className="w-10 h-10" />
            <h1 className="text-3xl font-bold">Cookie Policy</h1>
          </div>
          <p className="text-purple-100 text-lg">
            Learn how we use cookies and similar technologies on our platform.
          </p>
          <p className="text-purple-200 text-sm mt-2">
            Last updated: January 2026
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Introduction */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">What are Cookies?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Cookies are small text files that are placed on your device when you visit a website. They are widely used to make 
            websites work more efficiently and provide information to the site owners.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            We use cookies and similar technologies (such as local storage and pixels) to operate our platform, remember your 
            preferences, understand how you use our services, and improve your experience.
          </p>
        </section>

        {/* Cookie Settings Button */}
        <section className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6 mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Your Cookie Preferences</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Update your cookie settings at any time</p>
          </div>
          <button
            onClick={() => {
              // Trigger cookie banner
              localStorage.removeItem('athena_cookie_consent');
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Settings className="w-4 h-4" />
            Cookie Settings
          </button>
        </section>

        {/* Cookie Categories */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Types of Cookies We Use</h2>
          </div>
          
          {COOKIE_CATEGORIES.map((category) => (
            <div key={category.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
              <button
                onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${category.required ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      {category.title}
                      {category.required && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                          Always Active
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{category.description}</p>
                  </div>
                </div>
                {expandedCategory === category.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              
              {expandedCategory === category.id && (
                <div className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                          <th className="pb-3 font-medium">Cookie Name</th>
                          <th className="pb-3 font-medium">Purpose</th>
                          <th className="pb-3 font-medium">Duration</th>
                          <th className="pb-3 font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-600 dark:text-gray-300">
                        {category.cookies.map((cookie) => (
                          <tr key={cookie.name} className="border-b border-gray-50 dark:border-gray-750 last:border-0">
                            <td className="py-3 font-mono text-xs">{cookie.name}</td>
                            <td className="py-3">{cookie.purpose}</td>
                            <td className="py-3 text-gray-400">{cookie.duration}</td>
                            <td className="py-3">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                cookie.type === 'First-party' 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                              }`}>
                                {cookie.type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* How to Control Cookies */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">How to Control Cookies</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You can control and manage cookies in several ways:
          </p>
          <ul className="space-y-3 text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
              <span><strong>Cookie Settings:</strong> Use our cookie settings panel to accept or reject optional cookies.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
              <span><strong>Browser Settings:</strong> Most browsers allow you to refuse or accept cookies through their settings. Check your browser's help section for instructions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
              <span><strong>Third-Party Opt-Outs:</strong> For analytics and advertising cookies, you can opt out through industry programs like <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">DAA</a> or <a href="https://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Your Online Choices (EU)</a>.</span>
            </li>
          </ul>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-4">
            Please note that disabling certain cookies may affect the functionality of our platform.
          </p>
        </section>

        {/* Updates */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Updates to This Policy</h2>
          <p className="text-gray-600 dark:text-gray-400">
            We may update this Cookie Policy from time to time to reflect changes in our practices or for operational, legal, 
            or regulatory reasons. We will notify you of any material changes by posting the updated policy on this page with 
            a new "Last updated" date.
          </p>
        </section>

        {/* Contact */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Contact Us</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            If you have any questions about our use of cookies, please contact us:
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:privacy@athena.com"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Email Us
            </a>
            <Link
              href="/privacy-center"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
            >
              <Shield className="w-5 h-5" />
              Privacy Center
            </Link>
          </div>
        </section>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <Link href="/privacy/uk" className="text-purple-600 hover:underline">UK Privacy Addendum</Link>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <Link href="/terms" className="text-purple-600 hover:underline">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}
