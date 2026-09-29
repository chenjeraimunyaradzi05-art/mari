import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

/**
 * services/story-expiry.service.ts, which had no test of any kind.
 *
 * The product tells a member her story disappears after 24 hours. For a long
 * time that meant only that the feed stopped showing it: the row, the list of
 * everyone who watched it and the file itself all stayed, and the file's URL
 * kept working for anyone who had it. The sweep in this service is now what
 * makes "disappears" true, so these tests hold it to the promise:
 *
 *   - an expired story's row goes, and so does the file behind it, whether the
 *     file is in the bucket or on the API's own disk;
 *   - a story still inside its 24 hours is untouched;
 *   - the file stays when a highlight she chose to keep still shows it (the row
 *     goes regardless);
 *   - when the highlight lookup fails, every file stays and every row still
 *     goes — losing a highlight she kept is worse than an orphaned file;
 *   - a bucket that refuses a delete does not keep the row alive, and is
 *     counted, not swallowed;
 *   - a backlog bigger than one batch is cleared in one sweep.
 */

const CDN = 'https://media.athena.example';

const sent: Array<{ Bucket: string; Key: string }> = [];
const s3 = { failNext: false };

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: async (command: { input: { Bucket: string; Key: string } }) => {
      if (s3.failNext) {
        s3.failNext = false;
        throw new Error('AccessDenied');
      }
      db.order.push('file');
      sent.push(command.input);
      return {};
    },
  })),
  DeleteObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

interface Story {
  id: string;
  mediaUrl: string;
  expiresAt: Date;
}

const db = {
  stories: [] as Story[],
  highlightUrls: [] as string[],
  highlightLookupFails: false,
  order: [] as string[],
};

jest.mock('../src/utils/prisma', () => ({
  prisma: {
    status: {
      findMany: async ({ where, take }: { where: { expiresAt: { lte: Date } }; take: number }) =>
        db.stories
          .filter((story) => story.expiresAt.getTime() <= where.expiresAt.lte.getTime())
          .slice(0, take)
          .map(({ id, mediaUrl }) => ({ id, mediaUrl })),
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        db.order.push('rows');
        const before = db.stories.length;
        db.stories = db.stories.filter((story) => !where.id.in.includes(story.id));
        return { count: before - db.stories.length };
      },
    },
    storyHighlightItem: {
      findMany: async ({ where }: { where: { mediaUrl: { in: string[] } } }) => {
        if (db.highlightLookupFails) throw new Error('connection reset');
        return db.highlightUrls.filter((url) => where.mediaUrl.in.includes(url)).map((mediaUrl) => ({ mediaUrl }));
      },
    },
  },
}));

// Local files live in a scratch directory for the run; localPathForUrl maps
// /uploads/<name> into it the way media-storage maps it into ./uploads.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-story-expiry-'));

jest.mock('../src/utils/media-storage', () => ({
  localPathForUrl: (url: string) => {
    if (!url.startsWith('/uploads/')) return null;
    const file = path.join(scratch, decodeURIComponent(url.slice('/uploads/'.length)));
    return fs.existsSync(file) ? file : null;
  },
}));

const failures: Array<{ operation: string }> = [];
jest.mock('../src/utils/ops-metrics', () => ({
  recordFailure: (operation: string) => {
    failures.push({ operation });
  },
}));

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// The bucket and CDN are read when the module loads, so they are set first and
// the module is required after. Put back afterwards, so nothing after this
// suite believes it has AWS credentials.
const savedEnv = { ...process.env };
process.env.S3_BUCKET = 'athena-media-test';
process.env.CDN_URL = CDN;
process.env.AWS_ACCESS_KEY_ID = 'AKIATESTTESTTESTTEST';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const service = require('../src/services/story-expiry.service') as typeof import('../src/services/story-expiry.service');

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-09-26T12:00:00.000Z');

function localFile(name: string): string {
  fs.writeFileSync(path.join(scratch, name), 'image bytes');
  return `/uploads/${name}`;
}

function exists(url: string): boolean {
  return fs.existsSync(path.join(scratch, url.slice('/uploads/'.length)));
}

beforeEach(() => {
  db.stories = [];
  db.highlightUrls = [];
  db.highlightLookupFails = false;
  db.order = [];
  sent.length = 0;
  failures.length = 0;
  s3.failNext = false;
});

afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
  process.env = savedEnv;
});

describe('sweepExpiredStories', () => {
  it('deletes an expired story and the file behind it, and leaves a live one alone', async () => {
    const oldFile = localFile('old.jpg');
    const liveFile = localFile('live.jpg');
    db.stories = [
      { id: 'old', mediaUrl: oldFile, expiresAt: new Date(NOW.getTime() - HOUR) },
      { id: 'live', mediaUrl: liveFile, expiresAt: new Date(NOW.getTime() + HOUR) },
    ];

    const removed = await service.sweepExpiredStories(NOW);

    expect(removed).toBe(1);
    expect(db.stories.map((story) => story.id)).toEqual(['live']);
    expect(exists(oldFile)).toBe(false);
    expect(exists(liveFile)).toBe(true);
  });

  it('deletes the object from the bucket for media stored there, by its key', async () => {
    db.stories = [{ id: 's1', mediaUrl: `${CDN}/stories/ada/one%20photo.jpg`, expiresAt: new Date(NOW.getTime() - HOUR) }];

    await service.sweepExpiredStories(NOW);

    expect(sent).toEqual([{ Bucket: 'athena-media-test', Key: 'stories/ada/one photo.jpg' }]);
    expect(db.stories).toHaveLength(0);
  });

  it('never sends a delete for a URL that is not in our bucket', async () => {
    db.stories = [{ id: 's1', mediaUrl: 'https://elsewhere.example/stories/ada.jpg', expiresAt: new Date(NOW.getTime() - HOUR) }];

    await service.sweepExpiredStories(NOW);

    expect(sent).toHaveLength(0);
    expect(db.stories).toHaveLength(0);
  });

  it('keeps the file a highlight still shows, and still deletes the story row', async () => {
    const kept = localFile('kept.jpg');
    const gone = localFile('gone.jpg');
    db.highlightUrls = [kept];
    db.stories = [
      { id: 'in-highlight', mediaUrl: kept, expiresAt: new Date(NOW.getTime() - HOUR) },
      { id: 'not-kept', mediaUrl: gone, expiresAt: new Date(NOW.getTime() - HOUR) },
    ];

    expect(await service.sweepExpiredStories(NOW)).toBe(2);

    expect(db.stories).toHaveLength(0);
    expect(exists(kept)).toBe(true);
    expect(exists(gone)).toBe(false);
  });

  it('keeps every file and still deletes every row when the highlight lookup fails', async () => {
    const a = localFile('a.jpg');
    const b = localFile('b.jpg');
    db.highlightLookupFails = true;
    db.stories = [
      { id: 'a', mediaUrl: a, expiresAt: new Date(NOW.getTime() - HOUR) },
      { id: 'b', mediaUrl: b, expiresAt: new Date(NOW.getTime() - HOUR) },
    ];

    expect(await service.sweepExpiredStories(NOW)).toBe(2);

    expect(db.stories).toHaveLength(0);
    expect(exists(a)).toBe(true);
    expect(exists(b)).toBe(true);
    expect(failures).toEqual([{ operation: 'story-expiry.highlight-lookup' }]);
  });

  it('deletes the rows before the files, so a crash between the two leaves no story behind', async () => {
    db.stories = [{ id: 's1', mediaUrl: `${CDN}/stories/s1.jpg`, expiresAt: new Date(NOW.getTime() - HOUR) }];

    await service.sweepExpiredStories(NOW);

    expect(db.order).toEqual(['rows', 'file']);
  });

  it('still deletes the row when the bucket refuses the file, and counts the refusal', async () => {
    s3.failNext = true;
    db.stories = [{ id: 's1', mediaUrl: `${CDN}/stories/s1.jpg`, expiresAt: new Date(NOW.getTime() - HOUR) }];

    expect(await service.sweepExpiredStories(NOW)).toBe(1);

    expect(db.stories).toHaveLength(0);
    expect(failures).toEqual([{ operation: 'story-expiry.media-delete' }]);
  });

  it('clears a backlog larger than one batch in a single sweep', async () => {
    db.stories = Array.from({ length: 450 }, (_, i) => ({
      id: `s${i}`,
      mediaUrl: `${CDN}/stories/s${i}.jpg`,
      expiresAt: new Date(NOW.getTime() - HOUR),
    }));

    expect(await service.sweepExpiredStories(NOW)).toBe(450);
    expect(db.stories).toHaveLength(0);
    expect(sent).toHaveLength(450);
  });

  it('removes nothing when nothing has expired', async () => {
    db.stories = [{ id: 'live', mediaUrl: `${CDN}/stories/live.jpg`, expiresAt: new Date(NOW.getTime() + HOUR) }];

    expect(await service.sweepExpiredStories(NOW)).toBe(0);
    expect(sent).toHaveLength(0);
  });
});

describe('deleteStoriesWithMedia, which a member deleting her own story also uses', () => {
  it('deletes the same file once when two stories share it', async () => {
    const shared = `${CDN}/stories/shared.jpg`;

    const count = await service.deleteStoriesWithMedia([
      { id: 'a', mediaUrl: shared },
      { id: 'b', mediaUrl: shared },
    ]);

    // Neither row exists in this store, so nothing is counted, but the file
    // still goes exactly once.
    expect(count).toBe(0);
    expect(sent).toEqual([{ Bucket: 'athena-media-test', Key: 'stories/shared.jpg' }]);
  });

  it('does nothing for an empty list', async () => {
    expect(await service.deleteStoriesWithMedia([])).toBe(0);
    expect(db.order).toEqual([]);
  });
});
