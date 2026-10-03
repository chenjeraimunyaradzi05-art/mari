#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Confirms the email address of a member the full-stack browser suite has just
 * registered, standing in for her clicking the link in the email.
 *
 * Registration opens no session: she has to confirm her address before she can
 * sign in. The link is mailed, and in development the API only logs that a
 * mail would have been sent, without its contents. The tokens are stored
 * hashed, so a test cannot read one back out of the database either. What it
 * can do, on a disposable database, is mark the address confirmed, which is
 * the one change the link makes. The step that the link itself works is
 * covered against a real database, with the token captured from the mailer's
 * arguments, in server/tests/integration/auth-recovery.test.ts.
 *
 * It refuses anything that is not a throwaway member: the address must be on
 * the reserved .test domain the suite registers with, and the database must be
 * local, by the same two-part guard as seed-e2e.js.
 *
 * Usage: node scripts/verify-e2e-member.js e2e.member.1a2b3c@athena-e2e.test
 */

const { PrismaClient } = require('@prisma/client');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'db', 'host.docker.internal']);
const E2E_DOMAIN = '@athena-e2e.test';

function refuse(message) {
  console.error(`\n  verify-e2e-member: ${message}\n`);
  process.exit(1);
}

function assertDisposableDatabase() {
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    refuse('NODE_ENV is production. This is a test helper; it never goes near a real database.');
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
    refuse(`DATABASE_URL points at ${host}, which is not a local database.`);
  }
}

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email.endsWith(E2E_DOMAIN)) refuse(`Pass the address of a member on ${E2E_DOMAIN}. Got "${email}".`);

  assertDisposableDatabase();
  const prisma = new PrismaClient();

  try {
    const member = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!member) refuse(`No member is registered with ${email}.`);

    await prisma.user.update({
      where: { id: member.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
    await prisma.verificationToken.deleteMany({ where: { userId: member.id, type: 'EMAIL_VERIFICATION' } });

    console.log(`verify-e2e-member: ${email} is confirmed.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('verify-e2e-member failed:', error);
  process.exit(1);
});
