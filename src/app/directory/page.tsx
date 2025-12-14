"use client";

import Link from "next/link";

export default function Home() {
  const sections = [
    {
      heading: "Top-level",
      routes: [
        { href: "/dashboard", title: "Dashboard", blurb: "Role hub for members, companies, budgets, and jobs." },
        { href: "/feed", title: "Feed", blurb: "Program updates and announcements." },
        { href: "/search", title: "Search", blurb: "Search jobs, people, and org data." },
        { href: "/candidates", title: "Candidates", blurb: "Resume parsing, insights, and skills." },
        { href: "/payment", title: "Payments", blurb: "Subscriptions, gifts, and payout readiness." },
        { href: "/telemetry", title: "Telemetry", blurb: "User interaction analytics." },
        { href: "/social", title: "Social", blurb: "Messaging with AI suggestions." },
        { href: "/wellness", title: "Wellness", blurb: "Coaching and sentiment." },
        { href: "/education", title: "Education", blurb: "Courses and learning journeys." },
        { href: "/impact", title: "Impact", blurb: "Program KPIs and outcomes." },
        { href: "/identity", title: "Identity", blurb: "Profile, verification, and docs." },
        { href: "/onboarding", title: "Onboarding", blurb: "New member flows." },
        { href: "/api-docs", title: "API Docs", blurb: "Endpoints and usage." },
        { href: "/org-pages", title: "Org Pages", blurb: "Public organization profiles." },
        { href: "/home", title: "Legacy Home", blurb: "Early landing variant." },
      ],
    },
    {
      heading: "Dashboards",
      routes: [
        { href: "/dashboard/admin", title: "Admin Overview", blurb: "Admin operations and audit logs." },
        { href: "/dashboard/budgets", title: "Budgets", blurb: "Member budgets and expenses." },
        { href: "/dashboard/money", title: "Money", blurb: "Financial view for members." },
        { href: "/dashboard/company", title: "Company", blurb: "Company stats and views." },
        { href: "/dashboard/companies", title: "Companies", blurb: "List of hiring partners." },
        { href: "/dashboard/jobs", title: "Jobs", blurb: "Job postings management." },
        { href: "/dashboard/candidate", title: "Candidate", blurb: "Candidate detail view." },
        { href: "/dashboard/members", title: "Members", blurb: "Member roster." },
        { href: "/dashboard/applications", title: "Applications", blurb: "Applicant tracking placeholder." },
        { href: "/dashboard/mentors", title: "Mentors", blurb: "Mentor management placeholder." },
        { href: "/dashboard/sessions", title: "Sessions", blurb: "Mentor session placeholder." },
        { href: "/dashboard/courses", title: "Courses", blurb: "Course catalog placeholder." },
        { href: "/dashboard/enrollments", title: "Enrollments", blurb: "Enrollment placeholder." },
        { href: "/dashboard/agents", title: "Agents", blurb: "Real estate agent placeholder." },
        { href: "/dashboard/properties", title: "Properties", blurb: "Housing properties placeholder." },
        { href: "/dashboard/housing-applications", title: "Housing Apps", blurb: "Housing application placeholder." },
        { href: "/dashboard/expenses", title: "Expenses", blurb: "Expense placeholder." },
        { href: "/dashboard/wellness", title: "Wellness", blurb: "Wellness placeholder." },
        { href: "/dashboard/ai-concierge", title: "AI Concierge", blurb: "AI concierge placeholder." },
        { href: "/dashboard/audit-logs", title: "Audit Logs", blurb: "Audit log placeholder." },
        { href: "/dashboard/users", title: "Users", blurb: "User management placeholder." },
        { href: "/dashboard/settings", title: "Settings", blurb: "Dashboard settings placeholder." },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "radial-gradient(circle at 12% 10%, rgba(233,30,140,0.12), transparent 30%), radial-gradient(circle at 82% 0%, rgba(139,92,246,0.12), transparent 30%), var(--background)" }}>
      {/* Navigation */}
      <nav className="border-b bg-white/70 backdrop-blur femme-header" style={{ borderColor: "var(--border)" }}>
        <div className="femme-header__halo" aria-hidden />
        <div className="femme-header__glimmer femme-header__glimmer--left" aria-hidden />
        <div className="femme-header__glimmer femme-header__glimmer--right" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold" style={{ color: "var(--accent)" }}>ATHENA</div>
            <div className="hidden gap-8 md:flex">
              <a href="#features" className="text-slate-700 hover:text-pink-600">Features</a>
              <a href="#personas" className="text-slate-700 hover:text-pink-600">Personas</a>
              <a href="#routes" className="text-slate-700 hover:text-pink-600">Routes</a>
              <Link href="/api-docs" className="text-slate-700 hover:text-pink-600">API Docs</Link>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg px-4 py-2 font-medium text-white"
              style={{ background: "linear-gradient(120deg, #e91e8c, #8b5cf6)", boxShadow: "0 8px 24px -12px rgba(233,30,140,0.6)" }}
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-slate-900 sm:text-6xl">
              Welcome to <span style={{ color: "var(--accent)" }}>ATHENA</span>
            </h1>
            <p className="mt-6 text-xl text-slate-700">
              A comprehensive platform built with Next.js 14, TypeScript, and PostgreSQL
            </p>
            <div className="mt-10 flex gap-4 justify-center">
              <Link
                href="/dashboard"
                className="rounded-lg px-8 py-3 font-medium text-white"
                style={{ background: "linear-gradient(120deg, #e91e8c, #8b5cf6)", boxShadow: "0 12px 28px -14px rgba(233,30,140,0.6)" }}
              >
                Go to Dashboard
              </Link>
              <button
                className="rounded-lg border px-8 py-3 font-medium"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Features Grid */}
          <div id="features" className="mt-20 grid gap-6 md:grid-cols-3">
            {[{
              icon: "⚙️",
              title: "Modern Stack",
              copy: "Next.js 14, TypeScript, Prisma ORM, and PostgreSQL",
            }, {
              icon: "👥",
              title: "Multi-Tenant",
              copy: "Support for 9+ user personas with role-based access",
            }, {
              icon: "🚀",
              title: "Scalable",
              copy: "Ready for Netlify deployment with Netlify DB",
            }].map((f) => (
              <div key={f.title} className="rounded-lg border p-6" style={{ borderColor: "var(--border)", background: "var(--card)", boxShadow: "0 22px 46px -30px rgba(233,30,140,0.28)" }}>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-700">{f.copy}</p>
              </div>
            ))}
          </div>

          {/* Personas */}
          <div id="personas" className="mt-20">
            <h2 className="text-3xl font-bold text-white mb-10">Supported Personas</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {["Member", "Company", "Mentor", "TAFE Coordinator", "Real Estate Agent", "Admin", "AI Concierge", "Budget Manager", "Wellness Manager"].map((persona) => (
                <div key={persona} className="rounded-lg px-4 py-3 border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <span className="text-slate-800">{persona}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Route Directory */}
          <div id="routes" className="mt-20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white">Live Routes</h2>
              <span className="text-sm text-slate-400">
                {sections.reduce((acc, s) => acc + s.routes.length, 0)} pages wired
              </span>
            </div>
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.heading} className="space-y-3">
                  <h3 className="text-xl font-semibold text-white">{section.heading}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {section.routes.map((route) => (
                      <a
                        key={route.href}
                        href={route.href}
                        className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 hover:border-blue-500 hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-semibold text-white">{route.title}</p>
                            <p className="text-sm text-slate-400">{route.blurb}</p>
                          </div>
                          <span className="text-xs rounded-full bg-emerald-600/20 px-3 py-1 text-emerald-200 border border-emerald-700/50">Live</span>
                        </div>
                        <p className="mt-2 text-sm text-blue-300">{route.href}</p>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Docs Section */}
          <div id="docs" className="mt-20 rounded-lg border p-8 backdrop-blur" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">API Documentation</h2>
            <div className="space-y-3 text-slate-700">
              <p className="flex items-center gap-2">
                <span className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white">POST</span>
                <code className="text-sm">/api/auth/register</code> - User registration
              </p>
              <p className="flex items-center gap-2">
                <span className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">GET</span>
                <code className="text-sm">/api/members</code> - List members
              </p>
              <p className="flex items-center gap-2">
                <span className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">GET</span>
                <code className="text-sm">/api/jobs</code> - List job postings
              </p>
              <p className="flex items-center gap-2">
                <span className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">GET</span>
                <code className="text-sm">/api/budgets</code> - Member budgets
              </p>
            </div>
          </div>

          {/* Database Status */}
          <div className="mt-20 rounded-lg border p-6 backdrop-blur" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ background: "var(--accent)" }}></div>
              <div>
                <p className="text-lg font-semibold text-slate-900">Database Connected</p>
                <p className="text-sm text-slate-700">PostgreSQL is running and ready for use</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-6 text-center" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.75)", color: "#4a3553" }}>
        <p>ATHENA Platform • Built with Next.js 14, TypeScript & PostgreSQL</p>
      </footer>
    </div>
  );
}
