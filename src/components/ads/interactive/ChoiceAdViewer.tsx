"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, RefreshCcw } from "lucide-react";

interface Choice {
  id: string;
  text: string;
  nextNodeId?: string;
  url?: string;
}

interface StoryNode {
  id: string;
  title: string;
  description: string;
  image?: string;
  choices: Choice[];
}

interface ChoiceAdViewerProps {
  adId: string;
  initialNodeId: string;
  nodes: Record<string, StoryNode>;
}

export function ChoiceAdViewer({ adId, initialNodeId, nodes }: ChoiceAdViewerProps) {
  const [currentNodeId, setCurrentNodeId] = useState(initialNodeId);
  const [history, setHistory] = useState<string[]>([]);

  const currentNode = nodes[currentNodeId];

  const handleChoice = async (choice: Choice) => {
    // Track choice
    try {
      await fetch("/api/ads/track/interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adId, 
          type: "choice_selected", 
          payload: { choiceId: choice.id, nodeId: currentNodeId } 
        }),
      });
    } catch (e) {
      console.error(e);
    }

    if (choice.url) {
      window.open(choice.url, "_blank");
    } else if (choice.nextNodeId && nodes[choice.nextNodeId]) {
      setHistory([...history, currentNodeId]);
      setCurrentNodeId(choice.nextNodeId);
    }
  };

  const handleReset = () => {
    setCurrentNodeId(initialNodeId);
    setHistory([]);
  };

  if (!currentNode) {
    return <div className="p-4 text-center text-red-500">Error: Node not found</div>;
  }

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden border-2 border-purple-100">
      {currentNode.image && (
        <div className="relative h-48 w-full bg-gray-100">
          <img src={currentNode.image} alt={currentNode.title} className="w-full h-full object-cover" />
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl">{currentNode.title}</CardTitle>
        <p className="text-muted-foreground">{currentNode.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentNode.choices.map((choice) => (
          <Button 
            key={choice.id} 
            variant="outline" 
            className="w-full justify-between h-auto py-3 text-left whitespace-normal"
            onClick={() => handleChoice(choice)}
          >
            <span>{choice.text}</span>
            <ArrowRight className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
          </Button>
        ))}

        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="w-full mt-4 text-muted-foreground">
            <RefreshCcw className="h-3 w-3 mr-2" /> Restart
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
