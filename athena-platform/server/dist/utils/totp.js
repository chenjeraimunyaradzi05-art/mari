"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTotpSecret = generateTotpSecret;
exports.buildTotpAuthUrl = buildTotpAuthUrl;
exports.verifyTotpCode = verifyTotpCode;
exports.normalizeTotpCode = normalizeTotpCode;
const crypto_1 = __importDefault(require("crypto"));
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
function generateTotpSecret(bytes = 20) {
    return base32Encode(crypto_1.default.randomBytes(bytes));
}
function buildTotpAuthUrl(params) {
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
function verifyTotpCode(code, secret, now = Date.now()) {
    const normalizedCode = normalizeTotpCode(code);
    if (!normalizedCode)
        return false;
    for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
        const candidate = generateTotpCode(secret, now + offset * TOTP_STEP_SECONDS * 1000);
        if (crypto_1.default.timingSafeEqual(Buffer.from(candidate), Buffer.from(normalizedCode))) {
            return true;
        }
    }
    return false;
}
function normalizeTotpCode(code) {
    if (typeof code !== 'string')
        return null;
    const normalized = code.replace(/\s|-/g, '');
    return /^\d{6}$/.test(normalized) ? normalized : null;
}
function generateTotpCode(secret, now) {
    const key = base32Decode(secret);
    const counter = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
    const hmac = crypto_1.default.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
        (hmac[offset + 1] << 16) |
        (hmac[offset + 2] << 8) |
        hmac[offset + 3];
    const otp = binary % 10 ** TOTP_DIGITS;
    return otp.toString().padStart(TOTP_DIGITS, '0');
}
function base32Encode(buffer) {
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
function base32Decode(secret) {
    const normalized = secret.replace(/=|\s|-/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes = [];
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
//# sourceMappingURL=totp.js.map