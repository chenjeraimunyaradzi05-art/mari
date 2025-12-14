import React from "react";
import "../dashboard/shared-dashboard.css";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { SubscriptionActions } from "./subscription-actions";

type PaymentSummary = {
  gifts: number;
  payouts: number;
  net: number;
  giftCount: number;
  payoutCount: number;
  nextBilling?: Date | null;
  tier?: string | null;
  status?: string | null;
  subscriptionId?: string | null;
  invoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
};

type PaymentEvent = {
  id: string;
  label: string;
  amount: number;
  status?: string;
  date: Date;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", { month: "short", day: "numeric" }).format(date);
}

async function loadPaymentData(userId: string): Promise<{ summary: PaymentSummary; methods: string[]; events: PaymentEvent[] }> {
  const [subscription, gifts, payouts] = await Promise.all([
    prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.giftTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.creatorPayout.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const giftsTotal = gifts.reduce((sum, gift) => sum + Number(gift.creatorEarnings), 0);
  const payoutsTotal = payouts.reduce((sum, payout) => sum + Number(payout.totalAmount), 0);

  const events: PaymentEvent[] = [
    ...gifts.map((gift) => ({
      id: gift.id,
      label: `${gift.giftType} gift`,
      amount: Number(gift.creatorEarnings),
      date: gift.createdAt,
      status: "Settled",
    })),
    ...payouts.map((payout) => ({
      id: payout.id,
      label: "Creator payout",
      amount: Number(payout.totalAmount),
      date: payout.createdAt,
      status: payout.status,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const summary: PaymentSummary = {
    gifts: giftsTotal,
    payouts: payoutsTotal,
    net: giftsTotal - payoutsTotal,
    giftCount: gifts.length,
    payoutCount: payouts.length,
    nextBilling: subscription?.nextBillingDate ?? subscription?.currentPeriodEnd ?? null,
    tier: subscription?.tier ?? null,
    status: subscription?.status ?? null,
    subscriptionId: subscription?.id ?? null,
    invoiceUrl: subscription?.latestInvoiceUrl ?? null,
    invoicePdfUrl: subscription?.invoicePdfUrl ?? null,
  };

  const methods = subscription?.defaultPaymentMethodId || subscription?.paymentMethodId
    ? ["Payment method on file", subscription.defaultPaymentMethodId ?? subscription.paymentMethodId!]
    : ["OSKO / PayID", "Direct debit"];

  return { summary, methods, events };
}

export default async function PaymentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?from=${encodeURIComponent("/payment")}`);
  }

  const { summary, methods, events } = await loadPaymentData(session!.user!.id);

  return (
    <main
      className="dash-shell"
      aria-label="Payments"
      style={{
        background:
          "radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)",
      }}
    >
      <div className="dash-container" style={{ display: "grid", gap: 18, maxWidth: 980 }}>
        <section
          className="search-hero"
          style={{
            background: "linear-gradient(135deg,#e91e8c,#8b5cf6)",
            boxShadow: "0 22px 44px -30px rgba(233,30,140,0.55)",
          }}
        >
          <p className="stat-label" style={{ color: "rgba(255,255,255,0.75)" }}>Payments</p>
          <h1 style={{ margin: "6px 0 10px" }}>Membership & settlement</h1>
          <p style={{ color: "rgba(226,232,240,0.85)", maxWidth: 740 }}>
            Live membership status, Stripe checkout links, invoices, and creator earnings. Use the actions below to upgrade, downgrade, or cancel at period end.
          </p>
        </section>

        <section className="dash-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          <div className="card-plain" style={{ border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)" }}>
            <p className="stat-label">Net position</p>
            <h2 style={{ margin: "4px 0" }}>{formatCurrency(summary.net)}</h2>
            <p className="stat-context">Gifts minus payouts</p>
          </div>
          <div className="card-plain" style={{ border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)" }}>
            <p className="stat-label">Gift earnings</p>
            <h2 style={{ margin: "4px 0" }}>{formatCurrency(summary.gifts)}</h2>
            <p className="stat-context">{summary.giftCount} gift events</p>
          </div>
          <div className="card-plain" style={{ border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)" }}>
            <p className="stat-label">Payouts processed</p>
            <h2 style={{ margin: "4px 0" }}>{formatCurrency(summary.payouts)}</h2>
            <p className="stat-context">{summary.payoutCount} payout runs</p>
          </div>
          <div className="card-plain" style={{ border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)" }}>
            <p className="stat-label">Membership</p>
            <h2 style={{ margin: "4px 0" }}>{summary.tier ?? "Free"}</h2>
            <p className="stat-context">Status {summary.status ?? "inactive"}</p>
            <p className="stat-context" style={{ margin: 0 }}>Next billing {summary.nextBilling ? formatDate(summary.nextBilling) : "—"}</p>
            {summary.invoiceUrl && (
              <a href={summary.invoiceUrl} target="_blank" rel="noreferrer" className="stat-context" style={{ display: "inline-block", marginTop: 6 }}>
                View latest invoice
              </a>
            )}
          </div>
        </section>

        <section
          className="card-plain"
          style={{ borderRadius: 18, border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Membership actions</h2>
              <p className="stat-context" style={{ margin: 0 }}>Upgrade, downgrade, or cancel with Stripe-managed invoices and tax.</p>
            </div>
            <SubscriptionActions
              userId={session!.user!.id}
              subscriptionId={summary.subscriptionId ?? undefined}
              currentTier={(summary.tier as 'free' | 'premium' | 'premium_plus' | 'creator' | undefined) ?? undefined}
              email={session!.user?.email ?? undefined}
            />
          </div>
        </section>

        <section
          className="card-plain"
          style={{ borderRadius: 18, border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)" }}
        >
          <h2 style={{ margin: "0 0 10px" }}>Settlement methods</h2>
          <div className="dash-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            {methods.map((method) => (
              <article
                key={method}
                className="card-plain"
                style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.9)", boxShadow: "0 12px 28px -22px rgba(233,30,140,0.35)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <h3 style={{ margin: 0 }}>{method}</h3>
                  <span className="badge-soft" style={{ background: "rgba(233,30,140,0.12)", color: "#9d174d" }}>Preferred</span>
                </div>
                <p className="stat-context" style={{ margin: 0 }}>Live method sourced from subscription or default rails.</p>
                <button className="btn-primary-gradient" style={{ marginTop: 10 }}>Use this method</button>
              </article>
            ))}
          </div>
        </section>

        <section
          className="card-plain"
          style={{ borderRadius: 18, border: "1px solid var(--border)", background: "var(--card)", boxShadow: "0 18px 36px -28px rgba(233,30,140,0.35)" }}
        >
          <h2 style={{ margin: "0 0 10px" }}>Recent settlements</h2>
          {events.length === 0 ? (
            <p className="stat-context" style={{ margin: 0 }}>No payment activity yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {events.map((event) => (
                <li
                  key={event.id}
                  className="card-plain"
                  style={{ border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.9)", boxShadow: "0 12px 28px -22px rgba(233,30,140,0.35)" }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{event.label}</p>
                    <p className="stat-context" style={{ margin: 0 }}>{formatDate(event.date)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{formatCurrency(event.amount)}</p>
                    <p className="stat-context" style={{ margin: 0 }}>{event.status ?? "—"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
