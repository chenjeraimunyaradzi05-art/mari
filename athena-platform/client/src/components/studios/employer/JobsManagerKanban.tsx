'use client';

/**
 * Jobs Manager Kanban
 * Phase 4: Web Client - Persona Studios
 * Step 67: Employer drag-and-drop applicant board
 * 
 * Features:
 * - Kanban columns for application stages
 * - Drag and drop applicants
 * - Applicant cards with key info
 * - Filters and search
 * - Bulk actions
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  Star,
  MapPin,
  Briefcase,
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileText,
  ExternalLink,
  ChevronDown,
  Users,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

// ============================================
// TYPES
// ============================================

type StageId = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

interface Candidate {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  phone?: string;
  location: string;
  currentRole: string;
  currentCompany?: string;
  experience: number;
  education?: string;
  skills: string[];
  matchScore: number;
  appliedAt: Date;
  lastActivity: Date;
  resumeUrl?: string;
  linkedinUrl?: string;
  notes?: string[];
  rating?: number;
  source: 'direct' | 'linkedin' | 'referral' | 'indeed' | 'athena';
}

interface Stage {
  id: StageId;
  name: string;
  color: string;
  candidates: Candidate[];
}

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract';
  postedAt: Date;
  totalApplicants: number;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_JOB: Job = {
  id: '1',
  title: 'Senior Product Manager',
  department: 'Product',
  location: 'San Francisco, CA (Hybrid)',
  type: 'full-time',
  postedAt: new Date(2026, 0, 5),
  totalApplicants: 47,
};

const MOCK_CANDIDATES: Candidate[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    avatar: '/avatars/sarah.jpg',
    email: 'sarah.chen@email.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    currentRole: 'Product Manager',
    currentCompany: 'TechCorp',
    experience: 5,
    education: 'MBA, Stanford University',
    skills: ['Product Strategy', 'Agile', 'User Research', 'SQL', 'Figma'],
    matchScore: 94,
    appliedAt: new Date(2026, 0, 15),
    lastActivity: new Date(2026, 0, 18),
    rating: 5,
    source: 'linkedin',
  },
  {
    id: '2',
    name: 'Alex Thompson',
    avatar: '/avatars/alex.jpg',
    email: 'alex.t@email.com',
    location: 'Austin, TX',
    currentRole: 'Senior Product Owner',
    currentCompany: 'StartupXYZ',
    experience: 7,
    education: 'BS Computer Science, MIT',
    skills: ['Product Management', 'Data Analysis', 'A/B Testing', 'Roadmapping'],
    matchScore: 88,
    appliedAt: new Date(2026, 0, 14),
    lastActivity: new Date(2026, 0, 17),
    rating: 4,
    source: 'direct',
  },
  {
    id: '3',
    name: 'Maria Rodriguez',
    email: 'maria.r@email.com',
    location: 'New York, NY',
    currentRole: 'Product Lead',
    currentCompany: 'BigCo',
    experience: 8,
    skills: ['Product Vision', 'Team Leadership', 'Market Analysis'],
    matchScore: 85,
    appliedAt: new Date(2026, 0, 12),
    lastActivity: new Date(2026, 0, 16),
    source: 'referral',
  },
  {
    id: '4',
    name: 'James Wilson',
    email: 'jwilson@email.com',
    location: 'Seattle, WA',
    currentRole: 'Product Manager',
    experience: 4,
    skills: ['Scrum', 'JIRA', 'Product Discovery'],
    matchScore: 76,
    appliedAt: new Date(2026, 0, 10),
    lastActivity: new Date(2026, 0, 15),
    source: 'indeed',
  },
  {
    id: '5',
    name: 'Emily Park',
    avatar: '/avatars/emily.jpg',
    email: 'emily.park@email.com',
    location: 'Los Angeles, CA',
    currentRole: 'Associate PM',
    experience: 3,
    skills: ['User Stories', 'Prototyping', 'Customer Research'],
    matchScore: 72,
    appliedAt: new Date(2026, 0, 8),
    lastActivity: new Date(2026, 0, 14),
    source: 'athena',
  },
];

const INITIAL_STAGES: Stage[] = [
  {
    id: 'applied',
    name: 'Applied',
    color: 'zinc',
    candidates: MOCK_CANDIDATES.slice(0, 2),
  },
  {
    id: 'screening',
    name: 'Screening',
    color: 'blue',
    candidates: [MOCK_CANDIDATES[2]],
  },
  {
    id: 'interview',
    name: 'Interview',
    color: 'yellow',
    candidates: [MOCK_CANDIDATES[3]],
  },
  {
    id: 'offer',
    name: 'Offer',
    color: 'purple',
    candidates: [],
  },
  {
    id: 'hired',
    name: 'Hired',
    color: 'emerald',
    candidates: [],
  },
  {
    id: 'rejected',
    name: 'Rejected',
    color: 'red',
    candidates: [MOCK_CANDIDATES[4]],
  },
];

// ============================================
// CONFIG
// ============================================

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  indeed: 'Indeed',
  athena: 'Athena',
};

// ============================================
// COMPONENTS
// ============================================

function CandidateCard({
  candidate,
  onDragStart,
  onView,
}: {
  candidate: Candidate;
  onDragStart: (e: React.DragEvent, candidate: Candidate) => void;
  onView: () => void;
}) {
  return (
    <Card
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      draggable
      onDragStart={(e) => onDragStart(e, candidate)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={candidate.avatar} alt={candidate.name} />
              <AvatarFallback>
                {candidate.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{candidate.name}</p>
              <p className="text-sm text-muted-foreground">{candidate.currentRole}</p>
            </div>
          </div>
          <div className={cn(
            'px-2 py-1 rounded text-xs font-medium',
            candidate.matchScore >= 90 && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            candidate.matchScore >= 75 && candidate.matchScore < 90 && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            candidate.matchScore < 75 && 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
          )}>
            {candidate.matchScore}% match
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {candidate.location}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />
            {candidate.experience} years experience
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {candidate.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs">
              {skill}
            </Badge>
          ))}
          {candidate.skills.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{candidate.skills.length - 3}
            </Badge>
          )}
        </div>

        <Separator className="my-3" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {candidate.rating && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-3 w-3',
                      star <= candidate.rating!
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-zinc-300'
                    )}
                  />
                ))}
              </div>
            )}
            <Badge variant="outline" className="text-xs">
              {SOURCE_LABELS[candidate.source]}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Mail className="h-4 w-4 mr-2" />
                  Send email
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule interview
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add note
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <FileText className="h-4 w-4 mr-2" />
                  View resume
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  LinkedIn profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  stage,
  onDragOver,
  onDrop,
  onDragStart,
  onViewCandidate,
}: {
  stage: Stage;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stageId: StageId) => void;
  onDragStart: (e: React.DragEvent, candidate: Candidate) => void;
  onViewCandidate: (candidate: Candidate) => void;
}) {
  return (
    <div
      className="flex-shrink-0 w-80 flex flex-col bg-zinc-50 dark:bg-zinc-900/50 rounded-lg"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-3 h-3 rounded-full',
              stage.color === 'zinc' && 'bg-zinc-400',
              stage.color === 'blue' && 'bg-blue-500',
              stage.color === 'yellow' && 'bg-yellow-500',
              stage.color === 'purple' && 'bg-purple-500',
              stage.color === 'emerald' && 'bg-emerald-500',
              stage.color === 'red' && 'bg-red-500'
            )} />
            <h3 className="font-medium">{stage.name}</h3>
            <Badge variant="secondary" className="text-xs">
              {stage.candidates.length}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {stage.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onDragStart={onDragStart}
              onView={() => onViewCandidate(candidate)}
            />
          ))}
          {stage.candidates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Drop candidates here
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CandidateDetailSheet({
  candidate,
  open,
  onClose,
}: {
  candidate: Candidate | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!candidate) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={candidate.avatar} alt={candidate.name} />
              <AvatarFallback className="text-xl">
                {candidate.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle>{candidate.name}</SheetTitle>
              <SheetDescription>
                {candidate.currentRole}
                {candidate.currentCompany && ` at ${candidate.currentCompany}`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Match Score */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">AI Match Score</span>
              <span className={cn(
                'text-2xl font-bold',
                candidate.matchScore >= 90 && 'text-emerald-600',
                candidate.matchScore >= 75 && candidate.matchScore < 90 && 'text-blue-600',
                candidate.matchScore < 75 && 'text-zinc-600'
              )}>
                {candidate.matchScore}%
              </span>
            </div>
            <Progress value={candidate.matchScore} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Based on skills, experience, and job requirements
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button className="flex-1">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Interview
            </Button>
            <Button variant="outline" className="flex-1">
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
              <TabsTrigger value="resume" className="flex-1">Resume</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Contact Info */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Contact Information</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {candidate.email}
                  </div>
                  {candidate.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {candidate.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {candidate.location}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Experience */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Experience</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    {candidate.experience} years total experience
                  </div>
                  {candidate.education && (
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      {candidate.education}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Skills */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Application Details */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Application Details</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Applied</span>
                    <span>{candidate.appliedAt.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Activity</span>
                    <span>{candidate.lastActivity.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Source</span>
                    <Badge variant="outline">{SOURCE_LABELS[candidate.source]}</Badge>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="resume" className="mt-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Resume preview</p>
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Full Resume
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <div className="space-y-4">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Interview Note</span>
                    <span className="text-xs text-muted-foreground">Jan 16, 2026</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Strong communication skills. Has relevant experience in B2B SaaS.
                    Schedule technical interview next.
                  </p>
                </div>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Rating */}
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm font-medium">Your Rating</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} className="p-1">
                  <Star
                    className={cn(
                      'h-5 w-5',
                      star <= (candidate.rating || 0)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-zinc-300'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Decision Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700">
              <ThumbsDown className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              <ThumbsUp className="h-4 w-4 mr-2" />
              Move Forward
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function JobSelector({ job, jobs }: { job: Job; jobs: Job[] }) {
  return (
    <Select defaultValue={job.id}>
      <SelectTrigger className="w-[300px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {jobs.map((j) => (
          <SelectItem key={j.id} value={j.id}>
            <div className="flex items-center gap-2">
              <span className="font-medium">{j.title}</span>
              <Badge variant="secondary" className="text-xs">
                {j.totalApplicants}
              </Badge>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function JobsManagerKanban({ className }: { className?: string }) {
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null);

  const handleDragStart = (e: React.DragEvent, candidate: Candidate) => {
    setDraggedCandidate(candidate);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStageId: StageId) => {
    e.preventDefault();
    
    if (!draggedCandidate) return;

    setStages(currentStages => {
      return currentStages.map(stage => {
        // Remove candidate from original stage
        const filteredCandidates = stage.candidates.filter(
          c => c.id !== draggedCandidate.id
        );

        // Add candidate to target stage
        if (stage.id === targetStageId) {
          return {
            ...stage,
            candidates: [...filteredCandidates, draggedCandidate],
          };
        }

        return { ...stage, candidates: filteredCandidates };
      });
    });

    setDraggedCandidate(null);
  };

  const handleViewCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setDetailOpen(true);
  };

  const totalCandidates = stages.reduce((sum, s) => sum + s.candidates.length, 0);

  return (
    <div className={cn('h-screen flex flex-col', className)}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <JobSelector job={MOCK_JOB} jobs={[MOCK_JOB]} />
            <Badge variant="outline" className="text-muted-foreground">
              <Users className="h-3 w-3 mr-1" />
              {totalCandidates} candidates
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Archive className="h-4 w-4 mr-2" />
              Bulk Actions
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Candidate
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="athena">Athena</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Match Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="90+">90%+ Match</SelectItem>
              <SelectItem value="75+">75%+ Match</SelectItem>
              <SelectItem value="50+">50%+ Match</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onViewCandidate={handleViewCandidate}
            />
          ))}
        </div>
      </div>

      {/* Candidate Detail Sheet */}
      <CandidateDetailSheet
        candidate={selectedCandidate}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}

export default JobsManagerKanban;
