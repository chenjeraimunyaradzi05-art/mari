/**
 * Integration test for course enrollment endpoints
 * - Tests auth requirement on /courses/me and /courses/:id/enroll
 * - Tests successful enrollment flow
 *
 * Run with: npx ts-node tests/course-enrollment.test.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

interface TestContext {
  userId: string;
  courseId: string;
  token: string;
}

async function setupTestData(): Promise<TestContext> {
  console.log('Setting up test data...');
  // Create test user
  const email = `test-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash('TestPass123!', 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
    },
  });

  // Create test course
  const course = await prisma.course.create({
    data: {
      title: `Test Course ${Date.now()}`,
      slug: `test-course-${Date.now()}`,
      description: 'A test course for enrollment testing',
      isActive: true,
    },
  });

  // Generate auth token
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '1h',
  });

  return {
    userId: user.id,
    courseId: course.id,
    token,
  };
}

async function cleanupTestData(ctx: TestContext) {
  await prisma.courseEnrollment.deleteMany({ where: { userId: ctx.userId } });
  await prisma.course.deleteMany({ where: { id: ctx.courseId } });
  await prisma.user.deleteMany({ where: { id: ctx.userId } });
}

async function testAuthRequired() {
  console.log('\n🔒 Test: Auth required on /courses/me');

  const res = await fetch(`${API_BASE}/courses/me`);
  if (res.status === 401) {
    console.log('   ✅ Returned 401 Unauthorized as expected');
  } else {
    console.log(`   ❌ Expected 401, got ${res.status}`);
    process.exitCode = 1;
  }
}

async function testEnrollAuthRequired(courseId: string) {
  console.log('\n🔒 Test: Auth required on POST /courses/:id/enroll');

  const res = await fetch(`${API_BASE}/courses/${courseId}/enroll`, {
    method: 'POST',
  });
  if (res.status === 401) {
    console.log('   ✅ Returned 401 Unauthorized as expected');
  } else {
    console.log(`   ❌ Expected 401, got ${res.status}`);
    process.exitCode = 1;
  }
}

async function testEnrollSuccess(ctx: TestContext) {
  console.log('\n📚 Test: Successful enrollment');

  const res = await fetch(`${API_BASE}/courses/${ctx.courseId}/enroll`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 201) {
    const body = (await res.json()) as any;
    if (body.success && body.data?.courseId === ctx.courseId) {
      console.log('   ✅ Enrollment created successfully');
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

async function testGetMyCourses(ctx: TestContext) {
  console.log('\n📖 Test: GET /courses/me returns enrolled course');

  const res = await fetch(`${API_BASE}/courses/me`, {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
    },
  });

  if (res.status === 200) {
    const body = (await res.json()) as any;
    const courses = body.data || [];
    const found = courses.find((c: any) => c.id === ctx.courseId);
    if (found) {
      console.log('   ✅ Enrolled course returned in /courses/me');
    } else {
      console.log('   ❌ Course not found in response');
      console.log('   Courses:', JSON.stringify(courses.map((c: any) => c.id)));
      process.exitCode = 1;
    }
  } else {
    console.log(`   ❌ Expected 200, got ${res.status}`);
    process.exitCode = 1;
  }
}

async function testIdempotentEnroll(ctx: TestContext) {
  console.log('\n🔄 Test: Idempotent re-enrollment');

  const res = await fetch(`${API_BASE}/courses/${ctx.courseId}/enroll`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
    },
  });

  // Should still return 201 or 200 (upsert is safe)
  if (res.status === 200 || res.status === 201) {
    console.log('   ✅ Re-enrollment handled gracefully');
  } else {
    console.log(`   ❌ Unexpected status ${res.status}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('========================================');
  console.log('  Course Enrollment Integration Tests  ');
  console.log('========================================');
  console.log(`API Base: ${API_BASE}`);

  let ctx: TestContext | null = null;

  try {
    ctx = await setupTestData();
    console.log(`Created test user: ${ctx.userId}`);
    console.log(`Created test course: ${ctx.courseId}`);

    await testAuthRequired();
    await testEnrollAuthRequired(ctx.courseId);
    await testEnrollSuccess(ctx);
    await testGetMyCourses(ctx);
    await testIdempotentEnroll(ctx);

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
