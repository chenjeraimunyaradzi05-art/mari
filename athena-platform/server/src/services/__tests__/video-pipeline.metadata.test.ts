/**
 * What a phone writes into a video or a recording, and what the platform does
 * with it.
 *
 * A clip from a phone says where it was filmed. The pipeline used to publish a
 * reel that was already an H.264 MP4 exactly as it arrived, and its transcode
 * and duet commands copied the input's tags across to the new file, so the
 * place reached every viewer. These suites run the real ffmpeg that ships with
 * the server on clips that are tagged with a title and a location, and look at
 * what comes out.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    video: { findUnique: jest.fn(), update: jest.fn() },
    audioTrack: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  },
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../socket.service', () => ({ emitToUserRoom: jest.fn() }));
jest.mock('../engagement.service', () => ({ checkContentAchievements: jest.fn() }));

// What the pipeline hands to storage is a file that is deleted straight after,
// so the mock keeps its bytes.
const stored = new Map<string, Buffer>();
jest.mock('../../utils/media-storage', () => {
  const fsModule = jest.requireActual('fs') as typeof import('fs');
  return {
    localPathForUrl: (url: string) => (fsModule.existsSync(url) ? url : null),
    storeFile: jest.fn(async (key: string, filePath: string) => {
      stored.set(key, fsModule.readFileSync(filePath));
      return `https://cdn.example/${key}`;
    }),
  };
});

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  hasStrippableMetadata,
  MediaMetadataError,
  processVideo,
  stripMediaMetadata,
  stripMediaMetadataBuffer,
  stripMetadataArgs,
} from '../video-pipeline.service';
import { prisma as prismaTyped } from '../../utils/prisma';
import {
  carriesMarkers,
  CLIP_CONTENT_TYPE,
  FFMPEG,
  makeClip,
  probeText,
  type ClipKind,
} from '../../utils/__tests__/media-fixtures';

const prisma: any = prismaTyped;
const withFfmpeg = FFMPEG ? describe : describe.skip;

describe('The arguments that drop metadata', () => {
  it('copies pictures and sound across and nothing else', () => {
    const args = stripMetadataArgs('in', 'out', 'video/mp4');

    expect(args.join(' ')).toContain('-map_metadata -1');
    expect(args.join(' ')).toContain('-map_chapters -1');
    expect(args.join(' ')).toContain('-c copy');
    // Data tracks (a camera's GPS track) and cover art are never mapped.
    expect(args.join(' ')).toContain('-map 0:v:0 -map 0:a?');
    expect(args).not.toContain('0');
    expect(args.slice(-3)).toEqual(['-f', 'mp4', 'out']);
  });

  it('puts the index up front only for the MP4 family, and asks no ID3 header of anything but an MP3', () => {
    expect(stripMetadataArgs('in', 'out', 'video/mp4')).toContain('+faststart');
    expect(stripMetadataArgs('in', 'out', 'video/quicktime')).toContain('+faststart');
    expect(stripMetadataArgs('in', 'out', 'video/webm')).not.toContain('+faststart');
    expect(stripMetadataArgs('in', 'out', 'audio/mpeg').join(' ')).toContain('-write_id3v2 0');
    expect(stripMetadataArgs('in', 'out', 'audio/wav').join(' ')).not.toContain('id3');
    expect(stripMetadataArgs('in', 'out', 'audio/mpeg').join(' ')).toContain('-map 0:a');
  });

  it('knows exactly the video and sound types an upload may be, and nothing else', () => {
    for (const type of ['video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/ogg', 'audio/webm']) {
      expect(hasStrippableMetadata(type)).toBe(true);
    }
    for (const type of ['image/jpeg', 'text/vtt', 'application/pdf', 'constructor', '__proto__']) {
      expect(hasStrippableMetadata(type)).toBe(false);
    }
    expect(() => stripMetadataArgs('in', 'out', 'text/vtt')).toThrow(/No metadata strip/);
  });
});

withFfmpeg('Copying a file without its metadata, with the real ffmpeg', () => {
  let workDir: string;
  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-metadata-test-'));
  });
  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const videoKinds: ClipKind[] = ['mp4', 'mov'];
  for (const kind of videoKinds) {
    it(`a ${kind} comes out without its location or title, and still plays`, async () => {
      const clip = makeClip(kind);
      // The test could not fail if the tags were never there.
      expect(carriesMarkers(clip, kind)).toBe(true);

      const input = path.join(workDir, `in.${kind}`);
      const output = path.join(workDir, `out.${kind}`);
      fs.writeFileSync(input, clip);
      await stripMediaMetadata(input, output, CLIP_CONTENT_TYPE[kind]);

      const cleaned = fs.readFileSync(output);
      expect(carriesMarkers(cleaned, kind)).toBe(false);
      const said = probeText(cleaned, kind);
      expect(said).toMatch(/Video: h264.*160x120/);
      expect(said).toMatch(/Audio: aac/);
      expect(said).toMatch(/Duration: 00:00:01/);
    });
  }

  const soundKinds: ClipKind[] = ['m4a', 'mp3', 'wav'];
  for (const kind of soundKinds) {
    it(`a ${kind} recording held in memory comes out without its tags, and still plays`, async () => {
      const clip = makeClip(kind);
      expect(carriesMarkers(clip, kind)).toBe(true);

      const cleaned = await stripMediaMetadataBuffer(clip, CLIP_CONTENT_TYPE[kind]);

      expect(carriesMarkers(cleaned, kind)).toBe(false);
      expect(probeText(cleaned, kind)).toMatch(/Audio:/);
      expect(probeText(cleaned, kind)).toMatch(/Duration: 00:00:01/);
    });
  }

  it('says a file ffmpeg cannot read is unreadable, and leaves no output behind', async () => {
    const input = path.join(workDir, 'in.mp4');
    const output = path.join(workDir, 'out.mp4');
    fs.writeFileSync(input, Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(2048)]));

    await expect(stripMediaMetadata(input, output, 'video/mp4')).rejects.toMatchObject({
      name: 'MediaMetadataError',
      reason: 'unreadable',
    });
    expect(fs.existsSync(output)).toBe(false);
  });

  it('does not leave its scratch folder behind', async () => {
    const before = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('athena-strip-')).length;
    await stripMediaMetadataBuffer(makeClip('wav'), 'audio/wav');
    await expect(stripMediaMetadataBuffer(Buffer.from('not audio at all'), 'audio/wav')).rejects.toBeInstanceOf(MediaMetadataError);
    const after = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('athena-strip-')).length;
    expect(after).toBe(before);
  });
});

withFfmpeg('The reel pipeline', () => {
  let workDir: string;
  beforeEach(() => {
    stored.clear();
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-pipeline-test-'));
    prisma.video.update.mockResolvedValue({ thumbnailUrl: null, duration: 1 });
  });
  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  /** A reel whose poster and sound are already chosen, so only the rendition is under test. */
  function reelAt(file: string) {
    prisma.video.findUnique.mockResolvedValue({
      id: 'reel-1',
      authorId: 'her',
      videoUrl: file,
      sourceUrl: file,
      thumbnailUrl: 'https://cdn.example/poster.jpg',
      duration: 1,
      audioTrackId: 'sound-1',
      duetOfVideoId: null,
      author: { displayName: 'Her', firstName: null, lastName: null },
    });
  }

  it('publishes an upload that is already H.264 in an MP4 without its location, not as it arrived', async () => {
    const file = path.join(workDir, 'phone.mp4');
    const original = makeClip('mp4');
    expect(carriesMarkers(original, 'mp4')).toBe(true);
    fs.writeFileSync(file, original);
    reelAt(file);

    await processVideo('reel-1');

    const rendition = stored.get('videos/her/reel-1-web.mp4');
    expect(rendition).toBeDefined();
    expect(carriesMarkers(rendition!, 'mp4')).toBe(false);
    expect(probeText(rendition!, 'mp4')).toMatch(/Video: h264/);
    const published = prisma.video.update.mock.calls.map((call: any[]) => call[0].data).find((data: any) => data.status === 'PUBLISHED');
    expect(published.videoUrl).toBe('https://cdn.example/videos/her/reel-1-web.mp4');
    expect(published.processingError).toBeNull();
  });

  it('transcodes a file it must, and the result carries no location either', async () => {
    // A .mov is not the rendition the platform plays, so it is transcoded.
    const file = path.join(workDir, 'phone.mov');
    const original = makeClip('mov');
    expect(carriesMarkers(original, 'mov')).toBe(true);
    fs.writeFileSync(file, original);
    reelAt(file);

    await processVideo('reel-1');

    const rendition = stored.get('videos/her/reel-1-web.mp4');
    expect(rendition).toBeDefined();
    expect(carriesMarkers(rendition!, 'mp4')).toBe(false);
  });
});
