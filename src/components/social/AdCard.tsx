import { useEffect, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface AdProps {
  ad: {
    id: string;
    headline: string;
    body: string;
    mediaUrl: string;
    cta: string;
    targetUrl: string;
    advertiser: {
      name: string;
      logo: string | null;
    };
  };
}

export function AdCard({ ad }: AdProps) {
  const hasRecordedImpression = useRef(false);

  useEffect(() => {
    if (!hasRecordedImpression.current) {
      fetch("/api/ads/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creativeId: ad.id, type: "IMPRESSION" }),
      }).catch(console.error);
      hasRecordedImpression.current = true;
    }
  }, [ad.id]);

  const handleClick = () => {
    fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creativeId: ad.id, type: "CLICK" }),
    }).catch(console.error);
  };

  return (
    <Card className="mb-6 border-2 border-blue-100 bg-blue-50/30">
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden">
          {ad.advertiser.logo ? (
            <img src={ad.advertiser.logo} alt={ad.advertiser.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white text-xs font-bold">
              {ad.advertiser.name.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{ad.advertiser.name}</span>
          <span className="text-xs text-muted-foreground">Sponsored</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{ad.body}</p>
        {ad.mediaUrl && (
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
             <img src={ad.mediaUrl} alt={ad.headline} className="h-full w-full object-cover" />
          </div>
        )}
        <h3 className="font-bold text-lg">{ad.headline}</h3>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="default" asChild onClick={handleClick}>
          <a href={ad.targetUrl} target="_blank" rel="noopener noreferrer">
            {ad.cta} <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
