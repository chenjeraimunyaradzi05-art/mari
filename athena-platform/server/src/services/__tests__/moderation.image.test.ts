/**
 * What the image provider is shown, and what happens when it cannot answer.
 *
 * Rekognition takes an image as bytes only up to 5 MiB and only as JPEG or
 * PNG. The upload routes passed it the picture as it arrived (a cover may be
 * 10 MB, a post picture 20 MB, and WebP and GIF are allowed everywhere), the
 * provider refused what it could not take, and the catch read the refusal as an
 * outage and let the picture through. A picture only had to be a few megabytes
 * bigger, or saved as WebP, to go up unseen.
 */

import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  DetectModerationLabelsCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

jest.mock('openai', () => jest.fn().mockImplementation(() => ({ moderations: { create: jest.fn() } })));

jest.mock('../../utils/prisma', () => ({ prisma: { adminFlag: { create: jest.fn() } } }));

jest.mock('../../utils/cache', () => ({
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => undefined),
}));

jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type ModerationModule = typeof import('../moderation.service');

let recordFailure: jest.Mock;
const savedEnv = { ...process.env };

/** A fresh copy of the service with the image provider configured, as production has it. */
function loadWithProvider(env: Record<string, string | undefined> = {}): ModerationModule {
  process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
  delete process.env.MODERATION_IMAGE_OUTAGE;
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  let loaded: ModerationModule | undefined;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    loaded = require('../moderation.service') as ModerationModule;
    recordFailure = (require('../../utils/ops-metrics') as { recordFailure: jest.Mock }).recordFailure;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return loaded!;
}

/** The bytes the provider was last asked to look at. */
function bytesSentToProvider(): Buffer {
  const command = mockSend.mock.calls[mockSend.mock.calls.length - 1][0] as { input: { Image: { Bytes: Buffer } } };
  return command.input.Image.Bytes;
}

const FIVE_MIB = 5 * 1024 * 1024;
const startsLikeJpeg = (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const startsLikePng = (bytes: Buffer) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;

/** A picture of noise, which does not compress: this is how a file gets past 5 MB. */
async function noisy(side: number, format: 'jpeg' | 'png' | 'webp' | 'gif'): Promise<Buffer> {
  const raw = { raw: { width: side, height: side, channels: 3 as const } };
  const image = sharp(randomBytes(side * side * 3), raw);
  if (format === 'png') return image.png({ compressionLevel: 1 }).toBuffer();
  if (format === 'webp') return image.webp({ quality: 100 }).toBuffer();
  if (format === 'gif') return image.gif().toBuffer();
  return image.jpeg({ quality: 95 }).toBuffer();
}

const small = (format: 'jpeg' | 'png' | 'webp') =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: '#336699' } })[format]().toBuffer();

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockImplementation(async () => ({ ModerationLabels: [] }));
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('The picture the provider is shown', () => {
  it('is the picture itself when it is a small JPEG, untouched', async () => {
    const service = loadWithProvider();
    const jpeg = await small('jpeg');

    await service.moderateImage(jpeg);

    expect(bytesSentToProvider()).toBe(jpeg);
  });

  it('is the picture itself when it is a small PNG, untouched', async () => {
    const service = loadWithProvider();
    const png = await small('png');

    await service.moderateImage(png);

    expect(bytesSentToProvider()).toBe(png);
  });

  it('is a smaller copy when the upload is over the 5 MB the provider takes', async () => {
    const service = loadWithProvider();
    const huge = await noisy(2600, 'jpeg');
    expect(huge.length).toBeGreaterThan(FIVE_MIB);

    const verdict = await service.moderateImage(huge);

    const sent = bytesSentToProvider();
    expect(sent.length).toBeLessThan(FIVE_MIB);
    expect(startsLikeJpeg(sent)).toBe(true);
    // It was screened: the provider answered, and nothing says it could not.
    expect(verdict.unavailable).toBeUndefined();
    expect(verdict.action).toBe('allow');
    expect(recordFailure).not.toHaveBeenCalled();
  }, 60_000);

  it('is a JPEG when the upload is a PNG too large to send as it is', async () => {
    const service = loadWithProvider();
    const huge = await noisy(1800, 'png');
    expect(huge.length).toBeGreaterThan(5 * 1024 * 1024);

    await service.moderateImage(huge);

    const sent = bytesSentToProvider();
    expect(sent.length).toBeLessThan(FIVE_MIB);
    expect(startsLikeJpeg(sent)).toBe(true);
  }, 60_000);

  it('is a JPEG when the upload is a WebP, a format the provider does not read', async () => {
    const service = loadWithProvider();

    await service.moderateImage(await small('webp'));

    const sent = bytesSentToProvider();
    expect(startsLikeJpeg(sent)).toBe(true);
    expect(startsLikePng(sent)).toBe(false);
  });

  it('is a JPEG when the upload is a GIF, looked at by its first frame', async () => {
    const service = loadWithProvider();

    await service.moderateImage(await noisy(64, 'gif'));

    expect(startsLikeJpeg(bytesSentToProvider())).toBe(true);
  });

  it('is turned upright, so what is looked at is what will be shown', async () => {
    const service = loadWithProvider();
    // A phone's portrait photo: stored landscape, with the rotation in a tag.
    const sideways = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#aa5500' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    // Small enough to go as it is, so nothing is rewritten; a WebP of the same
    // picture is not, and shows the rotation being honoured.
    const webp = await sharp(sideways).webp().withMetadata({ orientation: 6 }).toBuffer();

    await service.moderateImage(webp);

    const seen = await sharp(bytesSentToProvider()).metadata();
    expect(seen.width).toBe(100);
    expect(seen.height).toBe(200);
  });

  it('is refused with a 400 when the upload is not a picture at all, and the provider is not asked', async () => {
    const service = loadWithProvider();

    await expect(service.moderateImage(Buffer.from('this is not a picture'))).rejects.toMatchObject({ statusCode: 400 });

    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('A picture the provider flags is still refused, whatever size it arrived at', () => {
  it('blocks an explicit one that had to be made smaller to be looked at', async () => {
    const service = loadWithProvider();
    mockSend.mockImplementation(async () => ({ ModerationLabels: [{ Name: 'Explicit Nudity', Confidence: 97 }] }));

    const verdict = await service.moderateImage(await noisy(2600, 'jpeg'));

    expect(verdict.action).toBe('block');
  }, 60_000);
});

describe('A provider that is configured and cannot answer', () => {
  beforeEach(() => {
    mockSend.mockImplementation(async () => {
      throw new Error('Rekognition is down');
    });
  });

  it('lets the picture through, counted and marked as unscreened, by default', async () => {
    const service = loadWithProvider();

    const verdict = await service.moderateImage(await small('jpeg'));

    expect(verdict).toMatchObject({ action: 'allow', unavailable: true });
    expect(recordFailure).toHaveBeenCalledWith('moderation.image_provider_unavailable', expect.any(Error));
    expect(service.imageOutagePolicy()).toBe('allow');
  });

  it("refuses it with a 503 the member can retry when MODERATION_IMAGE_OUTAGE is 'refuse'", async () => {
    const service = loadWithProvider({ MODERATION_IMAGE_OUTAGE: 'refuse' });

    await expect(service.moderateImage(await small('jpeg'))).rejects.toMatchObject({
      statusCode: 503,
      message: service.IMAGE_CHECK_UNAVAILABLE,
    });
    // Counted either way: refusing is not a reason to stop saying it happened.
    expect(recordFailure).toHaveBeenCalledWith('moderation.image_provider_unavailable', expect.any(Error));
  });

  it("reads the switch as 'allow' for any value but 'refuse'", () => {
    expect(loadWithProvider({ MODERATION_IMAGE_OUTAGE: 'maybe' }).imageOutagePolicy()).toBe('allow');
    expect(loadWithProvider({ MODERATION_IMAGE_OUTAGE: ' Refuse ' }).imageOutagePolicy()).toBe('refuse');
  });
});
