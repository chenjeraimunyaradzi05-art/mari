# The media bucket: keeping members' files where they belong

**What this is for.** Members' photographs, voice notes, clips, résumés and
documents live in one S3 bucket. Some of those are meant for everyone (an
avatar, a post picture, a reel) and some for one person or one conversation (a
résumé, a document, a file sent in a direct message). The code decides which
address it hands out; the bucket and the CDN decide what an address opens. This
runbook is for the second half: how to check it from outside, what a failed
check means, and what to do about it. Setting the bucket up in the first place
is in [`infrastructure/README.md`](../../infrastructure/README.md) ("Media
bucket").

## What lives where

| Folder | Who may open it | How |
| --- | --- | --- |
| `avatars/`, `covers/`, `posts/`, `videos/`, `thumbnails/`, `captions/`, `sounds/` | Anyone | Through the CDN at `CDN_URL`, the address stored on the row |
| `resumes/`, `documents/` | The owner; hiring staff on an application the file was attached to | `POST /api/media/download-url` with the key, which answers a signed S3 link that lives five minutes |
| `chat/<conversation or group id>/` | The people in that conversation now, unless a block stands between the reader and the sender | The same call and the same five-minute link; the message carries the key, never a link |

The list of private folders the code works from is `PRIVATE_MEDIA_FOLDERS` in
[`server/src/utils/media-storage.ts`](../../server/src/utils/media-storage.ts).
The bucket policy and the CDN must agree with it: the CDN may read the public
folders and nothing else, and Block Public Access stays on, so the bucket's own
address opens nothing.

Every image is re-encoded on the way in, which drops EXIF, GPS and the rest of
what a phone writes into a photograph; every video and recording is copied
without its tags ([`server/src/routes/media.routes.ts`](../../server/src/routes/media.routes.ts)).
No file in the bucket says where it was taken.

## Check it from outside

Four requests, from any machine, with no credentials. Take the key of any
avatar from a member row (its URL ends in `avatars/<id>/<file>`); the private
keys need not exist, since the answer for a key that is there and one that is
not must be the same.

```bash
CDN=https://<CDN_URL host>
BUCKET=https://<S3_BUCKET>.s3.ap-southeast-2.amazonaws.com

curl -sI "$CDN/avatars/<id>/<file>"         | head -1   # 200: public files load
curl -sI "$BUCKET/avatars/<id>/<file>"      | head -1   # 403: the bucket itself opens nothing
curl -sI "$CDN/resumes/x/y.pdf"             | head -1   # 403: the CDN cannot reach a private folder
curl -sI "$CDN/chat/x/y_z.webp"             | head -1   # 403: nor this one
```

A 200 on the second, third or fourth line is an exposure: fix the bucket policy
before anything else (below). A 403 on the first line means the CDN is not
allowed to read the public folders, and no avatar or reel is loading.

The API asks the same question for you, writing one small probe object into a
public folder and one into a private folder, fetching each the way a stranger
would, and deleting both:

```
GET $API_URL/health/launch-readiness?probe=media
x-health-token: <HEALTH_DIAGNOSTICS_TOKEN>
```

Read the `MEDIA_EXPOSURE` check. The daily job in
[`.github/workflows/uptime.yml`](../../../.github/workflows/uptime.yml) runs it
when the repository has the `HEALTH_DIAGNOSTICS_TOKEN` secret, and opens an
issue when it does not pass.

## When `MEDIA_EXPOSURE` does not pass

| It says | What it means | Do this |
| --- | --- | --- |
| `exposed` | A probe in a private folder was readable without signing in, at the CDN's address or the bucket's. Every résumé and chat file is readable by anyone who has its address. | **Treat as an incident** ([`docs/security/incident-response.md`](../../../docs/security/incident-response.md), and the Notifiable Data Breaches steps in [`ONCALL.md`](ONCALL.md)). Turn Block Public Access on for all four settings; replace the bucket policy with the one in the README, which allows the CloudFront distribution to read the seven public folders only; remove any CloudFront behaviour that covers the whole bucket. Run the check again. Then decide, with the privacy officer, whether the exposure was long enough to notify. |
| `public_unreadable` | A probe in a public folder could not be read at the address stored rows use. Avatars, covers, post pictures and reels are not loading. | Check `CDN_URL` is the distribution's https address; check the distribution's origin access control is attached and the bucket policy names the distribution's ARN; check the distribution has finished deploying. |
| `unverified` | A probe could not be written, could not be removed, or an address did not answer in time. Nothing is known either way. | Run it again. If it keeps failing: the API's IAM user needs `s3:PutObject` and `s3:DeleteObject` on the bucket's objects, and the API host needs to reach both the CDN and the bucket. Silence is never read as safe. |
| `not_applicable` | No S3 credentials are configured. | Outside production this is a developer's machine. In production the API does not start this way. |

## Why `CDN_URL` is required

A public file is written to its row as `${CDN_URL}/key` at upload. Without a
CDN the fallback is the bucket's own address, which Block Public Access answers
with 403, and the only way to make pictures load would be to open the bucket,
which opens every résumé and chat file with them. So in production the API
refuses to start without `CDN_URL`, and refuses the bucket's own `amazonaws.com`
address ([`server/src/utils/env.ts`](../../server/src/utils/env.ts)). A value
that was wrong for a while is permanent for every file uploaded while it was
wrong; those rows have to be rewritten by hand.

## When files go

- A story goes with its 24 hours, and so does its file, unless a highlight
  still shows it ([`server/src/services/story-expiry.service.ts`](../../server/src/services/story-expiry.service.ts)).
- A disappearing message goes at its time, an unsent message at once, and
  every message of an erased member with her account, and the files under
  `chat/` go with them ([`server/src/services/chat-attachment-cleanup.service.ts`](../../server/src/services/chat-attachment-cleanup.service.ts)).
  The one exception is the file behind a message somebody has reported, which
  the people deciding the report need to see; it is kept, the report's copy of
  the message carries its key, and a member of staff with a second factor opens
  it from the report through the same `POST /api/media/download-url`. The sender
  cannot delete it by its key either: a file a message carries, or a report
  names, is answered with 409 by `DELETE /api/media/delete`.
- A member deletes her own upload with `DELETE /api/media/delete` and its key.

A file that could not be removed from the bucket is counted, not swallowed:
`media-storage.delete` and `story-expiry.media-delete` on `/health/detailed`
climbing means the bucket has started refusing deletes, usually a revoked key
or a policy change.

## Files from before

Until October 2026 a file sent in a direct message or a group chat was uploaded
as a post picture, a reel or a sound: into a public folder, to a public link.
Those files were not moved. They are still public links, they are not deleted
when their message expires or is unsent, and the web client shows them as it
always did. A member who wants one gone can ask; a member of staff with the
bucket's console removes the object by its key, which is the tail of the link on
the message. There is no bulk migration, on purpose: moving a file means
rewriting the message that points at it, and nothing in the product promised
those members anything about files sent before the change.

## Rotating the API's key

Create a new access key for the API's IAM user, set `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` on the API host, redeploy, and watch the start-up log
for "Media storage probe: S3 bucket reachable" (the API asks S3 at every start;
[`server/src/utils/media-storage.ts`](../../server/src/utils/media-storage.ts)
`probeMediaStorage`). Then delete the old key. `/health/detailed` shows
`media-storage.s3-unreachable` at 1 while the bucket cannot be reached.
