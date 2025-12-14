"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart, Diamond, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface GiftButtonProps {
  creatorId: string;
  onGiftSent?: (type: string) => void;
}

export function GiftButton({ creatorId, onGiftSent }: GiftButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const sendGift = async (type: "heart" | "diamond" | "star") => {
    setLoading(type);
    try {
      const res = await fetch("/api/creator/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, giftType: type }),
      });

      if (res.ok) {
        toast({ title: "Gift Sent!", description: `You sent a ${type}!` });
        if (onGiftSent) onGiftSent(type);
      } else {
        toast({ title: "Error", description: "Failed to send gift", variant: "destructive" });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button 
        variant="secondary" 
        size="sm" 
        className="bg-pink-100 hover:bg-pink-200 text-pink-700"
        onClick={() => sendGift("heart")}
        disabled={!!loading}
      >
        <Heart className={`mr-1 h-4 w-4 ${loading === "heart" ? "animate-pulse" : ""}`} fill="currentColor" /> 
        $1
      </Button>
      <Button 
        variant="secondary" 
        size="sm" 
        className="bg-blue-100 hover:bg-blue-200 text-blue-700"
        onClick={() => sendGift("diamond")}
        disabled={!!loading}
      >
        <Diamond className={`mr-1 h-4 w-4 ${loading === "diamond" ? "animate-pulse" : ""}`} fill="currentColor" /> 
        $5
      </Button>
      <Button 
        variant="secondary" 
        size="sm" 
        className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700"
        onClick={() => sendGift("star")}
        disabled={!!loading}
      >
        <Star className={`mr-1 h-4 w-4 ${loading === "star" ? "animate-pulse" : ""}`} fill="currentColor" /> 
        $10
      </Button>
    </div>
  );
}
