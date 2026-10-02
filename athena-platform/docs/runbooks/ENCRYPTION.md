# Encryption at rest: what it protects, and how to keep the key

**Read before changing `DV_ENCRYPTION_KEY`, before restoring a database backup, and before writing any sentence that tells a member her data is "encrypted".**

## What this is, in one paragraph

The most private things a member keeps on ATHENA are sealed with AES-256-GCM before they reach the database: the text of her safe-chat messages, her health records, her authenticator seed and her personal safety plan. A copy of the database, a leaked dump or a restored backup holds sealed text, not words. The key that opens it is held by the API host, not by the database.

That is **encryption at rest**. It is not end-to-end. The server holds the key and opens a value whenever the member asks to see it, so ATHENA's own servers can read everything described here, and so can anyone who holds both the database and the key. No sentence anywhere may say that "only you" can read it. The honest sentence is: *encrypted before it is stored; ATHENA's servers decrypt it to show it to you.*

## What is sealed, and what is not

| Sealed under the key | Where | Key variable |
|---|---|---|
| The text of a safe-chat message | `DvSafeMessage.content` | `DV_ENCRYPTION_KEY` |
| A health entry (check-in, cycle, sleep, water, doses) | `HealthEntry.payload` | `HEALTH_ENCRYPTION_KEY`, else `DV_ENCRYPTION_KEY` |
| A medication's name, dose and instructions | `Medication.details` | as above |
| A health note | `HealthNote.content` | as above |
| The reason given for a practitioner booking | `HealthBooking.reason` | as above |
| The authenticator seed behind two-factor sign-in | `User.twoFactorSecret` | `TOTP_ENCRYPTION_KEY`, else `DV_ENCRYPTION_KEY` |
| The seven parts of a personal safety plan | `SafetyPlan.*` | `DV_ENCRYPTION_KEY` only |

A safety plan is never keyed from the authenticator key: a second factor can be re-enrolled, so rotating that key is routine, and a plan sealed under it would be lost without her knowing until she opened it.

**Readable in the database, on purpose, because the product needs to find it:**

- Safe chats: who sent a message, when, and when it will delete itself; the chat's real name and its disguised name; the emergency contacts and panic alert history. The PIN is a salted hash, not sealed text.
- Health: which member, what kind of record and which day (so a month can be found); a medication's schedule (times, days, start and end, refills); a note's link to a booking; a booking's time, mode, status, the practitioner's note and the meeting link; share links (their scope, label and expiry).
- The rest of the wellness area, which is **not** sealed: habits (name, cue, notes), habit logs and their notes, goals and their labels, the mental load log (the task text she types), forum posts and replies, and circle check-ins. They sit behind her sign-in and are removed by "Delete all my health data" where that button covers them, but a database copy shows them as typed. Copy must say "what you log, your medications and your health notes" is encrypted, never "everything health-related", until those columns are sealed too.
- Everything about the account that is not listed in the first table.

## What it protects against, and what it does not

**Protects against**

- Someone who obtains a copy of the database without the key: a leaked dump, a stolen credential for the database host, a restored backup. The nightly off-platform backup (`.github/workflows/backup.yml`) is a dump of the same tables, so it holds sealed text too, and is itself encrypted to the owner's offline keys on top of that.
- Someone reading rows through a database console, or a support query that selects the wrong column.
- The logs, the error tracker and the search index. No log line carries message or record content (the services log ids only), error reports have the request body, cookies, query string and sensitive headers removed before they leave (`scrubEvent` in `server/src/utils/sentry.ts`, tested against the real SDK in `server/src/utils/__tests__/sentry.test.ts`), and no admin screen or search index reads these tables.

**Does not protect against**

- **ATHENA itself.** The API decrypts on every read. Anyone who can run code on the API host, or who holds the host's environment variables together with a database copy, can read everything above. What ATHENA can read it could be required to hand over, and nobody should tell a member otherwise.
- **A link she gives out.** A practitioner share link (`HealthShare`) shows the summary it names to whoever holds the link until it expires or she revokes it.
- **Her own device.** Nothing here protects a phone or browser someone else can open. That is what the quick exit, the disguised chat name and the chat PIN are for, and they are weaker than they sound against a person who has her phone and her patience.
- **A key that was ever public.** `.env.example` used to ship `DV_ENCRYPTION_KEY` as 64 zeros. A deployment that ran with it sealed its data under a key anyone can read in the repository. See "A key that was ever public" below.

Plaintext exists in these places by design: in the API's memory while it serves a request, in the response to the member, in the data export she asks for (readable, not ciphertext: `gdpr.service.ts` opens each sealed column), in a wellness report she downloads, and in a share summary she hands out.

### What members are told

Two forms, and nothing stronger. In a menu, an intro or a one-line blurb (the wellness pages, the home page directory, the mobile app):

> Encrypted before it is stored, and shown only to you unless you share it.

Where there is room to say more (the wellness privacy page, the help centre, the safe-chat and safety-plan screens, the privacy notice):

> Encrypted before it is stored. ATHENA's servers decrypt it to show it to you, so this protects it from anyone who gets hold of a copy of our database, not from ATHENA. The people who look after our servers hold the key.

The phrases that are **not** allowed, because they promise what encryption at rest cannot: "only you can read it", "read only by you", "nobody can see it", "end-to-end", any claim about "all data", and "everything health-related is encrypted" (habits, goals, the mental load log and forum posts are stored as typed; name what is sealed instead: what she logs, her medications, her health notes and booking reasons). `client/src/lib/encryption-claims.test.ts` fails on most of these; search the client and mobile source for the rest before a release.

Backups are the other half. Deleting a record removes it from the live database at once. Copies of the whole database are kept sealed for a limited time (`BACKUP_RETENTION_DAYS`, see "Backups and restore" in `ONCALL.md`), and a deleted record ages out of them as the oldest copies are removed. Copy must not say "there is no copy".

If ATHENA ever moves to client-side or end-to-end encryption, the copy may say "only you can read it" **from the day that ships and not before**. That is a product and legal decision, not an edit.

## The key

One 64-character hex value, generated with `openssl rand -hex 32`. It lives in the API host's environment (Render, `render.yaml`; Fly, `fly.toml`) and **nowhere else that the database or this repository can reach**. Production refuses to start with a missing, short, non-hex, all-zero, placeholder or repeating-pattern key (`server/src/utils/env.ts`), and refuses to seal or open anything with one even if the boot check was skipped (`server/src/utils/encryption-key.ts`). `/health/launch-readiness` reports the same.

**Back it up.** A copy goes in a password manager the owner controls, in a place the API host and the database host cannot take with them. Record where it is and who can reach it. Two people should know. Without this exact value:

| What | What happens |
|---|---|
| Safe-chat messages | Show "This message could not be read". Gone. |
| Health records, medications, notes, booking reasons | Show as unreadable. Gone. |
| Safety plans | Each sealed part shows as unreadable, never as ciphertext. Gone. |
| Two-factor seeds | The member's authenticator code stops working. A member who still has her recovery codes signs in with one, turns two-factor off and on again. A member with neither has no way in: there is no staff reset in the product, so it is a manual change made by someone who has checked who she is. |
| Backups | Restore fine, and open nothing. The key is not in them. |

There is no recovery from a lost key. Do not "try a different value": every wrong key fails the same way.

## Rotating the key (planned, or after a suspected leak)

Rotation is safe because a key can be retired without losing what it sealed. Each key variable has a companion, `DV_ENCRYPTION_KEY_PREVIOUS`, `HEALTH_ENCRYPTION_KEY_PREVIOUS` and `TOTP_ENCRYPTION_KEY_PREVIOUS`, holding the keys it replaced, comma separated. The API **seals with the current key** and **opens with the current key, then the previous ones**. A value that carries the marker `enc:v1:` is in the current format; an older value without it is the same bytes and is still opened.

1. **Generate** the new key (`openssl rand -hex 32`) and **put it in the key backup before anything else.** A key that exists only on the host it was set on is the situation this runbook is about.
2. **Set**, on the API host: `DV_ENCRYPTION_KEY` to the new key, and `DV_ENCRYPTION_KEY_PREVIOUS` to the old one (add to the list if it already holds older ones). If `HEALTH_ENCRYPTION_KEY` or `TOTP_ENCRYPTION_KEY` is set, rotate that variable the same way with its own `_PREVIOUS`. The API refuses to start on a malformed key or a malformed `_PREVIOUS` list, and says which variable (never the value).
3. **Deploy.** Nothing breaks: old values open through the previous key, new writes use the new one. Check `/health/launch-readiness` is `ready`.
4. **Seal everything again.** From `athena-platform/server`, with `DATABASE_URL` set to the production value (the one the API host uses: the script opens whatever it names) and the same two variables set:

   ```bash
   npm run rotate:encryption-keys                 # dry run: counts only, writes nothing
   npm run rotate:encryption-keys -- --apply      # seals under the current key
   ```

   It covers every sealed column in the first table. A value the current key already opens is left alone, a new seal is opened under the current key before it is written, and a row she changed while it ran is skipped, not overwritten. It prints counts and never an id or a word. **Run it again until `skipped` is 0.**
5. **`unreadable` must be 0.** A non-zero count means some value is sealed under a key that is not in any `_PREVIOUS` list: find that key (the key backup, an earlier rotation, the all-zero example key) and add it. Do not go on while it is above zero.
6. **Retire the old key from the host only after step 5 is clean**, by taking it out of `DV_ENCRYPTION_KEY_PREVIOUS`. **Keep it in the key backup** for at least as long as the longest-lived database backup (`BACKUP_RETENTION_DAYS`). A backup taken before the rotation is sealed under the old key; restoring one without that key opens nothing. When you restore, put the old key back in `_PREVIOUS` first.

If the old key leaked, everything sealed under it is readable by whoever holds a database copy from before the rotation. Re-sealing protects the live database from then on; it cannot recall copies that already exist.

The script refuses to run, from any shell and whatever `NODE_ENV` is, if the current key is missing, not 64 hex characters, or a placeholder or repeating pattern, so a typo cannot seal the whole database under a key the API will not start with.

### Giving health records or authenticator seeds a key of their own

`HEALTH_ENCRYPTION_KEY` and `TOTP_ENCRYPTION_KEY` are optional, and unset means "use `DV_ENCRYPTION_KEY`". **Setting one for the first time is a rotation, not an addition.** Everything of that kind already stored is sealed under the safe-chat key, and a purpose opens values with its own key and its own `_PREVIOUS` list, not with the safe-chat key it used to fall back to. Set the new variable and put the key that is current today in the matching `_PREVIOUS` variable (for example `HEALTH_ENCRYPTION_KEY_PREVIOUS` = the present `DV_ENCRYPTION_KEY`), deploy, then run steps 4 to 6 above. Skip the `_PREVIOUS` line and every health record (or every two-factor seed) reads as unreadable the moment the API restarts.

## A key that was ever public

`.env.example` used to ship the all-zero key, which is valid hex and used to pass every check. The example now holds no value, and the boot, readiness and per-write checks all refuse it. If production was **ever** started with that value (or any placeholder), treat what it sealed as readable by anyone who obtained a database copy, and rotate: generate a real key, set `DV_ENCRYPTION_KEY_PREVIOUS` to the 64 zeros, and run the steps above. A retired key is allowed to be one the current-key check would refuse; that is exactly the key that needs retiring.

## Where this lives in the code

- `server/src/utils/encryption-key.ts`: the one key loader, the `enc:v1:` marker, sealing and opening, the previous-key list.
- `server/src/services/dv-safe.service.ts`, `server/src/services/wellness/health-crypto.ts`, `server/src/utils/secret-box.ts`, `server/src/utils/safety-plan-seal.ts`: what is sealed, each calling the loader.
- `server/src/utils/env.ts`, `server/src/routes/health.routes.ts`: the boot check and the readiness check.
- `server/src/services/gdpr.service.ts`: opens each sealed column for a member's own data export.
- `server/src/scripts/rotate-encryption-keys.ts`: step 4 above. `server/src/scripts/seal-safety-plans.ts` is the one-off that sealed plans saved before plans were sealed.
- `server/src/utils/sentry.ts`: what an error report may carry.

## Decisions that are not engineering's

- Whether to keep "only you can read it" as a goal and fund client-side or end-to-end encryption, or to stand on the wording above.
- The privacy contact or DPO re-approving the records of processing, the impact assessment and the privacy statement wherever they say wellness data is encrypted, against the threat model above.
- Where the key backup is held, and who can reach it.
- Whether backups that outlive a deletion are acceptable for the retention period chosen, and what members are told about it.
