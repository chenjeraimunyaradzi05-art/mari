/**
 * ATHENA Platform - Content Seed (static posts + videos)
 *
 * Seeds feed content for local development and demo environments:
 *   - static posts: TEXT, IMAGE and ARTICLE entries for the community feed
 *   - videos: REEL, TUTORIAL, CAREER_STORY, MENTOR_TIP and STORY entries
 *
 * Every record uses a deterministic id derived from its content key, so the
 * seed is idempotent - running it repeatedly updates the same rows instead of
 * creating duplicates.
 *
 * Authors are taken from users already in the database. Run the base seed
 * (`npm run db:seed`) first so there are users to attribute content to.
 */

import { PrismaClient, PostType, VideoStatus, VideoType } from '@prisma/client';
import crypto from 'crypto';

// ==========================================
// HELPERS
// ==========================================

/**
 * Deterministic UUID for a given namespace + key, so re-seeding is idempotent.
 * Shaped like a v5 UUID (version nibble 5, RFC 4122 variant bits).
 */
function stableId(namespace: string, key: string): string {
  const h = crypto.createHash('sha1').update(`${namespace}:${key}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `5${h.slice(13, 16)}`,
    `${variant}${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Stable pseudo-random integer in [min, max] derived from a key. */
function seededInt(key: string, min: number, max: number): number {
  const h = crypto.createHash('sha1').update(key).digest();
  return min + (h.readUInt32BE(0) % (max - min + 1));
}

// ==========================================
// MEDIA
// ==========================================

const POST_IMAGES = [
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&auto=format&fit=crop',
];

const VIDEO_THUMBNAILS = [
  'https://images.unsplash.com/photo-1596496050827-8299e0220de1?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&auto=format&fit=crop',
];

/**
 * Base URL for seeded video files. Point SEED_VIDEO_BASE_URL at your own CDN or
 * local /uploads path to avoid depending on the public sample bucket.
 */
const VIDEO_BASE_URL =
  process.env.SEED_VIDEO_BASE_URL ??
  'https://storage.googleapis.com/gtv-videos-bucket/sample';

const SAMPLE_VIDEO_FILES = [
  'ForBiggerJoyrides.mp4',
  'ForBiggerMeltdowns.mp4',
  'ForBiggerEscapes.mp4',
  'ForBiggerBlazes.mp4',
];

// ==========================================
// STATIC POST CONTENT
// ==========================================

interface StaticPostSeed {
  key: string;
  type: PostType;
  content: string;
  withImage?: boolean;
  isPinned?: boolean;
  ageDays: number;
}

const STATIC_POSTS: StaticPostSeed[] = [
  {
    key: 'welcome-to-athena',
    type: PostType.TEXT,
    content:
      "Welcome to ATHENA. This is a space for women building careers and businesses across Australia and New Zealand - ask the awkward questions, share the wins that felt too small to mention, and find the people a few steps ahead of you.",
    isPinned: true,
    ageDays: 30,
  },
  {
    key: 'salary-negotiation-thread',
    type: PostType.TEXT,
    content:
      "I negotiated my first pay rise last week and got $14k more than the initial offer. The thing that worked: I stopped explaining why I needed it and started listing what I had delivered. Three bullet points, no apology, then silence. Happy to share the exact script if it helps anyone.",
    ageDays: 2,
  },
  {
    key: 'career-change-teaching-to-product',
    type: PostType.ARTICLE,
    content:
      "From classroom to product team: what actually transferred\n\nEight years teaching Year 9 maths, now six months into a product analyst role. The skills that carried over were not the ones on my resume.\n\nStakeholder management is parent-teacher night. Roadmap prioritisation is deciding which topic to reteach when you have three weeks until exams. Running a workshop is just classroom management with better coffee.\n\nWhat I had to learn from scratch: SQL, writing specs that engineers do not hate, and saying 'I do not know yet' in a room full of senior people.",
    ageDays: 5,
  },
  {
    key: 'first-board-meeting',
    type: PostType.IMAGE,
    content:
      "First board meeting as a director today. Wore the blazer, brought the numbers, said the thing I was scared to say. Nobody laughed. Turns out the room was waiting for someone to name the problem.",
    withImage: true,
    ageDays: 8,
  },
  {
    key: 'returning-after-parental-leave',
    type: PostType.TEXT,
    content:
      "Back at work after 14 months of parental leave. Week one observations: my logins all expired, half the team is new, and the imposter feeling is loud. Also true: I am faster at triage than I have ever been, because I no longer have time to agonise. Both things can be real.",
    ageDays: 11,
  },
  {
    key: 'grant-application-approved',
    type: PostType.IMAGE,
    content:
      "We got the grant. $50k to take the pilot from three community centres to twelve across regional Victoria. Fourth application, second year of trying. The first three rejections taught us how to answer the impact question properly.",
    withImage: true,
    ageDays: 14,
  },
  {
    key: 'tech-interview-prep',
    type: PostType.ARTICLE,
    content:
      "What six months of technical interviews taught me\n\nI did 23 interviews before the offer. Some patterns:\n\nThe technical screen is rarely the thing that fails you. Twice I solved the problem and still got a no. Once I did not finish and got a yes, because I narrated my thinking clearly.\n\nAsk what success looks like at 90 days. The answers tell you whether the role is defined or whether you are being hired to absorb chaos.\n\nNegotiate after the yes, not during. Every time I raised money early, the conversation got colder.",
    ageDays: 17,
  },
  {
    key: 'small-business-first-hire',
    type: PostType.TEXT,
    content:
      "Made my first hire this month after two years solo. Nobody warns you that becoming someone's employer changes how you think about cash flow. I now keep three months of her salary in a separate account before I pay myself. Sleep improved immediately.",
    ageDays: 21,
  },
  {
    key: 'mentor-match-outcome',
    type: PostType.TEXT,
    content:
      "Six months with my ATHENA mentor. She never once told me what to do. She asked 'what would you do if you were not worried about being liked?' and then let the silence sit. I have changed roles, raised my rate, and dropped two clients who were draining me.",
    ageDays: 24,
  },
  {
    key: 'regional-remote-work',
    type: PostType.IMAGE,
    content:
      "Two years working remotely from Wagga. The trade-off nobody mentions: you have to be twice as deliberate about visibility. I now write a short Friday summary of what shipped. It takes 10 minutes and it has done more for my career than any conference.",
    withImage: true,
    ageDays: 27,
  },
  {
    key: 'apprenticeship-completion',
    type: PostType.TEXT,
    content:
      "Finished my electrical apprenticeship this week - one of two women in a cohort of 34. To anyone in the middle of one: the fourth year is different. You stop proving you belong and start being the person others ask.",
    ageDays: 33,
  },
  {
    key: 'super-and-the-gap',
    type: PostType.ARTICLE,
    content:
      "I finally looked at my super properly\n\nAt 41, after two career breaks, I was about $60k behind where I should be. Here is what I did in one afternoon:\n\nConsolidated four accounts into one, which stopped four sets of fees. Checked the insurance inside the fund - I was paying for cover I already had elsewhere. Set up a small salary sacrifice, $50 a fortnight, because the tax treatment beats putting it in savings.\n\nNone of this is advice, it is just the list I wish someone had handed me at 30.",
    ageDays: 38,
  },
];

// ==========================================
// VIDEO CONTENT
// ==========================================

interface VideoSeed {
  key: string;
  type: VideoType;
  title: string;
  description: string;
  durationSeconds: number;
  hashtags: string[];
  location?: string;
  ageDays: number;
}

const VIDEOS: VideoSeed[] = [
  {
    key: 'reel-first-90-days',
    type: VideoType.REEL,
    title: 'Your first 90 days in a new role',
    description:
      'Three things to do in week one that make the next three months easier. Number two is the one people skip.',
    durationSeconds: 47,
    hashtags: ['career', 'newjob', 'firstninetydays'],
    location: 'Sydney, NSW',
    ageDays: 1,
  },
  {
    key: 'tutorial-sql-for-non-engineers',
    type: VideoType.TUTORIAL,
    title: 'SQL for people who are not engineers',
    description:
      'SELECT, WHERE and GROUP BY are 80 percent of what you need to stop asking the data team for every number. Follow along with the sample dataset.',
    durationSeconds: 612,
    hashtags: ['sql', 'data', 'upskilling'],
    ageDays: 4,
  },
  {
    key: 'career-story-nurse-to-health-tech',
    type: VideoType.CAREER_STORY,
    title: 'From ICU nurse to health tech product lead',
    description:
      'Eleven years in intensive care, now leading product at a clinical software company. What transferred, what did not, and the pay cut she took for 14 months.',
    durationSeconds: 428,
    hashtags: ['careerchange', 'healthtech', 'nursing'],
    location: 'Melbourne, VIC',
    ageDays: 6,
  },
  {
    key: 'mentor-tip-saying-no',
    type: VideoType.MENTOR_TIP,
    title: 'How to say no without damaging the relationship',
    description:
      'A two minute script for declining work that is not yours to carry, from a mentor who spent a decade saying yes to everything.',
    durationSeconds: 124,
    hashtags: ['boundaries', 'mentorship', 'workload'],
    ageDays: 9,
  },
  {
    key: 'reel-negotiation-script',
    type: VideoType.REEL,
    title: 'The 20 second pay rise script',
    description:
      'What to say after they name a number. The pause is doing most of the work here.',
    durationSeconds: 38,
    hashtags: ['negotiation', 'payrise', 'money'],
    ageDays: 12,
  },
  {
    key: 'tutorial-business-registration-au',
    type: VideoType.TUTORIAL,
    title: 'Registering a business in Australia, start to finish',
    description:
      'ABN, business name, GST threshold and the structure question. Recorded screen-by-screen for a sole trader going into a company structure.',
    durationSeconds: 845,
    hashtags: ['smallbusiness', 'abn', 'startup'],
    ageDays: 16,
  },
  {
    key: 'career-story-trades-apprentice',
    type: VideoType.CAREER_STORY,
    title: 'Four years as an apprentice electrician',
    description:
      'What the first site was like, how she handled the crew, and what she would tell a woman starting her apprenticeship next month.',
    durationSeconds: 356,
    hashtags: ['trades', 'apprenticeship', 'electrician'],
    location: 'Brisbane, QLD',
    ageDays: 22,
  },
  {
    key: 'story-conference-day',
    type: VideoType.STORY,
    title: 'A day at the ATHENA regional summit',
    description: 'Ninety seconds from the Adelaide summit - workshops, the mentor floor, and the closing panel.',
    durationSeconds: 88,
    hashtags: ['athena', 'community', 'events'],
    location: 'Adelaide, SA',
    ageDays: 29,
  },
];

// ==========================================
// SEED
// ==========================================

export interface ContentSeedSummary {
  posts: number;
  videos: number;
  authors: number;
}

export interface ContentSeedOptions {
  /** Log progress to the console. Defaults to true. */
  verbose?: boolean;
}

/**
 * Seeds static posts and videos, attributing them to existing users.
 * Idempotent: re-running updates the same records rather than duplicating.
 */
export async function seedContent(
  prisma: PrismaClient,
  options: ContentSeedOptions = {}
): Promise<ContentSeedSummary> {
  const { verbose = true } = options;
  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  const authors = await prisma.user.findMany({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  if (authors.length === 0) {
    throw new Error(
      'Cannot seed content: no users exist. Run the base seed (npm run db:seed) first.'
    );
  }

  const authorFor = (key: string): string =>
    authors[seededInt(key, 0, authors.length - 1)].id;

  // ---- Static posts -------------------------------------------------------
  log(`Seeding ${STATIC_POSTS.length} static posts...`);

  for (const post of STATIC_POSTS) {
    const id = stableId('post', post.key);
    const createdAt = daysAgo(post.ageDays);
    const mediaUrls =
      post.withImage || post.type === PostType.IMAGE
        ? [POST_IMAGES[seededInt(post.key, 0, POST_IMAGES.length - 1)]]
        : undefined;

    const data = {
      authorId: authorFor(post.key),
      type: post.type,
      content: post.content,
      mediaUrls,
      isPublic: true,
      isPinned: post.isPinned ?? false,
      likeCount: seededInt(`${post.key}:likes`, 8, 240),
      commentCount: seededInt(`${post.key}:comments`, 0, 32),
      shareCount: seededInt(`${post.key}:shares`, 0, 18),
      viewCount: seededInt(`${post.key}:views`, 120, 4200),
      createdAt,
      updatedAt: createdAt,
    };

    await prisma.post.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // ---- Videos -------------------------------------------------------------
  log(`Seeding ${VIDEOS.length} videos...`);

  for (const video of VIDEOS) {
    const id = stableId('video', video.key);
    const createdAt = daysAgo(video.ageDays);
    const fileIndex = seededInt(video.key, 0, SAMPLE_VIDEO_FILES.length - 1);
    const viewCount = seededInt(`${video.key}:views`, 800, 96000);

    const data = {
      authorId: authorFor(video.key),
      title: video.title,
      description: video.description,
      type: video.type,
      status: VideoStatus.PUBLISHED,
      videoUrl: `${VIDEO_BASE_URL}/${SAMPLE_VIDEO_FILES[fileIndex]}`,
      thumbnailUrl: VIDEO_THUMBNAILS[seededInt(`${video.key}:thumb`, 0, VIDEO_THUMBNAILS.length - 1)],
      duration: video.durationSeconds,
      aspectRatio: video.type === VideoType.TUTORIAL ? '16:9' : '9:16',
      hasAutoCaption: true,
      viewCount,
      likeCount: Math.round(viewCount * (seededInt(`${video.key}:like`, 3, 11) / 100)),
      commentCount: seededInt(`${video.key}:comments`, 2, 180),
      shareCount: seededInt(`${video.key}:shares`, 1, 90),
      saveCount: seededInt(`${video.key}:saves`, 5, 420),
      completionRate: seededInt(`${video.key}:completion`, 38, 92) / 100,
      hashtags: video.hashtags,
      location: video.location ?? null,
      createdAt,
      updatedAt: createdAt,
      publishedAt: createdAt,
    };

    await prisma.video.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  const summary: ContentSeedSummary = {
    posts: STATIC_POSTS.length,
    videos: VIDEOS.length,
    authors: authors.length,
  };

  log(
    `Content seed complete: ${summary.posts} posts, ${summary.videos} videos across ${summary.authors} authors.`
  );

  return summary;
}

// Allow running standalone: `ts-node prisma/seeds/content.seed.ts`
if (require.main === module) {
  const prisma = new PrismaClient();
  seedContent(prisma)
    .catch((error) => {
      console.error('Content seed failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
