/**
 * Small real media files for the suites that check what happens to the
 * metadata inside an upload: clips built with the same ffmpeg the server runs,
 * and photos built with the same sharp.
 *
 * Not a suite itself: the name does not end in .test.ts, so jest does not
 * collect it. Every clip carries a title and, where its container has a place
 * for one, a location, so a suite can show the tags are there going in and not
 * there coming out. A check that only looked at the output could not fail.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

/** The ffmpeg binary the server uses, or null on a host that has none. */
export const FFMPEG: string | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional dependency, as in video-pipeline.service
    const resolved = require('ffmpeg-static') as string | null;
    return resolved && fs.existsSync(resolved) ? resolved : null;
  } catch {
    return null;
  }
})();

/** A phone's make, written into every fixture photo. */
export const PHONE_MARKER = 'PhoneCo-Private-8f3a';
/** A title text that must never survive an upload. */
export const TITLE_MARKER = 'PRIVATE_TITLE_8f3a';
/** Brisbane, as an ISO 6709 location, the way a phone writes it. */
export const LOCATION_MARKER = '+27.4698+153.0251/';

export type ClipKind = 'mp4' | 'mov' | 'm4a' | 'mp3' | 'wav';

const PICTURE = ['-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10:duration=1'];
const SOUND = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1'];

const ARGS: Record<ClipKind, string[]> = {
  mp4: [
    ...PICTURE,
    ...SOUND,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-metadata',
    `location=${LOCATION_MARKER}`,
    '-metadata',
    `title=${TITLE_MARKER}`,
    '-f',
    'mp4',
  ],
  mov: [
    ...PICTURE,
    ...SOUND,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    'use_metadata_tags',
    '-metadata',
    `com.apple.quicktime.location.ISO6709=${LOCATION_MARKER}`,
    '-metadata',
    `title=${TITLE_MARKER}`,
    '-f',
    'mov',
  ],
  m4a: [...SOUND, '-c:a', 'aac', '-metadata', `title=${TITLE_MARKER}`, '-metadata', `comment=${LOCATION_MARKER}`, '-f', 'ipod'],
  mp3: [...SOUND, '-c:a', 'libmp3lame', '-metadata', `title=${TITLE_MARKER}`, '-metadata', `comment=${LOCATION_MARKER}`, '-f', 'mp3'],
  wav: [...SOUND, '-c:a', 'pcm_s16le', '-metadata', `title=${TITLE_MARKER}`, '-f', 'wav'],
};

export const CLIP_CONTENT_TYPE: Record<ClipKind, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4a: 'audio/x-m4a',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

/** A one second clip tagged with a title and a location. */
export function makeClip(kind: ClipKind): Buffer {
  if (!FFMPEG) throw new Error('ffmpeg is not available on this host');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-fixture-'));
  try {
    const out = path.join(dir, `clip.${kind}`);
    const run = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...ARGS[kind], out], { encoding: 'utf8' });
    if (run.status !== 0 || !fs.existsSync(out)) throw new Error(`Could not build a ${kind} fixture: ${run.stderr}`);
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** What ffmpeg says is in a file: its tags and its streams. */
export function probeText(bytes: Buffer, extension: string): string {
  if (!FFMPEG) throw new Error('ffmpeg is not available on this host');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-probe-'));
  try {
    const file = path.join(dir, `probe.${extension}`);
    fs.writeFileSync(file, bytes);
    // With no output, ffmpeg prints the input on stderr and exits 1.
    return spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** True when the file still says where it was made or what it was called. */
export function carriesMarkers(bytes: Buffer, extension: string): boolean {
  const said = probeText(bytes, extension);
  return (
    bytes.includes(TITLE_MARKER) ||
    bytes.includes(LOCATION_MARKER) ||
    said.includes(TITLE_MARKER) ||
    /location/i.test(said) ||
    said.includes('153.0251')
  );
}

// ---------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------

/**
 * A photo as a phone writes it: tagged with the make of the phone, a location
 * in Brisbane and, if asked, a rotation, which is the one tag a re-encode must
 * apply before it drops the rest or a portrait photo turns on its side.
 */
export async function makePhoto(
  format: 'jpeg' | 'png' | 'webp' = 'jpeg',
  options: { width?: number; height?: number; orientation?: number } = {}
): Promise<Buffer> {
  const { width = 40, height = 20, orientation } = options;
  const photo = sharp({ create: { width, height, channels: 3, background: '#cc3333' } })
    .toFormat(format)
    .withExif({
      IFD0: { Make: PHONE_MARKER },
      IFD3: {
        GPSLatitudeRef: 'S',
        GPSLatitude: '27/1 28/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '153/1 1/1 0/1',
      },
    });
  return (orientation ? photo.withMetadata({ orientation }) : photo).toBuffer();
}

/** A small GIF. The format has no place for a location, so it is stored as sent. */
export function makeGif(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#3366cc' } }).gif().toBuffer();
}

/** True when the picture still holds EXIF, which is where a phone writes its location. */
export async function pictureCarriesExif(bytes: Buffer): Promise<boolean> {
  const { exif } = await sharp(bytes).metadata();
  return exif !== undefined || bytes.includes(PHONE_MARKER);
}
