"use client";

import { QuizAd } from "./interactive/QuizAd";
import { CarouselAd } from "./interactive/CarouselAd";
import { LeadFormAd } from "./interactive/LeadFormAd";
import { ShoppableVideoAd } from "./interactive/ShoppableVideoAd";
import { ARAdViewer } from "./interactive/ARAdViewer";
import { ChoiceAdViewer } from "./interactive/ChoiceAdViewer";
import { AudioAdPlayer } from "./interactive/AudioAdPlayer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export interface AdData {
  id: string;
  format: "image" | "video" | "carousel" | "quiz" | "lead_form" | "shoppable_video" | "ar_try_on" | "interactive_choice" | "audio";
  title: string;
  description?: string;
  mediaUrl?: string;
  callToAction?: string;
  landingUrl?: string;
  interactiveData?: any; // JSON data for specific formats
  organizationId?: string;
}

interface AdRendererProps {
  ad: AdData;
  className?: string;
}

export function AdRenderer({ ad, className }: AdRendererProps) {
  // Interactive Formats
  if (ad.format === "quiz" && ad.interactiveData) {
    return (
      <QuizAd
        adId={ad.id}
        headline={ad.title}
        questions={ad.interactiveData.questions || []}
        ctaText={ad.callToAction || "See Results"}
        onComplete={(answers) => console.log("Quiz completed", answers)}
      />
    );
  }

  if (ad.format === "carousel" && ad.interactiveData) {
    return (
      <CarouselAd
        adId={ad.id}
        cards={ad.interactiveData.slides || []}
      />
    );
  }

  if (ad.format === "lead_form" && ad.interactiveData) {
    return (
      <LeadFormAd
        adId={ad.id}
        headline={ad.title}
        description={ad.description || ""}
        fields={ad.interactiveData.fields || []}
        privacyPolicyUrl={ad.interactiveData.privacyPolicyUrl || "#"}
      />
    );
  }

  if (ad.format === "shoppable_video" && ad.interactiveData) {
    return (
      <ShoppableVideoAd
        adId={ad.id}
        videoUrl={ad.mediaUrl || ""}
        products={ad.interactiveData.products || []}
      />
    );
  }

  if (ad.format === "ar_try_on" && ad.interactiveData) {
    return (
      <ARAdViewer
        adId={ad.id}
        productImage={ad.interactiveData.overlayImage || ad.mediaUrl || ""}
        productName={ad.title}
        ctaText={ad.callToAction || "Learn More"}
        ctaUrl={ad.landingUrl || "#"}
      />
    );
  }

  if (ad.format === "interactive_choice" && ad.interactiveData) {
    return (
      <ChoiceAdViewer
        adId={ad.id}
        initialNodeId={ad.interactiveData.initialNodeId}
        nodes={ad.interactiveData.nodes || {}}
      />
    );
  }

  if (ad.format === "audio") {
    return (
      <AudioAdPlayer
        adId={ad.id}
        audioUrl={ad.mediaUrl || ""}
        title={ad.title}
        artist={ad.interactiveData?.artist}
        coverImage={ad.interactiveData?.coverImage}
        ctaText={ad.callToAction}
        ctaUrl={ad.landingUrl}
      />
    );
  }

  // Standard Formats (Image/Video)
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="relative aspect-video bg-gray-100">
        {ad.format === "video" && ad.mediaUrl ? (
          <video
            src={ad.mediaUrl}
            controls
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="relative w-full h-full">
             {ad.mediaUrl ? (
                <Image 
                  src={ad.mediaUrl} 
                  alt={ad.title} 
                  fill 
                  className="object-cover"
                />
             ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No Media
                </div>
             )}
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="font-semibold text-lg leading-tight">{ad.title}</h3>
            {ad.description && (
              <p className="text-sm text-muted-foreground mt-1">{ad.description}</p>
            )}
          </div>
          {ad.callToAction && (
            <Button size="sm" className="shrink-0" asChild>
              <a href={ad.landingUrl} target="_blank" rel="noopener noreferrer">
                {ad.callToAction}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
