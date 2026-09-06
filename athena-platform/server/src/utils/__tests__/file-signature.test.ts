import { describe, it, expect } from '@jest/globals';
import { checkFileContent, sniffContentType } from '../file-signature';

const bytes = (...b: number[]) => Buffer.from(b);
const pad = (head: Buffer, length = 64) => Buffer.concat([head, Buffer.alloc(Math.max(0, length - head.length))]);

const JPEG = pad(bytes(0xff, 0xd8, 0xff, 0xe0));
const PNG = pad(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
const GIF = pad(Buffer.from('GIF89a'));
const WEBP = pad(Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WEBP')]));
const WAV = pad(Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WAVE')]));
const PDF = pad(Buffer.from('%PDF-1.7'));
const DOCX = pad(bytes(0x50, 0x4b, 0x03, 0x04));
const DOC = pad(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1));
const MP4 = pad(Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftypisom')]));
const MOV = pad(Buffer.concat([bytes(0, 0, 0, 0x14), Buffer.from('ftypqt  ')]));
const M4A = pad(Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftypM4A ')]));
const WEBM = pad(bytes(0x1a, 0x45, 0xdf, 0xa3));
const MP3_ID3 = pad(Buffer.from('ID3\x03'));
const MP3_FRAME = pad(bytes(0xff, 0xfb, 0x90, 0x00));
const AAC = pad(bytes(0xff, 0xf1, 0x50, 0x80));
const OGG = pad(Buffer.from('OggS'));
const VTT = Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nHello');
const VTT_BOM = Buffer.concat([bytes(0xef, 0xbb, 0xbf), VTT]);
const EXE = pad(Buffer.from('MZ\x90\x00'));
const ELF = pad(bytes(0x7f, 0x45, 0x4c, 0x46));
const HTML = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>');
const SVG = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const TEXT = Buffer.from('Just some notes.\nNothing else.\n');

describe('What a file actually is', () => {
  it('recognises the formats the platform accepts', () => {
    expect(sniffContentType(JPEG)).toBe('image/jpeg');
    expect(sniffContentType(PNG)).toBe('image/png');
    expect(sniffContentType(GIF)).toBe('image/gif');
    expect(sniffContentType(WEBP)).toBe('image/webp');
    expect(sniffContentType(WAV)).toBe('audio/wav');
    expect(sniffContentType(PDF)).toBe('application/pdf');
    expect(sniffContentType(DOCX)).toBe('application/zip');
    expect(sniffContentType(DOC)).toBe('application/x-ole');
    expect(sniffContentType(MP4)).toBe('video/mp4');
    expect(sniffContentType(MOV)).toBe('video/quicktime');
    expect(sniffContentType(M4A)).toBe('audio/mp4');
    expect(sniffContentType(WEBM)).toBe('video/webm');
    expect(sniffContentType(MP3_ID3)).toBe('audio/mpeg');
    expect(sniffContentType(MP3_FRAME)).toBe('audio/mpeg');
    expect(sniffContentType(AAC)).toBe('audio/aac');
    expect(sniffContentType(OGG)).toBe('audio/ogg');
    expect(sniffContentType(VTT)).toBe('text/vtt');
    expect(sniffContentType(VTT_BOM)).toBe('text/vtt');
    expect(sniffContentType(TEXT)).toBe('text/plain');
  });

  it('names the things that must never come in as media', () => {
    expect(sniffContentType(EXE)).toBe('application/x-executable');
    expect(sniffContentType(ELF)).toBe('application/x-executable');
    expect(sniffContentType(HTML)).toBe('text/html');
    expect(sniffContentType(SVG)).toBe('image/svg+xml');
    expect(sniffContentType(Buffer.alloc(2))).toBeNull();
    expect(sniffContentType(pad(bytes(0x00, 0x01, 0x02, 0x03)))).toBeNull();
  });
});

describe('Does the file match what the browser said it is', () => {
  it('passes honest uploads, including the sensible synonyms', () => {
    expect(checkFileContent('image/jpeg', JPEG).ok).toBe(true);
    expect(checkFileContent('image/png', PNG).ok).toBe(true);
    expect(checkFileContent('image/gif', GIF).ok).toBe(true);
    expect(checkFileContent('image/webp', WEBP).ok).toBe(true);
    expect(checkFileContent('application/pdf', PDF).ok).toBe(true);
    expect(checkFileContent('application/vnd.openxmlformats-officedocument.wordprocessingml.document', DOCX).ok).toBe(true);
    expect(checkFileContent('application/msword', DOC).ok).toBe(true);
    expect(checkFileContent('video/mp4', MP4).ok).toBe(true);
    expect(checkFileContent('video/quicktime', MOV).ok).toBe(true);
    expect(checkFileContent('video/webm', WEBM).ok).toBe(true);
    expect(checkFileContent('audio/mpeg', MP3_FRAME).ok).toBe(true);
    expect(checkFileContent('audio/x-m4a', M4A).ok).toBe(true);
    expect(checkFileContent('audio/aac', AAC).ok).toBe(true);
    expect(checkFileContent('audio/wav', WAV).ok).toBe(true);
    expect(checkFileContent('audio/ogg', OGG).ok).toBe(true);
    expect(checkFileContent('audio/webm', WEBM).ok).toBe(true);
    expect(checkFileContent('text/vtt', VTT_BOM).ok).toBe(true);
    expect(checkFileContent('text/plain; charset=utf-8', TEXT).ok).toBe(true);
  });

  it('refuses a file whose bytes disagree with its declared type', () => {
    expect(checkFileContent('image/png', JPEG)).toMatchObject({ ok: false, detected: 'image/jpeg' });
    expect(checkFileContent('application/pdf', DOCX)).toMatchObject({ ok: false, detected: 'application/zip' });
    expect(checkFileContent('video/mp4', WEBM)).toMatchObject({ ok: false, detected: 'video/webm' });
    expect(checkFileContent('image/jpeg', Buffer.alloc(64)).ok).toBe(false);
  });

  it('refuses programs, pages and SVGs whatever they claim to be', () => {
    expect(checkFileContent('image/png', EXE)).toMatchObject({ ok: false, reason: 'the file is a program' });
    expect(checkFileContent('image/jpeg', HTML).ok).toBe(false);
    expect(checkFileContent('image/png', SVG).ok).toBe(false);
    expect(checkFileContent('text/plain', HTML).ok).toBe(false);
    expect(checkFileContent('text/plain', SVG).ok).toBe(false);
  });

  it('fails closed on a declared type it does not know', () => {
    expect(checkFileContent('application/x-shockwave-flash', PDF).ok).toBe(false);
    expect(checkFileContent('', PDF).ok).toBe(false);
  });
});
