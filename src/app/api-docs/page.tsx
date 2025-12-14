"use client";

import Link from "next/link";

export default function APIDocs() {
  const endpoints = [
    {
      category: "Authentication",
      items: [
        { method: "POST", path: "/api/auth/register", description: "Register a new user" },
        { method: "POST", path: "/api/auth/login", description: "Login user" },
        { method: "POST", path: "/api/auth/logout", description: "Logout user" },
      ],
    },
    {
      category: "Members",
      items: [
        { method: "GET", path: "/api/members", description: "List all members" },
        { method: "POST", path: "/api/members", description: "Create new member" },
        { method: "GET", path: "/api/members/[id]", description: "Get member details" },
        { method: "PUT", path: "/api/members/[id]", description: "Update member" },
        { method: "DELETE", path: "/api/members/[id]", description: "Delete member" },
      ],
    },
    {
      category: "Companies",
      items: [
        { method: "GET", path: "/api/companies", description: "List all companies" },
        { method: "POST", path: "/api/companies", description: "Create new company" },
        { method: "GET", path: "/api/companies/[id]", description: "Get company details" },
      ],
    },
    {
      category: "Jobs",
      items: [
        { method: "GET", path: "/api/jobs", description: "List all job postings" },
        { method: "POST", path: "/api/jobs", description: "Create new job posting" },
        { method: "GET", path: "/api/jobs/[id]", description: "Get job details" },
        { method: "POST", path: "/api/jobs/[id]/apply", description: "Apply for job" },
      ],
    },
    {
      category: "Budgets",
      items: [
        { method: "GET", path: "/api/budgets", description: "List all budgets" },
        { method: "POST", path: "/api/budgets", description: "Create new budget" },
        { method: "GET", path: "/api/budgets/[id]", description: "Get budget details" },
        { method: "POST", path: "/api/budgets/[id]/expenses", description: "Add expense to budget" },
      ],
    },
    {
      category: "Mentorship",
      items: [
        { method: "GET", path: "/api/mentors", description: "List all mentors" },
        { method: "POST", path: "/api/mentors", description: "Register as mentor" },
        { method: "GET", path: "/api/sessions", description: "List mentor sessions" },
        { method: "POST", path: "/api/sessions", description: "Schedule new session" },
      ],
    },
    {
      category: "Real Estate",
      items: [
        { method: "GET", path: "/api/agents", description: "List real estate agents" },
        { method: "GET", path: "/api/properties", description: "List properties" },
        { method: "POST", path: "/api/housing-applications", description: "Apply for housing" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 to-slate-800">
      <header className="border-b border-slate-700 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-blue-400 hover:text-blue-300">
              ATHENA
            </Link>
            <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-white mb-2">API Documentation</h1>
        <p className="text-slate-400 mb-8">Complete reference for ATHENA platform APIs</p>

        <div className="space-y-12">
          {endpoints.map((section) => (
            <div key={section.category}>
              <h2 className="mb-6 text-2xl font-bold text-blue-400">{section.category}</h2>
              <div className="space-y-4">
                {section.items.map((endpoint, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 backdrop-blur hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`rounded px-3 py-1 text-xs font-medium text-white ${
                              endpoint.method === "GET"
                                ? "bg-blue-600"
                                : endpoint.method === "POST"
                                ? "bg-green-600"
                                : endpoint.method === "PUT"
                                ? "bg-yellow-600"
                                : "bg-red-600"
                            }`}
                          >
                            {endpoint.method}
                          </span>
                          <code className="font-mono text-sm text-slate-300">{endpoint.path}</code>
                        </div>
                        <p className="text-slate-400">{endpoint.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Getting Started */}
        <div className="mt-16 rounded-lg border border-slate-700 bg-slate-800/50 p-8 backdrop-blur">
          <h2 className="mb-4 text-2xl font-bold text-white">Getting Started</h2>
          <div className="space-y-4 text-slate-300">
            <p>1. Register a user via <code className="bg-slate-900 px-2 py-1 rounded text-slate-200">POST /api/auth/register</code></p>
            <p>2. Create profile data (Member, Company, etc.)</p>
            <p>3. Start making API requests with your authentication token</p>
            <p>4. All responses follow the standard format with <code className="bg-slate-900 px-2 py-1 rounded text-slate-200">data</code> and <code className="bg-slate-900 px-2 py-1 rounded text-slate-200">error</code> fields</p>
          </div>
        </div>
      </div>
    </div>
  );
}
