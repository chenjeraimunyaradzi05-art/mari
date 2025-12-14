"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingCart, Check, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Lead {
  id: string;
  type: string;
  tier: "hot" | "warm" | "cold";
  score: number;
  priceCents: number;
  createdAt: string;
  // Masked data
  email: string;
  phone: string;
  lastName?: string;
}

export default function LeadMarketplacePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("ALL");
  const [filterTier, setFilterTier] = useState("ALL");

  useEffect(() => {
    fetchLeads();
  }, [filterType, filterTier]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.append("type", filterType);
      if (filterTier !== "ALL") params.append("tier", filterTier);

      const res = await fetch(`/api/leads/marketplace?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
      }
    } catch (error) {
      console.error("Failed to fetch leads", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (lead: Lead) => {
    if (!confirm(`Purchase this ${lead.tier} lead for $${(lead.priceCents / 100).toFixed(2)}?`)) return;
    
    setPurchasing(lead.id);
    try {
      // In a real app, we'd get the billingAccountId from context or selection
      // For MVP, the API infers it from the user's organization
      const res = await fetch("/api/leads/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          leadId: lead.id,
          billingAccountId: "default" // Placeholder, API handles logic
        }),
      });

      if (res.ok) {
        alert("Lead purchased successfully! View details in your dashboard.");
        // Remove from list
        setLeads(leads.filter(l => l.id !== lead.id));
      } else {
        const err = await res.json();
        alert(err.error || "Purchase failed");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred");
    } finally {
      setPurchasing(null);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "hot": return "bg-red-100 text-red-800 border-red-200";
      case "warm": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Lead Marketplace</h1>
          <p className="text-muted-foreground">Acquire high-intent leads for your business.</p>
        </div>
        
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Lead Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="job">Job Seeker</SelectItem>
              <SelectItem value="course">Course Interest</SelectItem>
              <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Quality Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Tiers</SelectItem>
              <SelectItem value="hot">Hot (High Intent)</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
      ) : leads.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <p className="text-slate-500">No leads available matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leads.map((lead) => (
            <Card key={lead.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className={getTierColor(lead.tier)}>
                    {lead.tier.toUpperCase()}
                  </Badge>
                  <span className="font-bold text-lg text-green-700">
                    ${(lead.priceCents / 100).toFixed(2)}
                  </span>
                </div>
                <CardTitle className="text-lg mt-2 capitalize">
                  {lead.type} Lead
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Score:</span>
                  <span className="font-medium">{lead.score}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Generated:</span>
                  <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="pt-2 border-t mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <p className="font-mono text-xs bg-slate-100 p-1 rounded">{lead.email}</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleBuy(lead)}
                  disabled={purchasing === lead.id}
                >
                  {purchasing === lead.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-4 w-4" />
                  )}
                  {purchasing === lead.id ? "Buying..." : "Buy Now"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
