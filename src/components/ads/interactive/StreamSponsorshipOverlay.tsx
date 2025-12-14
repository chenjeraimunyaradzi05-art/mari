"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Sponsorship {
  id: string;
  imageUrl: string;
  title: string;
  ctaUrl: string;
  position: "top-right" | "bottom-right" | "bottom-left" | "top-left";
  duration: number; // seconds
}

interface StreamSponsorshipOverlayProps {
  streamId: string;
  className?: string;
}

export function StreamSponsorshipOverlay({ streamId, className }: StreamSponsorshipOverlayProps) {
  const [activeSponsorship, setActiveSponsorship] = useState<Sponsorship | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // In a real implementation, this would listen to a WebSocket or polling endpoint
    // for real-time ad triggers from the streamer or ad server.
    const checkForAds = () => {
      // Mock logic: 20% chance to trigger an ad every 10s if none is showing
      if (!isVisible && Math.random() > 0.8) {
        setActiveSponsorship({
          id: `sponsor-${Date.now()}`,
          imageUrl: "https://placehold.co/300x100/png?text=Sponsor+Logo",
          title: "Official Partner",
          ctaUrl: "https://example.com",
          position: "top-right",
          duration: 15,
        });
        setIsVisible(true);
      }
    };

    const interval = setInterval(checkForAds, 10000);
    return () => clearInterval(interval);
  }, [streamId, isVisible]);

  useEffect(() => {
    if (isVisible && activeSponsorship) {
      // Track impression
      fetch("/api/ads/track/interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: activeSponsorship.id, type: "sponsorship_impression" }),
      }).catch(console.error);

      const timer = setTimeout(() => {
        setIsVisible(false);
      }, activeSponsorship.duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, activeSponsorship]);

  if (!activeSponsorship || !isVisible) return null;

  const positionClasses = {
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-24 right-4", // Higher to avoid player controls
    "bottom-left": "bottom-24 left-4",
    "top-left": "top-4 left-4",
  };

  return (
    <div className={`absolute ${positionClasses[activeSponsorship.position]} z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 ${className}`}>
      <Card className="relative overflow-hidden bg-black/60 backdrop-blur-md border-white/10 shadow-2xl max-w-[280px]">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 text-white/70 hover:text-white hover:bg-white/20 z-10"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-3 w-3" />
        </Button>

        <a 
          href={activeSponsorship.ctaUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block p-3"
          onClick={() => {
            fetch("/api/ads/track/interactive", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ adId: activeSponsorship.id, type: "sponsorship_click" }),
            }).catch(console.error);
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              {activeSponsorship.title}
            </span>
            <ExternalLink className="h-3 w-3 text-white/50" />
          </div>
          
          <div className="rounded-md overflow-hidden bg-white/5">
            <img 
              src={activeSponsorship.imageUrl} 
              alt="Sponsor" 
              className="w-full h-auto object-contain"
            />
          </div>
        </a>
      </Card>
    </div>
  );
}
