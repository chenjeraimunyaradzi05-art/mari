"use client";

import { AdBuilder } from "@/components/ads/AdBuilder";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

export default function CreateAdPage() {
  const router = useRouter();
  const { toast } = useToast();

  // In a real app, we'd fetch the organization ID from the session or context
  // For now, we'll rely on the API to handle the user's organization
  const organizationId = "current-user-org"; 

  const handleSave = async (adData: any) => {
    try {
      const res = await fetch("/api/ads/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adData),
      });

      if (!res.ok) throw new Error("Failed to create ad");

      toast({
        title: "Success",
        description: "Ad creative created successfully.",
      });

      router.push("/dashboard/ads");
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Ad</h1>
        <p className="text-muted-foreground">Design interactive ads to engage your audience.</p>
      </div>
      
      <AdBuilder 
        organizationId={organizationId} 
        onSave={handleSave} 
      />
    </div>
  );
}
