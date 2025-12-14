# Messaging API (Draft)

The messaging module exposes endpoints under `/api/v1/messaging`. Conversation, message, and invite routes require `auth:sanctum` and operate on the caller's active profile, while the metadata endpoint is public so clients can bootstrap UI before login.

## Conversations

### Metadata

- **Endpoint:** `GET /api/v1/messaging/meta`
- **Auth:** None
- **Response:**

  ```json
  {
    "updated_at": "2025-11-17T00:00:00Z",
    "shareable_types": ["post", "buddy_invite"],
    "attachment_types": {
      "allowed": ["image", "file"],
      "constraints": {
        "image": {
          "max_size_kb": 5120,
          "allowed_schemes": ["https"],
          "mime_types": ["image/png", "image/jpeg", "image/webp"],
          "description": "PNG, JPEG, or WebP images optimized for chat previews."
        },
        "file": {
          "max_size_kb": 10240,
          "allowed_schemes": ["https"],
          "mime_types": [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ],
          "description": "General documents such as PDF or DOCX shared via secure links."
        }
      }
    },
    "cdn": {
      "status": "online",
      "rolling_latency_ms": 120,
      "latency_window_seconds": 300,
      "latency_trend": "steady",
      "degraded": false,
      "window_sample_count": 8,
      "window_failure_count": 2,
      "probe_success_ratio": 0.8,
      "last_sample_recorded_at": "2025-11-17T01:55:00Z",
      "last_sample_latency_ms": 140,
      "samples_retained_minutes": 1440,
      "latency_stale": false,
      "latency_stale_threshold_minutes": 15,
      "last_sample_age_seconds": 90,
      "last_probe_status_code": 200,
      "last_probe_attempts": 2,
      "last_probe_failure_reason": null,
      "latency_percentiles": {
        "50": 120,
        "95": 180
      },
      "failure_streak": 0,
      "latency_histogram": {
        "<=200ms": 12,
        "<=400ms": 4,
        ">400ms": 1
      },
      "latency_histogram_labels": ["<=200ms", "<=400ms", ">400ms"],
      "latency_degraded_signals": [],
      "latency_degraded_summary": null,
      "max_attachments_per_message": 5,
      "video_uploads_enabled": false,
      "supported_video_formats": ["mp4", "webm"],
      "per_type_upload_limits": {
        "image": {"per_message": 5, "per_day": 40},
        "file": {"per_message": 2, "per_day": 15},
        "video": {"per_message": 1, "per_day": 8, "max_duration_seconds": 90}
      }
    }
  }
  ```

- **Usage:** Allows clients to fetch the currently supported `shareable_type` values and attachment/CDN constraints (including recommended MIME types) dynamically. Cache aggressively via the `ETag` header and send `If-None-Match` to receive `304 Not Modified` responses when nothing changed since `updated_at`.
- **CDN block:** The `cdn` object surfaces a lightweight health snapshot so clients can toggle uploader affordances (e.g., hide video pickers when `video_uploads_enabled` is `false`, respect `max_attachments_per_message`). The `rolling_latency_ms`, `latency_window_seconds`, `latency_trend`, and `degraded` flag help throttle UI if the media edge is under stress (for example, disabling auto-upload when the rolling latency over the last five minutes exceeds the configured threshold or when the trend is `rising`). Samples for these metrics are collected automatically via the scheduled `messaging:cdn:sample` artisan command, which dispatches the `RecordCdnLatencySampleJob` that probes `MESSAGING_CDN_LATENCY_PROBE_URL`. Operators can run the command manually (`php artisan messaging:cdn:sample --sync`) whenever they need to capture an immediate probe. Additional observability fields—`window_sample_count`, `window_failure_count`, `probe_success_ratio`, `latency_histogram`, `latency_histogram_labels`, `last_sample_recorded_at`, `last_sample_latency_ms`, `last_sample_age_seconds`, `latency_stale`, and `samples_retained_minutes`—let clients reason about how fresh the telemetry is. Probe diagnostics (`last_probe_status_code`, `last_probe_attempts`, `last_probe_failure_reason`) expose the most recent HTTP outcome; if the latest probe failed, `degraded` is forced to `true` even when rolling latency looks healthy, giving clients an immediate signal to pause uploads. Percentile stats (`latency_percentiles`) summarize the most recent latency distribution so dashboards can render P50/P95 charts without recomputing them client-side, `latency_histogram` offers a quick view of how many samples landed in each latency band (use `latency_histogram_labels` as the legend/axis so ops dashboards stay in sync with the configured buckets), and `failure_streak` advertises how many consecutive probes have failed since the last success (handy for gating media uploads during cascading outages). When `probe_success_ratio` drops below the configured target or the `failure_streak` crosses its limit, `degraded` flips to `true` even if latency looks fine—a proactive signal for client apps to pause heavy uploads.
- **Guardrail transparency:** Pair the `degraded` flag with `latency_degraded_signals` to highlight which guardrails fired (`rolling_latency`, `stale_samples`, `latest_probe_failed`, `success_ratio`, `failure_streak`). `latency_degraded_summary` strings these signals together in human-friendly text so dashboards can display the cause without re-implementing the guardrail logic.

#### CDN Latency Sampling Ops Checklist

- **Environment variables:** Populate `MESSAGING_CDN_LATENCY_PROBE_URL` with the edge health endpoint for every environment. Optional overrides (`MESSAGING_CDN_LATENCY_PROBE_METHOD`, `MESSAGING_CDN_LATENCY_PROBE_TIMEOUT`, `MESSAGING_CDN_LATENCY_PROBE_CONNECT_TIMEOUT`, `MESSAGING_CDN_LATENCY_PROBE_RETRIES`, `MESSAGING_CDN_LATENCY_PROBE_FREQUENCY_MINUTES`, `MESSAGING_CDN_LATENCY_PROBE_BATCH`, `MESSAGING_CDN_LATENCY_RETENTION_MINUTES`, `MESSAGING_CDN_LATENCY_STALE_THRESHOLD_MINUTES`, `MESSAGING_CDN_LATENCY_PERCENTILES`, `MESSAGING_CDN_LATENCY_SUCCESS_RATIO_TARGET`, `MESSAGING_CDN_LATENCY_FAILURE_STREAK_THRESHOLD`, `MESSAGING_CDN_LATENCY_HISTOGRAM_MS`) allow tuning per tier (e.g., slower timeout + 5 min cadence in production, faster cadence in staging). Use the percentile list to match whatever P50/P95/P99 series you graph downstream, tighten the ratio/threshold to decide how aggressively the client should pause uploads, and adjust histogram buckets to match the ranges you display on dashboards.
- **Scheduler:** The hourly/interval cadence comes from `latency_probe_frequency_minutes`. Confirm `php artisan schedule:run` is wired in the server crontab so samples continue to accumulate, then run `php artisan schedule:list` to ensure both `messaging:cdn:sample` and `messaging:cdn:prune-samples` are registered. On production, the cron entry `* * * * * cd /var/www/html && php artisan schedule:run >> /dev/null 2>&1` should already exist; reapply it after deployments.
- **Queue workers:** `RecordCdnLatencySampleJob` runs on the `messaging` queue. Update Supervisor/systemd unit files to include that queue (for example `php artisan queue:work --queue=messaging,default --tries=3`). Without a worker bound to `messaging`, scheduled probes will backlog and the metadata endpoint will fall back to stale config values. After deploying, check `php artisan queue:monitor messaging` or `supervisorctl status` to confirm at least one worker is actively processing the `messaging` queue.
- **Retention:** Samples older than `latency_retention_minutes` are pruned automatically via the scheduled `messaging:cdn:prune-samples` command; operators can run it on demand (`php artisan messaging:cdn:prune-samples --minutes=180`) during migrations or when tweaking retention.
- **Manual probes:** Run `php artisan messaging:cdn:sample --sync --count=3` when you need instant readings during incidents; this bypasses the queue and records samples inline.

##### Recommended retention per environment

| Environment | `MESSAGING_CDN_LATENCY_RETENTION_MINUTES` | Rationale |
|-------------|-------------------------------------------|-----------|
| Local       | 240 (4 hours)                             | Keeps developer DBs small while still providing a short freshness window. |
| Staging     | 1440 (24 hours)                           | Mirrors a full day of QA traffic for trend validation without piling up data. |
| Production  | 4320 (72 hours)                           | Sustains three days of historical latency for dashboards and incident review. |

Tune these numbers per region as needed; when reducing retention, run `messaging:cdn:prune-samples --minutes=<new value>` immediately after updating the `.env` to shrink the table quickly.

##### Recommended stale thresholds & telemetry monitors

| Environment | `MESSAGING_CDN_LATENCY_STALE_THRESHOLD_MINUTES` | Dashboard alert |
|-------------|-----------------------------------------------|-----------------|
| Local       | 5–10                                           | Optional (dev tooling only) |
| Staging     | 10                                             | Slack alert on `latency_stale=true` for >15 minutes |
| Production  | 15                                             | PagerDuty alert if `latency_stale` stays true for 2 consecutive samples |

When wiring client telemetry dashboards, chart the `cdn.latency_stale` flag alongside `rolling_latency_ms` so dead sampler incidents are obvious. Alert when `latency_stale` flips true outside maintenance windows, and annotate the chart with sampler restarts so reliability teams can correlate incidents quickly.

###### Dashboard integration tips

- Use `latency_histogram_labels` for the X-axis/legend in whatever chart surfaces the latency distribution so bucket names always match the server-side configuration.
- Plot `probe_success_ratio` alongside `failure_streak`; highlighting the ratio crossing its threshold makes it easy to explain why the `degraded` flag flipped even if P50 latency looks fine.
- Keep the histogram visualization stacked with the rolling percentile values so ops can correlate spikes with specific buckets (for example, a wall of `>400ms` samples typically precedes upload disablement).

##### Recommended success-ratio & failure-streak settings

| Environment | `MESSAGING_CDN_LATENCY_SUCCESS_RATIO_TARGET` | `MESSAGING_CDN_LATENCY_FAILURE_STREAK_THRESHOLD` | Notes |
|-------------|---------------------------------------------|--------------------------------------------------|-------|
| Local       | 0.70                                         | 8                                                | Keep loose to avoid flapping while iterating locally. |
| Staging     | 0.85                                         | 5                                                | Alert noise is acceptable; surface issues before going live. |
| Production  | 0.92                                         | 3                                                | Aggressive guardrails so client apps pause uploads quickly during edge instability. |

Tune these values based on real incident data—raise the ratio target whenever you notice recoveries taking longer than desired, and drop the failure streak threshold if packet loss tends to cascade rapidly in your region.

> The repo now ships `.env` (local), `.env.staging`, and `.env.production` templates with the targets above. Copy the version that matches your environment and adjust only if on-call reviews justify different guardrails.

### List conversations

- **Endpoint:** `GET /api/v1/messaging/conversations`
- **Query:** `per_page` (default 20, max 50)
- **Response:** Paginated list of conversations including participants and latest message metadata.

### Create conversation

- **Endpoint:** `POST /api/v1/messaging/conversations`
- **Body:**

  ```json
  {
    "type": "direct",
    "participant_profile_ids": [2],
    "subject": "Mentorship welcome",
    "requires_approval": false,
    "metadata": {"context": "buddy_program"},
    "initial_message": {
      "message_type": "text",
      "body": "Excited to connect!"
    }
  }
  ```

- **Behavior:** Validates safety (blocks, DM policy), reuses an existing direct conversation if present, and optionally seeds the first message.
- **Initial message rules:** If `initial_message.attachments` is supplied, each entry must include `type`, `url`, and (optionally) `size_kb`. URLs must use an allowed scheme for the given type (currently HTTPS only) and `size_kb`, when provided, cannot exceed the per-type limit surfaced in the metadata endpoint. When sharing an object, `initial_message.shareable_type` must be paired with `initial_message.shareable_id` and the type must be one of: `post`, `buddy_invite`.

### Show conversation

- **Endpoint:** `GET /api/v1/messaging/conversations/{conversation}`
- **Response:** Conversation payload with participants and most recent message.
- **Auth:** Only `active` participants may access; users who left, are blocked, or never joined receive `403`.

## Messages

### List messages

- **Endpoint:** `GET /api/v1/messaging/conversations/{conversation}/messages`
- **Query:**
  - `per_page`: default 30, max 100
  - `page`: standard paginator page number (defaults to 1)
- **Response:** Paginated messages ordered by `sent_at` descending with sender metadata and attachments payload.
  - `links.prev` is `null` on page 1 and populated afterward; `links.next` becomes `null` on the last page.
  - Each entry includes `sender` preview, `attachments` array (when provided), and optional `shareable_type/shareable_id` for shared objects.
  - Requests from profiles that are not `active` participants (left, blocked, never joined) receive `403`.

### Send message

- **Endpoint:** `POST /api/v1/messaging/conversations/{conversation}/messages`
- **Body:**

  ```json
  {
    "message_type": "text",
    "body": "Following up after our session"
  }
  ```

- **Alternatives:** Messages may omit `body` when they include either `attachments` or a shareable reference. For example, to send a shared post without any text:

  ```json
  {
    "message_type": "post_share",
    "shareable_type": "post",
    "shareable_id": 321
  }
  ```

- **Validation:** `shareable_type` and `shareable_id` must always be supplied together; requests that include only one of the fields are rejected with `422 Unprocessable Entity`.

### Realtime delivery

- **Event:** `social.messaging.message-created`
- **Channel:** `private-social.user.{userId}` (one broadcast per participant except the sender)
- **Payload:**

  ```json
  {
    "thread": {"id": 45, "type": "direct"},
    "message": {
      "id": 903,
      "message_type": "text",
      "body": "Realtime ping",
      "shareable_type": null,
      "shareable_id": null,
      "is_system": false,
      "sent_at": "2025-11-19T10:00:00Z",
      "sender": {
        "id": 11,
        "display_name": "Ariel",
        "username": "ariel.dev",
        "avatar_url": "https://cdn.test/u/ariel.jpg"
      },
      "attachments": []
    }
  }
  ```

- **Usage:** Subscribe via Laravel Echo/Pusher to `private-social.user.${userId}` (the authenticated user ID). The event mirrors the response from `POST /messages` so inbox panes can optimistically append new messages without re-polling the API. Because the backend enforces authorization on the conversation before dispatching, clients can trust that every payload corresponds to a conversation the local persona can view.
- **Shareable types:** Only `post` and `buddy_invite` are accepted values for `shareable_type`. Any other value results in validation failure.
- **Attachment objects:** Each entry in `attachments` must include both `type` and `url` keys; malformed entries trigger a `422` response.
- **Attachment types:** Attachment `type` must match the whitelist exposed by the metadata endpoint (currently `image`, `file`). URLs must use an allowed scheme for that type (HTTPS today) and any provided `size_kb` hint must stay within the max KB limit for the type.

- **Behavior:** Ensures the active profile is an `active` participant, re-validates safety, requires at least one of `body`, `attachments`, or `shareable_type/shareable_id`, updates `last_message_at`, and returns the persisted message record.

## Buddy Invites

### List invites

- **Endpoint:** `GET /api/v1/messaging/buddy-invites`
- **Query:**
  - `direction`: `incoming` (default), `outgoing`, or `all`
  - `status`: `pending`, `accepted`, `declined`, `withdrawn`
  - `per_page`: page size (default 15, max 50)
  - `page`: standard paginator page number (defaults to 1)
- **Response:** Paginated invites with requester/target preview cards.
  - `links.prev` is `null` on the first page and populated on later pages.
  - `links.next` is populated while more results exist and `null` on the last page.

### Send invite

- **Endpoint:** `POST /api/v1/messaging/buddy-invites`
- **Body:**

  ```json
  {
    "target_profile_id": 7,
    "activity_type": "yoga",
    "preferred_schedule": ["weekday_mornings"],
    "intro_message": "Want to be wellness buddies?"
  }
  ```

- **Behavior:** Applies standard DM safety checks, prevents duplicate pending invites (either direction), and records the request.

### Respond to invite

- **Endpoint:** `POST /api/v1/messaging/buddy-invites/{invite}/respond`
- **Body:**

  ```json
  {
    "action": "accept",
    "message_body": "Excited to connect!"
  }
  ```

- **Behavior:**
  - `accept`: only the invited profile may accept; marks invite accepted and spins up a direct conversation seeded with the optional message.
  - `decline`: invited profile closes the invite without a conversation.
  - `withdraw`: requester retracts the invite.

## Safety Rules (current)

1. Participants cannot be the same as the initiator.
2. Messaging is blocked if either side has an active `profile_blocks` entry.
3. Profiles with `dm_policy = no_one` cannot receive new threads.

Future enhancements (outside this increment): teen/women-specific escalations, trust graph checks, buddy invite workflow integration.
