'use client';

import Link from 'next/link';
import { Code, Terminal, Book, Key, Zap, Shield, Globe, ArrowRight, Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function DevelopersPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const codeExamples = {
    auth: `// Authentication
const response = await fetch('https://api.athena.com/v1/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    grant_type: 'client_credentials'
  })
});
const { access_token } = await response.json();`,
    jobs: `// Search Jobs
const jobs = await fetch('https://api.athena.com/v1/jobs?q=software+engineer&location=remote', {
  headers: { 'Authorization': \`Bearer \${access_token}\` }
});
const data = await jobs.json();
console.log(data.results);`,
    ai: `// AI Resume Analysis
const analysis = await fetch('https://api.athena.com/v1/ai/resume/analyze', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${access_token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ resume_text: '...' })
});`
  };

  const features = [
    { icon: Key, title: 'OAuth 2.0 Authentication', description: 'Secure API access with industry-standard OAuth 2.0 flows' },
    { icon: Zap, title: 'Real-time Webhooks', description: 'Get instant notifications for job matches and applications' },
    { icon: Shield, title: 'Rate Limiting', description: '1000 requests/minute with automatic scaling for enterprise' },
    { icon: Globe, title: 'Global CDN', description: 'Low latency API responses from edge locations worldwide' },
  ];

  const endpoints = [
    { method: 'GET', path: '/v1/jobs', description: 'Search and filter job listings' },
    { method: 'GET', path: '/v1/jobs/:id', description: 'Get detailed job information' },
    { method: 'POST', path: '/v1/applications', description: 'Submit job applications' },
    { method: 'GET', path: '/v1/users/:id/profile', description: 'Retrieve user profiles' },
    { method: 'POST', path: '/v1/ai/resume/analyze', description: 'AI-powered resume analysis' },
    { method: 'POST', path: '/v1/ai/match', description: 'AI job matching algorithm' },
    { method: 'GET', path: '/v1/mentors', description: 'Search mentor directory' },
    { method: 'POST', path: '/v1/messages', description: 'Send direct messages' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-8 h-8 text-green-400" />
              <span className="text-green-400 font-medium">Developer Platform</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Build with the ATHENA API
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl">
              Access jobs, mentors, AI tools, and more. Integrate ATHENA&apos;s powerful career platform into your applications.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/developers/docs"
                className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition flex items-center gap-2"
              >
                <Book className="w-5 h-5" />
                Read the Docs
              </Link>
              <Link
                href="/developers/console"
                className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
              >
                <Terminal className="w-5 h-5" />
                API Console
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <feature.icon className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Code Examples */}
      <section className="bg-gray-900 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Quick Start</h2>
          <div className="max-w-4xl mx-auto space-y-6">
            {Object.entries(codeExamples).map(([key, code]) => (
              <div key={key} className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-750 border-b border-gray-700">
                  <span className="text-sm text-gray-400 capitalize">{key === 'auth' ? 'Authentication' : key === 'jobs' ? 'Search Jobs' : 'AI Analysis'}</span>
                  <button
                    onClick={() => copyToClipboard(code, key)}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
                  >
                    {copied === key ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied === key ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
                  <code>{code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">API Endpoints</h2>
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {endpoints.map((endpoint, i) => (
              <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                <span className={`px-2 py-1 text-xs font-mono font-bold rounded ${
                  endpoint.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {endpoint.method}
                </span>
                <code className="text-sm font-mono text-gray-900 dark:text-white flex-1">{endpoint.path}</code>
                <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:block">{endpoint.description}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center mt-8">
          <Link href="/developers/docs/api-reference" className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium">
            View Full API Reference <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* SDKs */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Official SDKs</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: 'JavaScript/TypeScript', icon: '🟨', pkg: 'npm install @athena/sdk' },
              { name: 'Python', icon: '🐍', pkg: 'pip install athena-sdk' },
              { name: 'Ruby', icon: '💎', pkg: 'gem install athena-sdk' },
            ].map((sdk) => (
              <div key={sdk.name} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <span className="text-3xl mb-4 block">{sdk.icon}</span>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{sdk.name}</h3>
                <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block">
                  {sdk.pkg}
                </code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Build?</h2>
          <p className="text-green-100 mb-8 max-w-2xl mx-auto">
            Get your API keys and start integrating ATHENA into your application today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="px-8 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-gray-100 transition">
              Create Free Account
            </Link>
            <Link href="/contact-sales" className="px-8 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-800 transition flex items-center gap-2">
              Enterprise API <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
