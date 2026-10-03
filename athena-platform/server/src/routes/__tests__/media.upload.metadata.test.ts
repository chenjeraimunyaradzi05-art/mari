/**
 * What a phone writes into a file, and what the upload routes do with it.
 *
 * A photo or a video from a phone says where it was taken. Sent in a message or
 * posted, that is an address the member never chose to share, and for a woman
 * who has left somebody it can be the place she is staying. These suites send
 * real files, tagged with a location, through the real routes and look at the
 * bytes that reach storage. A check that only looked at the output could not
 * fail, so each one first shows the tags are there going in.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({ prisma: { user: { update: jest.fn() } } }));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'u1', role: 'USER', email: 'u1@athena.com' };
      next();
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/moderation.service', () => ({
  moderateImage: jest.fn(async () => ({ action: 'allow' })),
}));

// A video is streamed to storage from a file on disk, which is gone as soon as
// the request ends, so the mock keeps what it was handed.
const streamed: Array<{ key: string; bytes: Buffer }> = [];
jest.mock('../../utils/media-storage', () => {
  const actual: any = jest.requireActual('../../utils/media-storage');
  const fsModule = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actual,
    storeFile: jest.fn(async (key: string, filePath: string) => {
      streamed.push({ key, bytes: fsModule.readFileSync(filePath) });
      return `https://cdn.example/${key}`;
    }),
  };
});

import { app } from '../../index';
import { storeFile as storeFileTyped } from '../../utils/media-storage';
import {
  carriesMarkers,
  FFMPEG,
  makeClip,
  makeGif,
  makePhoto,
  pictureCarriesExif,
  probeText,
} from '../../utils/__tests__/media-fixtures';

const storeFile = storeFileTyped as unknown as jest.Mock;
const withFfmpeg = FFMPEG ? it : it.skip;

describe('An upload carries no location', () => {
  // What the routes write for a picture or a recording they hold in memory.
  const written: Array<{ file: string; bytes: Buffer }> = [];
  // Every temporary file the routes make goes into a folder of this test's own.
  let scratch: string;
  let tmpdirSpy: jest.SpiedFunction<typeof os.tmpdir>;
  let mkdirSpy: jest.SpiedFunction<typeof fs.promises.mkdir>;
  let writeFileSpy: jest.SpiedFunction<typeof fs.promises.writeFile>;

  beforeEach(() => {
    written.length = 0;
    streamed.length = 0;
    storeFile.mockClear();
    // The writes are caught, not made.
    mkdirSpy = jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockImplementation(async (file, data) => {
      written.push({ file: String(file), bytes: Buffer.from(data as Buffer) });
    });
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-upload-test-'));
    tmpdirSpy = jest.spyOn(os, 'tmpdir').mockReturnValue(scratch);
  });

  afterEach(() => {
    tmpdirSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeFileSpy.mockRestore();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  describe('pictures', () => {
    it('a photo posted on its own is stored without its EXIF', async () => {
      const photo = await makePhoto('jpeg', { width: 60, height: 40 });
      expect(await pictureCarriesExif(photo)).toBe(true);

      await request(app).post('/api/media/upload/post').attach('file', photo, { filename: 'beach.jpg', contentType: 'image/jpeg' }).expect(200);

      expect(written).toHaveLength(1);
      expect(await pictureCarriesExif(written[0].bytes)).toBe(false);
    });

    it('every photo in a multi-picture post is stored without its EXIF', async () => {
      const first = await makePhoto('jpeg', { width: 60, height: 40 });
      const second = await makePhoto('png', { width: 30, height: 30 });
      const third = await makePhoto('webp', { width: 30, height: 50 });
      for (const photo of [first, second, third]) expect(await pictureCarriesExif(photo)).toBe(true);

      const res = await request(app)
        .post('/api/media/post-images')
        .attach('images', first, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .attach('images', second, { filename: 'b.png', contentType: 'image/png' })
        .attach('images', third, { filename: 'c.webp', contentType: 'image/webp' })
        .expect(200);

      expect(res.body.data.count).toBe(3);
      expect(written).toHaveLength(3);
      for (const { bytes } of written) expect(await pictureCarriesExif(bytes)).toBe(false);
    });

    it('a photo stored at the size it was sent (a reel poster) loses its EXIF too, in the type it came in', async () => {
      const photo = await makePhoto('jpeg', { width: 60, height: 40 });

      const res = await request(app).post('/api/media/upload/thumbnail').attach('file', photo, { filename: 'poster.jpg', contentType: 'image/jpeg' }).expect(200);

      expect(res.body.data.contentType).toBe('image/jpeg');
      const stored = await sharp(written[0].bytes).metadata();
      expect(stored.format).toBe('jpeg');
      expect(stored.exif).toBeUndefined();
      expect([stored.width, stored.height]).toEqual([60, 40]);

      const png = await makePhoto('png');
      await request(app).post('/api/media/upload/thumbnail').attach('file', png, { filename: 'poster.png', contentType: 'image/png' }).expect(200);
      expect((await sharp(written[1].bytes).metadata()).format).toBe('png');
      expect(await pictureCarriesExif(written[1].bytes)).toBe(false);
    });

    it('a portrait photo is turned upright before its rotation tag is dropped, not left on its side', async () => {
      // Landscape pixels with the tag "rotate 90 degrees": a portrait photo.
      const photo = await makePhoto('jpeg', { width: 60, height: 40, orientation: 6 });
      expect(await pictureCarriesExif(photo)).toBe(true);

      await request(app).post('/api/media/upload/thumbnail').attach('file', photo, { filename: 'poster.jpg', contentType: 'image/jpeg' }).expect(200);
      let stored = await sharp(written[0].bytes).metadata();
      expect([stored.width, stored.height]).toEqual([40, 60]);
      expect(stored.exif).toBeUndefined();

      await request(app).post('/api/media/post-images').attach('images', photo, { filename: 'a.jpg', contentType: 'image/jpeg' }).expect(200);
      stored = await sharp(written[1].bytes).metadata();
      expect([stored.width, stored.height]).toEqual([40, 60]);
      expect(stored.exif).toBeUndefined();
    });

    it('a GIF is stored as it was sent: the format has nowhere to keep a location', async () => {
      const gif = await makeGif();

      await request(app).post('/api/media/upload/post').attach('file', gif, { filename: 'wave.gif', contentType: 'image/gif' }).expect(200);

      expect(written[0].bytes.equals(gif)).toBe(true);
    });

    it('a picture that cannot be decoded is the member’s to replace, not a server fault, and nothing is stored', async () => {
      const damaged = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(252)]);

      for (const route of ['/api/media/upload/post', '/api/media/upload/thumbnail']) {
        const res = await request(app).post(route).attach('file', damaged, { filename: 'p.jpg', contentType: 'image/jpeg' }).expect(400);
        expect(res.body.message).toMatch(/could not be read/);
      }
      const res = await request(app).post('/api/media/post-images').attach('images', damaged, { filename: 'p.jpg', contentType: 'image/jpeg' }).expect(400);
      expect(res.body.message).toMatch(/could not be read/);
      expect(written).toHaveLength(0);
    });
  });

  describe('videos and recordings', () => {
    withFfmpeg('a video sent in a chat is stored without its location or title, and still plays', async () => {
      const clip = makeClip('mp4');
      expect(carriesMarkers(clip, 'mp4')).toBe(true);

      const res = await request(app).post('/api/media/upload/video').attach('file', clip, { filename: 'clip.mp4', contentType: 'video/mp4' }).expect(200);

      expect(streamed).toHaveLength(1);
      const stored = streamed[0].bytes;
      expect(carriesMarkers(stored, 'mp4')).toBe(false);
      expect(probeText(stored, 'mp4')).toMatch(/Video: h264/);
      expect(res.body.data.size).toBe(stored.length);
      expect(fs.readdirSync(scratch)).toEqual([]);
    });

    withFfmpeg('a QuickTime video from an iPhone is cleaned the same way', async () => {
      const clip = makeClip('mov');
      expect(carriesMarkers(clip, 'mov')).toBe(true);

      await request(app).post('/api/media/upload/video').attach('file', clip, { filename: 'IMG_0001.MOV', contentType: 'video/quicktime' }).expect(200);

      expect(carriesMarkers(streamed[0].bytes, 'mov')).toBe(false);
    });

    withFfmpeg('a recording is stored without its tags, whatever its format', async () => {
      for (const [kind, contentType] of [
        ['m4a', 'audio/x-m4a'],
        ['mp3', 'audio/mpeg'],
        ['wav', 'audio/wav'],
      ] as const) {
        written.length = 0;
        const clip = makeClip(kind);
        expect(carriesMarkers(clip, kind)).toBe(true);

        await request(app).post('/api/media/upload/audio').attach('file', clip, { filename: `memo.${kind}`, contentType }).expect(200);

        expect(written).toHaveLength(1);
        expect(carriesMarkers(written[0].bytes, kind)).toBe(false);
        expect(probeText(written[0].bytes, kind)).toMatch(/Audio:/);
      }
    });

    withFfmpeg('a video ffmpeg cannot read is refused with the member’s next step, and nothing is stored or left behind', async () => {
      // A real MP4 signature followed by nothing a player could use.
      const broken = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(2048)]);

      const res = await request(app).post('/api/media/upload/video').attach('file', broken, { filename: 'clip.mp4', contentType: 'video/mp4' }).expect(400);

      expect(res.body.message).toMatch(/could not be read/);
      expect(storeFile).not.toHaveBeenCalled();
      expect(fs.readdirSync(scratch)).toEqual([]);
    });

    withFfmpeg('a recording ffmpeg cannot read is refused too', async () => {
      const broken = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVE'), Buffer.alloc(64)]);

      const res = await request(app).post('/api/media/upload/audio').attach('file', broken, { filename: 'memo.wav', contentType: 'audio/wav' }).expect(400);

      expect(res.body.message).toMatch(/could not be read/);
      expect(written).toHaveLength(0);
    });
  });

  it('documents are stored as sent: they go to private folders and are not offered in a chat', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(300, 0x20)]);

    await request(app).post('/api/media/resume').attach('resume', pdf, { filename: 'cv.pdf', contentType: 'application/pdf' }).expect(200);

    expect(written[0].bytes.equals(pdf)).toBe(true);
  });
});
