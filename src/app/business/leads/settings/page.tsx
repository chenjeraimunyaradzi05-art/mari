"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Webhook } from "lucide-react";

export default function LeadSettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Mock save - in real app, save to Organization settings
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSaving(false);
    alert("Settings saved!");
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Lead Delivery Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" /> Webhook Configuration
          </CardTitle>
          <CardDescription>
            Automatically receive lead data to your CRM as soon as you purchase it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input 
                id="webhookUrl" 
                placeholder="https://api.your-crm.com/webhooks/leads" 
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                We will send a POST request with the lead JSON payload to this URL.
              </p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
              <h4 className="text-sm font-semibold mb-2">Example Payload</h4>
              <pre className="text-xs overflow-auto bg-white p-2 rounded border">
{`{
  "id": "lead_123",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "score": 85,
  "tier": "hot",
  "type": "job_seeker",
  "deliveredAt": "2025-12-13T10:00:00Z"
}`}
              </pre>
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Configuration
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
