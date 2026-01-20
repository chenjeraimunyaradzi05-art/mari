'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  MessageCircle,
  Book,
  FileText,
  Mail,
  ExternalLink,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Shield,
  CreditCard,
  User,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const faqCategories = [
  {
    id: 'account',
    name: 'Account & Profile',
    icon: User,
    faqs: [
      {
        question: 'How do I update my profile information?',
        answer: 'Go to Settings > Profile to update your personal information, work experience, skills, and more. Make sure to keep your profile up-to-date for better job matches.',
      },
      {
        question: 'How do I change my password?',
        answer: 'Navigate to Settings > Security, then click "Change Password". You\'ll need to enter your current password and your new password twice to confirm.',
      },
      {
        question: 'Can I delete my account?',
        answer: 'Yes, you can delete your account from Settings > Security > Danger Zone. Please note this action is permanent and cannot be undone. All your data will be permanently removed.',
      },
    ],
  },
  {
    id: 'jobs',
    name: 'Jobs & Applications',
    icon: Briefcase,
    faqs: [
      {
        question: 'How does the job matching work?',
        answer: 'Our AI analyzes your profile, skills, experience, and preferences to find jobs that best match your qualifications. The more complete your profile, the better your matches will be.',
      },
      {
        question: 'How do I apply for a job?',
        answer: 'Click on any job listing to view details, then click "Apply Now". You can include a cover letter and the system will attach your most recent resume automatically.',
      },
      {
        question: 'Can I track my applications?',
        answer: 'Yes! Go to Dashboard > My Applications to see all your submitted applications and their current status.',
      },
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Subscriptions',
    icon: CreditCard,
    faqs: [
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards (Visa, Mastercard, American Express), as well as PayPal. Enterprise customers can also pay via invoice.',
      },
      {
        question: 'How do I cancel my subscription?',
        answer: 'Go to Settings > Billing and click "Cancel Subscription". You\'ll retain access until the end of your current billing period.',
      },
      {
        question: 'Do you offer refunds?',
        answer: 'We offer a 30-day money-back guarantee for first-time subscribers. Contact support within 30 days of your first payment for a full refund.',
      },
    ],
  },
  {
    id: 'privacy',
    name: 'Privacy & Safety',
    icon: Shield,
    faqs: [
      {
        question: 'Who can see my profile?',
        answer: 'By default, only verified employers and other ATHENA members can see your profile. You can adjust your visibility settings in Privacy settings.',
      },
      {
        question: 'How do you protect my data?',
        answer: 'We use industry-standard encryption (AES-256) for all data at rest and in transit. Your personal information is never sold to third parties.',
      },
      {
        question: 'How do I report inappropriate content?',
        answer: 'Click the three dots menu on any content and select "Report". Our safety team reviews all reports within 24 hours.',
      },
    ],
  },
  {
    id: 'learning',
    name: 'Learning & Courses',
    icon: GraduationCap,
    faqs: [
      {
        question: 'How do I access my enrolled courses?',
        answer: 'Go to Dashboard > Learn > My Courses to see all courses you\'re enrolled in. You can continue from where you left off.',
      },
      {
        question: 'Do I get a certificate upon completion?',
        answer: 'Yes! All courses include a certificate of completion that you can add to your profile and share on LinkedIn.',
      },
      {
        question: 'Can I get a refund for a course?',
        answer: 'Courses can be refunded within 7 days of purchase if you haven\'t completed more than 30% of the content.',
      },
    ],
  },
];

const quickLinks = [
  {
    title: 'Getting Started Guide',
    description: 'New to ATHENA? Start here',
    icon: Book,
    href: '/help/getting-started',
  },
  {
    title: 'Safety Center',
    description: 'Manage reports, blocks, and safety tools',
    icon: Shield,
    href: '/safety-center',
  },
  {
    title: 'Contact Support',
    description: 'Get help from our team',
    icon: Mail,
    href: 'mailto:support@athena.com',
  },
  {
    title: 'Community Guidelines',
    description: 'Our rules and policies',
    icon: FileText,
    href: '/help/community-guidelines',
  },
  {
    title: 'Feature Requests',
    description: 'Suggest improvements',
    icon: Lightbulb,
    href: '/help/feedback',
  },
];

export default function HelpSupportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('account');
  const [expandedFaqs, setExpandedFaqs] = useState<string[]>([]);

  const toggleFaq = (faqId: string) => {
    setExpandedFaqs((prev) =>
      prev.includes(faqId) ? prev.filter((id) => id !== faqId) : [...prev, faqId]
    );
  };

  const filteredCategories = faqCategories
    .map((category) => ({
      ...category,
      faqs: category.faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.faqs.length > 0 || !searchQuery);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center space-x-2">
          <HelpCircle className="w-6 h-6 text-primary-500" />
          <span>Help & Support</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Find answers to common questions or get in touch with our team
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search for help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-lg"
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.title}
            href={link.href}
            className="card-hover flex flex-col items-center text-center p-4"
          >
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-3">
              <link.icon className="w-6 h-6 text-primary-500" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
              {link.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {link.description}
            </p>
          </Link>
        ))}
      </div>

      {/* FAQs */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === category.id ? null : category.id
                  )
                }
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition"
              >
                <div className="flex items-center space-x-3">
                  <category.icon className="w-5 h-5 text-primary-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({category.faqs.length})
                  </span>
                </div>
                {expandedCategory === category.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {/* FAQs */}
              {expandedCategory === category.id && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {category.faqs.map((faq, index) => {
                    const faqId = `${category.id}-${index}`;
                    const isExpanded = expandedFaqs.includes(faqId);

                    return (
                      <div key={faqId}>
                        <button
                          onClick={() => toggleFaq(faqId)}
                          className="w-full flex items-start justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                          <span className="text-gray-700 dark:text-gray-300 pr-4">
                            {faq.question}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 text-gray-500 dark:text-gray-400 text-sm">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 text-center">
        <MessageCircle className="w-12 h-12 text-primary-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Still need help?
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Our support team is available 24/7 to assist you
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="mailto:support@athena.com"
            className="btn-primary flex items-center space-x-2"
          >
            <Mail className="w-4 h-4" />
            <span>Email Support</span>
          </a>
          <button className="btn-outline flex items-center space-x-2">
            <MessageCircle className="w-4 h-4" />
            <span>Live Chat</span>
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Average response time: &lt; 2 hours
        </p>
      </div>

      {/* Resources */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Additional Resources
        </h2>
        <div className="space-y-3">
          <a
            href="/terms"
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <span className="text-gray-700 dark:text-gray-300">Terms of Service</span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
          <a
            href="/privacy"
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <span className="text-gray-700 dark:text-gray-300">Privacy Policy</span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
          <a
            href="/cookies"
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <span className="text-gray-700 dark:text-gray-300">Cookie Policy</span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
          <a
            href="/accessibility"
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <span className="text-gray-700 dark:text-gray-300">Accessibility Statement</span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
