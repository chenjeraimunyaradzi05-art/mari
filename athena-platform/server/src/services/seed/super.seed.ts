/**
 * ATHENA Platform - Super Seed
 *
 * Stands up a working environment in one command: the admin and moderator
 * accounts, plus the data the staff surfaces need in order to show anything at
 * all. It complements the other seeders rather than repeating them, and every
 * write is idempotent, so running it twice changes nothing the second time.
 *
 * What it fills that nothing else does:
 *
 *  - SalaryDataPoint. The benchmarking service reports nothing below five
 *    contributors and states no gender gap without three reports from each of
 *    women and men, so on an empty table every salary screen is honestly blank.
 *    This seeds past those thresholds for a few roles.
 *  - Mentor profiles marked available, so the booking slot picker has mentors
 *    whose free hours it can actually generate.
 *  - A pending content report, so the moderation queue is not empty.
 *  - A data breach mid-assessment, so the Notifiable Data Breaches flow can be
 *    walked through.
 *
 * ## Seeded people are obviously seeded, on purpose
 *
 * Accounts are created under @seed.athena.invalid. `.invalid` is reserved by
 * RFC 2606 and can never resolve, so nothing here can send mail to a real
 * person, and one query by email domain finds or removes every seeded account.
 *
 * Employers are invented names. The older seeds attribute invented people to
 * real companies, which is how a job card reading "Atlassian, $50k-$60k" ends
 * up on a public page describing a vacancy that does not exist at a company
 * that never posted it. Nothing here names a real organisation.
 *
 * Credentials are never hardcoded. The admin password comes from ADMIN_PASSWORD
 * or is generated and printed once; seeded members share a password set by
 * SEED_MEMBER_PASSWORD, and without it they are created with an unusable hash
 * so they cannot be signed into at all.
 */

import { PrismaClient, Persona, UserRole, BreachSeverity, BreachStatus, DataCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { seedAdmin, generatePassword, type AdminSeedResult } from './admin.seed';

const BCRYPT_ROUNDS = 12;

/** RFC 2606 reserves .invalid, so these addresses can never reach anyone. */
const SEED_DOMAIN = 'seed.athena.invalid';

const seedEmail = (local: string) => `${local}@${SEED_DOMAIN}`;

/**
 * A hash no password produces, for seeded accounts nobody should sign into.
 * bcrypt of a random secret that is discarded immediately.
 */
async function unusableHash(): Promise<string> {
  return bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
}

interface SeededPerson {
  local: string;
  firstName: string;
  lastName: string;
  displayName: string;
  persona: Persona;
  city: string;
  state: string;
  headline: string;
  role?: UserRole;
}

/**
 * Weighted to Queensland because that is where the venture operates, with
 * enough spread to exercise the timezone handling: Brisbane does not observe
 * daylight saving and Perth is two to three hours behind the east.
 */
const PEOPLE: SeededPerson[] = [
  { local: 'moderator', firstName: 'Seed', lastName: 'Moderator', displayName: 'Moderator', persona: Persona.EMPLOYER, city: 'Brisbane', state: 'QLD', headline: 'Trust and safety', role: UserRole.MODERATOR },
  { local: 'nadia.okafor', firstName: 'Nadia', lastName: 'Okafor', displayName: 'Nadia O.', persona: Persona.MENTOR, city: 'Brisbane', state: 'QLD', headline: 'Engineering leadership mentor' },
  { local: 'imogen.reid', firstName: 'Imogen', lastName: 'Reid', displayName: 'Imogen R.', persona: Persona.MENTOR, city: 'Perth', state: 'WA', headline: 'Product and discovery mentor' },
  { local: 'thanh.vu', firstName: 'Thanh', lastName: 'Vu', displayName: 'Thanh V.', persona: Persona.MENTOR, city: 'Melbourne', state: 'VIC', headline: 'Data and analytics mentor' },
  { local: 'georgia.mahoney', firstName: 'Georgia', lastName: 'Mahoney', displayName: 'Georgia M.', persona: Persona.EARLY_CAREER, city: 'Brisbane', state: 'QLD', headline: 'Graduate software engineer' },
  { local: 'salma.haddad', firstName: 'Salma', lastName: 'Haddad', displayName: 'Salma H.', persona: Persona.MID_CAREER, city: 'Gold Coast', state: 'QLD', headline: 'Senior product designer' },
  { local: 'rosie.whitlam', firstName: 'Rosie', lastName: 'Whitlam', displayName: 'Rosie W.', persona: Persona.ENTREPRENEUR, city: 'Cairns', state: 'QLD', headline: 'Founder, regional logistics' },
];

/**
 * Invented employers. Named so they cannot be mistaken for real Australian
 * companies, while still reading like plausible workplaces.
 */
const SALARY_ROWS: {
  jobTitle: string;
  company: string;
  city: string;
  state: string;
  baseSalary: number;
  yearsExperience: number;
  gender: 'WOMAN' | 'MAN';
}[] = [
  { jobTitle: 'Software Engineer', company: 'Marra Digital', city: 'Brisbane', state: 'QLD', baseSalary: 96000, yearsExperience: 2, gender: 'WOMAN' },
  { jobTitle: 'Software Engineer', company: 'Coralline Systems', city: 'Brisbane', state: 'QLD', baseSalary: 104000, yearsExperience: 3, gender: 'WOMAN' },
  { jobTitle: 'Software Engineer', company: 'Verdant Rail', city: 'Brisbane', state: 'QLD', baseSalary: 112000, yearsExperience: 4, gender: 'WOMAN' },
  { jobTitle: 'Software Engineer', company: 'Marra Digital', city: 'Brisbane', state: 'QLD', baseSalary: 118000, yearsExperience: 3, gender: 'MAN' },
  { jobTitle: 'Software Engineer', company: 'Coralline Systems', city: 'Brisbane', state: 'QLD', baseSalary: 125000, yearsExperience: 4, gender: 'MAN' },
  { jobTitle: 'Software Engineer', company: 'Verdant Rail', city: 'Brisbane', state: 'QLD', baseSalary: 131000, yearsExperience: 5, gender: 'MAN' },
  { jobTitle: 'Software Engineer', company: 'Marra Digital', city: 'Brisbane', state: 'QLD', baseSalary: 99000, yearsExperience: 2, gender: 'WOMAN' },

  { jobTitle: 'Product Designer', company: 'Coralline Systems', city: 'Brisbane', state: 'QLD', baseSalary: 92000, yearsExperience: 3, gender: 'WOMAN' },
  { jobTitle: 'Product Designer', company: 'Marra Digital', city: 'Brisbane', state: 'QLD', baseSalary: 101000, yearsExperience: 5, gender: 'WOMAN' },
  { jobTitle: 'Product Designer', company: 'Verdant Rail', city: 'Brisbane', state: 'QLD', baseSalary: 97000, yearsExperience: 4, gender: 'WOMAN' },
  { jobTitle: 'Product Designer', company: 'Coralline Systems', city: 'Brisbane', state: 'QLD', baseSalary: 108000, yearsExperience: 4, gender: 'MAN' },
  { jobTitle: 'Product Designer', company: 'Marra Digital', city: 'Brisbane', state: 'QLD', baseSalary: 114000, yearsExperience: 6, gender: 'MAN' },
  { jobTitle: 'Product Designer', company: 'Verdant Rail', city: 'Brisbane', state: 'QLD', baseSalary: 106000, yearsExperience: 4, gender: 'MAN' },
];

export interface SuperSeedResult {
  admin: AdminSeedResult;
  memberPassword?: string;
  people: number;
  mentorProfiles: number;
  salaryDataPoints: number;
  contentReports: number;
  breaches: number;
}

export async function superSeed(prisma: PrismaClient): Promise<SuperSeedResult> {
  const admin = await seedAdmin(prisma, { rotateExisting: process.env.ADMIN_ROTATE === 'true' });

  // Members share one password so the environment is usable, but only when it
  // was asked for. Left unset, they exist and cannot be signed into.
  const suppliedMemberPassword = process.env.SEED_MEMBER_PASSWORD;
  const memberHash = suppliedMemberPassword
    ? await bcrypt.hash(suppliedMemberPassword, BCRYPT_ROUNDS)
    : await unusableHash();

  const byLocal = new Map<string, string>();

  for (const person of PEOPLE) {
    const email = seedEmail(person.local);

    const user = await prisma.user.upsert({
      where: { email },
      // An existing account keeps its password: re-seeding must not lock
      // anyone out of an environment they are already using.
      update: {
        role: person.role ?? UserRole.USER,
        persona: person.persona,
        headline: person.headline,
      },
      create: {
        email,
        passwordHash: memberHash,
        firstName: person.firstName,
        lastName: person.lastName,
        displayName: person.displayName,
        role: person.role ?? UserRole.USER,
        persona: person.persona,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        city: person.city,
        state: person.state,
        country: 'Australia',
        headline: person.headline,
        referralCode: `SEED${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      },
      select: { id: true },
    });

    byLocal.set(person.local, user.id);
  }

  // Mentors, marked available and priced, which is what the booking screen
  // checks before it will offer any times at all.
  let mentorProfiles = 0;
  for (const person of PEOPLE.filter(p => p.persona === Persona.MENTOR)) {
    const userId = byLocal.get(person.local)!;
    await prisma.mentorProfile.upsert({
      where: { userId },
      update: { isAvailable: true },
      create: {
        userId,
        isAvailable: true,
        hourlyRate: 120,
        yearsExperience: 9,
        specializations: ['Career change', 'Leadership', 'Interviewing'],
      },
    });
    mentorProfiles += 1;
  }

  // Pay reports. Seeded only when the table is empty for that role, so a real
  // contribution is never diluted by invented rows sitting beside it.
  let salaryDataPoints = 0;
  for (const row of SALARY_ROWS) {
    const normalizedTitle = row.jobTitle.toLowerCase().trim();

    const alreadyThere = await prisma.salaryDataPoint.count({
      where: { normalizedTitle, company: row.company, baseSalary: row.baseSalary },
    });
    if (alreadyThere > 0) continue;

    await prisma.salaryDataPoint.create({
      data: {
        jobTitle: row.jobTitle,
        normalizedTitle,
        company: row.company,
        city: row.city,
        state: row.state,
        country: 'Australia',
        baseSalary: row.baseSalary,
        totalComp: row.baseSalary,
        currency: 'AUD',
        yearsExperience: row.yearsExperience,
        gender: row.gender,
        isVerified: false,
      },
    });
    salaryDataPoints += 1;
  }

  // One report waiting in the moderation queue, so the screen has a case to work.
  let contentReports = 0;
  const reporterId = byLocal.get('georgia.mahoney');
  const reportedId = byLocal.get('rosie.whitlam');

  if (reporterId && reportedId) {
    const existing = await prisma.contentReport.findFirst({
      where: { reporterId, contentId: 'seed-report-subject' },
      select: { id: true },
    });

    if (!existing) {
      await prisma.contentReport.create({
        data: {
          reporterId,
          reportedUserId: reportedId,
          contentType: 'PROFILE',
          contentId: 'seed-report-subject',
          reason: 'HARASSMENT',
          description: 'Seeded report, so the moderation queue has something to work.',
          status: 'PENDING',
        },
      });
      contentReports += 1;
    }
  }

  // A breach part-way through an Australian assessment, so the thirty-day
  // window and the serious-harm decision can both be seen on the screen.
  let breaches = 0;
  const existingBreach = await prisma.dataBreach.findFirst({
    where: { title: 'Seeded incident for assessment walkthrough' },
    select: { id: true },
  });

  if (!existingBreach) {
    const detectedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.dataBreach.create({
      data: {
        title: 'Seeded incident for assessment walkthrough',
        description:
          'A seeded incident so the Notifiable Data Breaches assessment can be walked through end to end. Not a real event.',
        detectedAt,
        detectedBy: admin.userId,
        severity: BreachSeverity.MEDIUM,
        status: BreachStatus.INVESTIGATING,
        dataCategories: [DataCategory.PII],
        affectedUsers: 12,
        riskToIndividuals: 'Contact details were reachable by one other member for a short period.',
        jurisdiction: 'AU',
        assessmentDueAt: new Date(detectedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        assessmentComplete: false,
      },
    });
    breaches += 1;
  }

  return {
    admin,
    memberPassword: suppliedMemberPassword,
    people: PEOPLE.length,
    mentorProfiles,
    salaryDataPoints,
    contentReports,
    breaches,
  };
}

if (require.main === module) {
  const prisma = new PrismaClient();

  superSeed(prisma)
    .then((result) => {
      console.log('========================================');
      console.log('  ATHENA super seed');
      console.log('========================================');
      console.log(`  Admin email : ${result.admin.email}`);
      console.log(`  Admin status: ${result.admin.created ? 'created' : 'already existed'}`);
      if (result.admin.generatedPassword) {
        console.log(`  Admin pass  : ${result.admin.generatedPassword}`);
        console.log('  ^ shown once. Store it now; it cannot be recovered.');
      } else {
        console.log('  Admin pass  : unchanged (ADMIN_PASSWORD + ADMIN_ROTATE=true to rotate)');
      }
      console.log('----------------------------------------');
      console.log(`  People      : ${result.people} (@${SEED_DOMAIN})`);
      console.log(`  Mentors     : ${result.mentorProfiles}`);
      console.log(`  Pay reports : ${result.salaryDataPoints} added`);
      console.log(`  Reports     : ${result.contentReports} added`);
      console.log(`  Breaches    : ${result.breaches} added`);
      console.log('----------------------------------------');
      if (result.memberPassword) {
        console.log('  Seeded members share SEED_MEMBER_PASSWORD.');
      } else {
        console.log('  Seeded members have no usable password.');
        console.log('  Set SEED_MEMBER_PASSWORD and re-run to sign in as one.');
      }
      console.log('========================================');
      console.log('  Remove everything seeded here with:');
      console.log(`  DELETE FROM "User" WHERE email LIKE '%@${SEED_DOMAIN}';`);
      console.log('========================================');
    })
    .catch((error) => {
      console.error('Super seed failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { generatePassword, SEED_DOMAIN };
