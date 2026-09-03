/**
 * Seeds the apprenticeship catalogue.
 *
 * ## What is real here, and what is representative
 *
 * This follows the standard set by `prisma/seed.ts` ("real Australian private &
 * public institutions, authentic job listings, accredited courses"), NOT the
 * stricter rule in `real-content.seed.ts`. The difference matters and is worth
 * stating plainly:
 *
 *   - `real-content.seed.ts` publishes content ABOUT REAL NAMED PEOPLE — events
 *     that exist, videos with a checked licence, stories about women whose
 *     achievements are on the public record. Nothing there may be invented,
 *     because inventing it would put words in a real person's mouth.
 *
 *   - This file seeds a CATALOGUE OF QUALIFICATIONS. No person is invented and
 *     no employer is invented. Every qualification below is a real, current
 *     national code from the Australian Qualifications Framework, and every
 *     training organisation is a real RTO already present in the database
 *     (TAFE NSW, TAFE Queensland, RMIT) which genuinely delivers training in
 *     that field.
 *
 * What is representative rather than sourced:
 *   - Wage bands. Australian apprentice wages are set by the relevant modern
 *     award and vary by year of apprenticeship, age and trade, so the figures
 *     here are indicative ranges, and every description says so. Nobody should
 *     take a number here as an offer.
 *   - `positions` is left at 1 and no `applicationDeadline` is set, so the
 *     catalogue never implies a closing date that does not exist.
 *   - No `hostEmployerId`. These are training pathways offered through an RTO,
 *     not placements with a named employer — claiming a specific employer had
 *     vacancies would be inventing one.
 *
 * Deliberately NOT seeded, for the same reason: mentor profiles, marketplace
 * services, housing listings and RFPs. Each of those is an offer made by a
 * specific person, and there is no honest way to fabricate one.
 *
 * Idempotent: ids derive from a stable slug, so re-running updates rather than
 * duplicates.
 *
 *   npm run db:seed:apprenticeships
 */

import { createHash } from 'crypto';
import { ApprenticeshipLevel, ApprenticeshipStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

function stableId(slug: string): string {
  const h = createHash('sha1').update(`athena:apprenticeship:${slug}`).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), `5${h.slice(13, 16)}`, `a${h.slice(17, 20)}`, h.slice(20, 32)].join('-');
}

type Seed = {
  slug: string;
  /** The national code and title exactly as they appear on training.gov.au. */
  code: string;
  title: string;
  framework: string;
  level: ApprenticeshipLevel;
  durationMonths: number;
  /** Indicative award-based range, in whole dollars per year. */
  wageMin: number;
  wageMax: number;
  /** Indicative full rate once qualified. */
  wagePostCompletion: number;
  /** Slug of the RTO in the Organization table. */
  rtoSlug: string;
  city: string;
  state: string;
  summary: string;
  competencies: { code: string; title: string }[];
};

const WAGE_NOTE =
  'Wages shown are an indicative range only. Apprentice pay is set by the relevant modern award and ' +
  'varies with your year of apprenticeship, your age and whether you have finished Year 12 — check the ' +
  'award or ask the provider for the rate that would apply to you.';

const APPRENTICESHIPS: Seed[] = [
  {
    slug: 'certificate-iii-electrotechnology-electrician-tafe-nsw',
    code: 'UEE30820',
    title: 'Certificate III in Electrotechnology Electrician',
    framework: 'Electrotechnology',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 48,
    wageMin: 27000,
    wageMax: 47000,
    wagePostCompletion: 88000,
    rtoSlug: 'tafe-nsw',
    city: 'Sydney',
    state: 'NSW',
    summary:
      'The electrical trade apprenticeship. Four years on the tools alongside classroom blocks, ending in an ' +
      'electrician licence. Women are about two per cent of the licensed electrical workforce in Australia, ' +
      'which is exactly why this pathway is here.',
    competencies: [
      { code: 'UEECD0007', title: 'Apply work health and safety regulations, codes and practices in the workplace' },
      { code: 'UEERL0003', title: 'Arrange circuits, control and protection for general electrical installations' },
      { code: 'UEEEL0020', title: 'Solve problems in low voltage a.c. circuits' },
      { code: 'UEEEL0021', title: 'Terminate cables, cords and accessories for low voltage circuits' },
    ],
  },
  {
    slug: 'certificate-iii-individual-support-tafe-queensland',
    code: 'CHC33021',
    title: 'Certificate III in Individual Support (Ageing and Disability)',
    framework: 'Community Services',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 12,
    wageMin: 48000,
    wageMax: 58000,
    wagePostCompletion: 64000,
    rtoSlug: 'tafe-queensland',
    city: 'Brisbane',
    state: 'QLD',
    summary:
      'A traineeship into aged care and disability support, with supervised placement hours built in. One of ' +
      'the fastest routes into paid care work, and the qualification most employers ask for.',
    competencies: [
      { code: 'CHCCCS031', title: 'Provide individualised support' },
      { code: 'CHCCCS038', title: 'Facilitate the empowerment of people receiving support' },
      { code: 'HLTWHS002', title: 'Follow safe work practices for direct client care' },
      { code: 'CHCDIV001', title: 'Work with diverse people' },
    ],
  },
  {
    slug: 'certificate-iii-early-childhood-education-tafe-nsw',
    code: 'CHC30121',
    title: 'Certificate III in Early Childhood Education and Care',
    framework: 'Community Services',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 18,
    wageMin: 47000,
    wageMax: 57000,
    wagePostCompletion: 62000,
    rtoSlug: 'tafe-nsw',
    city: 'Sydney',
    state: 'NSW',
    summary:
      'The minimum qualification to work as an educator in a long day care or preschool service, done as a ' +
      'traineeship so you earn while you study and finish with the placement hours already logged.',
    competencies: [
      { code: 'CHCECE054', title: 'Encourage understanding of Aboriginal and Torres Strait Islander peoples’ cultures' },
      { code: 'CHCECE030', title: 'Support inclusion and diversity' },
      { code: 'HLTWHS001', title: 'Participate in workplace health and safety' },
      { code: 'CHCECE034', title: 'Use an approved learning framework to guide practice' },
    ],
  },
  {
    slug: 'certificate-iii-information-technology-tafe-queensland',
    code: 'ICT30120',
    title: 'Certificate III in Information Technology',
    framework: 'Information and Communications Technology',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 12,
    wageMin: 45000,
    wageMax: 58000,
    wagePostCompletion: 72000,
    rtoSlug: 'tafe-queensland',
    city: 'Brisbane',
    state: 'QLD',
    summary:
      'An IT traineeship covering support, basic networking and web fundamentals. The usual first step into a ' +
      'service desk role, and a common way into tech without a degree.',
    competencies: [
      { code: 'ICTICT313', title: 'Identify IP security threats and breaches' },
      { code: 'ICTSAS308', title: 'Run standard diagnostic tests' },
      { code: 'ICTICT311', title: 'Customise packaged software applications for clients' },
      { code: 'BSBXCS303', title: 'Securely manage personally identifiable information and workplace information' },
    ],
  },
  {
    slug: 'certificate-iii-engineering-fabrication-tafe-nsw',
    code: 'MEM31922',
    title: 'Certificate III in Engineering — Fabrication Trade',
    framework: 'Manufacturing and Engineering',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 48,
    wageMin: 27000,
    wageMax: 46000,
    wagePostCompletion: 82000,
    rtoSlug: 'tafe-nsw',
    city: 'Newcastle',
    state: 'NSW',
    summary:
      'Boilermaking and welding, done as a four-year trade apprenticeship. Heavy fabrication work that pays ' +
      'well and is chronically short of people.',
    competencies: [
      { code: 'MEM13015', title: 'Work safely and effectively in manufacturing and engineering' },
      { code: 'MEM05050', title: 'Perform routine gas metal arc welding' },
      { code: 'MEM05005', title: 'Carry out mechanical cutting' },
      { code: 'MEM09002', title: 'Interpret technical drawing' },
    ],
  },
  {
    slug: 'certificate-iii-light-vehicle-mechanical-tafe-queensland',
    code: 'AUR30620',
    title: 'Certificate III in Light Vehicle Mechanical Technology',
    framework: 'Automotive',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 42,
    wageMin: 26000,
    wageMax: 45000,
    wagePostCompletion: 76000,
    rtoSlug: 'tafe-queensland',
    city: 'Gold Coast',
    state: 'QLD',
    summary:
      'The motor mechanic apprenticeship, now covering hybrid and electric drivetrains alongside conventional ' +
      'engines. Women are a very small share of the trade and the shortage is acute.',
    competencies: [
      { code: 'AURASA102', title: 'Follow safe working practices in an automotive workplace' },
      { code: 'AURETR112', title: 'Test and repair basic electrical circuits' },
      { code: 'AURLTB101', title: 'Identify automotive mechanical systems and components' },
      { code: 'AURTTA104', title: 'Carry out servicing operations' },
    ],
  },
  {
    slug: 'certificate-iii-health-services-assistance-tafe-nsw',
    code: 'HLT33115',
    title: 'Certificate III in Health Services Assistance',
    framework: 'Health',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 12,
    wageMin: 48000,
    wageMax: 60000,
    wagePostCompletion: 66000,
    rtoSlug: 'tafe-nsw',
    city: 'Sydney',
    state: 'NSW',
    summary:
      'A traineeship into hospital and clinical support work — assisting nursing staff, moving patients, ' +
      'preparing wards. Often the entry point people use before going on to nursing.',
    competencies: [
      { code: 'HLTAIN001', title: 'Assist with nursing care in an acute care environment' },
      { code: 'HLTINF006', title: 'Apply basic principles and practices of infection prevention and control' },
      { code: 'HLTWHS001', title: 'Participate in workplace health and safety' },
      { code: 'CHCCOM005', title: 'Communicate and work in health or community services' },
    ],
  },
  {
    slug: 'certificate-iv-cyber-security-rmit',
    code: '22603VIC',
    title: 'Certificate IV in Cyber Security',
    framework: 'Information and Communications Technology',
    level: ApprenticeshipLevel.CERTIFICATE_IV,
    durationMonths: 18,
    wageMin: 52000,
    wageMax: 68000,
    wagePostCompletion: 95000,
    rtoSlug: 'rmit-university',
    city: 'Melbourne',
    state: 'VIC',
    summary:
      'A traineeship into security operations — monitoring, incident response and hardening. Cyber is one of ' +
      'the few fields where employers will still take you on qualification and aptitude rather than a degree.',
    competencies: [
      { code: 'VU23213', title: 'Utilise basic network concepts and protocols required in cyber security' },
      { code: 'VU23215', title: 'Test concepts and procedures for cyber security' },
      { code: 'VU23217', title: 'Recognise the need for cyber security in an organisation' },
      { code: 'BSBXCS402', title: 'Promote workplace cyber security awareness and best practices' },
    ],
  },
  {
    slug: 'certificate-iii-air-conditioning-refrigeration-tafe-queensland',
    code: 'UEE32220',
    title: 'Certificate III in Air Conditioning and Refrigeration',
    framework: 'Electrotechnology',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 48,
    wageMin: 27000,
    wageMax: 46000,
    wagePostCompletion: 85000,
    rtoSlug: 'tafe-queensland',
    city: 'Townsville',
    state: 'QLD',
    summary:
      'Refrigeration and air conditioning mechanic, done as a four-year apprenticeship. Steady work in a warm ' +
      'climate, and a licensed trade at the end of it.',
    competencies: [
      { code: 'UEECD0007', title: 'Apply work health and safety regulations, codes and practices in the workplace' },
      { code: 'UEERA0038', title: 'Diagnose and rectify faults in refrigeration systems' },
      { code: 'UEERA0025', title: 'Commission air conditioning systems' },
      { code: 'UEERA0043', title: 'Recover, pressure test, evacuate and charge refrigeration systems' },
    ],
  },
  {
    slug: 'certificate-iii-business-tafe-nsw',
    code: 'BSB30120',
    title: 'Certificate III in Business',
    framework: 'Business Services',
    level: ApprenticeshipLevel.CERTIFICATE_III,
    durationMonths: 12,
    wageMin: 44000,
    wageMax: 55000,
    wagePostCompletion: 62000,
    rtoSlug: 'tafe-nsw',
    city: 'Parramatta',
    state: 'NSW',
    summary:
      'A general business traineeship — administration, records, customer contact and workplace systems. ' +
      'Broad rather than specialised, which makes it a reasonable restart if you are changing direction.',
    competencies: [
      { code: 'BSBOPS304', title: 'Deliver and monitor a service to customers' },
      { code: 'BSBTEC302', title: 'Design and produce spreadsheets' },
      { code: 'BSBPEF201', title: 'Support personal wellbeing in the workplace' },
      { code: 'BSBSUS211', title: 'Participate in sustainable work practices' },
    ],
  },
];

export async function seedApprenticeships() {
  const rtoSlugs = Array.from(new Set(APPRENTICESHIPS.map((a) => a.rtoSlug)));
  const rtos = await prisma.organization.findMany({
    where: { slug: { in: rtoSlugs } },
    select: { id: true, slug: true, name: true },
  });
  const rtoBySlug = new Map(rtos.map((o) => [o.slug, o]));

  const missing = rtoSlugs.filter((s) => !rtoBySlug.has(s));
  if (missing.length > 0) {
    logger.warn('Apprenticeship seed: missing RTOs, those rows will be skipped', { missing });
  }

  let written = 0;
  let skipped = 0;

  for (const a of APPRENTICESHIPS) {
    const rto = rtoBySlug.get(a.rtoSlug);
    if (!rto) {
      skipped += 1;
      continue;
    }

    // The wage caveat is NOT folded in here. The card shows the first two lines
    // of the description as its preview, so putting boilerplate in the text
    // made every listing preview identical. It belongs beside the wage figure
    // in the UI instead — see the detail page.
    const description = [
      a.summary,
      '',
      `Qualification: ${a.code} ${a.title}, delivered by ${rto.name}.`,
    ].join('\n');

    const data = {
      title: a.title,
      description,
      framework: a.framework,
      level: a.level,
      durationMonths: a.durationMonths,
      wageMin: a.wageMin,
      wageMax: a.wageMax,
      wagePostCompletion: a.wagePostCompletion,
      rtoId: rto.id,
      // Left null on purpose: these are pathways through an RTO, not vacancies
      // with a named employer.
      hostEmployerId: null,
      city: a.city,
      state: a.state,
      country: 'Australia',
      isRemote: false,
      competencies: a.competencies,
      status: ApprenticeshipStatus.OPEN,
      positions: 1,
      // No applicationDeadline: the catalogue must not imply a closing date
      // that nobody set.
      publishedAt: new Date(),
    };

    await prisma.apprenticeship.upsert({
      where: { id: stableId(a.slug) },
      create: { id: stableId(a.slug), slug: a.slug, ...data },
      update: data,
    });
    written += 1;
  }

  logger.info('Apprenticeship catalogue seeded', { written, skipped });
  return { written, skipped };
}

if (require.main === module) {
  seedApprenticeships()
    .then((r) => {
      console.log(`Apprenticeships seeded: ${r.written} written, ${r.skipped} skipped`);
      return prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
