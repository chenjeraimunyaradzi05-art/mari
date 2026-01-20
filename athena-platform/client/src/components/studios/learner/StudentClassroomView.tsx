'use client';

/**
 * Student Classroom View
 * Phase 4: Web Client - Persona Studios
 * Step 70: Learning player with video, notes, progress
 * 
 * Features:
 * - Video player with controls
 * - Course navigation sidebar
 * - Progress tracking
 * - Note-taking
 * - Q&A section
 * - Transcript view
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Lock,
  BookOpen,
  FileText,
  MessageSquare,
  Clock,
  Star,
  Download,
  Share2,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  Send,
  PanelRightOpen,
  PanelRightClose,
  ListVideo,
  StickyNote,
  HelpCircle,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================
// TYPES
// ============================================

interface Lesson {
  id: string;
  title: string;
  duration: number;
  type: 'video' | 'article' | 'quiz';
  isCompleted: boolean;
  isLocked: boolean;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface Note {
  id: string;
  timestamp?: number;
  content: string;
  createdAt: Date;
}

interface Question {
  id: string;
  author: {
    name: string;
    avatar?: string;
  };
  content: string;
  upvotes: number;
  replies: number;
  createdAt: Date;
  isAnswered: boolean;
}

interface CourseData {
  id: string;
  title: string;
  instructor: {
    name: string;
    avatar?: string;
  };
  currentLesson: Lesson;
  modules: Module[];
  progress: number;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_COURSE: CourseData = {
  id: '1',
  title: 'Product Management Fundamentals',
  instructor: {
    name: 'Sarah Johnson',
    avatar: '/avatars/sarah.jpg',
  },
  progress: 35,
  currentLesson: {
    id: 'l2',
    title: 'The Product Manager Role',
    duration: 18,
    type: 'video',
    isCompleted: false,
    isLocked: false,
  },
  modules: [
    {
      id: 'm1',
      title: 'Introduction to Product Management',
      lessons: [
        { id: 'l1', title: 'What is Product Management?', duration: 12, type: 'video', isCompleted: true, isLocked: false },
        { id: 'l2', title: 'The Product Manager Role', duration: 18, type: 'video', isCompleted: false, isLocked: false },
        { id: 'l3', title: 'Module Quiz', duration: 10, type: 'quiz', isCompleted: false, isLocked: false },
      ],
    },
    {
      id: 'm2',
      title: 'Product Discovery',
      lessons: [
        { id: 'l4', title: 'Understanding User Problems', duration: 15, type: 'video', isCompleted: false, isLocked: false },
        { id: 'l5', title: 'User Research Methods', duration: 8, type: 'article', isCompleted: false, isLocked: false },
        { id: 'l6', title: 'Discovery Quiz', duration: 10, type: 'quiz', isCompleted: false, isLocked: true },
      ],
    },
    {
      id: 'm3',
      title: 'Product Strategy',
      lessons: [
        { id: 'l7', title: 'Creating a Product Vision', duration: 20, type: 'video', isCompleted: false, isLocked: true },
        { id: 'l8', title: 'Roadmapping Basics', duration: 15, type: 'video', isCompleted: false, isLocked: true },
      ],
    },
  ],
};

const MOCK_NOTES: Note[] = [
  {
    id: '1',
    timestamp: 120,
    content: 'Key responsibilities: Product vision, roadmap, stakeholder management',
    createdAt: new Date(2026, 0, 18),
  },
  {
    id: '2',
    timestamp: 340,
    content: 'PM is the "CEO of the product" - responsible for success',
    createdAt: new Date(2026, 0, 18),
  },
];

const MOCK_QUESTIONS: Question[] = [
  {
    id: '1',
    author: { name: 'Alex Chen', avatar: '/avatars/alex.jpg' },
    content: 'How does the PM role differ between startups and large companies?',
    upvotes: 15,
    replies: 3,
    createdAt: new Date(2026, 0, 17),
    isAnswered: true,
  },
  {
    id: '2',
    author: { name: 'Maria Rodriguez' },
    content: 'Is technical background necessary for product management?',
    upvotes: 8,
    replies: 5,
    createdAt: new Date(2026, 0, 16),
    isAnswered: true,
  },
];

const MOCK_TRANSCRIPT = [
  { time: 0, text: "Welcome back to the course. In this lesson, we're going to explore the role of a Product Manager in depth." },
  { time: 15, text: "A Product Manager is often called the 'CEO of the product', but what does that really mean?" },
  { time: 30, text: "First and foremost, the PM is responsible for the product's success. This means understanding the market, the users, and the business." },
  { time: 50, text: "Let's break down the key responsibilities of a Product Manager..." },
  { time: 65, text: "Number one: Defining the product vision. This is your north star that guides all decisions." },
  { time: 85, text: "Number two: Creating and maintaining the product roadmap. This is your plan for getting from here to there." },
  { time: 105, text: "Number three: Working with stakeholders. This includes engineering, design, marketing, sales, and leadership." },
];

// ============================================
// COMPONENTS
// ============================================

function VideoPlayer({
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
}: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
      {/* Video placeholder */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
        <Play className="h-16 w-16 text-white/50" />
      </div>

      {/* Controls overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress bar */}
        <div className="absolute bottom-16 left-0 right-0 px-4">
          <Slider
            value={[currentTime]}
            max={duration}
            step={1}
            onValueChange={(value) => onSeek(value[0])}
            className="cursor-pointer"
          />
        </div>

        {/* Control buttons */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={onPlayPause}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <SkipForward className="h-5 w-5" />
            </Button>
            <div
              className="relative"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              {showVolumeSlider && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/80 rounded-lg">
                  <Slider
                    orientation="vertical"
                    value={[isMuted ? 0 : volume]}
                    max={100}
                    step={1}
                    onValueChange={(value) => onVolumeChange(value[0])}
                    className="h-20"
                  />
                </div>
              )}
            </div>
            <span className="text-white text-sm ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <Maximize2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseSidebar({
  course,
  currentLessonId,
  onSelectLesson,
  isCollapsed,
}: {
  course: CourseData;
  currentLessonId: string;
  onSelectLesson: (lessonId: string) => void;
  isCollapsed: boolean;
}) {
  const [expandedModules, setExpandedModules] = useState<string[]>(['m1', 'm2']);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  if (isCollapsed) return null;

  return (
    <div className="w-80 border-l bg-white dark:bg-zinc-900 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Course Content</h2>
        <div className="flex items-center gap-2 mt-2">
          <Progress value={course.progress} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground">{course.progress}%</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {course.modules.map((module, moduleIndex) => {
            const completedLessons = module.lessons.filter(l => l.isCompleted).length;
            const isExpanded = expandedModules.includes(module.id);

            return (
              <div key={module.id} className="mb-2">
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left"
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      !isExpanded && '-rotate-90'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      Section {moduleIndex + 1}: {module.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {completedLessons}/{module.lessons.length} completed
                    </p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <button
                        key={lesson.id}
                        onClick={() => !lesson.isLocked && onSelectLesson(lesson.id)}
                        disabled={lesson.isLocked}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-lg text-left text-sm',
                          lesson.id === currentLessonId && 'bg-emerald-100 dark:bg-emerald-900/30',
                          !lesson.isLocked && 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                          lesson.isLocked && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="shrink-0">
                          {lesson.isLocked ? (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          ) : lesson.isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : lesson.id === currentLessonId ? (
                            <Play className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'truncate',
                            lesson.id === currentLessonId && 'font-medium'
                          )}>
                            {lessonIndex + 1}. {lesson.title}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {lesson.duration}m
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function NotesPanel({ notes, onAddNote }: { notes: Note[]; onAddNote: (note: string) => void }) {
  const [newNote, setNewNote] = useState('');

  const formatTimestamp = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
          className="resize-none"
        />
        <Button
          size="icon"
          onClick={() => {
            if (newNote.trim()) {
              onAddNote(newNote);
              setNewNote('');
            }
          }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            {note.timestamp && (
              <Badge variant="secondary" className="mb-2 text-xs">
                {formatTimestamp(note.timestamp)}
              </Badge>
            )}
            <p className="text-sm">{note.content}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {note.createdAt.toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QAPanel({ questions }: { questions: Question[] }) {
  const [newQuestion, setNewQuestion] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Ask a question..."
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
        />
        <Button>Ask</Button>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="p-4 border rounded-lg">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={q.author.avatar} />
                <AvatarFallback className="text-xs">
                  {q.author.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{q.author.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {q.createdAt.toLocaleDateString()}
                  </span>
                  {q.isAnswered && (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                      Answered
                    </Badge>
                  )}
                </div>
                <p className="text-sm mt-1">{q.content}</p>
                <div className="flex items-center gap-4 mt-3">
                  <Button variant="ghost" size="sm" className="h-8">
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {q.upvotes}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    {q.replies} replies
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TranscriptPanel({ transcript, currentTime }: { transcript: typeof MOCK_TRANSCRIPT; currentTime: number }) {
  return (
    <div className="space-y-2">
      {transcript.map((item, index) => (
        <button
          key={index}
          className={cn(
            'w-full text-left p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800',
            currentTime >= item.time && (transcript[index + 1]?.time || Infinity) > currentTime
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-2 border-emerald-500'
              : ''
          )}
        >
          <span className="text-xs text-muted-foreground mr-2">
            {Math.floor(item.time / 60)}:{(item.time % 60).toString().padStart(2, '0')}
          </span>
          <span className="text-sm">{item.text}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StudentClassroomView({ className }: { className?: string }) {
  const [course] = useState<CourseData>(MOCK_COURSE);
  const [currentLessonId, setCurrentLessonId] = useState(course.currentLesson.id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(180); // 3 minutes
  const [volume, setVolume] = useState(75);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notes, setNotes] = useState<Note[]>(MOCK_NOTES);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const duration = course.currentLesson.duration * 60;

  const handleAddNote = (content: string) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      content,
      timestamp: currentTime,
      createdAt: new Date(),
    };
    setNotes([newNote, ...notes]);
  };

  return (
    <div className={cn('h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950', className)}>
      {/* Header */}
      <header className="h-14 border-b bg-white dark:bg-zinc-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Course
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="font-medium text-sm">{course.currentLesson.title}</h1>
            <p className="text-xs text-muted-foreground">{course.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsBookmarked(!isBookmarked)}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Bookmark className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bookmark lesson</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon">
            <Share2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <PanelRightOpen className="h-5 w-5" />
            ) : (
              <PanelRightClose className="h-5 w-5" />
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 flex items-center justify-center bg-zinc-900">
            <div className="w-full max-w-5xl">
              <VideoPlayer
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                onPlayPause={() => setIsPlaying(!isPlaying)}
                onSeek={setCurrentTime}
                onVolumeChange={setVolume}
              />
            </div>
          </div>

          {/* Below Video */}
          <div className="border-t bg-white dark:bg-zinc-900">
            <div className="max-w-5xl mx-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={course.instructor.avatar} />
                    <AvatarFallback>
                      {course.instructor.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold">{course.currentLesson.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {course.instructor.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Resources
                  </Button>
                  <Button size="sm">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="notes">
                <TabsList>
                  <TabsTrigger value="notes">
                    <StickyNote className="h-4 w-4 mr-2" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="qa">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Q&A
                  </TabsTrigger>
                  <TabsTrigger value="transcript">
                    <FileText className="h-4 w-4 mr-2" />
                    Transcript
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="notes" className="mt-4">
                  <NotesPanel notes={notes} onAddNote={handleAddNote} />
                </TabsContent>

                <TabsContent value="qa" className="mt-4">
                  <QAPanel questions={MOCK_QUESTIONS} />
                </TabsContent>

                <TabsContent value="transcript" className="mt-4">
                  <TranscriptPanel transcript={MOCK_TRANSCRIPT} currentTime={currentTime} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <CourseSidebar
          course={course}
          currentLessonId={currentLessonId}
          onSelectLesson={setCurrentLessonId}
          isCollapsed={sidebarCollapsed}
        />
      </div>

      {/* Navigation Footer */}
      <footer className="h-14 border-t bg-white dark:bg-zinc-900 flex items-center justify-between px-4">
        <Button variant="outline" size="sm">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous Lesson
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Lesson 2 of 8
          </span>
        </div>
        <Button size="sm">
          Next Lesson
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </footer>
    </div>
  );
}

export default StudentClassroomView;
