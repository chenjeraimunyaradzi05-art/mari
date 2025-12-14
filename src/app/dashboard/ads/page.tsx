"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CampaignSummary = {
  id: string;
  name: string;
  objective: string;
  status: string;
  budgetCents: number;
  spend: number;
  dailyBudgetCents?: number;
};

type CreativeSummary = {
  id: string;
  title?: string;
  format?: string;
  landingUrl?: string;
  mediaUrl?: string;
  callToAction?: string;
};

const objectives = [
  { value: "reach", label: "Reach" },
  { value: "traffic", label: "Traffic" },
  { value: "leads", label: "Leads" },
  { value: "applications", label: "Applications" },
];

function cents(value: number | string) {
  const num = Number(value || 0);
  return Math.max(0, Math.round(num * 100));
}

export default function AdsDashboardPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [creatives, setCreatives] = useState<CreativeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingCreative, setCreatingCreative] = useState(false);

  const activeCampaign = useMemo(() => campaigns.find((c) => c.id === selectedCampaign), [campaigns, selectedCampaign]);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await fetch('/api/me/organization');
        if (res.ok) {
          const data = await res.json();
          if (data.organizationId) {
            setOrganizationId(data.organizationId);
          } else {
            // Create default org if none exists (for MVP convenience)
            const createRes = await fetch('/api/me/organization', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'My Ad Agency' }),
            });
            if (createRes.ok) {
              const createData = await createRes.json();
              setOrganizationId(createData.organizationId);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrg();
  }, []);

  useEffect(() => {
    if (organizationId) {
      fetchCampaigns();
    }
  }, [organizationId]);

  useEffect(() => {
    if (!selectedCampaign) return;
    const fetchCreatives = async () => {
      try {
        const res = await fetch(`/api/creatives?campaignId=${selectedCampaign}`);
        if (!res.ok) throw new Error("Unable to load creatives");
        const data = await res.json();
        setCreatives(data.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCreatives();
  }, [selectedCampaign]);

  const fetchCampaigns = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns?organizationId=${encodeURIComponent(organizationId)}`);
      if (!res.ok) throw new Error("Unable to load campaigns");
      const data = await res.json();
      setCampaigns(data.data || []);
      if (!selectedCampaign && data.data?.length) setSelectedCampaign(data.data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (formData: FormData) => {
    setCreating(true);
    setError(null);
    try {
      const payload = {
        organizationId,
        name: formData.get("name") as string,
        objective: formData.get("objective") as string,
        budgetCents: cents(formData.get("budget") as string),
        dailyBudgetCents: formData.get("dailyBudget") ? cents(formData.get("dailyBudget") as string) : undefined,
        startDate: formData.get("startDate"),
        endDate: formData.get("endDate"),
      };
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchCampaigns();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    setSelectedCampaign((prev) => (prev === id ? null : prev));
    await fetchCampaigns();
  };

  const handleCreateCreative = async (formData: FormData) => {
    if (!selectedCampaign || !organizationId) return;
    setCreatingCreative(true);
    setError(null);
    try {
      const payload = {
        campaignId: selectedCampaign,
        organizationId,
        title: formData.get("title"),
        description: formData.get("description"),
        mediaUrl: formData.get("mediaUrl") || undefined,
        mediaType: formData.get("mediaType"),
        callToAction: formData.get("cta"),
        landingUrl: formData.get("landingUrl"),
        format: formData.get("format"),
      };
      const res = await fetch("/api/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Creative create failed");
      const data = await res.json();
      setCreatives((prev) => [data, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreatingCreative(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f172a 0%, #111827 45%, #0b1221 100%)", color: "#e2e8f0" }}>
      <header className="border-b border-white/10 sticky top-0 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-indigo-200 hover:text-white">Dashboard</Link>
            <span className="text-slate-500">/</span>
            <span className="font-semibold text-white">Advertiser</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder="Organization ID"
              className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <button
              onClick={fetchCampaigns}
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-400"
              disabled={!organizationId || loading}
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-8">
        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-white/5 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Campaigns</h2>
              <span className="text-xs text-slate-400">Pacing + budgets enforced</span>
            </div>
            {campaigns.length === 0 && !loading && (
              <p className="text-slate-400 text-sm">No campaigns loaded.</p>
            )}
            <div className="grid gap-3">
              {campaigns.map((c) => (
                <div key={c.id} className={`rounded-xl border ${selectedCampaign === c.id ? "border-indigo-400/60" : "border-white/5"} bg-black/20 px-4 py-3 flex items-center justify-between`}> 
                  <div className="flex flex-col">
                    <button className="text-left text-base font-semibold text-white" onClick={() => setSelectedCampaign(c.id)}>
                      {c.name}
                    </button>
                    <p className="text-xs text-slate-400">{c.objective} · Status: {c.status}</p>
                    <p className="text-xs text-slate-500">Budget ${(Number(c.budgetCents) / 100).toFixed(2)} · Spend ${(Number(c.spend) / 100).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateStatus(c.id, c.status === "active" ? "paused" : "active")}
                      className="rounded-md border border-white/10 px-3 py-1 text-xs text-white hover:border-indigo-400"
                    >
                      {c.status === "active" ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="rounded-md border border-white/10 px-3 py-1 text-xs text-rose-200 hover:border-rose-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/5 shadow-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Create Campaign</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                handleCreateCampaign(fd);
              }}
              className="grid gap-3"
            >
              <input name="name" required placeholder="Campaign name" className="input" />
              <select name="objective" className="input" defaultValue="reach">
                {objectives.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input name="budget" required type="number" step="0.01" placeholder="Total budget ($)" className="input" />
                <input name="dailyBudget" type="number" step="0.01" placeholder="Daily cap ($)" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-slate-800">
                <input name="startDate" required type="date" className="input" />
                <input name="endDate" required type="date" className="input" />
              </div>
              <button
                type="submit"
                disabled={creating || !organizationId}
                className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-400 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </form>
          </div>
        </section>

        {activeCampaign && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-white/5 shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Creatives for {activeCampaign.name}</h3>
                <span className="text-xs text-slate-400">{creatives.length} items</span>
              </div>
              {creatives.length === 0 && <p className="text-slate-400 text-sm">No creatives yet.</p>}
              <div className="grid gap-3">
                {creatives.map((cr) => (
                  <div key={cr.id} className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                    <p className="text-white font-semibold">{cr.title}</p>
                    <p className="text-xs text-slate-400">{cr.callToAction} → {cr.landingUrl}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 shadow-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Add Creative</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  handleCreateCreative(fd);
                }}
                className="grid gap-3"
              >
                <input name="title" required placeholder="Title" className="input" />
                <input name="description" placeholder="Description" className="input" />
                <input name="mediaUrl" placeholder="Media URL" className="input" />
                <div className="grid grid-cols-2 gap-3">
                  <select name="mediaType" className="input" defaultValue="image">
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="carousel">Carousel</option>
                  </select>
                  <select name="format" className="input" defaultValue="image">
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="carousel">Carousel</option>
                    <option value="collection">Collection</option>
                  </select>
                </div>
                <input name="cta" required placeholder="CTA text" className="input" />
                <input name="landingUrl" required placeholder="Landing URL" className="input" />
                <button
                  type="submit"
                  disabled={!selectedCampaign || creatingCreative}
                  className="rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-400 disabled:opacity-50"
                >
                  {creatingCreative ? "Saving..." : "Create creative"}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #e2e8f0;
          padding: 10px 12px;
          font-size: 0.9rem;
        }
        .input:focus { outline: 2px solid rgba(129,140,248,0.6); }
      `}</style>
    </div>
  );
}
