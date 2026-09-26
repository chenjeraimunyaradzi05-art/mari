import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSend = jest.fn<(command: { constructor: { name: string }; input: Record<string, unknown> }) => Promise<unknown>>();

jest.mock('@aws-sdk/client-s3', () => {
  class Command {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class PutObjectCommand extends Command {}
  class HeadBucketCommand extends Command {}
  class S3Client {
    send(command: never) {
      return mockSend(command);
    }
  }
  return { PutObjectCommand, HeadBucketCommand, S3Client };
});

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { MEDIA_STORAGE_CONDITION, probeMediaStorage, storeBuffer, storeFile } from '../media-storage';
import { opsSnapshot, resetOpsMetrics } from '../ops-metrics';

describe('media storage', () => {
  const env = { ...process.env };
  let writeFile: jest.SpiedFunction<typeof fs.promises.writeFile>;
  let copyFile: jest.SpiedFunction<typeof fs.promises.copyFile>;

  beforeEach(() => {
    mockSend.mockReset();
    resetOpsMetrics();
    process.env = { ...env, AWS_ACCESS_KEY_ID: 'AKIAABCDEFGHIJKLMNOP', AWS_SECRET_ACCESS_KEY: 'x'.repeat(40), API_URL: 'https://api.athena.example' };
    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    writeFile = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    copyFile = jest.spyOn(fs.promises, 'copyFile').mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = env;
    jest.restoreAllMocks();
  });

  it('refuses, in production, to put a file on the container disk when the S3 write fails', async () => {
    process.env.NODE_ENV = 'production';
    mockSend.mockRejectedValue(new Error('InvalidAccessKeyId'));

    await expect(storeBuffer('avatars/u1/a.png', Buffer.from('png'), 'image/png')).rejects.toThrow(/S3 failed.*InvalidAccessKeyId/);
    await expect(storeFile('videos/u1/v-web.mp4', __filename, 'video/mp4')).rejects.toThrow(/S3 failed/);

    // The disk the next deploy wipes was never written.
    expect(writeFile).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
  });

  it('still falls back to the local disk outside production, where that disk is the developer’s own', async () => {
    process.env.NODE_ENV = 'development';
    mockSend.mockRejectedValue(new Error('no network'));

    const url = await storeBuffer('avatars/u1/a.png', Buffer.from('png'), 'image/png');

    expect(url).toBe('https://api.athena.example/uploads/avatars/u1/a.png');
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it('streams a produced file to S3 rather than reading it into memory first', async () => {
    process.env.NODE_ENV = 'production';
    mockSend.mockResolvedValue({});
    const readFileSync = jest.spyOn(fs, 'readFileSync');

    const url = await storeFile('videos/u1/v-web.mp4', __filename, 'video/mp4');

    expect(url).toMatch(/\/videos\/u1\/v-web\.mp4$/);
    const input = mockSend.mock.calls[0][0].input;
    expect(input.Body).toBeInstanceOf(fs.ReadStream);
    expect(input.ContentLength).toBe(fs.statSync(__filename).size);
    expect(readFileSync).not.toHaveBeenCalledWith(__filename);
    (input.Body as fs.ReadStream).destroy();
  });

  it('records an unreachable bucket where the health check shows it, and clears it once it answers', async () => {
    mockSend.mockRejectedValueOnce(new Error('Forbidden'));
    const down = await probeMediaStorage();
    expect(down.reachable).toBe(false);
    expect(opsSnapshot().conditions[MEDIA_STORAGE_CONDITION]).toMatchObject({ count: 1 });
    expect(opsSnapshot().conditions[MEDIA_STORAGE_CONDITION].detail).toContain('Forbidden');

    mockSend.mockResolvedValueOnce({});
    const up = await probeMediaStorage();
    expect(up.reachable).toBe(true);
    expect(opsSnapshot().conditions[MEDIA_STORAGE_CONDITION]).toMatchObject({ count: 0 });
  });

  it('says so in production when there are no S3 credentials at all', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AWS_ACCESS_KEY_ID;

    const result = await probeMediaStorage();

    expect(result.reachable).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
    expect(opsSnapshot().conditions[MEDIA_STORAGE_CONDITION]).toMatchObject({ count: 1 });
  });
});
