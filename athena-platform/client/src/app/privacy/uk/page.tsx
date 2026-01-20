'use client';

import { Shield, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';

export default function UKPrivacyAddendumPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-10 h-10" />
            <h1 className="text-3xl font-bold">UK Privacy Addendum</h1>
          </div>
          <p className="text-purple-100 text-lg">
            Additional privacy information for users in the United Kingdom
          </p>
          <p className="text-purple-200 text-sm mt-2">
            Last updated: January 2026
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 prose prose-purple dark:prose-invert max-w-none">
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
          <p>
            This UK Privacy Addendum supplements our main <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link> and 
            provides additional information required under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
          </p>
          <p>
            When we refer to "GDPR" in this addendum, we mean the UK GDPR as it forms part of UK domestic law by virtue of section 3 of the 
            European Union (Withdrawal) Act 2018.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Data Controller</h2>
          <p>For UK users, the data controller responsible for your personal data is:</p>
          <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 mt-4">
            <p className="font-semibold">ATHENA Platform Ltd</p>
            <p className="flex items-center gap-2 mt-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              [Registered Address], London, United Kingdom
            </p>
            <p className="flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4 text-gray-400" />
              <a href="mailto:privacy@athena.com" className="text-purple-600">privacy@athena.com</a>
            </p>
            <p className="text-sm text-gray-500 mt-2">ICO Registration Number: [To be added]</p>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Lawful Bases for Processing</h2>
          <p>Under UK GDPR, we must have a lawful basis to process your personal data. We rely on the following bases:</p>
          
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full border border-gray-200 dark:border-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-750">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Processing Activity</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Lawful Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="px-4 py-3 text-sm">Account creation and management</td>
                  <td className="px-4 py-3 text-sm">Contract performance</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">Processing payments</td>
                  <td className="px-4 py-3 text-sm">Contract performance</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">Service-related communications</td>
                  <td className="px-4 py-3 text-sm">Contract performance / Legitimate interests</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">Marketing communications</td>
                  <td className="px-4 py-3 text-sm">Consent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">Platform security and fraud prevention</td>
                  <td className="px-4 py-3 text-sm">Legitimate interests</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">Analytics and service improvement</td>
                  <td className="px-4 py-3 text-sm">Legitimate interests / Consent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">Job recommendations and matching</td>
                  <td className="px-4 py-3 text-sm">Contract performance / Consent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">Compliance with legal obligations</td>
                  <td className="px-4 py-3 text-sm">Legal obligation</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Your Rights Under UK GDPR</h2>
          <p>As a UK resident, you have the following rights regarding your personal data:</p>
          
          <ul className="mt-4 space-y-3">
            <li>
              <strong>Right of Access (Article 15)</strong> - You can request a copy of your personal data we hold.
            </li>
            <li>
              <strong>Right to Rectification (Article 16)</strong> - You can request correction of inaccurate data.
            </li>
            <li>
              <strong>Right to Erasure (Article 17)</strong> - You can request deletion of your data in certain circumstances.
            </li>
            <li>
              <strong>Right to Restriction (Article 18)</strong> - You can request we limit how we use your data.
            </li>
            <li>
              <strong>Right to Data Portability (Article 20)</strong> - You can request your data in a machine-readable format.
            </li>
            <li>
              <strong>Right to Object (Article 21)</strong> - You can object to certain processing, including direct marketing.
            </li>
            <li>
              <strong>Rights related to automated decision-making (Article 22)</strong> - You have rights regarding automated decisions that significantly affect you.
            </li>
          </ul>

          <p className="mt-4">
            To exercise any of these rights, visit our <Link href="/privacy-center" className="text-purple-600 hover:underline">Privacy Center</Link> or 
            contact us at <a href="mailto:privacy@athena.com" className="text-purple-600 hover:underline">privacy@athena.com</a>.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">International Data Transfers</h2>
          <p>
            Your data may be transferred to and processed in countries outside the UK. When we transfer data internationally, 
            we ensure appropriate safeguards are in place:
          </p>
          <ul className="mt-4 space-y-2">
            <li>Transfers to countries with UK adequacy decisions</li>
            <li>International Data Transfer Agreement (IDTA) or Addendum to EU SCCs</li>
            <li>Binding Corporate Rules where applicable</li>
            <li>Additional technical and organisational measures</li>
          </ul>
          <p className="mt-4">
            For more information about our international data transfers and the safeguards in place, 
            please contact our Data Protection Officer.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Data Protection Officer</h2>
          <p>We have appointed a Data Protection Officer (DPO) who can be contacted for any privacy-related queries:</p>
          <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 mt-4">
            <p className="font-semibold">Data Protection Officer</p>
            <p className="flex items-center gap-2 mt-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <a href="mailto:dpo@athena.com" className="text-purple-600">dpo@athena.com</a>
            </p>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Complaints</h2>
          <p>
            If you are not satisfied with how we handle your personal data, you have the right to lodge a complaint 
            with the Information Commissioner's Office (ICO):
          </p>
          <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 mt-4">
            <p className="font-semibold">Information Commissioner's Office</p>
            <p className="flex items-center gap-2 mt-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF
            </p>
            <p className="flex items-center gap-2 mt-1">
              <Phone className="w-4 h-4 text-gray-400" />
              0303 123 1113
            </p>
            <p className="flex items-center gap-2 mt-1">
              <ExternalLink className="w-4 h-4 text-gray-400" />
              <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="text-purple-600">
                ico.org.uk/make-a-complaint
              </a>
            </p>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            We would encourage you to contact us first so we can try to resolve any concerns directly.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">UK Online Safety</h2>
          <p>
            In compliance with the UK Online Safety Act, we have implemented comprehensive safety measures to protect 
            users from harmful content:
          </p>
          <ul className="mt-4 space-y-2">
            <li>Robust content moderation systems</li>
            <li>Easy-to-use reporting mechanisms for illegal and harmful content</li>
            <li>User blocking and muting features</li>
            <li>Safe Mode for users requiring enhanced privacy</li>
            <li>Age-appropriate content controls</li>
          </ul>
          <p className="mt-4">
            For more information, visit our <Link href="/safety-center" className="text-purple-600 hover:underline">Safety Center</Link>.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p>For any questions about this UK Privacy Addendum or your privacy rights, please contact us:</p>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <a
              href="mailto:privacy@athena.com"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Mail className="w-5 h-5" />
              Email Privacy Team
            </a>
            <Link
              href="/privacy-center"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
            >
              <Shield className="w-5 h-5" />
              Visit Privacy Center
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
