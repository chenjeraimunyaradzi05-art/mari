import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluatePaywall } from "@/lib/membership";

export const metadata: Metadata = {
  title: "Dashboard - ATHENA",
  description: "ATHENA Platform Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuardedDashboard>{children}</GuardedDashboard>;
}

async function GuardedDashboard({ children }: { children: React.ReactNode }) {
  const pathname = "/dashboard";
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/login?from=${encodeURIComponent(pathname)}`);
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId: session!.user!.id } });
  const decision = evaluatePaywall(pathname, {
    tier: subscription?.tier ?? null,
    status: subscription?.status ?? null,
  });

  if (!decision.allowed) {
    const search = new URLSearchParams({ from: pathname });
    if (decision.requiredTier) search.set("upgradeTier", decision.requiredTier);
    redirect(`/payment?${search.toString()}`);
  }

  return <>{children}</>;
}
