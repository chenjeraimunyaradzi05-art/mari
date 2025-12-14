"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

interface LeadFormAdProps {
  adId: string;
  headline: string;
  description: string;
  fields: { id: string; label: string; type: string }[];
  privacyPolicyUrl: string;
}

export function LeadFormAd({ adId, headline, description, fields, privacyPolicyUrl }: LeadFormAdProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/ads/track/interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adId, 
          type: "lead_form_submit", 
          payload: formData 
        }),
      });

      if (res.ok) {
        setIsSuccess(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
          <h3 className="text-xl font-bold text-green-900">Thank You!</h3>
          <p className="text-green-700">Your information has been sent. We'll be in touch shortly.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader>
        <CardTitle>{headline}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input 
                id={field.id} 
                type={field.type} 
                required 
                value={formData[field.id] || ""} 
                onChange={handleChange}
              />
            </div>
          ))}
          
          <p className="text-xs text-gray-500">
            By submitting, you agree to our <a href={privacyPolicyUrl} target="_blank" className="underline">Privacy Policy</a>.
          </p>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
