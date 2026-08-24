/**
 * Seeds real, verified content: events that genuinely exist, reels that are
 * genuinely playable, and stories about women whose achievements are a matter
 * of public record.
 *
 * Every item here was checked before it was written down:
 *   - each event page was fetched and its date, time and venue read off it
 *   - each video URL was resolved through the Wikimedia Commons API and its
 *     licence confirmed as public domain
 *   - each story links to the authoritative source it was summarised from
 *
 * Nothing is invented. Where a detail could not be verified (a ticket price, a
 * venue still marked "to be announced") the field is left empty rather than
 * filled with a plausible guess.
 *
 * Stories are written in the third person and published from the platform's
 * own account. They are deliberately NOT first-person posts under accounts
 * named after these women — that would be putting words in the mouths of real
 * people who never wrote them.
 *
 * Idempotent: ids are derived from a stable slug, so re-running updates rather
 * than duplicates.
 *
 *   npm run db:seed:real
 */

import { createHash } from 'crypto';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

// A stable uuid-shaped id from a slug, so a second run updates the same row.
function stableId(slug: string): string {
  const h = createHash('sha1').update(`athena:real-content:${slug}`).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), `5${h.slice(13, 16)}`, `a${h.slice(17, 20)}`, h.slice(20, 32)].join('-');
}

// Initials avatar for an organisation. Honest about being generated, rather
// than a stock photo standing in for a real person's face.
const orgAvatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=128&background=6D28D9&color=fff&bold=true`;

// ===========================================
// EVENTS — each verified on its own listing page
// ===========================================

const EVENTS = [
  {
    slug: 'wsw-women-leading-ai-2026',
    title: 'Women Leading AI: Connecting, Scaling & Growing in Western Sydney',
    description:
      'A half-day conference bringing together female entrepreneurs, business leaders and students in Western Sydney to explore how AI is reshaping business and careers. Keynotes and an expert panel cover practical applications, with dedicated networking time and an AI toolkit to take away.',
    type: 'CONFERENCE' as const,
    format: 'IN_PERSON' as const,
    date: new Date('2026-09-17T12:00:00Z'),
    startTime: '9:00 AM',
    endTime: '12:00 PM',
    location: 'KPMG, Level 16/153 Macquarie Street, Parramatta NSW 2150',
    link: 'https://events.humanitix.com/wsw-ai',
    image: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&q=80',
    hostName: 'Western Sydney Women',
    hostTitle: 'Event organiser',
    tags: ['ai', 'entrepreneurship', 'western-sydney', 'networking'],
    isFeatured: true,
  },
  {
    slug: 'women-in-digital-awards-2026',
    title: '2026 National Women in Digital Awards',
    description:
      'A black-tie gala celebrating excellence across Australia\'s digital industry, with up to 1,000 guests, a three-course dinner and awards announced across categories recognising women and diversity champions in digital.',
    type: 'NETWORKING' as const,
    format: 'IN_PERSON' as const,
    date: new Date('2026-11-06T12:00:00Z'),
    startTime: '5:30 PM',
    endTime: '11:00 PM',
    location: 'QCEC, Brisbane QLD',
    link: 'https://womenindigital.org/women-in-digital-awards/attend/',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&q=80',
    hostName: 'Women in Digital',
    hostTitle: 'Event organiser',
    tags: ['awards', 'digital', 'brisbane', 'networking'],
    isFeatured: true,
  },
  {
    slug: 'women-in-tech-fest-2027',
    title: 'Women in Tech Fest 2027',
    description:
      'Now in its 11th year, this conference equips attendees with technical knowledge, in-demand skills and leadership strategies. Connect with senior technology leaders and explore emerging trends including AI and automation.',
    type: 'CONFERENCE' as const,
    format: 'IN_PERSON' as const,
    date: new Date('2027-02-23T12:00:00Z'),
    startTime: '9:00 AM',
    endTime: '5:00 PM',
    location: 'Sydney Masonic Centre, 111 Goulburn Street, Sydney NSW',
    link: 'https://www.womenintechfest.com.au/',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80',
    hostName: 'Quest Events',
    hostTitle: 'Event organiser',
    tags: ['technology', 'leadership', 'sydney', 'conference'],
    isFeatured: true,
  },
  {
    slug: 'sans-women-in-cyber-sydney-2027',
    title: 'SANS Women in Cyber — Sydney',
    description:
      'Australia\'s first SANS Women in Cyber event: hands-on cybersecurity training, networking and community support for women entering the field, spanning digital forensics, industrial control systems security, threat intelligence and leadership.',
    type: 'WORKSHOP' as const,
    format: 'IN_PERSON' as const,
    date: new Date('2027-03-15T12:00:00Z'),
    startTime: '9:00 AM',
    endTime: '5:00 PM',
    // Venue is still "to be announced" on the listing, so it is not invented here.
    location: 'Sydney NSW — venue to be announced',
    link: 'https://www.sans.org/mlp/women-in-cyber-sydney-march-2027',
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80',
    hostName: 'SANS Institute',
    hostTitle: 'Training provider',
    tags: ['cybersecurity', 'training', 'sydney'],
    isFeatured: false,
  },
];

// ===========================================
// REELS — public domain, resolved via the Commons API and range-checked
// ===========================================

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';
const SCIENCE_SPEAKS = 'Science_Speaks_-_Talking_to_Women_in_Science';

// Paths resolved through the Commons imageinfo API — the two hex directory
// segments are content-addressed and cannot be guessed. Tracking parameters
// the API appends are stripped.
const REELS = [
  {
    slug: 'science-speaks-deborah-engineer',
    title: 'Deborah, Engineer — Talking to Women in Science',
    url: `${COMMONS}/f/f7/${SCIENCE_SPEAKS}_%28Deborah%2C_Engineer%29.webm`,
    duration: 267,
    hashtags: ['engineering', 'womeninstem', 'careers'],
  },
  {
    slug: 'science-speaks-sara-epidemiologist',
    title: 'Sara, Epidemiologist — Talking to Women in Science',
    url: `${COMMONS}/a/ac/${SCIENCE_SPEAKS}_%28Sara%2C_Epidemiologist%29.webm`,
    duration: 262,
    hashtags: ['epidemiology', 'womeninstem', 'publichealth'],
  },
  {
    slug: 'science-speaks-tara-epidemiologist',
    title: 'Tara, Epidemiologist — Talking to Women in Science',
    url: `${COMMONS}/9/9d/${SCIENCE_SPEAKS}_%28Tara%2C_Epidemiologist%29.webm`,
    duration: 228,
    hashtags: ['epidemiology', 'womeninstem', 'research'],
  },
  {
    slug: 'science-speaks-kellie-psychologist',
    title: 'Kellie, Psychologist — Talking to Women in Science',
    url: `${COMMONS}/7/73/${SCIENCE_SPEAKS}_%28Kellie%2C_Psychologist%29.webm`,
    duration: 243,
    hashtags: ['psychology', 'womeninstem', 'careers'],
  },
  {
    slug: 'science-speaks-sudha-medical-officer',
    title: 'Sudha, Medical Officer — Talking to Women in Science',
    url: `${COMMONS}/d/d9/${SCIENCE_SPEAKS}_%28Sudha%2C_Medical_Officer%29.webm`,
    duration: 262,
    hashtags: ['medicine', 'womeninstem', 'publichealth'],
  },
  {
    slug: 'science-speaks-rebecca-health-communication',
    title: 'Rebecca, Health Communication Specialist — Talking to Women in Science',
    url: `${COMMONS}/a/aa/${SCIENCE_SPEAKS}_%28Rebecca%2C_Health_Communication_Specialist%29.webm`,
    duration: 261,
    hashtags: ['communication', 'womeninstem', 'publichealth'],
  },
  {
    slug: 'nasa-anne-mcclain-crew10',
    title: 'Meet NASA Astronaut Anne McClain, Crew-10 Commander',
    url: `${COMMONS}/2/21/Meet_NASA_Astronaut_Anne_McClain%2C_Crew-10_Commander_%28jsc2025m000014%29.webm`,
    duration: 188,
    hashtags: ['space', 'nasa', 'womeninstem', 'leadership'],
  },
];

const REEL_CREDIT =
  'Public domain footage via Wikimedia Commons. Shared here so the women telling these stories are heard in their own words.';

// ===========================================
// STORIES — summarised from the source each one links to
// ===========================================

const STORIES = [
  {
    slug: 'story-csiro-indigenous-women-stem',
    content:
      'CSIRO\'s Young Indigenous Women\'s STEM Academy exists to increase the number of Indigenous women entering Australia\'s STEM industries, through mentoring and clear career pathways.\n\nIn May 2026 CSIRO profiled ten Aboriginal and Torres Strait Islander women at every stage — from high school students to aerospace engineers and food scientists — each describing what it means to represent her community through science.\n\nRead their stories: https://www.csiro.au/en/news/All/Articles/2026/May/10-Young-Indigenous-Women-showing-up-in-STEM-in-2026',
  },
  {
    slug: 'story-fiona-wood',
    content:
      'Professor Fiona Wood co-developed spray-on skin — a treatment that changed how severe burns are cared for and that was used at scale after the 2002 Bali bombings.\n\nShe is one of eight Australian women profiled by Austrade for work spanning renewable energy, healthcare, aviation and technology.\n\nSource: https://www.austrade.gov.au/en/news-and-analysis/news/shining-a-spotlight-on-australias-female-innovators',
  },
  {
    slug: 'story-veena-sahajwalla',
    content:
      'Professor Veena Sahajwalla invented "green steel" — a process that uses discarded tyres and plastic in place of coke in steelmaking, turning waste into a raw material.\n\nHer work is a reminder that a research career can be measured in landfill diverted as much as in papers published.\n\nSource: https://www.austrade.gov.au/en/news-and-analysis/news/shining-a-spotlight-on-australias-female-innovators',
  },
  {
    slug: 'story-maria-skyllas-kazacos',
    content:
      'Professor Maria Skyllas-Kazacos pioneered the vanadium redox flow battery at UNSW — a technology now used to store renewable energy at grid scale around the world.\n\nShe developed it in the 1980s, long before grid storage was a mainstream concern.\n\nSource: https://www.austrade.gov.au/en/news-and-analysis/news/shining-a-spotlight-on-australias-female-innovators',
  },
  {
    slug: 'story-melanie-perkins',
    content:
      'Melanie Perkins co-founded Canva in 2013 after teaching design software to university students and concluding it was far harder to use than it needed to be.\n\nCanva is now one of Australia\'s best known technology companies — and it started from an observation about other people\'s frustration.\n\nSource: https://www.austrade.gov.au/en/news-and-analysis/news/shining-a-spotlight-on-australias-female-innovators',
  },
  {
    slug: 'story-anita-ho-baillie',
    content:
      'Professor Anita Ho-Baillie works on perovskite solar cells, pushing the efficiency of the next generation of solar technology.\n\nAustralia is one of the strongest solar research communities in the world, and her work sits at the front of it.\n\nSource: https://www.austrade.gov.au/en/news-and-analysis/news/shining-a-spotlight-on-australias-female-innovators',
  },
  {
    slug: 'story-nancy-bird-walton',
    content:
      'Nancy Bird Walton earned her pilot\'s licence at 19 and went on to run outback medical flights, becoming one of the founding figures of Australian aviation.\n\nShe flew when very few women were permitted to, and spent decades afterwards making room for the ones who followed.\n\nSource: https://www.austrade.gov.au/en/news-and-analysis/news/shining-a-spotlight-on-australias-female-innovators',
  },
];

// ===========================================
// SEED
// ===========================================

async function resolveCuratorId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });
  if (!admin) {
    throw new Error('No ADMIN user to attribute curated content to. Run db:seed:admin first.');
  }
  logger.info(`Attributing curated content to ${admin.email}`);
  return admin.id;
}

export async function seedRealContent(): Promise<void> {
  const curatorId = await resolveCuratorId();

  for (const e of EVENTS) {
    const { slug, tags, ...rest } = e;
    const data = {
      ...rest,
      tags,
      hostAvatar: orgAvatar(e.hostName),
      baseAttendees: 0,
      // Ticket prices were not published on any of these listings, so this
      // stays null rather than claiming the events are free.
      price: null,
    };
    await prisma.event.upsert({
      where: { id: stableId(slug) },
      create: { id: stableId(slug), ...data },
      update: data,
    });
  }
  logger.info(`Seeded ${EVENTS.length} verified events`);

  for (const r of REELS) {
    const data = {
      authorId: curatorId,
      title: r.title,
      description: REEL_CREDIT,
      videoUrl: r.url,
      duration: r.duration,
      type: 'CAREER_STORY' as const,
      status: 'PUBLISHED' as const,
      hashtags: r.hashtags,
      publishedAt: new Date(),
    };
    await prisma.video.upsert({
      where: { id: stableId(r.slug) },
      create: { id: stableId(r.slug), ...data },
      update: data,
    });
  }
  logger.info(`Seeded ${REELS.length} public-domain reels`);

  for (const s of STORIES) {
    const data = {
      authorId: curatorId,
      content: s.content,
      type: 'TEXT' as const,
      isPublic: true,
    };
    await prisma.post.upsert({
      where: { id: stableId(s.slug) },
      create: { id: stableId(s.slug), ...data },
      update: data,
    });
  }
  logger.info(`Seeded ${STORIES.length} sourced stories`);
}

if (require.main === module) {
  seedRealContent()
    .then(() => {
      logger.info('Real content seed complete');
      return prisma.$disconnect();
    })
    .catch(async (error) => {
      logger.error('Real content seed failed', { error });
      await prisma.$disconnect();
      process.exit(1);
    });
}
