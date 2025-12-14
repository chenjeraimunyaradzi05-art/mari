const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.TURBOTAX_DATA_DIR || path.join(__dirname, '..', 'data');
const MASTER_KEY = process.env.TURBOTAX_MASTER_KEY || process.env.MASTER_KEY || null;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureKey() {
  if (!MASTER_KEY) throw new Error('Missing MASTER_KEY/TURBOTAX_MASTER_KEY env var for encryption');
}

function encryptPayload(payload) {
  ensureKey();
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(String(MASTER_KEY)).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decryptPayload(blob) {
  ensureKey();
  const data = Buffer.from(blob, 'base64');
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const ciphertext = data.slice(28);
  const key = crypto.createHash('sha256').update(String(MASTER_KEY)).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

function tokenPathFor(userId) {
  return path.join(DATA_DIR, `tokens_${userId}.enc`);
}

async function saveTokens(userId, tokens) {
  const file = tokenPathFor(userId);
  const blob = encryptPayload(tokens);
  await fs.promises.writeFile(file, blob, { encoding: 'utf8', mode: 0o600 });
  return true;
}

async function getTokens(userId) {
  const file = tokenPathFor(userId);
  if (!fs.existsSync(file)) return null;
  const blob = await fs.promises.readFile(file, 'utf8');
  return decryptPayload(blob);
}

async function savePII(userId, piiData) {
  const file = path.join(DATA_DIR, `pii_${userId}.enc`);
  const blob = encryptPayload(piiData);
  await fs.promises.writeFile(file, blob, { encoding: 'utf8', mode: 0o600 });
  return true;
}

async function getPII(userId) {
  const file = path.join(DATA_DIR, `pii_${userId}.enc`);
  if (!fs.existsSync(file)) return null;
  const blob = await fs.promises.readFile(file, 'utf8');
  return decryptPayload(blob);
}

module.exports = { saveTokens, getTokens, savePII, getPII, encryptPayload, decryptPayload };
