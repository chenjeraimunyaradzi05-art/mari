"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, ExternalLink } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface AudioAdPlayerProps {
  adId: string;
  audioUrl: string;
  title: string;
  artist?: string;
  coverImage?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function AudioAdPlayer({ adId, audioUrl, title, artist, coverImage, ctaText, ctaUrl }: AudioAdPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress(audio.currentTime);
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      // Track completion
      fetch("/api/ads/track/interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId, type: "audio_complete" }),
      }).catch(console.error);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [adId]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
        // Track start
        if (progress === 0) {
           fetch("/api/ads/track/interactive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adId, type: "audio_start" }),
          }).catch(console.error);
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none shadow-xl">
      <audio ref={audioRef} src={audioUrl} />
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-20 w-20 rounded-md bg-gray-700 overflow-hidden flex-shrink-0">
            {coverImage ? (
              <img src={coverImage} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{title}</h3>
            <p className="text-gray-400 text-sm truncate">{artist || "Sponsored Audio"}</p>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <Slider 
            value={[progress]} 
            max={duration || 100} 
            step={1} 
            onValueChange={(val) => {
              if (audioRef.current) {
                audioRef.current.currentTime = val[0];
                setProgress(val[0]);
              }
            }}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="text-gray-400 hover:text-white">
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>

          <Button 
            size="icon" 
            className="h-14 w-14 rounded-full bg-white text-black hover:bg-gray-200"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-1" />}
          </Button>

          {ctaUrl ? (
            <Button variant="ghost" size="icon" asChild className="text-gray-400 hover:text-white">
              <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-5 w-5" />
              </a>
            </Button>
          ) : (
            <div className="w-10" /> // Spacer
          )}
        </div>

        {ctaText && ctaUrl && (
          <Button className="w-full mt-6 bg-white/10 hover:bg-white/20 text-white border-0" asChild>
            <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
              {ctaText}
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
