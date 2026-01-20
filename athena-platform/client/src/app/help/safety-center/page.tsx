/**
 * Safety Center Page
 * UK Online Safety Act Compliance
 * Phase 4: UK/EU Market Launch
 */

import { Shield, AlertTriangle, Lock, Eye, Phone, Heart, Users, BookOpen, ExternalLink, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Safety Center | ATHENA',
  description: 'Resources and tools to help you stay safe on ATHENA. Learn about our safety features, reporting tools, and external support resources.',
};

const SAFETY_RESOURCES = [
  {
    title: 'National Domestic Abuse Helpline (UK)',
    description: 'Free 24-hour support for anyone experiencing domestic abuse',
    phone: '0808 2000 247',
    website: 'https://www.nationaldahelpline.org.uk',
    region: 'UK',
  },
  {
    title: "Samaritans",
    description: '24/7 emotional support for anyone in distress',
    phone: '116 123',
    website: 'https://www.samaritans.org',
    region: 'UK',
  },
  {
    title: 'CEOP (Child Exploitation and Online Protection)',
    description: 'Report child sexual exploitation or abuse',
    website: 'https://www.ceop.police.uk/ceop-reporting/',
    region: 'UK',
  },
  {
    title: 'Action Fraud (UK)',
    description: 'Report fraud and cyber crime',
    phone: '0300 123 2040',
    website: 'https://www.actionfraud.police.uk',
    region: 'UK',
  },
  {
    title: 'Revenge Porn Helpline',
    description: 'Support for victims of intimate image abuse',
    phone: '0345 6000 459',
    website: 'https://revengepornhelpline.org.uk',
    region: 'UK',
  },
  {
    title: 'Stop Hate UK',
    description: 'Report hate crime and get support',
    phone: '0800 138 1625',
    website: 'https://www.stophateuk.org',
    region: 'UK',
  },
];

export default function SafetyCenterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Safety Center
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your safety is our top priority. Learn about the tools we provide to keep you safe, 
            and find resources for additional support.
          </p>
        </div>

        {/* Emergency Banner */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-100 mb-2">
                Are you in immediate danger?
              </h3>
              <p className="text-red-800 dark:text-red-200 mb-4">
                If you're in immediate danger, please call emergency services:
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="tel:999"
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call 999 (UK)
                </a>
                <a
                  href="tel:112"
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call 112 (EU)
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Safety Tools */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Safety Tools on ATHENA</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <Lock className="w-8 h-8 text-purple-500 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Block Users</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Block anyone who makes you uncomfortable. They won't be able to message you, 
                see your profile, or interact with your content.
              </p>
              <Link href="/settings/privacy" className="text-purple-600 dark:text-purple-400 text-sm hover:underline">
                Manage blocked users →
              </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <Eye className="w-8 h-8 text-blue-500 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Privacy Controls</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Control who can see your profile, message you, and view your activity. 
                Set your profile to private mode for extra protection.
              </p>
              <Link href="/settings/privacy" className="text-purple-600 dark:text-purple-400 text-sm hover:underline">
                Privacy settings →
              </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <AlertTriangle className="w-8 h-8 text-orange-500 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Report Content</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Report harmful content, harassment, or policy violations. Our Trust & Safety team 
                reviews all reports within 24-72 hours.
              </p>
              <Link href="/report" className="text-purple-600 dark:text-purple-400 text-sm hover:underline">
                Report content →
              </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <MessageCircle className="w-8 h-8 text-green-500 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Message Filters</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Filter message requests and hide potentially offensive content. 
                Only receive messages from people you're connected with.
              </p>
              <Link href="/settings/messages" className="text-purple-600 dark:text-purple-400 text-sm hover:underline">
                Message settings →
              </Link>
            </div>
          </div>
        </section>

        {/* Staying Safe Online */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Staying Safe Online</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-500" />
                  Protect Your Account
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Use a strong, unique password</li>
                  <li>• Enable two-factor authentication</li>
                  <li>• Don't share your login credentials</li>
                  <li>• Review connected apps regularly</li>
                  <li>• Log out on shared devices</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-500" />
                  Protect Your Information
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Never share financial details in messages</li>
                  <li>• Be cautious of unsolicited job offers</li>
                  <li>• Verify employer identities before sharing info</li>
                  <li>• Use platform messaging for initial contact</li>
                  <li>• Report suspicious activity immediately</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Meeting People Offline
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Meet in public places for first meetings</li>
                  <li>• Tell someone where you're going</li>
                  <li>• Trust your instincts</li>
                  <li>• Keep your phone charged</li>
                  <li>• Arrange your own transportation</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Recognizing Scams
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Be wary of "too good to be true" offers</li>
                  <li>• Never pay upfront for job opportunities</li>
                  <li>• Check company legitimacy independently</li>
                  <li>• Don't click suspicious links</li>
                  <li>• Report scam attempts to us</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* External Resources */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">External Support Resources</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            If you need support beyond what ATHENA can provide, these organizations can help:
          </p>
          <div className="grid gap-4">
            {SAFETY_RESOURCES.map((resource, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{resource.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{resource.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {resource.phone && (
                      <a
                        href={`tel:${resource.phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        {resource.phone}
                      </a>
                    )}
                    <a
                      href={resource.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Website
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mental Health */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <Heart className="w-6 h-6 text-pink-500" />
            Mental Health Support
          </h2>
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-6 border border-pink-200 dark:border-pink-800">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your mental health matters. If you're struggling with online experiences, career stress, or anything else, 
              please reach out for support:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Mind</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Mental health support and information</p>
                <a href="tel:03001233393" className="text-pink-600 dark:text-pink-400 text-sm">0300 123 3393</a>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Anxiety UK</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Support for anxiety disorders</p>
                <a href="tel:03444775774" className="text-pink-600 dark:text-pink-400 text-sm">0344 477 5774</a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Us */}
        <section className="text-center">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-8">
            <BookOpen className="w-8 h-8 text-purple-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Need More Help?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Our Trust & Safety team is here to help. If you have questions about safety on ATHENA 
              or need assistance with a specific situation, please reach out.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/help"
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Help Center
              </Link>
              <Link
                href="/report"
                className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Report an Issue
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
