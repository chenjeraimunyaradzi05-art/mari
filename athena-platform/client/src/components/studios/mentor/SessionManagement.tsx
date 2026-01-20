'use client';

/**
 * Session Management UI
 * Phase 4: Web Client - Persona Studios
 * Step 65: Interface for video calls with mentees
 * 
 * Features:
 * - Pre-session lobby
 * - Video/audio controls
 * - Screen sharing
 * - Session notes
 * - Recording controls
 * - Post-session summary
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Monitor,
  MessageSquare,
  Users,
  Settings,
  Maximize2,
  Minimize2,
  Clock,
  FileText,
  Star,
  Send,
  MoreVertical,
  Circle,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Pause,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// ============================================
// TYPES
// ============================================

type SessionState = 'lobby' | 'in-progress' | 'ended';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  role: 'mentor' | 'mentee';
  isVideoOn: boolean;
  isAudioOn: boolean;
  isScreenSharing: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor';
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
}

interface SessionDetails {
  id: string;
  topic: string;
  scheduledStart: Date;
  duration: number;
  price: number;
  mentee: {
    id: string;
    name: string;
    avatar?: string;
    bio?: string;
    goals?: string[];
  };
  agenda?: string[];
  previousNotes?: string;
}

interface SessionManagementProps {
  session: SessionDetails;
  className?: string;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_SESSION: SessionDetails = {
  id: '1',
  topic: 'Career Transition Strategy',
  scheduledStart: new Date(2026, 0, 19, 14, 0),
  duration: 60,
  price: 150,
  mentee: {
    id: 'u1',
    name: 'Alex Thompson',
    avatar: '/avatars/alex.jpg',
    bio: 'Product manager with 5 years experience looking to transition into tech leadership.',
    goals: [
      'Develop leadership skills',
      'Build technical credibility',
      'Expand professional network',
    ],
  },
  agenda: [
    'Review progress from last session',
    'Discuss leadership opportunities at current company',
    'Create action plan for next month',
  ],
  previousNotes: 'Alex is making good progress on the technical reading list. Still needs to work on visibility within the organization.',
};

// ============================================
// COMPONENTS
// ============================================

function SessionTimer({ startTime, duration }: { startTime?: Date; duration: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setElapsed(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const remaining = duration * 60 - elapsed;
  const progress = (elapsed / (duration * 60)) * 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isOvertime = remaining < 0;

  return (
    <div className="flex items-center gap-2">
      <Clock className={cn('h-4 w-4', isOvertime && 'text-red-500')} />
      <span className={cn('font-mono', isOvertime && 'text-red-500')}>
        {isOvertime ? '-' : ''}{formatTime(remaining)}
      </span>
      <Progress
        value={Math.min(progress, 100)}
        className={cn('w-20 h-1.5', isOvertime && '[&>div]:bg-red-500')}
      />
    </div>
  );
}

function LobbyView({
  session,
  participant,
  onJoin,
  onToggleVideo,
  onToggleAudio,
}: {
  session: SessionDetails;
  participant: Participant;
  onJoin: () => void;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(`https://athena.app/session/${session.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Ready to join?</CardTitle>
          <CardDescription>{session.topic}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preview */}
          <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden">
            {participant.isVideoOn ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={participant.avatar} />
                  <AvatarFallback className="text-3xl">You</AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Avatar className="h-24 w-24 bg-zinc-800">
                  <AvatarFallback className="text-3xl text-zinc-400">
                    {participant.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={participant.isAudioOn ? 'secondary' : 'destructive'}
                      size="icon"
                      className="rounded-full"
                      onClick={onToggleAudio}
                    >
                      {participant.isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {participant.isAudioOn ? 'Mute' : 'Unmute'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={participant.isVideoOn ? 'secondary' : 'destructive'}
                      size="icon"
                      className="rounded-full"
                      onClick={onToggleVideo}
                    >
                      {participant.isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {participant.isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Session Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
              <Avatar>
                <AvatarImage src={session.mentee.avatar} alt={session.mentee.name} />
                <AvatarFallback>
                  {session.mentee.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{session.mentee.name}</p>
                <p className="text-sm text-muted-foreground">Waiting in lobby...</p>
              </div>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{session.duration} minutes</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Scheduled</span>
                <span className="font-medium">
                  {session.scheduledStart.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Share Link */}
          <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <Input
              value={`https://athena.app/session/${session.id}`}
              readOnly
              className="text-sm"
            />
            <Button variant="outline" size="icon" onClick={copyLink}>
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* Join Button */}
          <Button className="w-full" size="lg" onClick={onJoin}>
            <Video className="h-5 w-5 mr-2" />
            Join Session
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InSessionView({
  session,
  participants,
  isRecording,
  onEndSession,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onToggleRecording,
}: {
  session: SessionDetails;
  participants: Participant[];
  isRecording: boolean;
  onEndSession: () => void;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
}) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [sessionStartTime] = useState(new Date());

  const currentUser = participants.find(p => p.role === 'mentor')!;
  const otherParticipant = participants.find(p => p.role !== 'mentor')!;

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    setMessages([
      ...messages,
      {
        id: crypto.randomUUID(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        text: newMessage,
        timestamp: new Date(),
      },
    ]);
    setNewMessage('');
  };

  return (
    <div className={cn(
      'h-screen flex flex-col bg-zinc-950',
      isFullscreen && 'fixed inset-0 z-50'
    )}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900">
        <div className="flex items-center gap-4">
          <h1 className="font-medium text-white">{session.topic}</h1>
          {isRecording && (
            <Badge className="bg-red-600 text-white gap-1">
              <Circle className="h-2 w-2 fill-current animate-pulse" />
              Recording
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <SessionTimer startTime={sessionStartTime} duration={session.duration} />
          <Badge variant="outline" className="text-emerald-400 border-emerald-400">
            <Users className="h-3 w-3 mr-1" />
            {participants.length}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Area */}
        <div className="flex-1 p-4 grid grid-cols-2 gap-4">
          {participants.map((p) => (
            <div
              key={p.id}
              className={cn(
                'relative bg-zinc-900 rounded-lg overflow-hidden',
                p.isScreenSharing && 'col-span-2'
              )}
            >
              {p.isVideoOn ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                  <Avatar className="h-32 w-32">
                    <AvatarImage src={p.avatar} />
                    <AvatarFallback className="text-4xl">
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <Avatar className="h-32 w-32">
                    <AvatarFallback className="text-4xl bg-zinc-800 text-zinc-400">
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}

              {/* Participant Info */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg">
                <span className="text-sm text-white font-medium">{p.name}</span>
                {!p.isAudioOn && <MicOff className="h-4 w-4 text-red-400" />}
              </div>

              {/* Connection Quality */}
              <div className="absolute top-4 right-4">
                <div className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1 rounded-full',
                  p.connectionQuality === 'excellent' && 'bg-emerald-500/20 text-emerald-400',
                  p.connectionQuality === 'good' && 'bg-yellow-500/20 text-yellow-400',
                  p.connectionQuality === 'poor' && 'bg-red-500/20 text-red-400'
                )}>
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    p.connectionQuality === 'excellent' && 'bg-emerald-400',
                    p.connectionQuality === 'good' && 'bg-yellow-400',
                    p.connectionQuality === 'poor' && 'bg-red-400'
                  )} />
                  {p.connectionQuality}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Side Panel (Chat/Notes) */}
        {(isChatOpen || isNotesOpen) && (
          <div className="w-80 bg-zinc-900 border-l border-zinc-800">
            <Tabs defaultValue={isChatOpen ? 'chat' : 'notes'} className="h-full flex flex-col">
              <TabsList className="mx-4 mt-4">
                <TabsTrigger value="chat" onClick={() => { setIsChatOpen(true); setIsNotesOpen(false); }}>
                  Chat
                </TabsTrigger>
                <TabsTrigger value="notes" onClick={() => { setIsNotesOpen(true); setIsChatOpen(false); }}>
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex-1 flex flex-col p-4 pt-2">
                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'p-2 rounded-lg',
                          msg.senderId === currentUser.id
                            ? 'bg-emerald-600 text-white ml-8'
                            : 'bg-zinc-800 text-white mr-8'
                        )}
                      >
                        <p className="text-xs opacity-75 mb-1">{msg.senderName}</p>
                        <p className="text-sm">{msg.text}</p>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <p className="text-center text-zinc-500 text-sm py-8">
                        No messages yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 mt-4">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                  <Button size="icon" onClick={sendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="flex-1 p-4 pt-2">
                <Textarea
                  placeholder="Take session notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-full resize-none bg-zinc-800 border-zinc-700 text-white"
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-center gap-2 px-4 py-4 bg-zinc-900">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentUser.isAudioOn ? 'secondary' : 'destructive'}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={onToggleAudio}
              >
                {currentUser.isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {currentUser.isAudioOn ? 'Mute (M)' : 'Unmute (M)'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentUser.isVideoOn ? 'secondary' : 'destructive'}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={onToggleVideo}
              >
                {currentUser.isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {currentUser.isVideoOn ? 'Turn off camera (V)' : 'Turn on camera (V)'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentUser.isScreenSharing ? 'default' : 'secondary'}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={onToggleScreenShare}
              >
                <Monitor className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share screen (S)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-8 bg-zinc-700" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isChatOpen ? 'default' : 'secondary'}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={() => setIsChatOpen(!isChatOpen)}
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chat (C)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isNotesOpen ? 'default' : 'secondary'}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={() => setIsNotesOpen(!isNotesOpen)}
              >
                <FileText className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notes (N)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isRecording ? 'destructive' : 'secondary'}
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={onToggleRecording}
              >
                <Circle className={cn('h-5 w-5', isRecording && 'fill-current')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isRecording ? 'Stop recording (R)' : 'Start recording (R)'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-8 bg-zinc-700" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full h-12 w-12"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full h-12 w-12">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new window
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-500">
              <AlertCircle className="h-4 w-4 mr-2" />
              Report issue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-8 bg-zinc-700" />

        <Button
          variant="destructive"
          className="rounded-full px-6"
          onClick={onEndSession}
        >
          <PhoneOff className="h-5 w-5 mr-2" />
          End Session
        </Button>
      </div>
    </div>
  );
}

function PostSessionView({
  session,
  onComplete,
}: {
  session: SessionDetails;
  onComplete: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [notes, setNotes] = useState('');
  const [actionItems, setActionItems] = useState(['']);

  const addActionItem = () => {
    setActionItems([...actionItems, '']);
  };

  const updateActionItem = (index: number, value: string) => {
    const updated = [...actionItems];
    updated[index] = value;
    setActionItems(updated);
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle>Session Complete!</CardTitle>
            <CardDescription>
              Your session with {session.mentee.name} has ended
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">60</p>
                <p className="text-sm text-muted-foreground">Minutes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">${session.price}</p>
                <p className="text-sm text-muted-foreground">Earned</p>
              </div>
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session Summary</CardTitle>
            <CardDescription>Document what was covered and next steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Session Notes</Label>
              <Textarea
                placeholder="What was discussed during the session..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Action Items for Mentee</Label>
              {actionItems.map((item, index) => (
                <Input
                  key={index}
                  placeholder={`Action item ${index + 1}`}
                  value={item}
                  onChange={(e) => updateActionItem(index, e.target.value)}
                />
              ))}
              <Button variant="outline" size="sm" onClick={addActionItem}>
                Add action item
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rate This Session</CardTitle>
            <CardDescription>How would you rate your experience?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      'h-8 w-8 transition-colors',
                      star <= rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-zinc-300 dark:text-zinc-600'
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Additional Feedback (Optional)</Label>
              <Textarea
                placeholder="Any thoughts about the session..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1">
            Skip for now
          </Button>
          <Button className="flex-1" onClick={onComplete}>
            Complete & Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SessionManagement({ session = MOCK_SESSION, className }: SessionManagementProps) {
  const [sessionState, setSessionState] = useState<SessionState>('lobby');
  const [isRecording, setIsRecording] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 'mentor-1',
      name: 'You',
      role: 'mentor',
      isVideoOn: true,
      isAudioOn: true,
      isScreenSharing: false,
      connectionQuality: 'excellent',
    },
    {
      id: session.mentee.id,
      name: session.mentee.name,
      avatar: session.mentee.avatar,
      role: 'mentee',
      isVideoOn: true,
      isAudioOn: true,
      isScreenSharing: false,
      connectionQuality: 'good',
    },
  ]);

  const currentUser = participants.find(p => p.role === 'mentor')!;

  const updateCurrentUser = (updates: Partial<Participant>) => {
    setParticipants(participants.map(p =>
      p.role === 'mentor' ? { ...p, ...updates } : p
    ));
  };

  const handleJoin = () => setSessionState('in-progress');
  const handleEndSession = () => setSessionState('ended');
  const handleComplete = () => {
    // Navigate back to calendar or dashboard
    console.log('Session completed');
  };

  if (sessionState === 'lobby') {
    return (
      <LobbyView
        session={session}
        participant={currentUser}
        onJoin={handleJoin}
        onToggleVideo={() => updateCurrentUser({ isVideoOn: !currentUser.isVideoOn })}
        onToggleAudio={() => updateCurrentUser({ isAudioOn: !currentUser.isAudioOn })}
      />
    );
  }

  if (sessionState === 'in-progress') {
    return (
      <InSessionView
        session={session}
        participants={participants}
        isRecording={isRecording}
        onEndSession={handleEndSession}
        onToggleVideo={() => updateCurrentUser({ isVideoOn: !currentUser.isVideoOn })}
        onToggleAudio={() => updateCurrentUser({ isAudioOn: !currentUser.isAudioOn })}
        onToggleScreenShare={() => updateCurrentUser({ isScreenSharing: !currentUser.isScreenSharing })}
        onToggleRecording={() => setIsRecording(!isRecording)}
      />
    );
  }

  return (
    <PostSessionView
      session={session}
      onComplete={handleComplete}
    />
  );
}

export default SessionManagement;
