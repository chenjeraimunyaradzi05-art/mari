/**
 * `/uploads` serves files from this host's disk, and only from the folders that
 * are public. The guard in front of the file server used to read the folder off
 * the raw text of the path, and the file server resolves `..` after that, so a
 * request that started "avatars" and climbed out of it was served from a
 * private folder. These tests send the climbing paths to the real file server.
 */

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { isPublicUploadPath } from '../public-uploads';

const PUBLIC = new Set(['avatars', 'covers', 'posts', 'videos']);
const BACKSLASH = String.fromCharCode(92);

describe('isPublicUploadPath', () => {
  it('accepts a file in a public folder, at any depth', () => {
    expect(isPublicUploadPath('/avatars/a.webp', PUBLIC)).toBe(true);
    expect(isPublicUploadPath('/posts/user-1/photo.webp', PUBLIC)).toBe(true);
    expect(isPublicUploadPath('avatars/a.webp', PUBLIC)).toBe(true);
  });

  it('refuses a private folder, and one it has never heard of', () => {
    expect(isPublicUploadPath('/resumes/u1/cv.pdf', PUBLIC)).toBe(false);
    expect(isPublicUploadPath('/documents/u1/deed.pdf', PUBLIC)).toBe(false);
    expect(isPublicUploadPath('/secrets/x', PUBLIC)).toBe(false);
  });

  it('refuses every way of climbing out of a public folder into a private one', () => {
    for (const attempt of [
      '/avatars/../resumes/u1/cv.pdf',
      '/avatars/./../resumes/u1/cv.pdf',
      '/avatars/%2e%2e/resumes/u1/cv.pdf',
      '/avatars/..%2fresumes/u1/cv.pdf',
      '/avatars/..%2Fresumes/u1/cv.pdf',
      `/avatars/..${BACKSLASH}resumes/u1/cv.pdf`,
      '/avatars/..%5cresumes/u1/cv.pdf',
      '/avatars//..//resumes/u1/cv.pdf',
      '/../resumes/u1/cv.pdf',
    ]) {
      expect(isPublicUploadPath(attempt, PUBLIC)).toBe(false);
    }
  });

  it('refuses a private folder written with an escape, a null byte or broken encoding', () => {
    expect(isPublicUploadPath('/%72esumes/u1/cv.pdf', PUBLIC)).toBe(false);
    expect(isPublicUploadPath('/avatars/a.webp%00.png', PUBLIC)).toBe(false);
    expect(isPublicUploadPath('/avatars/%E0%A4%A', PUBLIC)).toBe(false);
  });

  it('refuses the root, which names no folder at all', () => {
    expect(isPublicUploadPath('/', PUBLIC)).toBe(false);
    expect(isPublicUploadPath('', PUBLIC)).toBe(false);
  });
});

describe('the guard in front of express.static', () => {
  let root: string;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-uploads-'));
    fs.mkdirSync(path.join(root, 'avatars'), { recursive: true });
    fs.mkdirSync(path.join(root, 'resumes', 'u1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'avatars', 'a.txt'), 'a public picture');
    fs.writeFileSync(path.join(root, 'resumes', 'u1', 'cv.txt'), 'a private resume');

    const app = express();
    app.use(
      '/uploads',
      (req, res, next) => {
        if (!isPublicUploadPath(req.path, PUBLIC)) {
          res.status(404).json({ success: false, message: 'Not found' });
          return;
        }
        next();
      },
      express.static(root, { dotfiles: 'deny', index: false })
    );
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  });

  /** The path goes on the wire exactly as written: a client library would tidy the dots away. */
  const fetchRaw = (requestPath: string) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      http
        .get({ host: '127.0.0.1', port, path: requestPath }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        })
        .on('error', reject);
    });

  it('serves a public file, so the refusals below are not a server that serves nothing', async () => {
    const res = await fetchRaw('/uploads/avatars/a.txt');
    expect(res.status).toBe(200);
    expect(res.body).toBe('a public picture');
  });

  it('does not serve a private file by its address', async () => {
    expect((await fetchRaw('/uploads/resumes/u1/cv.txt')).status).toBe(404);
  });

  it.each([
    '/uploads/avatars/../resumes/u1/cv.txt',
    '/uploads/avatars/./../resumes/u1/cv.txt',
    '/uploads/avatars/%2e%2e/resumes/u1/cv.txt',
    '/uploads/avatars/..%2fresumes/u1/cv.txt',
    `/uploads/avatars/..${BACKSLASH}resumes/u1/cv.txt`,
  ])('does not serve a private file through a public folder: %s', async (requestPath) => {
    const res = await fetchRaw(requestPath);
    expect(res.status).toBe(404);
    expect(res.body).not.toContain('private resume');
  });
});
