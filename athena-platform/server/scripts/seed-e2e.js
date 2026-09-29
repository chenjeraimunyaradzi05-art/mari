#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * The rows the full-stack browser suite needs, and nothing else.
 *
 * client/tests/critical-paths.spec.ts registers a member, finds a mentor,
 * requests a session and searches the job board. It used to do all of that
 * against whatever happened to be in the database, and accepted "nothing
 * there" as a pass at every step: an empty mentor list, a registration that
 * never left the form, a booking button that never changed. So it went green
 * on an empty database and proved nothing. It now fails unless each step
 * really happens, which means the database has to hold something to happen
 * to. This is that something:
 *
 *   - one mentor who mentors for free, so a session can be requested without a
 *     Stripe account; her working hours are the platform default (weekdays,
 *     9 to 5 in her own timezone), which the spec picks a date inside;
 *   - one published job whose title the spec searches for.
 *
 * Both are named as fixtures ("E2E Mentor", "E2E Fixture Software Engineer")
 * and live under the reserved .test domain, so nothing here can be mistaken
 * for a real person or a real vacancy, and a re-run finds the same rows
 * rather than adding more. Sessions against the fixture mentor are cleared on
 * each run so a developer running the suite twice finds her free again.
 *
 * It refuses to run against anything but a local, disposable database. The
 * guard is the same two-part test prisma/seed.ts applies: NODE_ENV alone would
 * let a shell with a production DATABASE_URL exported sail past, and the host
 * alone would not stop a production process pointed at a tunnel.
 *
 * Usage (after `npx prisma migrate deploy`):
 *   node scripts/seed-e2e.js
 */

const { PrismaClient } = require('@prisma/client');

const MENTOR_EMAIL = 'e2e.mentor@athena-e2e.test';
const MENTOR_NAME = 'E2E Mentor';
const JOB_SLUG = 'e2e-fixture-software-engineer';
const JOB_TITLE = 'E2E Fixture Software Engineer';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'db', 'host.docker.internal']);

function refuse(message) {
  console.error(`\n  seed-e2e: ${message}\n`);
  process.exit(1);
}

function assertDisposableDatabase() {
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    refuse('NODE_ENV is production. These are test fixtures; they never go near a real database.');
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) refuse('DATABASE_URL is not set. Refusing to guess which database to write to.');

  let host = '';
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    refuse('DATABASE_URL could not be parsed. Refusing to write.');
  }

  if (!LOCAL_HOSTS.has(host)) {
    refuse(`DATABASE_URL points at ${host}, which is not a local database. The fixtures go only into a disposable one.`);
  }
}

async function main() {
  assertDisposableDatabase();
  const prisma = new PrismaClient();

  try {
    const mentor = await prisma.user.upsert({
      where: { email: MENTOR_EMAIL },
      update: {},
      create: {
        email: MENTOR_EMAIL,
        firstName: 'E2E',
        lastName: 'Mentor',
        displayName: MENTOR_NAME,
        headline: 'Fixture mentor for the browser suite',
        bio: 'A fixture account the end-to-end suite books sessions with. Not a real person.',
        emailVerified: true,
        womanSelfAttested: true,
        womanVerificationStatus: 'VERIFIED',
        dateOfBirth: new Date('1985-03-14T00:00:00.000Z'),
        // Brisbane: no daylight saving, so her working day is the same UTC
        // window all year and the spec's choice of date never lands on a
        // boundary that moves.
        timezone: 'Australia/Brisbane',
      },
    });

    // A rate of zero is a real rate: she mentors for free, which is what makes
    // her bookable without a connected Stripe account (mentorAcceptsBookings).
    const profile = await prisma.mentorProfile.upsert({
      where: { userId: mentor.id },
      update: { isAvailable: true, hourlyRate: 0 },
      create: {
        userId: mentor.id,
        isAvailable: true,
        hourlyRate: 0,
        specializations: ['Career change', 'Returning to work'],
        yearsExperience: 8,
      },
    });

    const cleared = await prisma.mentorSession.deleteMany({ where: { mentorProfileId: profile.id } });

    await prisma.job.upsert({
      where: { slug: JOB_SLUG },
      update: { status: 'ACTIVE', publishedAt: new Date(), closedAt: null },
      create: {
        title: JOB_TITLE,
        slug: JOB_SLUG,
        description:
          'A fixture listing the end-to-end suite searches for. It is not a real vacancy and nobody is hiring for it.',
        postedById: mentor.id,
        status: 'ACTIVE',
        publishedAt: new Date(),
        city: 'Brisbane',
        state: 'QLD',
        isRemote: true,
      },
    });

    console.log(
      `seed-e2e: mentor "${MENTOR_NAME}" (profile ${profile.id}, ${cleared.count} old session(s) cleared) and job "${JOB_TITLE}" are in place.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('seed-e2e failed:', error);
  process.exit(1);
});
