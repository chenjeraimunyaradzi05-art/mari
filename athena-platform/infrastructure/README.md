# Infrastructure

There is no infrastructure-as-code in this directory, and that is deliberate.
The one thing here is [`monitoring/`](monitoring/README.md): alert rules for a
metrics service that does not exist yet.

It used to hold a `main.tf` describing a platform ATHENA does not run: MySQL 8
on RDS (the API is PostgreSQL through Prisma, and cannot start on MySQL), ECS
Fargate clusters in four AWS regions, an ElastiCache Redis and a media bucket
per region. None of it matched a deployed service, and nothing here or in the
workflows ever applied it. Running `terraform apply` against it would have
built a multi-region estate the API cannot use, and started billing for it.
It was removed rather than corrected, because the real estate below is
described by the files each host actually reads.

## What ATHENA actually runs on

| Part | Host | Described by |
| --- | --- | --- |
| API (Express, Socket.IO, in-process workers) | Render, or Fly.io as the alternative. One instance, and it has to stay one until Socket.IO has a Redis adapter. | [`render.yaml`](../../render.yaml) at the repository root, or [`server/fly.toml`](../server/fly.toml), both building [`server/Dockerfile`](../server/Dockerfile) |
| Redis (rate limits, lockout counters, queues, sweep locks) | Render Key Value, declared in the same blueprint | [`render.yaml`](../../render.yaml) |
| PostgreSQL | Neon, `ap-southeast-2` (Sydney). Migrated by the release workflow before the API deploys. | [`server/prisma/schema.prisma`](../server/prisma/schema.prisma) and `server/prisma/migrations/` |
| Web app (Next.js) | Netlify, with the Next.js runtime plugin | [`netlify.toml`](../../netlify.toml) at the repository root and [`client/netlify.toml`](../client/netlify.toml) |
| Media | One S3 bucket, `S3_BUCKET`, in `ap-southeast-2`, with a CDN in front of the public folders only | [`server/.env.example`](../server/.env.example) (AWS and CDN sections), and "Media bucket" below |
| Releases | GitHub Actions: CI, then migrate, deploy the API, publish the web app | [`.github/workflows/build-and-deploy.yml`](../../.github/workflows/build-and-deploy.yml) |
| Uptime check | GitHub Actions on a schedule | [`.github/workflows/uptime.yml`](../../.github/workflows/uptime.yml) |
| Off-platform database copies | GitHub Actions nightly, to an S3 bucket the owner creates; nothing runs until it is set up | [`.github/workflows/backup.yml`](../../.github/workflows/backup.yml), setup in [`docs/runbooks/ONCALL.md`](../docs/runbooks/ONCALL.md) |
| Metrics alerting | Not yet anywhere: the rules and scrape job are written and tested, waiting for a hosted metrics service | [`monitoring/`](monitoring/README.md) |

The step-by-step setup is in [`DEPLOYMENT_GUIDE.md`](../../DEPLOYMENT_GUIDE.md), and
what to do when something is down is in
[`docs/runbooks/ONCALL.md`](../docs/runbooks/ONCALL.md).

## If infrastructure-as-code is added later

Start from the table above, not from the file that was here. Whatever is
written has to describe PostgreSQL rather than MySQL, one API instance rather
than a cluster per region, and the single media bucket the API writes to. The
bucket is where members' photographs and résumés live, so it stays private
with no public ACL, and a CDN in front of it, limited to the public folders, is
set through `CDN_URL` ("Media bucket" below). Keep
the database on Neon in Sydney unless there is a decision to move it:
members' records, including safety settings, are held there, so moving them is
a privacy decision before it is an infrastructure one.

## Media bucket

One bucket, `S3_BUCKET`, in `ap-southeast-2`, holds two kinds of file. Which is
which is decided by the top-level folder, and the list is
`PRIVATE_MEDIA_FOLDERS` in
[`server/src/utils/media-storage.ts`](../server/src/utils/media-storage.ts).

| Folders | What they hold | Who can read them | How a row refers to them |
| --- | --- | --- | --- |
| `avatars/`, `covers/`, `posts/`, `videos/`, `thumbnails/`, `captions/`, `sounds/` | Public by design: they are shown to other members | Anyone, through the CDN | `CDN_URL/key` |
| `resumes/`, `documents/` | One member's own file | The owner, and hiring staff on an application the file was attached to, through the API (`POST /api/media/download-url` gives a signed link that lives five minutes) | `https://<bucket>.s3.ap-southeast-2.amazonaws.com/key`, which is a name and not a link anyone can open |
| `chat/<conversation or group id>/` | A picture, voice note, clip or PDF sent in a direct message or a group chat | The people in that conversation now, through the same API call and the same five-minute link; nobody on either side of a block with the sender ([`server/src/services/chat-attachment.service.ts`](../server/src/services/chat-attachment.service.ts)) | The message carries the key only, never a link |

Files under `chat/` are removed when the message they were sent in expires, is
unsent, or belongs to a member whose account is erased, except behind a message
somebody has reported, which moderators need to see
([`server/src/services/chat-attachment-cleanup.service.ts`](../server/src/services/chat-attachment-cleanup.service.ts)).
A file sent in a conversation before chat files were private (before October
2026) was uploaded as a post picture, a reel or a sound, into a public folder,
and is left as it is: it is still a public link, and it is not deleted with its
message. Operating the bucket day to day, and checking it from outside, is in
[`docs/runbooks/MEDIA-BUCKET.md`](../docs/runbooks/MEDIA-BUCKET.md).

The code only chooses which address to hand out. Whether a file can be read is
decided by the bucket policy and by what the CDN may fetch, so those have to
agree with the table. Set it up once, in this order:

1. **Create the bucket** in `ap-southeast-2` with S3 Block Public Access on (all
   four settings) and default encryption on.
2. **Create an IAM user for the API**, limited to `s3:PutObject`, `s3:GetObject`
   and `s3:DeleteObject` on `bucket/*`, `s3:ListBucket` on the bucket, and
   `rekognition:DetectModerationLabels` (image moderation). Its keys are
   `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` on the API host. The API
   writes one tiny probe object under each of `avatars/_exposure-check/` and
   `resumes/_exposure-check/` and deletes it again when step 5 runs, which these
   permissions already allow.
3. **Put a CDN in front of the public folders only.** CloudFront with an origin
   access control, and a bucket policy that lets that distribution read the
   public folders and nothing else. Block Public Access stays on:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "CdnReadsPublicFoldersOnly",
         "Effect": "Allow",
         "Principal": { "Service": "cloudfront.amazonaws.com" },
         "Action": "s3:GetObject",
         "Resource": [
           "arn:aws:s3:::BUCKET/avatars/*",
           "arn:aws:s3:::BUCKET/covers/*",
           "arn:aws:s3:::BUCKET/posts/*",
           "arn:aws:s3:::BUCKET/videos/*",
           "arn:aws:s3:::BUCKET/thumbnails/*",
           "arn:aws:s3:::BUCKET/captions/*",
           "arn:aws:s3:::BUCKET/sounds/*"
         ],
         "Condition": {
           "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT:distribution/DISTRIBUTION_ID" }
         }
       }
     ]
   }
   ```

   Because the distribution is not allowed to read `resumes/`, `documents/` or
   `chat/`, a request for one through the CDN is refused even if somebody learns
   the key.
4. **Tell the API and the web app where the CDN is.** `CDN_URL=https://<the
   distribution's domain, or your own>` on the API host. On Netlify,
   `NEXT_PUBLIC_MEDIA_HOST=<the same host name>` (read at build time, so deploy
   again), which is what lets `next/image` load avatars from it. In production
   the API does not start without `CDN_URL`, and refuses the bucket's own
   `amazonaws.com` address ([`server/src/utils/env.ts`](../server/src/utils/env.ts)):
   a public file is stored on its row as `${CDN_URL}/key`, so a missing value is
   permanent for every file uploaded while it was missing, and the bucket's own
   address answers 403 with Block Public Access on. The only way to make
   pictures load without a CDN would be to open the bucket, which would open
   every résumé and chat file with them.
5. **Prove it.** With the diagnostics token, call
   `GET $API_URL/health/launch-readiness?probe=media` and read the
   `MEDIA_EXPOSURE` check. It passes when a public probe could be read and a
   private probe could not, at the CDN's address and at the bucket's.
   A failing check says which: a private file reachable without signing in
   (fix the policy before anything else), public files that cannot be read
   (avatars and reels will not load), a probe that could not be written or
   removed, or an address that did not answer at all (the check then says it
   could not tell, and never counts silence as safe). The check writes and deletes two small objects, so it only runs when
   asked with `?probe=media`. The daily job in
   [`uptime.yml`](../../.github/workflows/uptime.yml) repeats the check when the
   repository has the `HEALTH_DIAGNOSTICS_TOKEN` secret. The same thing by hand,
   from any machine and with no credentials, is four `curl` requests, listed in
   [`docs/runbooks/MEDIA-BUCKET.md`](../docs/runbooks/MEDIA-BUCKET.md).

A member's file never reaches the container's disk in production: the API
refuses to start without S3 and answers a failed write with a 503. The `uploads/`
folder inside `athena-platform/server` exists only on a developer's machine, and
is not in version control.
