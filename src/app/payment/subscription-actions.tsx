'use client';

import { useState } from "react";

type Tier = "free" | "premium" | "premium_plus" | "creator";

type Props = {
  userId: string;
  subscriptionId?: string;
  currentTier?: Tier;
  email?: string;
};

const tierOptions: Array<{ value: Tier; label: string }> = [
  { value: "premium", label: "Premium" },
  { value: "premium_plus", label: "Premium+" },
  { value: "creator", label: "Creator" },
];

export function SubscriptionActions({ userId, subscriptionId, currentTier, email }: Props) {
  const [tier, setTier] = useState<Tier>(currentTier && currentTier !== "free" ? currentTier : "premium");
  const [loading, setLoading] = useState<"upgrade" | "cancel" | "portal" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout() {
    setLoading("upgrade");
    setMessage(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier, email }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error?.error ?? "Unable to start checkout");
      }

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setMessage("Checkout session missing URL. Try again.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoading(null);
    }
  }

  async function cancelAtPeriodEnd() {
    if (!subscriptionId) {
      setMessage("No active subscription to cancel.");
      return;
    }
    setLoading("cancel");
    setMessage(null);
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "canceled", cancelAtPeriodEnd: true }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error?.error ?? "Unable to cancel subscription");
      }
      setMessage("Cancellation scheduled. Your access remains until the period ends.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setLoading(null);
    }
  }

  async function openBillingPortal() {
    setLoading("portal");
    setMessage(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error?.error ?? "Unable to open billing portal");
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage("Portal session missing URL. Try again.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 260 }}>
      <label className="stat-label" htmlFor="tier-select" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        Select plan
      </label>
      <select
        id="tier-select"
        value={tier}
        onChange={(e) => setTier(e.target.value as Tier)}
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)" }}
      >
        {tierOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className="btn-primary-gradient"
          onClick={startCheckout}
          disabled={loading === "upgrade"}
          style={{ minWidth: 140 }}
        >
          {loading === "upgrade" ? "Starting..." : "Upgrade / Downgrade"}
        </button>
        <button
          className="btn-ghost"
          onClick={cancelAtPeriodEnd}
          disabled={loading === "cancel"}
          style={{ minWidth: 140 }}
        >
          {loading === "cancel" ? "Submitting..." : "Cancel at period end"}
        </button>
        <button
          className="btn-outline"
          onClick={openBillingPortal}
          disabled={loading === "portal"}
          style={{ minWidth: 140 }}
        >
          {loading === "portal" ? "Opening..." : "Billing portal"}
        </button>
      </div>
      {message && (
        <p className="stat-context" style={{ margin: 0, color: "#9d174d" }}>
          {message}
        </p>
      )}
    </div>
  );
}
