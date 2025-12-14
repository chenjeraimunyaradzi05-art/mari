import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import path from 'path';
import fs from 'fs';

// Set the ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

interface ProcessingResult {
  videoPath: string;
  thumbnailPath: string;
  duration: number;
  format: string;
}

export class VideoProcessor {
  private uploadDir: string;
  private thumbnailDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos');
    this.thumbnailDir = path.join(process.cwd(), 'public', 'uploads', 'thumbnails');
  }

  /**
   * Process a video file: transcode to MP4 and generate thumbnail
   */
  async process(inputPath: string, filename: string): Promise<ProcessingResult> {
    const outputFilename = `${path.parse(filename).name}.mp4`;
    const outputPath = path.join(this.uploadDir, outputFilename);
    const thumbnailFilename = `${path.parse(filename).name}.png`;
    
    // Ensure directories exist
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
    if (!fs.existsSync(this.thumbnailDir)) fs.mkdirSync(this.thumbnailDir, { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec('libx264')
        .size('1280x720') // Standardize to 720p
        .on('end', async () => {
          try {
            // Generate thumbnail after video processing
            await this.generateThumbnail(outputPath, thumbnailFilename);
            
            // Get video metadata
            ffmpeg.ffprobe(outputPath, (err, metadata) => {
              if (err) return reject(err);
              
              resolve({
                videoPath: `/uploads/videos/${outputFilename}`,
                thumbnailPath: `/uploads/thumbnails/${thumbnailFilename}`,
                duration: metadata.format.duration || 0,
                format: 'mp4'
              });
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('Error processing video:', err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Generate a thumbnail for the video
   */
  private async generateThumbnail(videoPath: string, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['50%'], // Take screenshot at 50% of video
          filename: filename,
          folder: this.thumbnailDir,
          size: '320x180'
        })
        .on('end', () => {
          resolve(path.join(this.thumbnailDir, filename));
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }
}

export const videoProcessor = new VideoProcessor();
