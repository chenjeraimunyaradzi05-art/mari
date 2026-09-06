/**
 * What a file actually is, read from its first bytes.
 *
 * A browser sends whatever MIME type it likes with an upload; the allow-list
 * in the media routes only ever checked that claim. This reads the file's
 * signature and says whether the claim is true, so an executable, an HTML
 * page or an SVG with a script in it cannot come in wearing an image's
 * content type. It is deliberately small: the handful of formats the
 * platform accepts, nothing else.
 */

export type DetectedType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/svg+xml'
  | 'application/pdf'
  | 'application/zip'
  | 'application/x-ole'
  | 'video/mp4'
  | 'video/quicktime'
  | 'audio/mp4'
  | 'video/webm'
  | 'audio/mpeg'
  | 'audio/aac'
  | 'audio/wav'
  | 'audio/ogg'
  | 'text/vtt'
  | 'text/plain'
  | 'text/html'
  | 'application/x-executable';

const ascii = (buffer: Buffer, start: number, length: number) => buffer.subarray(start, start + length).toString('latin1');
const startsWith = (buffer: Buffer, bytes: number[], offset = 0) => buffer.length >= offset + bytes.length && bytes.every((b, i) => buffer[offset + i] === b);

/** Text prefix with a UTF-8 BOM allowed, lower-cased, whitespace-trimmed. */
function textHead(buffer: Buffer): string {
  const skip = startsWith(buffer, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  return buffer.subarray(skip, skip + 512).toString('utf8').trimStart().toLowerCase();
}

/** True when the first bytes look like text and not a binary format. */
function looksLikeText(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 512);
  for (const byte of head) {
    // NUL and most control characters do not occur in text.
    if (byte === 0 || (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d && byte !== 0x0c)) return false;
  }
  return true;
}

/** The type the bytes say, or null when nothing recognisable is there. */
export function sniffContentType(buffer: Buffer): DetectedType | null {
  if (!buffer || buffer.length < 4) return null;

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(buffer, 0, 4) === 'GIF8') return 'image/gif';
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WAVE') return 'audio/wav';
  if (ascii(buffer, 0, 4) === '%PDF') return 'application/pdf';
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) || startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])) return 'application/zip';
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'application/x-ole';
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  if (ascii(buffer, 0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(buffer, 0, 3) === 'ID3') return 'audio/mpeg';
  if (buffer[0] === 0xff && (buffer[1] & 0xe6) === 0xe2 && (buffer[1] & 0x18) !== 0x08) {
    // MPEG audio frame sync (layer bits set, reserved version excluded).
    return 'audio/mpeg';
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) return 'audio/aac'; // ADTS
  if (startsWith(buffer, [0x4d, 0x5a])) return 'application/x-executable'; // MZ
  if (startsWith(buffer, [0x7f, 0x45, 0x4c, 0x46])) return 'application/x-executable'; // ELF
  if (startsWith(buffer, [0xcf, 0xfa, 0xed, 0xfe]) || startsWith(buffer, [0xca, 0xfe, 0xba, 0xbe])) return 'application/x-executable'; // Mach-O

  if (buffer.length >= 12 && ascii(buffer, 4, 4) === 'ftyp') {
    const brand = ascii(buffer, 8, 4);
    if (brand.startsWith('qt')) return 'video/quicktime';
    if (brand.startsWith('M4A') || brand.startsWith('M4B')) return 'audio/mp4';
    return 'video/mp4';
  }

  if (looksLikeText(buffer)) {
    const head = textHead(buffer);
    if (head.startsWith('webvtt')) return 'text/vtt';
    if (head.startsWith('<?xml') && head.includes('<svg')) return 'image/svg+xml';
    if (head.startsWith('<svg')) return 'image/svg+xml';
    if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.includes('<script')) return 'text/html';
    return 'text/plain';
  }

  return null;
}

/** The detected types a declared type may legitimately be. */
const ACCEPTABLE: Record<string, DetectedType[]> = {
  'image/jpeg': ['image/jpeg'],
  'image/jpg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/gif': ['image/gif'],
  'image/webp': ['image/webp'],
  'application/pdf': ['application/pdf'],
  'application/msword': ['application/x-ole'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['application/zip'],
  'video/mp4': ['video/mp4'],
  'video/quicktime': ['video/quicktime', 'video/mp4'],
  'video/webm': ['video/webm'],
  'audio/mpeg': ['audio/mpeg'],
  'audio/mp3': ['audio/mpeg'],
  'audio/mp4': ['audio/mp4', 'video/mp4'],
  'audio/x-m4a': ['audio/mp4', 'video/mp4'],
  'audio/aac': ['audio/aac', 'audio/mp4', 'video/mp4'],
  'audio/wav': ['audio/wav'],
  'audio/x-wav': ['audio/wav'],
  'audio/ogg': ['audio/ogg'],
  'audio/webm': ['video/webm'],
  'text/vtt': ['text/vtt'],
  'text/plain': ['text/plain', 'text/vtt'],
};

export interface ContentCheck {
  ok: boolean;
  detected: DetectedType | null;
  reason?: string;
}

/**
 * Whether the bytes agree with the declared type. An unknown declared type
 * fails closed: the allow-list should have refused it already.
 */
export function checkFileContent(declaredType: string, buffer: Buffer): ContentCheck {
  const declared = (declaredType || '').toLowerCase().split(';')[0].trim();
  const detected = sniffContentType(buffer);
  const acceptable = ACCEPTABLE[declared];

  if (!acceptable) return { ok: false, detected, reason: `${declared || 'an unknown type'} is not a type this check knows` };
  if (detected === 'application/x-executable') return { ok: false, detected, reason: 'the file is a program' };
  if (detected === 'text/html' || detected === 'image/svg+xml') return { ok: false, detected, reason: `the file is ${detected}, which can carry scripts` };
  if (!detected) return { ok: false, detected, reason: 'the file does not start like any format the platform accepts' };
  if (!acceptable.includes(detected)) return { ok: false, detected, reason: `the file is ${detected}, not ${declared}` };
  return { ok: true, detected };
}
