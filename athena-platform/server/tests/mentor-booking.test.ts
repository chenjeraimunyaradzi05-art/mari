/**
 * Integration test for mentor booking endpoint
 * - Tests auth requirement on POST /mentors/:mentorId/book
 * - Tests successful booking flow
 *
 * Run with: npx ts-node tests/mentor-booking.test.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

interface TestContext {
  menteeId: string;
  mentorUserId: string;
  mentorProfileId: string;
  token: string;
}

async function setupTestData(): Promise<TestContext> {
  console.log('Setting up test data...');

  // Create mentee user
  const menteeEmail = `mentee-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash('TestPass123!', 10);

  const mentee = await prisma.user.create({
    data: {
      email: menteeEmail,
      passwordHash,
      firstName: 'Test',
      lastName: 'Mentee',
      emailVerified: true,
    },
  });

  // Create mentor user
  const mentorEmail = `mentor-${Date.now()}@example.com`;
  const mentorUser = await prisma.user.create({
    data: {
      email: mentorEmail,
      passwordHash,
      firstName: 'Test',
      lastName: 'Mentor',
      emailVerified: true,
      role: 'MENTOR',
    },
  });

  // Create mentor profile
  const mentorProfile = await prisma.mentorProfile.create({
    data: {
      userId: mentorUser.id,
      specializations: ['Career Development', 'Leadership'],
      hourlyRate: 100,
      isAvailable: true,
    },
  });

  // Generate auth token for mentee
  const token = jwt.sign({ userId: mentee.id, email: mentee.email }, JWT_SECRET, {
    expiresIn: '1h',
  });

  return {
    menteeId: mentee.id,
    mentorUserId: mentorUser.id,
    mentorProfileId: mentorProfile.id,
    token,
  };
}

async function cleanupTestData(ctx: TestContext) {
  await prisma.mentorSession.deleteMany({ where: { menteeId: ctx.menteeId } });
  await prisma.mentorProfile.deleteMany({ where: { id: ctx.mentorProfileId } });
  await prisma.user.deleteMany({ where: { id: { in: [ctx.menteeId, ctx.mentorUserId] } } });
}

async function testBookingAuthRequired(mentorUserId: string) {
  console.log('\n🔒 Test: Auth required on POST /mentors/:mentorId/book');

  const res = await fetch(`${API_BASE}/mentors/${mentorUserId}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-02-01', time: '10:00 AM', duration: 60 }),
  });
  if (res.status === 401) {
    console.log('   ✅ Returned 401 Unauthorized as expected');
  } else {
    console.log(`   ❌ Expected 401, got ${res.status}`);
    process.exitCode = 1;
  }
}

async function testBookingSuccess(ctx: TestContext) {
  console.log('\n📅 Test: Successful mentor booking');

  const res = await fetch(`${API_BASE}/mentors/${ctx.mentorUserId}/book`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      date: '2026-02-15',
      time: '2:00 PM',
      duration: 60,
      note: 'Looking forward to discussing career options',
    }),
  });

  if (res.status === 201) {
    const body = (await res.json()) as any;
    if (body.success && body.data?.status === 'REQUESTED') {
      console.log('   ✅ Mentor session booked successfully');
      console.log(`   📋 Session ID: ${body.data.id}`);
    } else {
      console.log('   ❌ Unexpected response body:', JSON.stringify(body));
      process.exitCode = 1;
    }
  } else {
    console.log(`   ❌ Expected 201, got ${res.status}`);
    const text = await res.text();
    console.log('   Response:', text);
    process.exitCode = 1;
  }
}

async function testCannotBookSelf(ctx: TestContext) {
  console.log('\n🚫 Test: Cannot book session with yourself');

  // Create a token for the mentor user
  const mentorToken = jwt.sign(
    { userId: ctx.mentorUserId, email: `mentor-test@example.com` },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const res = await fetch(`${API_BASE}/mentors/${ctx.mentorUserId}/book`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mentorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ date: '2026-02-15', time: '3:00 PM', duration: 30 }),
  });

  if (res.status === 400) {
    console.log('   ✅ Returned 400 Bad Request as expected');
  } else {
    console.log(`   ❌ Expected 400, got ${res.status}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('========================================');
  console.log('   Mentor Booking Integration Tests    ');
  console.log('========================================');
  console.log(`API Base: ${API_BASE}`);

  let ctx: TestContext | null = null;

  try {
    ctx = await setupTestData();
    console.log(`Created mentee: ${ctx.menteeId}`);
    console.log(`Created mentor: ${ctx.mentorUserId}`);

    await testBookingAuthRequired(ctx.mentorUserId);
    await testBookingSuccess(ctx);
    await testCannotBookSelf(ctx);

    console.log('\n========================================');
    if (process.exitCode === 1) {
      console.log('  ❌ Some tests failed');
    } else {
      console.log('  ✅ All tests passed!');
    }
    console.log('========================================\n');
  } catch (err) {
    console.error('Test error:', err);
    process.exitCode = 1;
  } finally {
    if (ctx) {
      await cleanupTestData(ctx);
      console.log('Cleaned up test data.');
    }
    await prisma.$disconnect();
  }
}

main();
