/**
 * ATHENA Platform - Admin Account Seed
 *
 * Creates or updates the platform administrator account.
 *
 * Credentials are environment-driven and never hardcoded:
 *   ADMIN_EMAIL     - defaults to admin@athena.com
 *   ADMIN_PASSWORD  - if unset, a strong random password is generated and
 *                     returned to the caller exactly once, then discarded.
 *
 * The generated password is only ever returned in memory - it is not written
 * to the database in plaintext, not logged by this module, and not recoverable
 * afterwards. If it is lost, re-run with ADMIN_PASSWORD set to rotate it.
 */

import { PrismaClient, Persona, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;

/** Character set excludes look-alike glyphs (0/O, 1/l/I) for transcription safety. */
const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';

/**
 * Cryptographically secure random password, rejection-sampled so every
 * character is uniformly distributed over the alphabet (no modulo bias).
 */
export function generatePassword(length = 24): string {
  const alphabetLength = PASSWORD_ALPHABET.length;
  const maxUnbiased = Math.floor(256 / alphabetLength) * alphabetLength;
  let out = '';

  while (out.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (byte >= maxUnbiased) continue; // reject to keep the distribution flat
      out += PASSWORD_ALPHABET[byte % alphabetLength];
      if (out.length === length) break;
    }
  }

  return out;
}

export interface AdminSeedResult {
  email: string;
  /** Present only when the password was generated here. Shown once, never stored. */
  generatedPassword?: string;
  /** True when the account did not exist before this run. */
  created: boolean;
  userId: string;
}

export interface AdminSeedOptions {
  email?: string;
  password?: string;
  /** Reset the password on an account that already exists. Defaults to false. */
  rotateExisting?: boolean;
}

/**
 * Creates the admin account, or returns the existing one untouched.
 *
 * An existing admin's password is left alone unless `rotateExisting` is set,
 * so re-running the seeder cannot silently lock anyone out.
 */
export async function seedAdmin(
  prisma: PrismaClient,
  options: AdminSeedOptions = {}
): Promise<AdminSeedResult> {
  const email = (options.email ?? process.env.ADMIN_EMAIL ?? 'admin@athena.com')
    .trim()
    .toLowerCase();

  const suppliedPassword = options.password ?? process.env.ADMIN_PASSWORD;

  if (suppliedPassword && suppliedPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters (received ${suppliedPassword.length}).`
    );
  }

  const generatedPassword = suppliedPassword ? undefined : generatePassword();
  const password = suppliedPassword ?? generatedPassword!;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { email },
      data: {
        role: UserRole.ADMIN,
        emailVerified: true,
        ...(options.rotateExisting ? { passwordHash } : {}),
      },
      select: { id: true },
    });

    return {
      email,
      userId: updated.id,
      created: false,
      // Only hand back a generated password if it was actually applied.
      ...(options.rotateExisting && generatedPassword ? { generatedPassword } : {}),
    };
  }

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Platform',
      lastName: 'Administrator',
      displayName: 'Admin',
      role: UserRole.ADMIN,
      persona: Persona.EMPLOYER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      city: 'Sydney',
      state: 'NSW',
      country: 'Australia',
      headline: 'Platform Administrator',
      referralCode: `ADM${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    },
    select: { id: true },
  });

  return {
    email,
    userId: created.id,
    created: true,
    ...(generatedPassword ? { generatedPassword } : {}),
  };
}

// Allow running standalone: `ts-node prisma/seeds/admin.seed.ts`
if (require.main === module) {
  const prisma = new PrismaClient();
  seedAdmin(prisma, { rotateExisting: process.env.ADMIN_ROTATE === 'true' })
    .then((result) => {
      console.log('========================================');
      console.log('  ATHENA Admin Account');
      console.log('========================================');
      console.log(`  Email   : ${result.email}`);
      console.log(`  Status  : ${result.created ? 'created' : 'already existed'}`);
      if (result.generatedPassword) {
        console.log(`  Password: ${result.generatedPassword}`);
        console.log('  ^ shown once - store it in your password manager now.');
      } else {
        console.log('  Password: unchanged (set ADMIN_PASSWORD and ADMIN_ROTATE=true to rotate)');
      }
      console.log('========================================');
    })
    .catch((error) => {
      console.error('Admin seed failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
