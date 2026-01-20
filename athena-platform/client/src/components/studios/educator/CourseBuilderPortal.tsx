'use client';

/**
 * Course Builder Portal
 * Phase 4: Web Client - Persona Studios
 * Step 69: Educator drag-drop curriculum editor
 * 
 * Features:
 * - Course structure management
 * - Module and lesson drag-drop
 * - Content editor (video, text, quiz)
 * - Course settings and pricing
 * - Preview and publish
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Plus,
  MoreVertical,
  GripVertical,
  Video,
  FileText,
  HelpCircle,
  Image,
  Download,
  Settings,
  Eye,
  Play,
  Save,
  Send,
  Trash2,
  Edit,
  Copy,
  Clock,
  Users,
  DollarSign,
  Star,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Award,
  CheckCircle2,
  AlertCircle,
  Upload,
  Link2,
  Sparkles,
  Globe,
  Lock,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';

// ============================================
// TYPES
// ============================================

type LessonType = 'video' | 'article' | 'quiz' | 'assignment' | 'resource';
type CourseStatus = 'draft' | 'review' | 'published' | 'archived';

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration?: number; // minutes
  content?: string;
  videoUrl?: string;
  isPreview: boolean;
  isComplete: boolean;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  lessons: Lesson[];
  isExpanded: boolean;
}

interface Course {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  status: CourseStatus;
  modules: Module[];
  price: number;
  originalPrice?: number;
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string[];
  certificate: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  stats?: {
    enrollments: number;
    completionRate: number;
    avgRating: number;
    reviews: number;
    revenue: number;
  };
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_COURSE: Course = {
  id: '1',
  title: 'Product Management Fundamentals',
  subtitle: 'Learn to build products users love',
  description: 'A comprehensive course covering all aspects of modern product management, from discovery to delivery.',
  category: 'Business',
  level: 'beginner',
  language: 'English',
  status: 'draft',
  price: 49.99,
  originalPrice: 99.99,
  certificate: true,
  createdAt: new Date(2025, 11, 1),
  updatedAt: new Date(2026, 0, 18),
  learningOutcomes: [
    'Understand product management fundamentals',
    'Create product roadmaps and strategies',
    'Conduct user research effectively',
    'Work with cross-functional teams',
  ],
  requirements: [
    'No prior experience required',
    'Basic understanding of business concepts',
  ],
  targetAudience: [
    'Aspiring product managers',
    'Career changers into tech',
    'Entrepreneurs building products',
  ],
  stats: {
    enrollments: 0,
    completionRate: 0,
    avgRating: 0,
    reviews: 0,
    revenue: 0,
  },
  modules: [
    {
      id: 'm1',
      title: 'Introduction to Product Management',
      description: 'Learn what product management is and why it matters',
      isExpanded: true,
      lessons: [
        {
          id: 'l1',
          title: 'What is Product Management?',
          type: 'video',
          duration: 12,
          isPreview: true,
          isComplete: true,
        },
        {
          id: 'l2',
          title: 'The Product Manager Role',
          type: 'video',
          duration: 18,
          isPreview: false,
          isComplete: true,
        },
        {
          id: 'l3',
          title: 'Module Quiz',
          type: 'quiz',
          duration: 10,
          isPreview: false,
          isComplete: false,
        },
      ],
    },
    {
      id: 'm2',
      title: 'Product Discovery',
      description: 'Learn how to find and validate product ideas',
      isExpanded: false,
      lessons: [
        {
          id: 'l4',
          title: 'Understanding User Problems',
          type: 'video',
          duration: 15,
          isPreview: false,
          isComplete: false,
        },
        {
          id: 'l5',
          title: 'User Research Methods',
          type: 'article',
          duration: 8,
          isPreview: false,
          isComplete: false,
        },
        {
          id: 'l6',
          title: 'Competitive Analysis Template',
          type: 'resource',
          isPreview: false,
          isComplete: false,
        },
      ],
    },
    {
      id: 'm3',
      title: 'Product Strategy',
      description: 'Define your product vision and roadmap',
      isExpanded: false,
      lessons: [
        {
          id: 'l7',
          title: 'Creating a Product Vision',
          type: 'video',
          duration: 20,
          isPreview: false,
          isComplete: false,
        },
        {
          id: 'l8',
          title: 'Roadmapping Assignment',
          type: 'assignment',
          duration: 30,
          isPreview: false,
          isComplete: false,
        },
      ],
    },
  ],
};

// ============================================
// CONFIG
// ============================================

const LESSON_TYPES: Record<LessonType, { label: string; icon: React.ElementType; color: string }> = {
  video: { label: 'Video', icon: Video, color: 'blue' },
  article: { label: 'Article', icon: FileText, color: 'emerald' },
  quiz: { label: 'Quiz', icon: HelpCircle, color: 'purple' },
  assignment: { label: 'Assignment', icon: Edit, color: 'yellow' },
  resource: { label: 'Resource', icon: Download, color: 'zinc' },
};

const STATUS_CONFIG: Record<CourseStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'zinc' },
  review: { label: 'In Review', color: 'yellow' },
  published: { label: 'Published', color: 'emerald' },
  archived: { label: 'Archived', color: 'red' },
};

// ============================================
// COMPONENTS
// ============================================

function LessonCard({
  lesson,
  onEdit,
  onDelete,
  onDragStart,
}: {
  lesson: Lesson;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const config = LESSON_TYPES[lesson.type];
  const Icon = config.icon;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        'flex items-center gap-3 p-3 border rounded-lg bg-white dark:bg-zinc-900',
        'hover:shadow-sm transition-shadow cursor-grab active:cursor-grabbing'
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      
      <div className={cn(
        'h-8 w-8 rounded flex items-center justify-center shrink-0',
        config.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30',
        config.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30',
        config.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30',
        config.color === 'yellow' && 'bg-yellow-100 dark:bg-yellow-900/30',
        config.color === 'zinc' && 'bg-zinc-100 dark:bg-zinc-800'
      )}>
        <Icon className={cn(
          'h-4 w-4',
          config.color === 'blue' && 'text-blue-600 dark:text-blue-400',
          config.color === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
          config.color === 'purple' && 'text-purple-600 dark:text-purple-400',
          config.color === 'yellow' && 'text-yellow-600 dark:text-yellow-400',
          config.color === 'zinc' && 'text-zinc-600 dark:text-zinc-400'
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{lesson.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{config.label}</span>
          {lesson.duration && (
            <>
              <span>•</span>
              <span>{lesson.duration} min</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {lesson.isPreview && (
          <Badge variant="outline" className="text-xs">Preview</Badge>
        )}
        {lesson.isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-yellow-500" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ModuleSection({
  module,
  onToggle,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onEditModule,
  onDeleteModule,
}: {
  module: Module;
  onToggle: () => void;
  onAddLesson: () => void;
  onEditLesson: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onEditModule: () => void;
  onDeleteModule: () => void;
}) {
  const totalDuration = module.lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
  const completedLessons = module.lessons.filter(l => l.isComplete).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
        onClick={onToggle}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
          {module.isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        <div className="flex-1 min-w-0">
          <p className="font-medium">{module.title}</p>
          {module.description && (
            <p className="text-sm text-muted-foreground truncate">{module.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{module.lessons.length} lessons</span>
          <span>{totalDuration} min</span>
          <Badge variant="outline">
            {completedLessons}/{module.lessons.length} ready
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditModule}>
              <Edit className="h-4 w-4 mr-2" />
              Edit module
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddLesson}>
              <Plus className="h-4 w-4 mr-2" />
              Add lesson
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={onDeleteModule}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete module
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {module.isExpanded && (
        <div className="p-4 space-y-2">
          {module.lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onEdit={() => onEditLesson(lesson.id)}
              onDelete={() => onDeleteLesson(lesson.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData('lessonId', lesson.id);
                e.dataTransfer.setData('moduleId', module.id);
              }}
            />
          ))}
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={onAddLesson}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Lesson
          </Button>
        </div>
      )}
    </div>
  );
}

function AddLessonDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (lesson: Partial<Lesson>) => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LessonType>('video');

  const handleAdd = () => {
    onAdd({ title, type, isPreview: false, isComplete: false });
    setTitle('');
    setType('video');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Lesson</DialogTitle>
          <DialogDescription>
            Create a new lesson for your course module
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lesson Title</Label>
            <Input
              placeholder="Enter lesson title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Content Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(LESSON_TYPES) as [LessonType, typeof LESSON_TYPES[LessonType]][]).map(
                ([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setType(key)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors',
                        type === key
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                      )}
                    >
                      <Icon className={cn(
                        'h-6 w-6',
                        type === key && 'text-emerald-600'
                      )} />
                      <span className="text-sm font-medium">{config.label}</span>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!title.trim()}>
            Add Lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CourseSettingsSheet({ course }: { course: Course }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Course Settings</SheetTitle>
          <SheetDescription>
            Configure your course details and pricing
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Basic Information</h3>
            <div className="space-y-2">
              <Label>Course Title</Label>
              <Input defaultValue={course.title} />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input defaultValue={course.subtitle} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea defaultValue={course.description} rows={4} />
            </div>
          </div>

          <Separator />

          {/* Category & Level */}
          <div className="space-y-4">
            <h3 className="font-medium">Classification</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select defaultValue={course.category}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Select defaultValue={course.level}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium">Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input type="number" defaultValue={course.price} />
              </div>
              <div className="space-y-2">
                <Label>Original Price ($)</Label>
                <Input type="number" defaultValue={course.originalPrice} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Free Course</p>
                <p className="text-xs text-muted-foreground">
                  Make this course available for free
                </p>
              </div>
              <Switch />
            </div>
          </div>

          <Separator />

          {/* Options */}
          <div className="space-y-4">
            <h3 className="font-medium">Options</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Certificate</p>
                    <p className="text-xs text-muted-foreground">
                      Award certificate on completion
                    </p>
                  </div>
                </div>
                <Switch defaultChecked={course.certificate} />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Public</p>
                    <p className="text-xs text-muted-foreground">
                      Visible in course catalog
                    </p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          <Button className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CoursePreviewCard({ course }: { course: Course }) {
  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalDuration = course.modules.reduce(
    (sum, m) => sum + m.lessons.reduce((lsum, l) => lsum + (l.duration || 0), 0),
    0
  );
  const completedLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.filter(l => l.isComplete).length,
    0
  );
  const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Course Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="text-center">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload Thumbnail
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Content Progress</span>
            <span className="font-medium">{completedLessons}/{totalLessons} lessons ready</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <BookOpen className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="font-medium">{course.modules.length}</p>
            <p className="text-muted-foreground text-xs">Modules</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <Play className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="font-medium">{totalLessons}</p>
            <p className="text-muted-foreground text-xs">Lessons</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="font-medium">{Math.round(totalDuration / 60)}h {totalDuration % 60}m</p>
            <p className="text-muted-foreground text-xs">Total Duration</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <DollarSign className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="font-medium">${course.price}</p>
            <p className="text-muted-foreground text-xs">Price</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Publishing Checklist</h4>
          <div className="space-y-1">
            {[
              { label: 'Course thumbnail uploaded', done: !!course.thumbnail },
              { label: 'At least 1 module', done: course.modules.length > 0 },
              { label: 'All lessons have content', done: completedLessons === totalLessons },
              { label: 'Course description filled', done: !!course.description },
              { label: 'Pricing set', done: course.price > 0 },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span className={cn(!item.done && 'text-muted-foreground')}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CourseBuilderPortal({ className }: { className?: string }) {
  const [course, setCourse] = useState<Course>(MOCK_COURSE);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const toggleModule = (moduleId: string) => {
    setCourse(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId ? { ...m, isExpanded: !m.isExpanded } : m
      ),
    }));
  };

  const addModule = () => {
    const newModule: Module = {
      id: `m${Date.now()}`,
      title: 'New Module',
      lessons: [],
      isExpanded: true,
    };
    setCourse(prev => ({
      ...prev,
      modules: [...prev.modules, newModule],
    }));
  };

  const handleAddLesson = (moduleId: string) => {
    setActiveModuleId(moduleId);
    setAddLessonOpen(true);
  };

  const addLesson = (lesson: Partial<Lesson>) => {
    if (!activeModuleId) return;
    
    const newLesson: Lesson = {
      id: `l${Date.now()}`,
      title: lesson.title || 'New Lesson',
      type: lesson.type || 'video',
      isPreview: false,
      isComplete: false,
    };

    setCourse(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === activeModuleId
          ? { ...m, lessons: [...m.lessons, newLesson] }
          : m
      ),
    }));
  };

  const statusConfig = STATUS_CONFIG[course.status];

  return (
    <div className={cn('min-h-screen bg-zinc-50 dark:bg-zinc-950', className)}>
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold">{course.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      statusConfig.color === 'zinc' && 'border-zinc-400',
                      statusConfig.color === 'yellow' && 'border-yellow-400 text-yellow-600',
                      statusConfig.color === 'emerald' && 'border-emerald-400 text-emerald-600',
                      statusConfig.color === 'red' && 'border-red-400 text-red-600'
                    )}
                  >
                    {statusConfig.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Last saved {course.updatedAt.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CourseSettingsSheet course={course} />
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button size="sm">
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Curriculum Editor */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Curriculum</h2>
              <Button onClick={addModule}>
                <Plus className="h-4 w-4 mr-2" />
                Add Module
              </Button>
            </div>

            <div className="space-y-4">
              {course.modules.map((module) => (
                <ModuleSection
                  key={module.id}
                  module={module}
                  onToggle={() => toggleModule(module.id)}
                  onAddLesson={() => handleAddLesson(module.id)}
                  onEditLesson={(lessonId) => console.log('Edit lesson', lessonId)}
                  onDeleteLesson={(lessonId) => console.log('Delete lesson', lessonId)}
                  onEditModule={() => console.log('Edit module', module.id)}
                  onDeleteModule={() => console.log('Delete module', module.id)}
                />
              ))}

              {course.modules.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No modules yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start building your course by adding the first module
                    </p>
                    <Button onClick={addModule}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Module
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <CoursePreviewCard course={course} />

            {/* AI Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium mb-1">Add more practice</p>
                  <p className="text-xs text-muted-foreground">
                    Consider adding quizzes after each module to reinforce learning
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <p className="text-sm font-medium mb-1">Great pacing!</p>
                  <p className="text-xs text-muted-foreground">
                    Your lesson lengths are optimal for student engagement
                  </p>
                </div>
                <Button variant="outline" className="w-full" size="sm">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get More Suggestions
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Lesson Dialog */}
      <AddLessonDialog
        open={addLessonOpen}
        onClose={() => setAddLessonOpen(false)}
        onAdd={addLesson}
      />
    </div>
  );
}

export default CourseBuilderPortal;
