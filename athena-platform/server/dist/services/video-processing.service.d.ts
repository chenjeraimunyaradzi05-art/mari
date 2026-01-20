/**
 * Video Processing Pipeline Service
 * Handles transcoding, auto-captioning, effects, and thumbnail generation
 */
export type VideoProcessingStatus = 'pending' | 'uploading' | 'transcoding' | 'captioning' | 'thumbnail' | 'completed' | 'failed';
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
/**
 * Initiate video processing pipeline
 */
export declare function initiateVideoProcessing(userId: string, videoUrl: string, options?: {
    generateCaptions?: boolean;
    generateThumbnail?: boolean;
    transcodeFormats?: ('720p' | '480p' | '360p' | 'hls')[];
    applyEffects?: VideoEffect[];
}): Promise<VideoProcessingJob>;
/**
 * Get video processing job status
 */
export declare function getProcessingStatus(jobId: string): VideoProcessingJob | null;
/**
 * Get all processing jobs for a user
 */
export declare function getUserProcessingJobs(userId: string): VideoProcessingJob[];
export type VideoEffect = {
    type: 'filter';
    name: FilterType;
} | {
    type: 'overlay';
    imageUrl: string;
    position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
} | {
    type: 'text';
    text: string;
    position: 'top' | 'bottom' | 'center';
    style?: TextStyle;
} | {
    type: 'trim';
    startTime: number;
    endTime: number;
} | {
    type: 'speed';
    factor: number;
} | {
    type: 'music';
    audioUrl: string;
    volume: number;
};
export type FilterType = 'none' | 'vintage' | 'sepia' | 'grayscale' | 'warm' | 'cool' | 'vivid' | 'dramatic' | 'soft' | 'bright' | 'contrast' | 'fade' | 'blur' | 'sharpen' | 'vignette';
export interface TextStyle {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    animation?: 'none' | 'fadeIn' | 'slideUp' | 'typewriter';
}
export declare const VIDEO_EFFECTS_LIBRARY: {
    filters: {
        id: string;
        name: string;
        preview: string;
    }[];
    stickers: {
        id: string;
        name: string;
        url: string;
    }[];
    musicTracks: {
        id: string;
        name: string;
        duration: number;
        url: string;
    }[];
    textAnimations: {
        id: string;
        name: string;
    }[];
};
/**
 * Generate video captions using Whisper API
 */
export declare function generateCaptions(videoUrl: string, language?: string): Promise<{
    vtt: string;
    srt: string;
    segments: CaptionSegment[];
}>;
export interface CaptionSegment {
    start: number;
    end: number;
    text: string;
}
/**
 * Generate thumbnail from video
 */
export declare function generateThumbnail(videoUrl: string, timestamp?: number): Promise<string>;
/**
 * Get transcoding presets
 */
export declare function getTranscodingPresets(): {
    '720p': {
        width: number;
        height: number;
        bitrate: string;
        audioBitrate: string;
        fps: number;
    };
    '480p': {
        width: number;
        height: number;
        bitrate: string;
        audioBitrate: string;
        fps: number;
    };
    '360p': {
        width: number;
        height: number;
        bitrate: string;
        audioBitrate: string;
        fps: number;
    };
    hls: {
        variants: string[];
        segmentDuration: number;
    };
};
/**
 * Apply video effects (simulated - would use FFmpeg in production)
 */
export declare function applyEffects(videoUrl: string, effects: VideoEffect[]): Promise<string>;
declare const _default: {
    initiateVideoProcessing: typeof initiateVideoProcessing;
    getProcessingStatus: typeof getProcessingStatus;
    getUserProcessingJobs: typeof getUserProcessingJobs;
    generateCaptions: typeof generateCaptions;
    generateThumbnail: typeof generateThumbnail;
    applyEffects: typeof applyEffects;
    getTranscodingPresets: typeof getTranscodingPresets;
    VIDEO_EFFECTS_LIBRARY: {
        filters: {
            id: string;
            name: string;
            preview: string;
        }[];
        stickers: {
            id: string;
            name: string;
            url: string;
        }[];
        musicTracks: {
            id: string;
            name: string;
            duration: number;
            url: string;
        }[];
        textAnimations: {
            id: string;
            name: string;
        }[];
    };
};
export default _default;
//# sourceMappingURL=video-processing.service.d.ts.map