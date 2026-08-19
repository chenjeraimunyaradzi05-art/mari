import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

export function buildTotpAuthUrl(params: {
  issuer: string;
  accountName: string;
  secret: string;
}): string {
  const label = `${params.issuer}:${params.accountName}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
}

export function verifyTotpCode(code: string, secret: string, now = Date.now()): boolean {
  const normalizedCode = normalizeTotpCode(code);
  if (!normalizedCode) return false;

  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const candidate = generateTotpCode(
      secret,
      now + offset * TOTP_STEP_SECONDS * 1000
    );

    if (
      crypto.timingSafeEqual(
        Buffer.from(candidate),
        Buffer.from(normalizedCode)
      )
    ) {
      return true;
    }
  }

  return false;
}

export function normalizeTotpCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const normalized = code.replace(/\s|-/g, '');
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

function generateTotpCode(secret: string, now: number): string {
  const key = base32Decode(secret);
  const counter = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  const otp = binary % 10 ** TOTP_DIGITS;

  return otp.toString().padStart(TOTP_DIGITS, '0');
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(secret: string): Buffer {
  const normalized = secret.replace(/=|\s|-/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error('Invalid TOTP secret');
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}
