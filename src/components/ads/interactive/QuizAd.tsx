"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronRight, CheckCircle2 } from "lucide-react";

interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
}

interface QuizAdProps {
  adId: string;
  headline: string;
  questions: QuizQuestion[];
  ctaText: string;
  onComplete: (answers: Record<string, string>) => void;
}

export function QuizAd({ adId, headline, questions, ctaText, onComplete }: QuizAdProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [questions[currentStep].id]: value });
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
      // Track progress
      fetch("/api/ads/track/interactive", {
        method: "POST",
        body: JSON.stringify({ adId, type: "quiz_step", step: currentStep + 1 }),
      }).catch(console.error);
    } else {
      setCompleted(true);
      onComplete(answers);
      // Track completion
      fetch("/api/ads/track/interactive", {
        method: "POST",
        body: JSON.stringify({ adId, type: "quiz_complete", payload: answers }),
      }).catch(console.error);
    }
  };

  if (completed) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-blue-900">Great job!</h3>
          <p className="text-blue-700">We've found the perfect match for you based on your answers.</p>
          <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
            {ctaText}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const question = questions[currentStep];

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
            Question {currentStep + 1} of {questions.length}
          </span>
        </div>
        <h3 className="text-lg font-bold">{headline}</h3>
        <p className="text-md font-medium mt-2">{question.text}</p>
      </CardHeader>
      <CardContent>
        <RadioGroup onValueChange={handleAnswer} value={answers[question.id]} className="space-y-3">
          {question.options.map((option) => (
            <div key={option.id} className={`flex items-center space-x-2 border p-3 rounded-lg transition-colors ${answers[question.id] === option.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <RadioGroupItem value={option.id} id={option.id} />
              <Label htmlFor={option.id} className="flex-1 cursor-pointer">{option.text}</Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={handleNext} 
          disabled={!answers[question.id]}
        >
          {currentStep === questions.length - 1 ? "See Results" : "Next"} <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
