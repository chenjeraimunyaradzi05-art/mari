"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselCard {
  id: string;
  image: string;
  title: string;
  description: string;
  ctaUrl: string;
}

interface CarouselAdProps {
  adId: string;
  cards: CarouselCard[];
}

export function CarouselAd({ adId, cards }: CarouselAdProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      trackSwipe(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      trackSwipe(currentIndex - 1);
    }
  };

  const trackSwipe = (index: number) => {
    fetch("/api/ads/track/interactive", {
      method: "POST",
      body: JSON.stringify({ adId, type: "carousel_swipe", cardIndex: index }),
    }).catch(console.error);
  };

  const currentCard = cards[currentIndex];

  return (
    <div className="relative w-full max-w-md mx-auto">
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="relative aspect-[4/5] bg-gray-100">
          <img 
            src={currentCard.image} 
            alt={currentCard.title} 
            className="w-full h-full object-cover"
          />
          
          {/* Navigation Overlays */}
          {currentIndex > 0 && (
            <button 
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          
          {currentIndex < cards.length - 1 && (
            <button 
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Progress Indicators */}
          <div className="absolute top-4 left-0 right-0 flex justify-center gap-1 px-4">
            {cards.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1 flex-1 rounded-full transition-colors ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>

        <CardContent className="p-4 bg-white">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="font-bold text-lg">{currentCard.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{currentCard.description}</p>
            </div>
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => window.open(currentCard.ctaUrl, '_blank')}
            >
              Learn More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
