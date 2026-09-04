#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Re-derive the engagement counters on posts and reels from their rows.
 *
 * Post.likeCount / commentCount and Video.likeCount / commentCount / saveCount
 * are denormalised counters that the routes increment and decrement as rows
 * are written. Seed data and older code paths set them directly, so a post
 * can advertise "15 comments" while its thread is empty and its post page
 * says "No comments yet". Hidden comments are excluded, matching what the
 * read routes return.
 *
 * Dry run by default: prints how many rows disagree and by how much.
 *
 *   node scripts/recount-engagement.js          # report only
 *   node scripts/recount-engagement.js --apply  # write the corrected counters
 *
 * Only these counter columns are touched, and only where they differ. Safe on
 * the shared database (see docs/runbooks/SHARED-DATABASE-HAZARD.md): it is
 * UPDATE on rows this schema owns, never DDL.
 */

require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const POST_DRIFT = `
  SELECT p.id,
         p."likeCount"    AS stored_likes,    l.n::int AS actual_likes,
         p."commentCount" AS stored_comments, c.n::int AS actual_comments
  FROM "Post" p
  LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM "Like"    WHERE "postId" = p.id) l ON true
  LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM "Comment" WHERE "postId" = p.id AND "isHidden" = false) c ON true
  WHERE p."likeCount" <> l.n OR p."commentCount" <> c.n`;

const VIDEO_DRIFT = `
  SELECT v.id,
         v."likeCount"    AS stored_likes,    l.n::int AS actual_likes,
         v."commentCount" AS stored_comments, c.n::int AS actual_comments,
         v."saveCount"    AS stored_saves,    s.n::int AS actual_saves
  FROM "Video" v
  LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM "VideoLike"    WHERE "videoId" = v.id) l ON true
  LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM "VideoComment" WHERE "videoId" = v.id AND "isHidden" = false) c ON true
  LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM "VideoSave"    WHERE "videoId" = v.id) s ON true
  WHERE v."likeCount" <> l.n OR v."commentCount" <> c.n OR v."saveCount" <> s.n`;

async function main() {
  const posts = await prisma.$queryRawUnsafe(POST_DRIFT);
  const videos = await prisma.$queryRawUnsafe(VIDEO_DRIFT);

  console.log(`Posts with drifted counters:  ${posts.length}`);
  console.log(`Reels with drifted counters:  ${videos.length}`);

  const sample = (rows, label) => {
    for (const row of rows.slice(0, 5)) {
      console.log(
        `  ${label} ${row.id}: likes ${row.stored_likes} -> ${row.actual_likes}, ` +
          `comments ${row.stored_comments} -> ${row.actual_comments}` +
          (row.stored_saves !== undefined ? `, saves ${row.stored_saves} -> ${row.actual_saves}` : '')
      );
    }
    if (rows.length > 5) console.log(`  ... and ${rows.length - 5} more`);
  };
  sample(posts, 'post');
  sample(videos, 'reel');

  if (!APPLY) {
    if (posts.length + videos.length > 0) {
      console.log('\nDry run. Re-run with --apply to write the corrected counters.');
    }
    return;
  }

  let updated = 0;
  for (const row of posts) {
    await prisma.post.update({
      where: { id: row.id },
      data: { likeCount: row.actual_likes, commentCount: row.actual_comments },
    });
    updated += 1;
  }
  for (const row of videos) {
    await prisma.video.update({
      where: { id: row.id },
      data: {
        likeCount: row.actual_likes,
        commentCount: row.actual_comments,
        saveCount: row.actual_saves,
      },
    });
    updated += 1;
  }
  console.log(`\nUpdated ${updated} row(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
