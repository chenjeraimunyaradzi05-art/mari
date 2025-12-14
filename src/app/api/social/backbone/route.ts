import { NextResponse } from 'next/server';

// Dummy model for backbone data
const backbone = {
  graph: {
    followers: { stored: 10 },
    following: { stored: 5 },
    close_friends: { count: 2 },
  },
  invites: { pending_count: 1, items: [] },
  communities: { owned: [] },
  events: { upcoming: [] },
};

export async function GET() {
  return NextResponse.json({ data: backbone, meta: { cache: { stored_at: new Date().toISOString(), hit: false } } });
}
