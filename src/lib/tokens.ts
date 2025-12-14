import crypto from 'crypto';
import { prisma } from './prisma';

function hashToken(plain: string) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

export async function createPersonalAccessToken(userId: string, name = 'api-token') {
  const plain = crypto.randomBytes(32).toString('hex');
  const hashed = hashToken(plain);

  const row = await prisma.personalAccessToken.create({
    data: {
      tokenableId: userId,
      tokenableType: 'App\\Models\\User',
      name,
      token: hashed,
      abilities: null,
    },
  });

  if (!row) throw new Error('Failed to create token');

  return `${row.id}|${plain}`;
}

export async function verifyPersonalAccessToken(plainToken: string) {
  if (!plainToken || !plainToken.includes('|')) return null;
  const [idStr, tokenPlain] = plainToken.split('|');
  const hashed = hashToken(tokenPlain);

  // find by both id and token to enforce composite uniqueness
  const row = await prisma.personalAccessToken.findFirst({ where: { id: Number(idStr), token: hashed as any } });
  if (!row) return null;

  await prisma.personalAccessToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return row;
}

export async function revokePersonalAccessToken(plainToken: string) {
  if (!plainToken || !plainToken.includes('|')) return false;
  const [idStr, tokenPlain] = plainToken.split('|');
  const hashed = hashToken(tokenPlain);
  const row = await prisma.personalAccessToken.findFirst({ where: { id: Number(idStr), token: hashed as any } });
  if (!row) return false;
  await prisma.personalAccessToken.delete({ where: { id: row.id } });
  return true;
}

export async function revokeAllPersonalAccessTokensForUser(userId: string) {
  await prisma.personalAccessToken.deleteMany({ where: { tokenableId: userId, tokenableType: 'App\\Models\\User' } });
}

export async function getUserFromRequest(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  const row = await verifyPersonalAccessToken(token);
  if (!row) return null;
  const userId = String(row.tokenable_id);
  return userId;
}

export default {
  createPersonalAccessToken,
  verifyPersonalAccessToken,
  revokePersonalAccessToken,
  revokeAllPersonalAccessTokensForUser,
  getUserFromRequest,
};
