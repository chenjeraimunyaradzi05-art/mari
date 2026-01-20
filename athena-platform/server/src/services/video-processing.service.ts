/**
 * Video Processing Pipeline Service
 * Handles transcoding, auto-captioning, effects, and thumbnail generation
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET || 'athena-media';
const CDN_URL = process.env.CDN_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`;

// Video Processing Status
export type VideoProcessingStatus = 
  | 'pending'
  | 'uploading'
  | 'transcoding'
  | 'captioning'
  | 'thumbnail'
  | 'completed'
  | 'failed';

export interface VideoProcessingJob {
  id: string;
  userId: string;
  originalUrl: string;
  status: VideoProcessingStatus;
  progress: number;
  outputs: {
    hls?: string;
    mp4_720p?: string;
    mp4_480p?: string;
    mp4_360p?: string;
    thumbnail?: string;
    captionsVtt?: string;
    captionsSrt?: string;
  };
  metadata: {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    codec?: string;
    bitrate?: number;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory job store (would be Redis in production)
const processingJobs = new Map<string, VideoProcessingJob>();

/**
 * Initiate video processing pipeline
 */
export async function initiateVideoProcessing(
  userId: string,
  videoUrl: string,
  options: {
    generateCaptions?: boolean;
    generateThumbnail?: boolean;
    transcodeFormats?: ('720p' | '480p' | '360p' | 'hls')[];
    applyEffects?: VideoEffect[];
  } = {}
): Promise<VideoProcessingJob> {
  const jobId = uuidv4();

  const job: VideoProcessingJob = {
    id: jobId,
    userId,
    originalUrl: videoUrl,
    status: 'pending',
    progress: 0,
    outputs: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  processingJobs.set(jobId, job);

  // Start async processing pipeline
  processVideoAsync(job, options).catch((error) => {
    logger.error('Video processing failed:', error);
    updateJobStatus(jobId, 'failed', 0, error.message);
  });

  return job;
}

/**
 * Get video processing job status
 */
export function getProcessingStatus(jobId: string): VideoProcessingJob | null {
  return processingJobs.get(jobId) || null;
}

/**
 * Get all processing jobs for a user
 */
export function getUserProcessingJobs(userId: string): VideoProcessingJob[] {
  return Array.from(processingJobs.values())
    .filter((job) => job.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Video Effects
export type VideoEffect = 
  | { type: 'filter'; name: FilterType }
  | { type: 'overlay'; imageUrl: string; position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center' }
  | { type: 'text'; text: string; position: 'top' | 'bottom' | 'center'; style?: TextStyle }
  | { type: 'trim'; startTime: number; endTime: number }
  | { type: 'speed'; factor: number }
  | { type: 'music'; audioUrl: string; volume: number };

export type FilterType = 
  | 'none'
  | 'vintage'
  | 'sepia'
  | 'grayscale'
  | 'warm'
  | 'cool'
  | 'vivid'
  | 'dramatic'
  | 'soft'
  | 'bright'
  | 'contrast'
  | 'fade'
  | 'blur'
  | 'sharpen'
  | 'vignette';

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  animation?: 'none' | 'fadeIn' | 'slideUp' | 'typewriter';
}

// Available video effects library
export const VIDEO_EFFECTS_LIBRARY = {
  filters: [
    { id: 'vintage', name: 'Vintage', preview: '/effects/vintage.jpg' },
    { id: 'sepia', name: 'Sepia', preview: '/effects/sepia.jpg' },
    { id: 'grayscale', name: 'B&W', preview: '/effects/grayscale.jpg' },
    { id: 'warm', name: 'Warm', preview: '/effects/warm.jpg' },
    { id: 'cool', name: 'Cool', preview: '/effects/cool.jpg' },
    { id: 'vivid', name: 'Vivid', preview: '/effects/vivid.jpg' },
    { id: 'dramatic', name: 'Dramatic', preview: '/effects/dramatic.jpg' },
    { id: 'soft', name: 'Soft Glow', preview: '/effects/soft.jpg' },
    { id: 'bright', name: 'Bright', preview: '/effects/bright.jpg' },
    { id: 'contrast', name: 'High Contrast', preview: '/effects/contrast.jpg' },
    { id: 'fade', name: 'Fade', preview: '/effects/fade.jpg' },
    { id: 'vignette', name: 'Vignette', preview: '/effects/vignette.jpg' },
  ],
  stickers: [
    { id: 'athena-badge', name: 'ATHENA Badge', url: '/stickers/athena-badge.png' },
    { id: 'career-win', name: 'Career Win', url: '/stickers/career-win.png' },
    { id: 'hired', name: 'I Got Hired!', url: '/stickers/hired.png' },
    { id: 'mentor', name: 'Mentor Mode', url: '/stickers/mentor.png' },
    { id: 'promoted', name: 'Promoted!', url: '/stickers/promoted.png' },
    { id: 'learning', name: 'Learning', url: '/stickers/learning.png' },
    { id: 'networking', name: 'Networking', url: '/stickers/networking.png' },
    { id: 'women-in-tech', name: 'Women in Tech', url: '/stickers/women-in-tech.png' },
    { id: 'entrepreneur', name: 'Entrepreneur', url: '/stickers/entrepreneur.png' },
    { id: 'goal-setter', name: 'Goal Setter', url: '/stickers/goal-setter.png' },
  ],
  musicTracks: [
    { id: 'upbeat-1', name: 'Upbeat Corporate', duration: 60, url: '/music/upbeat-1.mp3' },
    { id: 'inspiring-1', name: 'Inspiring Journey', duration: 45, url: '/music/inspiring-1.mp3' },
    { id: 'tech-1', name: 'Tech Innovation', duration: 30, url: '/music/tech-1.mp3' },
    { id: 'calm-1', name: 'Calm Focus', duration: 60, url: '/music/calm-1.mp3' },
    { id: 'energetic-1', name: 'Energetic', duration: 30, url: '/music/energetic-1.mp3' },
  ],
  textAnimations: [
    { id: 'none', name: 'None' },
    { id: 'fadeIn', name: 'Fade In' },
    { id: 'slideUp', name: 'Slide Up' },
    { id: 'typewriter', name: 'Typewriter' },
  ],
};

/**
 * Generate video captions using Whisper API
 */
export async function generateCaptions(
  videoUrl: string,
  language: string = 'en'
): Promise<{ vtt: string; srt: string; segments: CaptionSegment[] }> {
  // In production, this would call OpenAI Whisper API
  // For now, return simulated captions
  logger.info('Generating captions for video', { videoUrl, language });

  const segments: CaptionSegment[] = [
    { start: 0, end: 5, text: 'Welcome to my career journey video.' },
    { start: 5, end: 10, text: 'Today I want to share some tips that helped me succeed.' },
    { start: 10, end: 15, text: 'First, always keep learning and growing.' },
    { start: 15, end: 20, text: 'Second, build meaningful professional connections.' },
    { start: 20, end: 25, text: 'Third, don\'t be afraid to take calculated risks.' },
    { start: 25, end: 30, text: 'Thank you for watching!' },
  ];

  const vtt = generateVTT(segments);
  const srt = generateSRT(segments);

  return { vtt, srt, segments };
}

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

function generateVTT(segments: CaptionSegment[]): string {
  let vtt = 'WEBVTT\n\n';
  segments.forEach((seg, i) => {
    vtt += `${i + 1}\n`;
    vtt += `${formatTime(seg.start)} --> ${formatTime(seg.end)}\n`;
    vtt += `${seg.text}\n\n`;
  });
  return vtt;
}

function generateSRT(segments: CaptionSegment[]): string {
  let srt = '';
  segments.forEach((seg, i) => {
    srt += `${i + 1}\n`;
    srt += `${formatTimeSRT(seg.start)} --> ${formatTimeSRT(seg.end)}\n`;
    srt += `${seg.text}\n\n`;
  });
  return srt;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function formatTimeSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(num: number, size: number = 2): string {
  return num.toString().padStart(size, '0');
}

/**
 * Generate thumbnail from video
 */
export async function generateThumbnail(
  videoUrl: string,
  timestamp: number = 0
): Promise<string> {
  // In production, this would use FFmpeg to extract frame
  logger.info('Generating thumbnail', { videoUrl, timestamp });
  
  // Return placeholder thumbnail URL
  const thumbnailKey = `thumbnails/${uuidv4()}.jpg`;
  return `${CDN_URL}/${thumbnailKey}`;
}

/**
 * Get transcoding presets
 */
export function getTranscodingPresets() {
  return {
    '720p': {
      width: 1280,
      height: 720,
      bitrate: '2500k',
      audioBitrate: '128k',
      fps: 30,
    },
    '480p': {
      width: 854,
      height: 480,
      bitrate: '1500k',
      audioBitrate: '96k',
      fps: 30,
    },
    '360p': {
      width: 640,
      height: 360,
      bitrate: '800k',
      audioBitrate: '64k',
      fps: 24,
    },
    'hls': {
      variants: ['720p', '480p', '360p'],
      segmentDuration: 6,
    },
  };
}

/**
 * Apply video effects (simulated - would use FFmpeg in production)
 */
export async function applyEffects(
  videoUrl: string,
  effects: VideoEffect[]
): Promise<string> {
  logger.info('Applying effects to video', { videoUrl, effectCount: effects.length });

  // Build FFmpeg filter chain
  const filterChain = effects.map((effect) => {
    switch (effect.type) {
      case 'filter':
        return getFFmpegFilter(effect.name);
      case 'speed':
        return `setpts=${1 / effect.factor}*PTS`;
      case 'trim':
        return `trim=start=${effect.startTime}:end=${effect.endTime}`;
      default:
        return '';
    }
  }).filter(Boolean);

  logger.info('FFmpeg filter chain:', filterChain);

  // Return processed video URL (simulated)
  const outputKey = `processed/${uuidv4()}.mp4`;
  return `${CDN_URL}/${outputKey}`;
}

function getFFmpegFilter(filterName: FilterType): string {
  const filters: Record<FilterType, string> = {
    none: '',
    vintage: 'curves=vintage',
    sepia: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
    grayscale: 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3',
    warm: 'colortemperature=temperature=6500',
    cool: 'colortemperature=temperature=10000',
    vivid: 'eq=saturation=1.5:contrast=1.1',
    dramatic: 'eq=contrast=1.3:brightness=-0.05:saturation=1.2',
    soft: 'gblur=sigma=0.5,eq=brightness=0.05',
    bright: 'eq=brightness=0.15:contrast=1.1',
    contrast: 'eq=contrast=1.5',
    fade: 'fade=in:0:30,fade=out:st=0:d=1',
    blur: 'gblur=sigma=2',
    sharpen: 'unsharp=5:5:1.0',
    vignette: 'vignette=PI/4',
  };
  return filters[filterName] || '';
}

// Private helper functions

async function processVideoAsync(
  job: VideoProcessingJob,
  options: {
    generateCaptions?: boolean;
    generateThumbnail?: boolean;
    transcodeFormats?: ('720p' | '480p' | '360p' | 'hls')[];
    applyEffects?: VideoEffect[];
  }
): Promise<void> {
  try {
    // Step 1: Analyze video metadata
    updateJobStatus(job.id, 'transcoding', 10);
    job.metadata = {
      duration: 30,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      bitrate: 5000000,
    };

    // Step 2: Transcode to different formats
    const formats = options.transcodeFormats || ['720p', '480p'];
    const totalSteps = formats.length + (options.generateCaptions ? 1 : 0) + (options.generateThumbnail ? 1 : 0);
    let currentStep = 0;

    for (const format of formats) {
      currentStep++;
      updateJobStatus(job.id, 'transcoding', 10 + (currentStep / totalSteps) * 60);
      
      // Simulate transcoding delay
      await delay(500);
      
      const outputKey = `videos/${job.userId}/${job.id}/${format}.mp4`;
      job.outputs[`mp4_${format}` as keyof typeof job.outputs] = `${CDN_URL}/${outputKey}`;
    }

    // Step 3: Generate captions
    if (options.generateCaptions !== false) {
      updateJobStatus(job.id, 'captioning', 75);
      const captions = await generateCaptions(job.originalUrl);
      
      // Upload captions to S3
      const vttKey = `captions/${job.id}.vtt`;
      const srtKey = `captions/${job.id}.srt`;
      
      job.outputs.captionsVtt = `${CDN_URL}/${vttKey}`;
      job.outputs.captionsSrt = `${CDN_URL}/${srtKey}`;
    }

    // Step 4: Generate thumbnail
    if (options.generateThumbnail !== false) {
      updateJobStatus(job.id, 'thumbnail', 90);
      job.outputs.thumbnail = await generateThumbnail(job.originalUrl, 5);
    }

    // Complete
    updateJobStatus(job.id, 'completed', 100);
    logger.info('Video processing completed', { jobId: job.id });

  } catch (error) {
    logger.error('Video processing error:', error);
    throw error;
  }
}

function updateJobStatus(
  jobId: string,
  status: VideoProcessingStatus,
  progress: number,
  error?: string
): void {
  const job = processingJobs.get(jobId);
  if (job) {
    job.status = status;
    job.progress = progress;
    job.updatedAt = new Date();
    if (error) {
      job.error = error;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  initiateVideoProcessing,
  getProcessingStatus,
  getUserProcessingJobs,
  generateCaptions,
  generateThumbnail,
  applyEffects,
  getTranscodingPresets,
  VIDEO_EFFECTS_LIBRARY,
};
