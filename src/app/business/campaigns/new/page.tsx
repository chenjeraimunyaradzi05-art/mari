"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdCard } from "@/components/social/AdCard";
import { Users, Target, Eye } from "lucide-react";

export default function NewCampaignPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audienceSize, setAudienceSize] = useState(15000); // Mock initial size
  
  const [formData, setFormData] = useState({
    campaignName: "",
    objective: "AWARENESS",
    dailyBudget: "10",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    headline: "",
    bodyText: "",
    mediaUrl: "",
    targetUrl: "",
    targetRole: "ALL",
    targetInterests: ""
  });

  // Mock Audience Size Calculation
  useEffect(() => {
    let size = 15000;
    if (formData.targetRole !== "ALL") size = Math.floor(size * 0.4);
    if (formData.targetInterests.length > 0) size = Math.floor(size * 0.8);
    setAudienceSize(size);
  }, [formData.targetRole, formData.targetInterests]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSelectChange = (value: string) => {
    setFormData({ ...formData, objective: value });
  };

  const handleRoleChange = (value: string) => {
    setFormData({ ...formData, targetRole: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/ads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          dailyBudget: parseFloat(formData.dailyBudget),
          targeting: {
            role: formData.targetRole === "ALL" ? null : formData.targetRole,
            interests: formData.targetInterests ? formData.targetInterests.split(",").map(s => s.trim()) : []
          }
        }),
      });

      if (res.ok) {
        router.push("/business");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create campaign");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock Ad Object for Preview
  const previewAd = {
    id: "preview",
    headline: formData.headline || "Your Headline Here",
    body: formData.bodyText || "Your ad body text will appear here. Make it compelling!",
    mediaUrl: formData.mediaUrl || "",
    cta: "Learn More",
    targetUrl: formData.targetUrl || "#",
    advertiser: {
      name: "Your Company",
      logo: null,
    }
  };

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Form */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle>Create New Ad Campaign</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5" /> Campaign Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="campaignName">Campaign Name</Label>
                      <Input id="campaignName" value={formData.campaignName} onChange={handleChange} required placeholder="e.g. Summer Sale 2025" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="objective">Objective</Label>
                      <Select onValueChange={handleSelectChange} defaultValue={formData.objective}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select objective" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AWARENESS">Brand Awareness</SelectItem>
                          <SelectItem value="TRAFFIC">Website Traffic</SelectItem>
                          <SelectItem value="CONVERSIONS">Conversions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dailyBudget">Daily Budget ($)</Label>
                      <Input id="dailyBudget" type="number" min="1" step="0.01" value={formData.dailyBudget} onChange={handleChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input id="startDate" type="date" value={formData.startDate} onChange={handleChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input id="endDate" type="date" value={formData.endDate} onChange={handleChange} required />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" /> Targeting
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">Estimated Audience Size</span>
                      <span className="text-lg font-bold text-blue-600">{audienceSize.toLocaleString()} Users</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetRole">Target Audience Role</Label>
                      <Select onValueChange={handleRoleChange} defaultValue={formData.targetRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Users</SelectItem>
                          <SelectItem value="MEMBER">Members (Job Seekers)</SelectItem>
                          <SelectItem value="COMPANY">Companies</SelectItem>
                          <SelectItem value="MENTOR">Mentors</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetInterests">Interests (comma separated)</Label>
                      <Input id="targetInterests" value={formData.targetInterests} onChange={handleChange} placeholder="e.g. Tech, Finance, Design" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Eye className="h-5 w-5" /> Ad Creative
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="headline">Headline</Label>
                    <Input id="headline" value={formData.headline} onChange={handleChange} required placeholder="Catchy headline for your ad" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bodyText">Body Text</Label>
                    <Textarea id="bodyText" value={formData.bodyText} onChange={handleChange} placeholder="Describe your offer..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mediaUrl">Image/Video URL</Label>
                    <Input id="mediaUrl" value={formData.mediaUrl} onChange={handleChange} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetUrl">Destination URL</Label>
                    <Input id="targetUrl" value={formData.targetUrl} onChange={handleChange} required placeholder="https://yourwebsite.com" />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Launching..." : "Launch Campaign"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview */}
        <div className="w-full lg:w-1/3 space-y-6">
          <div className="sticky top-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Ad Preview</h3>
            <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 min-h-[200px] flex flex-col items-center justify-center">
              <div className="w-full max-w-sm pointer-events-none select-none transform scale-95">
                <AdCard ad={previewAd} />
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                This is how your ad will appear in the feed.
              </p>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">Campaign Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Daily Budget:</span>
                  <span className="font-medium">${parseFloat(formData.dailyBudget).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-medium">7 Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Targeting:</span>
                  <span className="font-medium">{formData.targetRole === "ALL" ? "Everyone" : formData.targetRole}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
