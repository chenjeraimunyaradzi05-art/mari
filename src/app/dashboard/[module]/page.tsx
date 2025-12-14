import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

type Item = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  pill?: string;
};

type ModuleConfig = {
  title: string;
  description: string;
  fetch: () => Promise<{ count: number; items: Item[] }>;
};

const formatName = (first?: string | null, last?: string | null) => {
  const name = [first, last].filter(Boolean).join(" ");
  return name || "Unknown";
};

const modules: Record<string, ModuleConfig> = {
  applications: {
    title: "Job Applications",
    description: "Latest member job applications with company and status.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.jobApplication.count(),
        prisma.jobApplication.findMany({
          take: 5,
          orderBy: { appliedDate: "desc" },
          include: {
            job: { select: { title: true } },
            company: { select: { companyName: true } },
            member: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
          },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.job?.title ?? "Job",
          subtitle: `${formatName(r.member?.user?.firstName, r.member?.user?.lastName)} @ ${r.company?.companyName ?? "Company"}`,
          meta: `Status: ${r.status}`,
        })),
      };
    },
  },
  mentors: {
    title: "Mentors",
    description: "Active mentors and their specialties.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.mentor.count(),
        prisma.mentor.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { firstName: true, lastName: true } } },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: formatName(r.user?.firstName, r.user?.lastName),
          subtitle: r.bio ?? "No bio",
          meta: r.specialization?.join(", ") ?? "",
        })),
      };
    },
  },
  sessions: {
    title: "Mentor Sessions",
    description: "Recent mentor sessions and topics.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.mentorSession.count(),
        prisma.mentorSession.findMany({
          take: 5,
          orderBy: { sessionDate: "desc" },
          include: { mentor: { include: { user: { select: { firstName: true, lastName: true } } } } },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.topic,
          subtitle: `Mentor: ${formatName(r.mentor?.user?.firstName, r.mentor?.user?.lastName)}`,
          meta: `Status: ${r.status} • ${r.sessionDate.toISOString().slice(0, 10)}`,
        })),
      };
    },
  },
  courses: {
    title: "Courses",
    description: "TAFE courses with enrollment potential.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.course.count(),
        prisma.course.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { coordinator: { include: { user: { select: { firstName: true, lastName: true } } } } },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: r.description ?? "No description",
          meta: `Coordinator: ${formatName(r.coordinator?.user?.firstName, r.coordinator?.user?.lastName)}`,
        })),
      };
    },
  },
  enrollments: {
    title: "Enrollments",
    description: "Member enrollments across courses.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.courseEnrollment.count(),
        prisma.courseEnrollment.findMany({
          take: 5,
          orderBy: { enrollmentDate: "desc" },
          include: {
            course: { select: { title: true } },
            member: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.course?.title ?? "Course",
          subtitle: `Member: ${formatName(r.member?.user?.firstName, r.member?.user?.lastName)}`,
          meta: `Status: ${r.status}`,
        })),
      };
    },
  },
  agents: {
    title: "Real Estate Agents",
    description: "Agents managing properties for housing.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.realEstateAgent.count(),
        prisma.realEstateAgent.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { firstName: true, lastName: true } } },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: formatName(r.user?.firstName, r.user?.lastName),
          subtitle: r.agencyName ?? "",
          meta: r.specializations?.join(", ") ?? "",
        })),
      };
    },
  },
  properties: {
    title: "Properties",
    description: "Housing properties and availability.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.property.count(),
        prisma.property.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.address,
          subtitle: `${r.bedrooms ?? 0} br • ${r.type}`,
          meta: `Agent: ${formatName(r.agent?.user?.firstName, r.agent?.user?.lastName)} • Status: ${r.status}`,
        })),
      };
    },
  },
  "housing-applications": {
    title: "Housing Applications",
    description: "Member applications for properties.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.housingApplication.count(),
        prisma.housingApplication.findMany({
          take: 5,
          orderBy: { applicationDate: "desc" },
          include: {
            member: { select: { user: { select: { firstName: true, lastName: true } } } },
            property: { select: { address: true } },
          },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.property?.address ?? "Property",
          subtitle: `Member: ${formatName(r.member?.user?.firstName, r.member?.user?.lastName)}`,
          meta: `Status: ${r.status}`,
        })),
      };
    },
  },
  expenses: {
    title: "Expenses",
    description: "Member expenses across budgets.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.expense.count(),
        prisma.expense.findMany({
          take: 5,
          orderBy: { date: "desc" },
          include: { member: { select: { user: { select: { firstName: true, lastName: true } } } } },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.description,
          subtitle: `Member: ${formatName(r.member?.user?.firstName, r.member?.user?.lastName)}`,
          meta: `${r.category} • $${r.amount.toFixed(2)}`,
        })),
      };
    },
  },
  wellness: {
    title: "Wellness Sessions",
    description: "Wellness sessions with topics and mood.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.wellnessSession.count(),
        prisma.wellnessSession.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { member: { select: { user: { select: { firstName: true, lastName: true } } } } },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.topic,
          subtitle: `Member: ${formatName(r.member?.user?.firstName, r.member?.user?.lastName)}`,
          meta: r.mood ? `Mood: ${r.mood}` : undefined,
        })),
      };
    },
  },
  "ai-concierge": {
    title: "AI Concierge Requests",
    description: "Member AI concierge requests and categories.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.aIConciergeRequest.count(),
        prisma.aIConciergeRequest.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.request.slice(0, 80),
          subtitle: r.response ? `Response: ${r.response.slice(0, 60)}...` : "No response yet",
          meta: r.category ?? "",
        })),
      };
    },
  },
  "audit-logs": {
    title: "Audit Logs",
    description: "System audit log entries.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.auditLog.count(),
        prisma.auditLog.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: r.action,
          subtitle: `${r.resource}${r.resourceId ? ` #${r.resourceId}` : ""}`,
          meta: r.userId ? `User: ${r.userId}` : undefined,
        })),
      };
    },
  },
  users: {
    title: "Users",
    description: "Platform users with roles.",
    fetch: async () => {
      const [count, rows] = await Promise.all([
        prisma.user.count(),
        prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return {
        count,
        items: rows.map((r) => ({
          id: r.id,
          title: formatName(r.firstName, r.lastName) || r.email,
          subtitle: r.email,
          meta: `Role: ${r.role}`,
        })),
      };
    },
  },
  settings: {
    title: "Settings",
    description: "Settings area (static placeholder).",
    fetch: async () => ({ count: 0, items: [] }),
  },
};

const formatCount = (count: number) => (count === 0 ? "No records yet" : `${count} total`);

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: key } = await params;
  const config = modules[key];

  if (!config) {
    notFound();
  }

  const { title, description, fetch } = config;
  const { count, items } = await fetch();

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 18% 14%, rgba(233,30,140,0.1), transparent 30%), radial-gradient(circle at 80% 10%, rgba(139,92,246,0.1), transparent 28%), var(--background)",
      }}
    >
      <header
        className="border-b backdrop-blur sticky top-0 z-50"
        style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.82)" }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hover:underline" style={{ color: "var(--accent)", fontWeight: 600 }}>
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          </div>
          <span className="text-sm text-slate-600">{formatCount(count)}</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        <div
          className="rounded-lg border p-6"
          style={{ borderColor: "var(--border)", background: "var(--card)", boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)" }}
        >
          <p className="text-slate-800">{description}</p>
          {count === 0 && <p className="mt-2 text-slate-500">No records yet. Add data to see it here.</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border p-4"
              style={{
                borderColor: "var(--border)",
                background: "var(--card)",
                boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                {item.pill && (
                  <span className="text-xs rounded-full px-3 py-1" style={{ background: "rgba(233,30,140,0.12)", color: "#9d174d" }}>
                    {item.pill}
                  </span>
                )}
              </div>
              {item.subtitle && <p className="text-sm text-slate-600 mt-1">{item.subtitle}</p>}
              {item.meta && <p className="text-xs text-slate-500 mt-2">{item.meta}</p>}
            </div>
          ))}
          {items.length === 0 && (
            <div
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "#475569" }}
            >
              Nothing to show yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
