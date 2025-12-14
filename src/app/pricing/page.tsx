"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "Essential tools for job seekers.",
    features: ["Basic Profile", "Job Search", "Limited Applications (5/mo)"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$19",
    description: "Stand out and get hired faster.",
    features: ["Verified Badge", "Unlimited Applications", "Priority Support", "See Who Viewed Profile"],
    popular: true,
  },
  {
    id: "premium_plus",
    name: "Premium+",
    price: "$49",
    description: "Maximum visibility and AI tools.",
    features: ["All Premium Features", "AI Resume Review", "Featured Profile", "Direct Messaging to Recruiters"],
  },
  {
    id: "creator",
    name: "Creator",
    price: "$29",
    description: "Monetize your content and skills.",
    features: ["Live Streaming", "Monetization Tools", "Audience Analytics", "Custom Branding"],
  },
];

export default function PricingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (tier: string) => {
    setLoading(tier);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();

      if (data.url) {
        // Redirect to checkout (or success page in mock mode)
        router.push(data.url);
      } else if (data.success) {
         // Direct success (MVP mode)
         toast({
            title: "Subscription Updated",
            description: `You are now subscribed to ${tier}.`,
         });
         router.refresh();
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start subscription.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground">Unlock the full potential of your career.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={`flex flex-col ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-3xl font-bold mb-6">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant={plan.popular ? "default" : "outline"}
                onClick={() => handleSubscribe(plan.id)}
                disabled={!!loading}
              >
                {loading === plan.id ? "Processing..." : "Subscribe"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
