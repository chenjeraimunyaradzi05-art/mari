"use client";

import { useState } from "react";
import { AdRenderer, AdData } from "./AdRenderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";

interface AdBuilderProps {
  organizationId: string;
  campaignId?: string;
  onSave: (ad: Partial<AdData>) => Promise<void>;
}

export function AdBuilder({ organizationId, campaignId, onSave }: AdBuilderProps) {
  const [format, setFormat] = useState<AdData["format"]>("image");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [callToAction, setCallToAction] = useState("Learn More");
  const [landingUrl, setLandingUrl] = useState("");
  
  // Interactive Data States
  const [quizQuestions, setQuizQuestions] = useState<any[]>([
    { id: "q1", text: "Question 1?", options: ["Option A", "Option B"], correctAnswer: 0 }
  ]);
  const [carouselSlides, setCarouselSlides] = useState<any[]>([
    { id: "s1", title: "Slide 1", image: "", description: "Description 1" }
  ]);
  const [leadFields, setLeadFields] = useState<any[]>([
    { id: "name", label: "Full Name", type: "text" },
    { id: "email", label: "Email Address", type: "email" }
  ]);
  const [products, setProducts] = useState<any[]>([
    { id: "p1", name: "Product 1", price: 19.99 }
  ]);

  const [isSaving, setIsSaving] = useState(false);

  const getInteractiveData = () => {
    switch (format) {
      case "quiz": return { questions: quizQuestions };
      case "carousel": return { slides: carouselSlides };
      case "lead_form": return { fields: leadFields, privacyPolicyUrl: "#" };
      case "shoppable_video": return { products: products };
      default: return null;
    }
  };

  const previewAd: AdData = {
    id: "preview",
    format,
    title,
    description,
    mediaUrl,
    callToAction,
    landingUrl,
    interactiveData: getInteractiveData(),
    organizationId
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...previewAd,
        id: undefined, // Let backend generate ID
      });
    } catch (error) {
      console.error("Failed to save ad", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Editor Column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ad Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Single Image</SelectItem>
                  <SelectItem value="video">Single Video</SelectItem>
                  <SelectItem value="carousel">Carousel</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="lead_form">Lead Form</SelectItem>
                  <SelectItem value="shoppable_video">Shoppable Video</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ad Headline" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ad body text..." />
            </div>

            {(format === "image" || format === "video" || format === "shoppable_video") && (
              <div className="space-y-2">
                <Label>Media URL</Label>
                <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Call to Action</Label>
                <Select value={callToAction} onValueChange={setCallToAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Learn More">Learn More</SelectItem>
                    <SelectItem value="Shop Now">Shop Now</SelectItem>
                    <SelectItem value="Sign Up">Sign Up</SelectItem>
                    <SelectItem value="Apply Now">Apply Now</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destination URL</Label>
                <Input value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Format Specific Editors */}
        {format === "quiz" && (
          <Card>
            <CardHeader><CardTitle>Quiz Questions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quizQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <Label>Question {idx + 1}</Label>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const newQ = [...quizQuestions];
                        newQ.splice(idx, 1);
                        setQuizQuestions(newQ);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <Input value={q.text} onChange={(e) => {
                      const newQ = [...quizQuestions];
                      newQ[idx].text = e.target.value;
                      setQuizQuestions(newQ);
                    }} />
                    {/* Simplified options editor for demo */}
                    <div className="text-xs text-muted-foreground">Options: {q.options.join(", ")}</div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setQuizQuestions([...quizQuestions, { id: `q${Date.now()}`, text: "New Question?", options: ["Yes", "No"], correctAnswer: 0 }])}>
                  <Plus className="mr-2 h-4 w-4" /> Add Question
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {format === "carousel" && (
          <Card>
            <CardHeader><CardTitle>Carousel Slides</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {carouselSlides.map((s, idx) => (
                  <div key={s.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <Label>Slide {idx + 1}</Label>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const newS = [...carouselSlides];
                        newS.splice(idx, 1);
                        setCarouselSlides(newS);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <Input placeholder="Title" value={s.title} onChange={(e) => {
                      const newS = [...carouselSlides];
                      newS[idx].title = e.target.value;
                      setCarouselSlides(newS);
                    }} />
                    <Input placeholder="Image URL" value={s.image} onChange={(e) => {
                      const newS = [...carouselSlides];
                      newS[idx].image = e.target.value;
                      setCarouselSlides(newS);
                    }} />
                  </div>
                ))}
                <Button variant="outline" onClick={() => setCarouselSlides([...carouselSlides, { id: `s${Date.now()}`, title: "New Slide", image: "", description: "" }])}>
                  <Plus className="mr-2 h-4 w-4" /> Add Slide
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Button className="w-full" size="lg" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Creating Ad..." : "Create Ad"}
        </Button>
      </div>

      {/* Preview Column */}
      <div className="space-y-6">
        <div className="sticky top-6">
          <h3 className="text-lg font-semibold mb-4">Live Preview</h3>
          <div className="max-w-sm mx-auto border rounded-xl shadow-sm bg-white overflow-hidden">
             {/* Mobile Frame Simulation */}
             <div className="bg-gray-100 p-4 min-h-[600px] flex items-center justify-center">
                <AdRenderer ad={previewAd} className="w-full shadow-md bg-white" />
             </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            This is how your ad will appear in the mobile feed.
          </p>
        </div>
      </div>
    </div>
  );
}
