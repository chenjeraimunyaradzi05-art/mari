/**
 * Community Guidelines Page
 * UK Online Safety Act Compliance
 * Phase 4: UK/EU Market Launch
 */

import { Shield, Heart, Users, AlertTriangle, CheckCircle, XCircle, Scale, FileText } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community Guidelines | ATHENA',
  description: 'Learn about ATHENA\'s community standards and content policies that keep our platform safe and welcoming.',
};

export default function CommunityGuidelinesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Community Guidelines
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            ATHENA is committed to creating a safe, supportive, and empowering environment for women 
            to build their careers and connect with others. These guidelines help us maintain that space.
          </p>
        </div>

        {/* Core Values */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Our Core Values</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <Heart className="w-8 h-8 text-pink-500 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Respect</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Treat every member with dignity and respect, regardless of background, experience, or opinion.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <Users className="w-8 h-8 text-blue-500 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Inclusion</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Welcome and support women from all backgrounds, industries, and career stages.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <Shield className="w-8 h-8 text-green-500 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Safety</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Maintain a secure environment free from harassment, discrimination, and harmful content.
              </p>
            </div>
          </div>
        </section>

        {/* What's Allowed */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            What's Encouraged
          </h2>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Professional networking and career discussions</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Share experiences, seek advice, and build meaningful connections</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Mentorship and support</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Offer guidance, share knowledge, and lift others up</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Constructive feedback and discussions</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Engage respectfully, even when you disagree</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Celebrating achievements</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Share your wins and celebrate others' successes</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Educational content</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Share resources, articles, and learning opportunities</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* What's Not Allowed */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500" />
            What's Not Allowed
          </h2>
          <div className="space-y-4">
            {/* Harassment */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Harassment and Bullying</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Targeted attacks, threats, or intimidation</li>
                <li>• Stalking or unwanted persistent contact</li>
                <li>• Doxxing or sharing personal information without consent</li>
                <li>• Coordinated harassment campaigns</li>
              </ul>
            </div>

            {/* Hate Speech */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Hate Speech and Discrimination</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Content promoting hatred based on race, ethnicity, gender, sexual orientation, religion, disability, or other protected characteristics</li>
                <li>• Slurs, dehumanizing language, or harmful stereotypes</li>
                <li>• Denial or trivialization of historical atrocities</li>
              </ul>
            </div>

            {/* Violence */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Violence and Dangerous Content</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Threats of violence or incitement to harm</li>
                <li>• Graphic violence or gore</li>
                <li>• Content promoting self-harm or suicide</li>
                <li>• Terrorism or extremist content</li>
              </ul>
            </div>

            {/* Sexual Content */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Sexual and Explicit Content</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Pornography or sexually explicit material</li>
                <li>• Non-consensual intimate imagery</li>
                <li>• Sexual harassment or unwanted advances</li>
                <li>• Content sexualizing minors (strictly prohibited, reported to authorities)</li>
              </ul>
            </div>

            {/* Fraud */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Fraud and Deception</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Scams, phishing, or fraudulent schemes</li>
                <li>• Fake job postings or misleading opportunities</li>
                <li>• Impersonation of individuals or organizations</li>
                <li>• Coordinated inauthentic behavior</li>
              </ul>
            </div>

            {/* Spam */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Spam and Manipulation</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Repetitive posting or flooding</li>
                <li>• Misleading clickbait or engagement bait</li>
                <li>• Artificially boosting engagement</li>
                <li>• Unauthorized automated activity</li>
              </ul>
            </div>

            {/* Illegal */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Illegal Activities</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Content promoting illegal activities</li>
                <li>• Sale of illegal goods or services</li>
                <li>• Violation of intellectual property rights</li>
                <li>• Encouraging violation of laws</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Enforcement */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <Scale className="w-6 h-6 text-purple-500" />
            Enforcement
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              When we identify violations of these guidelines, we take action based on the severity and frequency of the violation:
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Warning</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">First-time or minor violations may result in a warning and content removal</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Temporary Suspension</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Repeated or moderate violations may result in temporary account suspension (7-30 days)</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Permanent Ban</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Severe or repeated violations may result in permanent account termination</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              Certain violations (such as CSAM, terrorism, or credible threats of violence) result in immediate permanent bans and may be reported to relevant authorities.
            </p>
          </div>
        </section>

        {/* Appeals */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Appeals Process</h2>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We know we don't always get it right. If you believe your content was removed or your account was actioned in error, you have the right to appeal.
            </p>
            <Link
              href="/help/appeal"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" />
              Submit an Appeal
            </Link>
          </div>
        </section>

        {/* Reporting */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">How to Report</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              If you see content that violates these guidelines, please report it. Your reports help keep ATHENA safe.
            </p>
            <ul className="space-y-3 text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="font-mono text-purple-600 dark:text-purple-400">1.</span>
                Click the "Report" option on any post, comment, message, or profile
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-purple-600 dark:text-purple-400">2.</span>
                Select the reason that best describes the violation
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-purple-600 dark:text-purple-400">3.</span>
                Provide any additional context that would help our review
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-purple-600 dark:text-purple-400">4.</span>
                Our Trust & Safety team will review within 24-72 hours
              </li>
            </ul>
            <div className="mt-6">
              <Link
                href="/report"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Report Content
              </Link>
            </div>
          </div>
        </section>

        {/* Last Updated */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Last updated: January 2025</p>
          <p className="mt-2">
            <Link href="/help/transparency-report" className="text-purple-600 dark:text-purple-400 hover:underline">
              View our Transparency Report
            </Link>
            {' | '}
            <Link href="/terms" className="text-purple-600 dark:text-purple-400 hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
