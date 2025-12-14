"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, ShoppingBag } from "lucide-react";

interface ARAdViewerProps {
  adId: string;
  productImage: string;
  productName: string;
  ctaText: string;
  ctaUrl: string;
}

export function ARAdViewer({ adId, productImage, productName, ctaText, ctaUrl }: ARAdViewerProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      // Fallback or error handling
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card className="relative overflow-hidden w-full max-w-sm mx-auto aspect-[9/16] bg-black group">
      {/* Camera Feed / Placeholder */}
      {isCameraActive ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover transform scale-x-[-1]" 
        />
      ) : (
        <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="mb-4 relative w-32 h-32">
             {/* Mock Face */}
             <div className="w-32 h-32 rounded-full bg-gray-700 border-4 border-dashed border-gray-500 flex items-center justify-center">
                <span className="text-4xl">😐</span>
             </div>
          </div>
          <h3 className="text-xl font-bold mb-2">Try On {productName}</h3>
          <p className="text-sm text-gray-400 mb-6">See how it looks on you before you buy.</p>
          <Button onClick={startCamera} className="bg-white text-black hover:bg-gray-200">
            <Camera className="mr-2 h-4 w-4" /> Enable Camera
          </Button>
        </div>
      )}

      {/* AR Overlay (Mock) */}
      {isCameraActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
           {/* This simulates the product overlaying the face */}
           <img src={productImage} alt="AR Overlay" className="w-48 opacity-90 drop-shadow-2xl" />
        </div>
      )}

      {/* Controls */}
      {isCameraActive && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-4">
          <div className="flex justify-center gap-4">
             <Button size="icon" variant="secondary" className="rounded-full" onClick={() => { /* Cycle variants */ }}>
                <RefreshCw className="h-4 w-4" />
             </Button>
             <Button className="flex-1 rounded-full" asChild>
                <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
                   <ShoppingBag className="mr-2 h-4 w-4" /> {ctaText}
                </a>
             </Button>
          </div>
          <Button variant="ghost" size="sm" className="text-white/70" onClick={stopCamera}>
            Close Camera
          </Button>
        </div>
      )}
    </Card>
  );
}
