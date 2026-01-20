'use client';

/**
 * Skills Assessment UI
 * Phase 4: Web Client - Persona Studios
 * Step 71: Adaptive quiz for skills verification
 * 
 * Features:
 * - Skill selection
 * - Adaptive question flow
 * - Timer and progress
 * - Results and recommendations
 * - Badge earning
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
  Award,
  Target,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Share2,
  Download,
  BookOpen,
  TrendingUp,
  Zap,
  Shield,
  Star,
  Play,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// ============================================
// TYPES
// ============================================

type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type AssessmentState = 'intro' | 'in-progress' | 'review' | 'results';

interface Question {
  id: string;
  text: string;
  code?: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  difficulty: Difficulty;
  explanation?: string;
  topic: string;
}

interface AssessmentResult {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  level: Difficulty;
  timeTaken: number;
  topicScores: { topic: string; score: number }[];
  badgeEarned?: { name: string; level: Difficulty };
  recommendations: string[];
}

interface Skill {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  estimatedTime: number;
  questions: number;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_SKILLS: Skill[] = [
  {
    id: 'js',
    name: 'JavaScript',
    category: 'Programming',
    icon: '🟨',
    description: 'Test your knowledge of JavaScript fundamentals, ES6+, and best practices',
    estimatedTime: 15,
    questions: 20,
  },
  {
    id: 'react',
    name: 'React',
    category: 'Frameworks',
    icon: '⚛️',
    description: 'Assess your React expertise including hooks, state management, and patterns',
    estimatedTime: 20,
    questions: 25,
  },
  {
    id: 'python',
    name: 'Python',
    category: 'Programming',
    icon: '🐍',
    description: 'Evaluate your Python skills from basics to advanced concepts',
    estimatedTime: 15,
    questions: 20,
  },
  {
    id: 'sql',
    name: 'SQL',
    category: 'Data',
    icon: '🗃️',
    description: 'Test your database querying skills and optimization knowledge',
    estimatedTime: 12,
    questions: 15,
  },
];

const MOCK_QUESTIONS: Question[] = [
  {
    id: '1',
    text: 'What is the output of console.log(typeof null) in JavaScript?',
    options: [
      { id: 'a', text: '"null"' },
      { id: 'b', text: '"object"' },
      { id: 'c', text: '"undefined"' },
      { id: 'd', text: '"number"' },
    ],
    correctAnswer: 'b',
    difficulty: 'beginner',
    explanation: 'In JavaScript, typeof null returns "object". This is a known bug that has been kept for backward compatibility.',
    topic: 'Types',
  },
  {
    id: '2',
    text: 'Which of the following is NOT a valid way to create an array in JavaScript?',
    options: [
      { id: 'a', text: 'const arr = []' },
      { id: 'b', text: 'const arr = new Array()' },
      { id: 'c', text: 'const arr = Array.of(1, 2, 3)' },
      { id: 'd', text: 'const arr = Array.create(1, 2, 3)' },
    ],
    correctAnswer: 'd',
    difficulty: 'beginner',
    explanation: 'Array.create() is not a valid method. Use [], new Array(), Array.of(), or Array.from() instead.',
    topic: 'Arrays',
  },
  {
    id: '3',
    text: 'What does the spread operator (...) do when used with arrays?',
    options: [
      { id: 'a', text: 'Creates a deep copy of the array' },
      { id: 'b', text: 'Creates a shallow copy and expands elements' },
      { id: 'c', text: 'Removes all elements from the array' },
      { id: 'd', text: 'Reverses the array' },
    ],
    correctAnswer: 'b',
    difficulty: 'intermediate',
    explanation: 'The spread operator creates a shallow copy and expands array elements. For deep copies, use structuredClone() or JSON methods.',
    topic: 'ES6+',
  },
  {
    id: '4',
    text: 'What is the purpose of the useEffect hook in React?',
    options: [
      { id: 'a', text: 'To manage component state' },
      { id: 'b', text: 'To handle side effects after render' },
      { id: 'c', text: 'To create context providers' },
      { id: 'd', text: 'To optimize rendering performance' },
    ],
    correctAnswer: 'b',
    difficulty: 'intermediate',
    explanation: 'useEffect is used to handle side effects like data fetching, subscriptions, or manually changing the DOM after the component renders.',
    topic: 'React Hooks',
  },
  {
    id: '5',
    text: 'What is a closure in JavaScript?',
    code: `function outer() {
  let x = 10;
  function inner() {
    console.log(x);
  }
  return inner;
}`,
    options: [
      { id: 'a', text: 'A function that returns another function' },
      { id: 'b', text: 'A function that has access to its outer scope even after the outer function returns' },
      { id: 'c', text: 'A way to make variables private' },
      { id: 'd', text: 'All of the above' },
    ],
    correctAnswer: 'd',
    difficulty: 'advanced',
    explanation: 'Closures combine all these concepts: they return functions, maintain access to outer scope, and enable data privacy.',
    topic: 'Closures',
  },
];

// ============================================
// CONFIG
// ============================================

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; icon: React.ElementType }> = {
  beginner: { label: 'Beginner', color: 'emerald', icon: Star },
  intermediate: { label: 'Intermediate', color: 'blue', icon: Zap },
  advanced: { label: 'Advanced', color: 'purple', icon: Trophy },
  expert: { label: 'Expert', color: 'yellow', icon: Shield },
};

// ============================================
// COMPONENTS
// ============================================

function SkillSelection({
  skills,
  onSelect,
}: {
  skills: Skill[];
  onSelect: (skill: Skill) => void;
}) {
  const categories = [...new Set(skills.map(s => s.category))];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Skills Assessment</h1>
        <p className="text-muted-foreground mt-2">
          Verify your skills and earn badges to showcase your expertise
        </p>
      </div>

      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-lg font-semibold mb-4">{category}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {skills
              .filter(s => s.category === category)
              .map((skill) => (
                <Card
                  key={skill.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onSelect(skill)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{skill.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{skill.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {skill.description}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {skill.estimatedTime} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            {skill.questions} questions
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AssessmentIntro({
  skill,
  onStart,
  onBack,
}: {
  skill: Skill;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="mb-6">
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to skills
      </Button>

      <Card>
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">{skill.icon}</div>
          <CardTitle className="text-2xl">{skill.name} Assessment</CardTitle>
          <CardDescription>{skill.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
              <Target className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="font-semibold">{skill.questions}</p>
              <p className="text-sm text-muted-foreground">Questions</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
              <Clock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="font-semibold">{skill.estimatedTime} min</p>
              <p className="text-sm text-muted-foreground">Time Limit</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
              <Sparkles className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="font-semibold">Adaptive</p>
              <p className="text-sm text-muted-foreground">Difficulty</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium">How it works</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                Questions adapt to your skill level based on your answers
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                You can skip questions if you're unsure
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                Review your answers before submitting
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                Earn a verified badge if you pass
              </li>
            </ul>
          </div>

          <Separator />

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Before you begin
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                  Make sure you have uninterrupted time. You can pause the assessment, but the timer will continue.
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={onStart}>
            <Play className="h-5 w-5 mr-2" />
            Start Assessment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionView({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  timeRemaining,
  onAnswer,
  onNext,
  onPrevious,
  onSkip,
  canGoPrevious,
}: {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  timeRemaining: number;
  onAnswer: (answerId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  canGoPrevious: boolean;
}) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const difficultyConfig = DIFFICULTY_CONFIG[question.difficulty];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge
            variant="outline"
            className={cn(
              difficultyConfig.color === 'emerald' && 'border-emerald-400 text-emerald-600',
              difficultyConfig.color === 'blue' && 'border-blue-400 text-blue-600',
              difficultyConfig.color === 'purple' && 'border-purple-400 text-purple-600',
              difficultyConfig.color === 'yellow' && 'border-yellow-400 text-yellow-600'
            )}
          >
            {difficultyConfig.label}
          </Badge>
          <Badge variant="secondary">{question.topic}</Badge>
        </div>
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full',
          timeRemaining < 60 ? 'bg-red-100 text-red-700' : 'bg-zinc-100 dark:bg-zinc-800'
        )}>
          <Clock className="h-4 w-4" />
          <span className="font-mono font-medium">{formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Question {questionNumber} of {totalQuestions}</span>
          <span>{Math.round((questionNumber / totalQuestions) * 100)}% complete</span>
        </div>
        <Progress value={(questionNumber / totalQuestions) * 100} className="h-2" />
      </div>

      {/* Question */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-medium mb-4">{question.text}</h2>

          {question.code && (
            <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-lg mb-6 overflow-x-auto text-sm">
              <code>{question.code}</code>
            </pre>
          )}

          <RadioGroup value={selectedAnswer || ''} onValueChange={onAnswer}>
            <div className="space-y-3">
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    'flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors',
                    selectedAnswer === option.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  )}
                  onClick={() => onAnswer(option.id)}
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer font-normal">
                    {option.text}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip question
        </Button>
        <Button onClick={onNext}>
          {questionNumber === totalQuestions ? 'Review Answers' : 'Next'}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function ResultsView({
  result,
  skill,
  onRetake,
  onContinue,
}: {
  result: AssessmentResult;
  skill: Skill;
  onRetake: () => void;
  onContinue: () => void;
}) {
  const levelConfig = DIFFICULTY_CONFIG[result.level];
  const LevelIcon = levelConfig.icon;
  const passed = result.score >= 70;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Result Header */}
      <Card className={cn(
        'border-2',
        passed ? 'border-emerald-500' : 'border-yellow-500'
      )}>
        <CardContent className="pt-8 pb-6 text-center">
          {passed ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Trophy className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold">Congratulations!</h2>
              <p className="text-muted-foreground mt-1">
                You've earned the {skill.name} badge
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <TrendingUp className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold">Keep Learning!</h2>
              <p className="text-muted-foreground mt-1">
                You're making progress, but need more practice
              </p>
            </>
          )}

          <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg inline-block">
            <p className="text-4xl font-bold">{result.score}%</p>
            <p className="text-sm text-muted-foreground">
              {result.correctAnswers} of {result.totalQuestions} correct
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Badge Earned */}
      {result.badgeEarned && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={cn(
                'h-16 w-16 rounded-full flex items-center justify-center',
                levelConfig.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30',
                levelConfig.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30',
                levelConfig.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30',
                levelConfig.color === 'yellow' && 'bg-yellow-100 dark:bg-yellow-900/30'
              )}>
                <LevelIcon className={cn(
                  'h-8 w-8',
                  levelConfig.color === 'emerald' && 'text-emerald-600',
                  levelConfig.color === 'blue' && 'text-blue-600',
                  levelConfig.color === 'purple' && 'text-purple-600',
                  levelConfig.color === 'yellow' && 'text-yellow-600'
                )} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{result.badgeEarned.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {levelConfig.label} Level • Verified Skill
                </p>
              </div>
              <Badge className={cn(
                levelConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700',
                levelConfig.color === 'blue' && 'bg-blue-100 text-blue-700',
                levelConfig.color === 'purple' && 'bg-purple-100 text-purple-700',
                levelConfig.color === 'yellow' && 'bg-yellow-100 text-yellow-700'
              )}>
                <Award className="h-3 w-3 mr-1" />
                Earned
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance by Topic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.topicScores.map((topic) => (
            <div key={topic.topic} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{topic.topic}</span>
                <span className="font-medium">{topic.score}%</span>
              </div>
              <Progress
                value={topic.score}
                className={cn(
                  'h-2',
                  topic.score >= 80 && '[&>div]:bg-emerald-500',
                  topic.score >= 60 && topic.score < 80 && '[&>div]:bg-yellow-500',
                  topic.score < 60 && '[&>div]:bg-red-500'
                )}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3">
                <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onRetake}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Retake Assessment
        </Button>
        <Button variant="outline" className="flex-1">
          <Share2 className="h-4 w-4 mr-2" />
          Share Result
        </Button>
        <Button className="flex-1" onClick={onContinue}>
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SkillsAssessmentUI({ className }: { className?: string }) {
  const [state, setState] = useState<AssessmentState>('intro');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes
  const [result, setResult] = useState<AssessmentResult | null>(null);

  // Timer effect
  useEffect(() => {
    if (state !== 'in-progress') return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  const handleSelectSkill = (skill: Skill) => {
    setSelectedSkill(skill);
  };

  const handleStartAssessment = () => {
    setState('in-progress');
    setTimeRemaining(selectedSkill!.estimatedTime * 60);
  };

  const handleAnswer = (answerId: string) => {
    const question = MOCK_QUESTIONS[currentQuestionIndex];
    setAnswers({ ...answers, [question.id]: answerId });
  };

  const handleNext = () => {
    if (currentQuestionIndex < MOCK_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleFinish = () => {
    // Calculate results
    const correctCount = MOCK_QUESTIONS.filter(
      q => answers[q.id] === q.correctAnswer
    ).length;
    const score = Math.round((correctCount / MOCK_QUESTIONS.length) * 100);

    const mockResult: AssessmentResult = {
      totalQuestions: MOCK_QUESTIONS.length,
      correctAnswers: correctCount,
      score,
      level: score >= 90 ? 'expert' : score >= 70 ? 'advanced' : score >= 50 ? 'intermediate' : 'beginner',
      timeTaken: (selectedSkill!.estimatedTime * 60) - timeRemaining,
      topicScores: [
        { topic: 'Types', score: 80 },
        { topic: 'Arrays', score: 100 },
        { topic: 'ES6+', score: 75 },
        { topic: 'React Hooks', score: 60 },
        { topic: 'Closures', score: 85 },
      ],
      badgeEarned: score >= 70 ? { name: `${selectedSkill!.name} Proficient`, level: score >= 90 ? 'expert' : 'advanced' } : undefined,
      recommendations: [
        'Review React Hooks documentation for useEffect best practices',
        'Practice more ES6+ destructuring patterns',
        'Take the advanced React course to improve your score',
      ],
    };

    setResult(mockResult);
    setState('results');
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setTimeRemaining(selectedSkill!.estimatedTime * 60);
    setState('in-progress');
  };

  const handleBackToSkills = () => {
    setSelectedSkill(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setResult(null);
    setState('intro');
  };

  return (
    <div className={cn('min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4', className)}>
      {!selectedSkill ? (
        <SkillSelection skills={MOCK_SKILLS} onSelect={handleSelectSkill} />
      ) : state === 'intro' ? (
        <AssessmentIntro
          skill={selectedSkill}
          onStart={handleStartAssessment}
          onBack={handleBackToSkills}
        />
      ) : state === 'in-progress' ? (
        <QuestionView
          question={MOCK_QUESTIONS[currentQuestionIndex]}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={MOCK_QUESTIONS.length}
          selectedAnswer={answers[MOCK_QUESTIONS[currentQuestionIndex].id] || null}
          timeRemaining={timeRemaining}
          onAnswer={handleAnswer}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSkip={handleNext}
          canGoPrevious={currentQuestionIndex > 0}
        />
      ) : result ? (
        <ResultsView
          result={result}
          skill={selectedSkill}
          onRetake={handleRetake}
          onContinue={handleBackToSkills}
        />
      ) : null}
    </div>
  );
}

export default SkillsAssessmentUI;
