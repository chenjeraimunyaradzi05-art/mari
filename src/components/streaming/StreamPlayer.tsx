"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GiftButton } from "./GiftButton";
import { User, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface StreamPlayerProps {
  streamId: string;
  playbackUrl: string;
  title: string;
  creatorId: string;
  creatorName: string;
}

export function StreamPlayer({ streamId, playbackUrl, title, creatorId, creatorName }: StreamPlayerProps) {
  const [viewerCount, setViewerCount] = useState(120);
  const [messages, setMessages] = useState<{user: string, text: string}[]>([
    { user: "Alice", text: "Hello!" },
    { user: "Bob", text: "Great stream!" },
  ]);
  const [newMessage, setNewMessage] = useState("");

  // Mock viewer count update
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setMessages([...messages, { user: "You", text: newMessage }]);
    setNewMessage("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
      {/* Video Area */}
      <div className="lg:col-span-3 relative bg-black rounded-xl overflow-hidden flex items-center justify-center group">
        {/* Mock Video Player */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center text-white/20">
          <p>Live Stream Video Feed (Mock)</p>
        </div>
        
        {/* Overlays */}
        <div className="absolute top-4 left-4 flex gap-2">
          <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
          <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm">
            <User className="h-3 w-3 mr-1" /> {viewerCount}
          </Badge>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/90">
              <div className="h-8 w-8 rounded-full bg-gray-500" />
              <span className="font-medium">{creatorName}</span>
            </div>
            <GiftButton creatorId={creatorId} />
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="lg:col-span-1 flex flex-col h-full">
        <div className="p-3 border-b font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> Live Chat
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className="text-sm">
              <span className="font-bold text-gray-700">{msg.user}: </span>
              <span className="text-gray-600">{msg.text}</span>
            </div>
          ))}
        </div>
        <div className="p-3 border-t">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input 
              placeholder="Say something..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="sm" type="submit" className="h-8">Send</Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
