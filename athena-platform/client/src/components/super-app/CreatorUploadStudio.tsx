'use client';

/**
 * Creator Upload Studio - Video upload with trimming/metadata
 * Phase 3: Web Client - Super App Core
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/ui.store';
import {
  Upload,
  Video,
  Image as ImageIcon,
  Music,
  Hash,
  AtSign,
  MapPin,
  Settings,
  Eye,
  EyeOff,
  Globe,
  Users,
  Lock,
  X,
  Scissors,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';

type UploadStep = 'select' | 'edit' | 'details' | 'uploading' | 'complete';
type Visibility = 'public' | 'connections' | 'private';

interface UploadState {
  file: File | null;
  preview: string;
  thumbnail: string;
  trimStart: number;
  trimEnd: number;
  duration: number;
  title: string;
  description: string;
  hashtags: string[];
  mentions: string[];
  location: string;
  visibility: Visibility;
  allowComments: boolean;
  allowDuets: boolean;
  scheduleTime: Date | null;
  category: string;
}

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_VIDEO_DURATION = 180; // 3 minutes
const CATEGORIES = [
  'Career Tips',
  'Industry Insights',
  'Day in My Life',
  'Tutorial',
  'Interview',
  'Networking',
  'Job Search',
  'Skills',
  'Motivation',
  'Other',
];

export function CreatorUploadStudio() {
  const [step, setStep] = useState<UploadStep>('select');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hashtagInput, setHashtagInput] = useState('');

  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    preview: '',
    thumbnail: '',
    trimStart: 0,
    trimEnd: 0,
    duration: 0,
    title: '',
    description: '',
    hashtags: [],
    mentions: [],
    location: '',
    visibility: 'public',
    allowComments: true,
    allowDuets: true,
    scheduleTime: null,
    category: '',
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useUIStore();

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (uploadState.preview) {
        URL.revokeObjectURL(uploadState.preview);
      }
    };
  }, [uploadState.preview]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('video/')) {
        addToast('Please select a video file', 'error');
        return;
      }

      // Validate file size
      if (file.size > MAX_VIDEO_SIZE) {
        addToast('Video must be under 500MB', 'error');
        return;
      }

      const preview = URL.createObjectURL(file);
      
      // Get video duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = video.duration;
        
        if (duration > MAX_VIDEO_DURATION) {
          addToast(`Video must be under ${MAX_VIDEO_DURATION} seconds`, 'error');
          URL.revokeObjectURL(preview);
          return;
        }

        setUploadState((prev) => ({
          ...prev,
          file,
          preview,
          duration,
          trimEnd: duration,
        }));
        setStep('edit');
      };
      video.src = preview;
    },
    [addToast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        const fakeEvent = {
          target: { files: [file] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileSelect(fakeEvent);
      }
    },
    [handleFileSelect]
  );

  const handleTrimChange = useCallback((values: number[]) => {
    setUploadState((prev) => ({
      ...prev,
      trimStart: values[0],
      trimEnd: values[1],
    }));
  }, []);

  const handleAddHashtag = useCallback(() => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (tag && !uploadState.hashtags.includes(tag) && uploadState.hashtags.length < 10) {
      setUploadState((prev) => ({
        ...prev,
        hashtags: [...prev.hashtags, tag],
      }));
      setHashtagInput('');
    }
  }, [hashtagInput, uploadState.hashtags]);

  const handleRemoveHashtag = useCallback((tag: string) => {
    setUploadState((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((t) => t !== tag),
    }));
  }, []);

  const handleUpload = useCallback(async () => {
    if (!uploadState.file) return;

    setStep('uploading');
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('video', uploadState.file);
      formData.append('title', uploadState.title);
      formData.append('description', uploadState.description);
      formData.append('hashtags', JSON.stringify(uploadState.hashtags));
      formData.append('mentions', JSON.stringify(uploadState.mentions));
      formData.append('location', uploadState.location);
      formData.append('visibility', uploadState.visibility);
      formData.append('allowComments', String(uploadState.allowComments));
      formData.append('allowDuets', String(uploadState.allowDuets));
      formData.append('category', uploadState.category);
      formData.append('trimStart', String(uploadState.trimStart));
      formData.append('trimEnd', String(uploadState.trimEnd));

      if (uploadState.scheduleTime) {
        formData.append('scheduledAt', uploadState.scheduleTime.toISOString());
      }

      await api.post('/video/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      setStep('complete');
      addToast('Video uploaded successfully!', 'success');
    } catch (error: any) {
      setUploadError(error.message || 'Upload failed');
      setStep('details');
      addToast('Failed to upload video', 'error');
    }
  }, [uploadState, addToast]);

  const resetUpload = useCallback(() => {
    if (uploadState.preview) {
      URL.revokeObjectURL(uploadState.preview);
    }
    setUploadState({
      file: null,
      preview: '',
      thumbnail: '',
      trimStart: 0,
      trimEnd: 0,
      duration: 0,
      title: '',
      description: '',
      hashtags: [],
      mentions: [],
      location: '',
      visibility: 'public',
      allowComments: true,
      allowDuets: true,
      scheduleTime: null,
      category: '',
    });
    setStep('select');
    setUploadProgress(0);
    setUploadError(null);
  }, [uploadState.preview]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Step: Select File */}
      {step === 'select' && (
        <div
          className={cn(
            'border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12',
            'hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
            'transition-colors cursor-pointer text-center'
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Upload className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          
          <h2 className="text-xl font-semibold mb-2">Upload Video</h2>
          <p className="text-zinc-500 mb-4">
            Drag and drop or click to select
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 text-sm text-zinc-400">
            <span className="flex items-center gap-1">
              <Video className="h-4 w-4" />
              MP4, WebM, MOV
            </span>
            <span className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              Max 500MB
            </span>
            <span className="flex items-center gap-1">
              <Scissors className="h-4 w-4" />
              Up to 3 minutes
            </span>
          </div>
        </div>
      )}

      {/* Step: Edit/Trim */}
      {step === 'edit' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Edit Video</h2>
            <Button variant="outline" onClick={resetUpload}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>

          {/* Video Preview */}
          <div className="relative aspect-[9/16] max-h-[60vh] mx-auto rounded-xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={uploadState.preview}
              className="w-full h-full object-contain"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => setIsPlaying(false)}
              muted={isMuted}
            />
            
            {/* Video Controls */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white"
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) {
                        videoRef.current.pause();
                      } else {
                        videoRef.current.play();
                      }
                      setIsPlaying(!isPlaying);
                    }
                  }}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
                
                <span className="text-sm text-white font-mono">
                  {formatTime(currentTime)} / {formatTime(uploadState.duration)}
                </span>
                
                <div className="flex-1" />
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
              </div>

              {/* Trim Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white">
                  <span>Trim: {formatTime(uploadState.trimStart)}</span>
                  <span>{formatTime(uploadState.trimEnd)}</span>
                </div>
                <Slider
                  value={[uploadState.trimStart, uploadState.trimEnd]}
                  min={0}
                  max={uploadState.duration}
                  step={0.1}
                  onValueChange={handleTrimChange}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep('select')}>
              Back
            </Button>
            <Button onClick={() => setStep('details')}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Video Details</h2>
            <Button variant="outline" onClick={resetUpload}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Preview */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <div className="aspect-[9/16] rounded-xl overflow-hidden bg-black">
                  <video
                    src={uploadState.preview}
                    className="w-full h-full object-contain"
                    muted
                    loop
                    autoPlay
                  />
                </div>
                <p className="text-sm text-zinc-500 mt-2 text-center">
                  Duration: {formatTime(uploadState.trimEnd - uploadState.trimStart)}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Add a title for your video..."
                  value={uploadState.title}
                  onChange={(e) =>
                    setUploadState((prev) => ({ ...prev, title: e.target.value }))
                  }
                  maxLength={100}
                />
                <p className="text-xs text-zinc-500 text-right">
                  {uploadState.title.length}/100
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your video..."
                  value={uploadState.description}
                  onChange={(e) =>
                    setUploadState((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  maxLength={2000}
                  rows={4}
                />
                <p className="text-xs text-zinc-500 text-right">
                  {uploadState.description.length}/2000
                </p>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={uploadState.category}
                  onValueChange={(value) =>
                    setUploadState((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hashtags */}
              <div className="space-y-2">
                <Label>Hashtags</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      placeholder="Add hashtag..."
                      value={hashtagInput}
                      onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddHashtag();
                        }
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" onClick={handleAddHashtag}>
                    Add
                  </Button>
                </div>
                {uploadState.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {uploadState.hashtags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1"
                      >
                        #{tag}
                        <button
                          onClick={() => handleRemoveHashtag(tag)}
                          className="hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>Location (optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder="Add location..."
                    value={uploadState.location}
                    onChange={(e) =>
                      setUploadState((prev) => ({ ...prev, location: e.target.value }))
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <Label>Who can see this?</Label>
                <Select
                  value={uploadState.visibility}
                  onValueChange={(value: Visibility) =>
                    setUploadState((prev) => ({ ...prev, visibility: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Public - Anyone can view
                      </div>
                    </SelectItem>
                    <SelectItem value="connections">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Connections - Only your connections
                      </div>
                    </SelectItem>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Private - Only you
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Settings */}
              <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Comments</Label>
                    <p className="text-xs text-zinc-500">
                      Let others comment on this video
                    </p>
                  </div>
                  <Switch
                    checked={uploadState.allowComments}
                    onCheckedChange={(checked) =>
                      setUploadState((prev) => ({ ...prev, allowComments: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Duets</Label>
                    <p className="text-xs text-zinc-500">
                      Let others create duet videos
                    </p>
                  </div>
                  <Switch
                    checked={uploadState.allowDuets}
                    onCheckedChange={(checked) =>
                      setUploadState((prev) => ({ ...prev, allowDuets: checked }))
                    }
                  />
                </div>
              </div>

              {/* Error message */}
              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm">{uploadError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep('edit')}>
                  Back
                </Button>
                <Button onClick={handleUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Video
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Uploading */}
      {step === 'uploading' && (
        <div className="text-center py-12">
          <Loader2 className="h-16 w-16 mx-auto mb-6 text-emerald-500 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Uploading Video</h2>
          <p className="text-zinc-500 mb-6">Please wait while we upload your video...</p>
          
          <div className="max-w-md mx-auto">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-sm text-zinc-500 mt-2">{uploadProgress}% complete</p>
          </div>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Upload Complete!</h2>
          <p className="text-zinc-500 mb-6">
            Your video is being processed and will be available shortly.
          </p>
          
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={resetUpload}>
              Upload Another
            </Button>
            <Button onClick={() => window.location.href = '/profile'}>
              View Profile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreatorUploadStudio;
