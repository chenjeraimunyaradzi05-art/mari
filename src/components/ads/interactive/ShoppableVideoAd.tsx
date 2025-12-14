"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Heart, Share2, Volume2, VolumeX, Play, Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
}

interface ShoppableVideoAdProps {
  adId: string;
  videoUrl: string;
  products: Product[];
}

export function ShoppableVideoAd({ adId, videoUrl, products }: ShoppableVideoAdProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showProducts, setShowProducts] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleProductClick = async (productId: string) => {
    try {
      await fetch("/api/ads/track/interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adId, 
          type: "product_click", 
          payload: { productId } 
        }),
      });
      // In a real app, this would open a product modal or add to cart
      console.log("Product clicked:", productId);
    } catch (error) {
      console.error("Tracking error:", error);
    }
  };

  return (
    <Card className="relative overflow-hidden w-full max-w-sm mx-auto aspect-[9/16] bg-black group">
      {/* Video Player */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={isMuted}
        onClick={togglePlay}
      />

      {/* Controls Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

      {/* Play/Pause Indicator (Center) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 p-4 rounded-full backdrop-blur-sm">
            <Play className="h-8 w-8 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-20 flex flex-col gap-4 items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm" onClick={() => setShowProducts(!showProducts)}>
          <ShoppingBag className="h-6 w-6" />
        </Button>
        <Button size="icon" variant="ghost" className="rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm">
          <Heart className="h-6 w-6" />
        </Button>
        <Button size="icon" variant="ghost" className="rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm">
          <Share2 className="h-6 w-6" />
        </Button>
      </div>

      {/* Mute Toggle */}
      <Button 
        size="icon" 
        variant="ghost" 
        className="absolute top-4 right-4 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm"
        onClick={toggleMute}
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </Button>

      {/* Product Drawer / Overlay */}
      {showProducts && (
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-4 rounded-t-xl transition-transform duration-300 ease-in-out animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Shop Products</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowProducts(false)}>Close</Button>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer" onClick={() => handleProductClick(product.id)}>
                <div className="h-12 w-12 bg-gray-200 rounded-md flex-shrink-0" /> {/* Placeholder for image */}
                <div className="flex-1">
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">${product.price.toFixed(2)}</p>
                </div>
                <Button size="sm" variant="secondary">View</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
