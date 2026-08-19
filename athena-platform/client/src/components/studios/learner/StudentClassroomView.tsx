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

import React, { useEffect, useState } from 'react';
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
  FileText,
  MessageSquare,
  Download,
  Share2,
  ThumbsUp,
  Send,
  PanelRightOpen,
  PanelRightClose,
  StickyNote,
  HelpCircle,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface TranscriptItem {
  time: number;
  text: string;
}

interface StudentClassroomViewProps {
  className?: string;
  course?: CourseData | null;
  initialNotes?: Note[];
  questions?: Question[];
  transcript?: TranscriptItem[];
  isLoading?: boolean;
  error?: string | null;
  onAskQuestion?: (question: string) => void;
}

const EMPTY_NOTES: Note[] = [];
const EMPTY_QUESTIONS: Question[] = [];
const EMPTY_TRANSCRIPT: TranscriptItem[] = [];

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
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Play className="h-16 w-16" />
          <span className="text-sm">No lesson media connected</span>
        </div>
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
  const [expandedModules, setExpandedModules] = useState<string[]>(() =>
    course.modules.slice(0, 2).map(module => module.id)
  );

  useEffect(() => {
    setExpandedModules(previous => {
      const moduleIds = new Set(course.modules.map(module => module.id));
      const stillValid = previous.filter(id => moduleIds.has(id));

      return stillValid.length > 0
        ? stillValid
        : course.modules.slice(0, 2).map(module => module.id);
    });
  }, [course.modules]);

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
        {notes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No notes have been saved for this lesson yet.
          </div>
        ) : (
          notes.map((note) => (
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
          ))
        )}
      </div>
    </div>
  );
}

function QAPanel({
  questions,
  onAskQuestion,
}: {
  questions: Question[];
  onAskQuestion?: (question: string) => void;
}) {
  const [newQuestion, setNewQuestion] = useState('');
  const canAskQuestion = Boolean(onAskQuestion);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={canAskQuestion ? 'Ask a question...' : 'Q&A posting is not connected'}
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          disabled={!canAskQuestion}
        />
        <Button
          disabled={!canAskQuestion || !newQuestion.trim()}
          onClick={() => {
            const question = newQuestion.trim();
            if (!question || !onAskQuestion) return;
            onAskQuestion(question);
            setNewQuestion('');
          }}
        >
          Ask
        </Button>
      </div>

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No live Q&A has been connected for this lesson yet.
          </div>
        ) : (
          questions.map((q) => (
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
          ))
        )}
      </div>
    </div>
  );
}

function TranscriptPanel({ transcript, currentTime }: { transcript: TranscriptItem[]; currentTime: number }) {
  return (
    <div className="space-y-2">
      {transcript.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No transcript is available for this lesson.
        </div>
      ) : (
        transcript.map((item, index) => (
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
        ))
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StudentClassroomView({
  className,
  course,
  initialNotes = EMPTY_NOTES,
  questions = EMPTY_QUESTIONS,
  transcript = EMPTY_TRANSCRIPT,
  isLoading = false,
  error = null,
  onAskQuestion,
}: StudentClassroomViewProps) {
  const [currentLessonId, setCurrentLessonId] = useState(course?.currentLesson.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(75);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    if (!course) {
      setCurrentLessonId('');
      return;
    }

    const courseLessonIds = new Set(course.modules.flatMap(module => module.lessons.map(lesson => lesson.id)));

    if (!currentLessonId || !courseLessonIds.has(currentLessonId)) {
      setCurrentLessonId(course.currentLesson.id);
    }
  }, [course, currentLessonId]);

  if (isLoading) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950', className)}>
        <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground shadow-sm dark:bg-zinc-900">
          Loading classroom...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950', className)}>
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
          <h2 className="font-semibold">Classroom unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950', className)}>
        <div className="max-w-md rounded-lg border bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
          <h2 className="font-semibold">No course connected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The classroom is ready for live course data, but no enrolled course has been provided.
          </p>
        </div>
      </div>
    );
  }

  const allLessons = course.modules.flatMap(module => module.lessons);
  const currentLesson = allLessons.find(lesson => lesson.id === currentLessonId) ?? course.currentLesson;
  const currentLessonIndex = allLessons.findIndex(lesson => lesson.id === currentLesson.id);
  const previousLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
    ? allLessons[currentLessonIndex + 1]
    : null;
  const duration = currentLesson.duration * 60;

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
            <h1 className="font-medium text-sm">{currentLesson.title}</h1>
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
                  aria-label="Bookmark lesson"
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
                    <h2 className="font-semibold">{currentLesson.title}</h2>
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
                  <QAPanel questions={questions} onAskQuestion={onAskQuestion} />
                </TabsContent>

                <TabsContent value="transcript" className="mt-4">
                  <TranscriptPanel transcript={transcript} currentTime={currentTime} />
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
        <Button
          variant="outline"
          size="sm"
          disabled={!previousLesson}
          onClick={() => previousLesson && setCurrentLessonId(previousLesson.id)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous Lesson
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Lesson {currentLessonIndex >= 0 ? currentLessonIndex + 1 : 1} of {Math.max(allLessons.length, 1)}
          </span>
        </div>
        <Button
          size="sm"
          disabled={!nextLesson}
          onClick={() => nextLesson && setCurrentLessonId(nextLesson.id)}
        >
          Next Lesson
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </footer>
    </div>
  );
}

export default StudentClassroomView;
