"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Video, StopCircle, Copy } from "lucide-react";
import Link from "next/link";

export function StreamManager() {
  const { toast } = useToast();
  const [isLive, setIsLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamData, setStreamData] = useState<{id: string, streamKey: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const startStream = async () => {
    if (!streamTitle) {
      toast({ title: "Error", description: "Please enter a stream title", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/creator/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: streamTitle }),
      });
      const data = await res.json();
      if (data.stream) {
        setStreamData(data.stream);
        setIsLive(true);
        toast({ title: "Stream Created", description: "You are ready to go live!" });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const endStream = async () => {
    if (!streamData) return;
    setLoading(true);
    try {
      await fetch("/api/creator/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", streamId: streamData.id }),
      });
      setIsLive(false);
      setStreamData(null);
      setStreamTitle("");
      toast({ title: "Stream Ended", description: "Your stream has ended." });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Stream Manager
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isLive ? (
          <div className="flex gap-4">
            <Input 
              placeholder="Enter stream title..." 
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              className="max-w-md"
            />
            <Button onClick={startStream} disabled={loading}>
              {loading ? "Starting..." : "Start Stream"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-md flex items-center justify-between">
              <div>
                <h3 className="font-bold text-green-800">You are Live!</h3>
                <p className="text-sm text-green-700">Stream ID: {streamData?.id}</p>
              </div>
              <Button variant="destructive" onClick={endStream} disabled={loading}>
                <StopCircle className="mr-2 h-4 w-4" /> End Stream
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-100 rounded-md">
                <label className="text-xs font-semibold text-slate-500 uppercase">Stream Key</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white px-2 py-1 rounded border flex-1 overflow-hidden text-ellipsis">
                    {streamData?.streamKey}
                  </code>
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Paste this into OBS or your streaming software.</p>
              </div>
              
              <div className="p-4 bg-slate-100 rounded-md">
                <label className="text-xs font-semibold text-slate-500 uppercase">Public URL</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white px-2 py-1 rounded border flex-1 overflow-hidden text-ellipsis">
                    {`${window.location.origin}/live/${streamData?.id}`}
                  </code>
                  <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                    <Link href={`/live/${streamData?.id}`} target="_blank">
                      <Copy className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Share this link with your audience.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
