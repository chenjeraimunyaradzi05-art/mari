import fs from 'fs/promises';
import path from 'path';

export interface SafetyReportRecord {
  id: string;
  userId: string;
  targetType: 'post' | 'video' | 'user' | 'message' | 'channel' | 'other';
  targetId?: string;
  reason: string;
  details?: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface SafetyBlockRecord {
  id: string;
  userId: string;
  blockedUserId: string;
  reason?: string;
  createdAt: string;
}

interface SafetyStoreData {
  reports: SafetyReportRecord[];
  blocks: SafetyBlockRecord[];
}

const STORE_PATH = path.join(__dirname, '..', 'data', 'safety-store.json');

async function ensureStoreDir() {
  const dir = path.dirname(STORE_PATH);
  await fs.mkdir(dir, { recursive: true });
}

export async function readSafetyStore(): Promise<SafetyStoreData> {
  try {
    const data = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(data) as SafetyStoreData;
  } catch {
    await ensureStoreDir();
    const empty: SafetyStoreData = { reports: [], blocks: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

export async function writeSafetyStore(store: SafetyStoreData): Promise<void> {
  await ensureStoreDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}
