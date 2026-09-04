import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({ prisma: {} }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../socket.service', () => ({ emitToUserRoom: jest.fn() }));

import { aspectRatioOf, isWebReady, parseProbeOutput } from '../video-pipeline.service';

const PORTRAIT_MP4 = `
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'source.mp4':
  Duration: 00:00:12.48, start: 0.000000, bitrate: 2210 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1080x1920 [SAR 1:1 DAR 9:16], 2077 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 128 kb/s (default)
`;

const SILENT_WEBM = `
Input #0, matroska,webm, from 'clip.webm':
  Duration: 00:01:05.20, start: 0.000000, bitrate: 900 kb/s
  Stream #0:0: Video: vp9 (Profile 0), yuv420p(tv), 1280x720, SAR 1:1 DAR 16:9, 25 fps, 25 tbr, 1k tbn (default)
`;

describe('parseProbeOutput', () => {
  it('reads duration, dimensions and codecs from ffmpeg output', () => {
    const probe = parseProbeOutput(PORTRAIT_MP4, 'source.mp4');
    expect(probe.durationSeconds).toBeCloseTo(12.48, 2);
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.videoCodec).toBe('h264');
    expect(probe.audioCodec).toBe('aac');
    expect(probe.hasAudio).toBe(true);
    expect(probe.container).toBe('mp4');
  });

  it('notices a silent clip and a non-mp4 container', () => {
    const probe = parseProbeOutput(SILENT_WEBM, 'clip.webm');
    expect(probe.hasAudio).toBe(false);
    expect(probe.videoCodec).toBe('vp9');
    expect(probe.container).toBe('webm');
    expect(probe.durationSeconds).toBeCloseTo(65.2, 2);
  });

  it('leaves everything null when ffmpeg said nothing useful', () => {
    const probe = parseProbeOutput('garbage', 'x.bin');
    expect(probe.durationSeconds).toBeNull();
    expect(probe.width).toBeNull();
    expect(probe.videoCodec).toBeNull();
    expect(probe.hasAudio).toBe(false);
  });
});

describe('isWebReady', () => {
  it('accepts H.264/AAC MP4 at 1080 rows or less', () => {
    expect(isWebReady(parseProbeOutput(PORTRAIT_MP4, 'source.mp4'))).toBe(true);
  });

  it('rejects other containers and codecs, and oversized frames', () => {
    expect(isWebReady(parseProbeOutput(SILENT_WEBM, 'clip.webm'))).toBe(false);
    const fourK = PORTRAIT_MP4.replace('1080x1920', '2160x3840');
    expect(isWebReady(parseProbeOutput(fourK, 'big.mp4'))).toBe(false);
  });
});

describe('aspectRatioOf', () => {
  it('names the common ratios and reduces the rest', () => {
    expect(aspectRatioOf(1080, 1920)).toBe('9:16');
    expect(aspectRatioOf(1920, 1080)).toBe('16:9');
    expect(aspectRatioOf(720, 720)).toBe('1:1');
    expect(aspectRatioOf(1080, 1350)).toBe('4:5');
    expect(aspectRatioOf(1000, 300)).toBe('10:3');
    expect(aspectRatioOf(null, 300)).toBeNull();
  });
});
