# DNS & SSL Configuration Guide

**Last Updated:** 2 October 2026

> **Note:** This document describes the **target-state** DNS/SSL layout for when
> ATHENA moves to a custom domain with Cloudflare in front and a CloudFront CDN
> for public media. ATHENA does not yet own a production domain: every record
> below is written against `<your-domain>`, the domain the owner registers, and
> nothing here names a domain the venture does not hold (the `athena.com` and
> `athena.app` names that used to appear in this file are refused by the API as
> a sending domain for exactly that reason). The **current** deployment uses:
>
> - **Frontend:** `https://athena-empress.netlify.app` (Netlify, auto-SSL)
> - **API:** the API host's public URL (managed hosts issue the certificate); database on Neon
>
> For the current setup, see [DEPLOY.md](../../DEPLOY.md) and [NETLIFY_SETUP.md](../../../NETLIFY_SETUP.md).
> The one section that is needed **before** launch whatever the domain layout is
> [Email records](#email-records-sendgrid-domain-authentication): no member can
> finish signing up until a verification email can leave.

## Overview

This document outlines the **target-state** DNS and SSL/TLS configuration for the ATHENA platform production deployment.

---

## 1. Domain Architecture

### Primary names

| Name | Purpose | Provider |
|--------|---------|----------|
| `<your-domain>` and `www.<your-domain>` | Web application | Netlify (DNS proxied through Cloudflare) |
| `api.<your-domain>` | API server, and the socket connections (Socket.IO is served by the same process on the same host; there is no separate WebSocket host) | The API host (Render or Fly) |
| `cdn.<your-domain>` | Public media (avatars, covers, post images, reels, thumbnails, captions, sounds) | CloudFront |
| `mail.<your-domain>` | The sending domain authenticated with SendGrid. CNAME records only; it receives no mail and has no MX | SendGrid |

### Optional names

| Name | Purpose |
|-----------|---------|
| `staging.<your-domain>` | Staging environment, if one is run |
| `status.<your-domain>` | Status page, if one is subscribed to |

Deploy previews need no DNS: Netlify serves them on `*.netlify.app`.

---

## 2. DNS Configuration

Netlify, the API host and CloudFront each print the exact target to point a
name at when the custom domain is added in their dashboard. The values below are
the shape of each record; copy the targets from the dashboards, not from here.

### A/AAAA and CNAME records (web and API)

```dns
# Web application (Netlify). Netlify prints the apex address and the site's
# CNAME target under Domain management > Add a domain.
<your-domain>.                 A       <apex address printed by Netlify>
www.<your-domain>.             CNAME   <site-name>.netlify.app.

# API server. The host prints the CNAME target when the custom domain is added.
api.<your-domain>.             CNAME   <target printed by Render or Fly>.

# CDN for public media (CloudFront distribution domain)
cdn.<your-domain>.             CNAME   <distribution-id>.cloudfront.net.

# Optional
staging.<your-domain>.         CNAME   <staging-site>.netlify.app.
status.<your-domain>.          CNAME   <target printed by the status-page provider>.
```

With Cloudflare in front, the web and API names may be proxied (orange cloud).
The three SendGrid CNAMEs below must be **DNS only** (grey cloud), or SendGrid
cannot verify them.

### Email records (SendGrid domain authentication)

Transactional email (verification, password reset, account lock, welcome,
booking and notification mail) is sent through SendGrid from
`SENDGRID_FROM_EMAIL`. The address must be on a domain you own and have
authenticated in SendGrid: the API refuses to start in production without a
usable one, and refuses `athena.com`, `athena.app`, `example.com` and the
template's `your-domain.com` by name
(`athena-platform/server/src/utils/sender-address.ts`). A variable cannot
prove the domain is authenticated; the first send does, which is why the last
step below is to register a throwaway account and read the headers of the
email that arrives.

1. **Authenticate the domain.** SendGrid > Settings > Sender Authentication >
   Authenticate Your Domain. Choose your DNS host, enter the domain. Using a
   subdomain such as `mail.<your-domain>` keeps the root domain's own mail
   reputation separate from the platform's. Leave "Use automated security" on.
2. **Add the three CNAME records SendGrid prints.** The host names and targets
   are generated for your account; these are the shape, not values:

   ```dns
   em####.mail.<your-domain>.          CNAME   u#######.wl###.sendgrid.net.
   s1._domainkey.mail.<your-domain>.   CNAME   s1.domainkey.u#######.wl###.sendgrid.net.
   s2._domainkey.mail.<your-domain>.   CNAME   s2.domainkey.u#######.wl###.sendgrid.net.
   ```

   With automated security, SPF and DKIM for the sending domain live at
   SendGrid behind these CNAMEs. Do **not** add `include:sendgrid.net` to the
   root domain's SPF and do **not** paste a `k=rsa; p=...` TXT record; both
   belong to SendGrid's older manual method and the CNAMEs replace them.
3. **Verify** in SendGrid once the records have propagated (minutes to an hour).
4. **Publish DMARC, starting at monitor only**, on the domain the From address
   uses (the root domain's policy also covers `mail.<your-domain>` unless a
   subdomain policy is set):

   ```dns
   _dmarc.<your-domain>.    TXT   "v=DMARC1; p=none; rua=mailto:<a mailbox you read>; fo=1"
   ```

   Read the aggregate reports for a few weeks. Move to `p=quarantine` once only
   your own sources are passing, and to `p=reject` after that.
5. **One SPF record on the root domain**, for whatever sends mail *as* the root
   domain (your mailbox provider, for `support@` and the DMARC mailbox). A
   domain may hold only one `v=spf1` record; a second one fails SPF for
   everything.
6. **Do not point MX at SendGrid.** `mx.sendgrid.net` is for SendGrid's Inbound
   Parse webhook, which this platform does not use. MX stays with the mailbox
   provider that receives mail for the domain.
7. **Set the API variables and redeploy.** On the API host set
   `SENDGRID_API_KEY` (Settings > API Keys, a key with **Mail Send** permission
   only) and `SENDGRID_FROM_EMAIL` to an address on the authenticated domain,
   for example `noreply@mail.<your-domain>`. For bounce and spam-report
   handling, add an Event Webhook (Settings > Mail Settings > Event Webhook)
   posting to `https://api.<your-domain>/api/webhooks/sendgrid` with
   **Signed Event Webhook** on, and set its verification key as
   `SENDGRID_WEBHOOK_PUBLIC_KEY`; bounced addresses are then kept on the
   suppression list and not written to again.
8. **Prove it end to end.** Register a throwaway account, open the verification
   email, and in Gmail choose "Show original": SPF, DKIM and DMARC should each
   read PASS. Run forgot-password once as well. Then
   `GET /health/launch-readiness` with the diagnostics token should show
   `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` ok. If the email never arrives
   and the API log says `Failed to send email` with status 403, the From
   address is not on the authenticated domain.

### TXT records for domain verification

```dns
<your-domain>.           TXT   "google-site-verification=<TOKEN>"   # Search Console, if used
<your-domain>.           TXT   "stripe-verification=<TOKEN>"        # Apple Pay domain registration, if used
```

### CAA Records (Certificate Authority Authorization)

Cloudflare and Netlify issue through Let's Encrypt (and Cloudflare also through
Google Trust Services); CloudFront uses AWS Certificate Manager. A CAA record
that names fewer authorities than the hosts actually use blocks a renewal, so
either list all of them or publish none.

```dns
<your-domain>.           CAA   0 issue "letsencrypt.org"
<your-domain>.           CAA   0 issue "pki.goog"
<your-domain>.           CAA   0 issue "amazon.com"
<your-domain>.           CAA   0 issuewild "letsencrypt.org"
<your-domain>.           CAA   0 iodef "mailto:<a mailbox you read>"
```

---

## 3. SSL/TLS Configuration

### Certificate Strategy

| Name | Certificate | Provider | Auto-Renewal |
|----------------|------------------|----------|--------------|
| `<your-domain>`, `www.<your-domain>` | Edge certificate (proxied) and Netlify's own origin certificate | Cloudflare / Netlify | Yes |
| `api.<your-domain>` | Edge certificate (proxied) and the API host's own origin certificate | Cloudflare / Render or Fly | Yes |
| `cdn.<your-domain>` | ACM certificate in `us-east-1` (CloudFront requires that region) | AWS ACM | Yes |

### Cloudflare SSL Settings

```yaml
# Cloudflare Dashboard Settings
ssl_mode: full_strict
min_tls_version: "1.2"
tls_1_3: on
automatic_https_rewrites: on
always_use_https: on
opportunistic_encryption: on
```

### HSTS

The API sends `Strict-Transport-Security` itself (Helmet, in
`athena-platform/server/src/index.ts`) and Netlify sends it for the web app
(`athena-platform/client/netlify.toml`). If Cloudflare's HSTS is turned on as
well, keep `includeSubDomains` off until every subdomain (status page included)
is confirmed to serve HTTPS, and submit to the preload list only after that.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### TLS Cipher Suites (if a self-managed origin is ever run)

The managed hosts choose their own cipher suites. For an nginx origin:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
```

---

## 4. Cloudflare Configuration

### Page Rules

```yaml
# Force HTTPS
- url: "http://*<your-domain>/*"
  actions:
    - always_use_https: on

# API caching bypass
- url: "api.<your-domain>/*"
  actions:
    - cache_level: bypass
    - disable_apps: on

# Public media caching
- url: "cdn.<your-domain>/*"
  actions:
    - cache_level: cache_everything
    - edge_cache_ttl: 2678400  # 31 days
    - browser_cache_ttl: 86400  # 1 day
```

### Firewall Rules

The API has its own per-caller budget (`athena-platform/server/src/middleware/apiBudget.ts`),
so an edge rate limit is a second line, not the first. Set it above the API's
anonymous budget so that it only ever catches a flood, and exempt the Stripe
and SendGrid webhook paths, which are signed by their senders.

```yaml
# Challenge known bad bots
- expression: "(cf.client.bot)"
  action: challenge

# Edge rate limit on the API, above the API's own anonymous budget
- expression: "(http.request.uri.path contains \"/api/\" and not http.request.uri.path contains \"/api/webhooks/\")"
  action: rate_limit
  threshold: 300
  period: 60

# Webhooks are signed; never challenge them
- expression: "(http.request.uri.path contains \"/api/webhooks/\")"
  action: allow
```

Do not add country blocks: members travel, and a member locked out abroad has
no way to tell the block from an outage.

---

## 5. AWS CloudFront Configuration

The bucket layout, the public and private folders and the bucket policy are
in `athena-platform/infrastructure/README.md` ("Media bucket"). The
distribution reads the **public folders only**, through Origin Access Control;
résumés, documents and files sent in a conversation (`resumes/`, `documents/`
and `chat/`) are private and are served by the API after it has checked who is
asking (`athena-platform/server/src/utils/media-storage.ts`), as a signed S3
link that lives five minutes, never by the CDN, so there are no CloudFront
signed URLs or cookies. `CDN_URL` is required of the API in production and must
be this distribution's address, not the bucket's own.

```yaml
distribution:
  aliases:
    - cdn.<your-domain>

  origins:
    - id: s3-media
      domain_name: <S3_BUCKET>.s3.ap-southeast-2.amazonaws.com
      origin_access_control_id: <OAC id>   # Origin Access Control, not the legacy OAI

  default_cache_behavior:
    viewer_protocol_policy: redirect-to-https
    allowed_methods: [GET, HEAD, OPTIONS]
    cached_methods: [GET, HEAD]
    compress: true
    ttl:
      min: 0
      default: 86400
      max: 31536000

  price_class: PriceClass_All   # the only class that includes the Australian edge locations

  viewer_certificate:
    acm_certificate_arn: <ACM certificate for cdn.<your-domain>, in us-east-1>
    minimum_protocol_version: TLSv1.2_2021
    ssl_support_method: sni-only
```

After it is up: set `CDN_URL=https://cdn.<your-domain>` on the API and
`NEXT_PUBLIC_MEDIA_HOST=cdn.<your-domain>` on Netlify (then redeploy the web
app, it is a build-time value), and call
`GET /health/launch-readiness?probe=media` with the diagnostics token:
`MEDIA_EXPOSURE` must say that public files can be read and private ones cannot.

---

## 6. Security Headers

The web app's security headers are set in three places that have to agree:
`athena-platform/client/netlify.toml` (the Content-Security-Policy among them),
`athena-platform/client/public/_headers` and `athena-platform/client/next.config.js`;
the API's are set by Helmet in `athena-platform/server/src/index.ts`. The CSP
allows connections, images and media from any `https:` or `wss:` origin, so
moving to a custom domain changes nothing in it. What does change is the
variables that name the hosts: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL` and
`NEXT_PUBLIC_MEDIA_HOST` on Netlify (the last is the CDN host `next.config.js`
lets `next/image` load from), and `CLIENT_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`,
`API_URL` and `CDN_URL` on the API. They are build-time values on Netlify, so the
web app is redeployed after they change.

The `Permissions-Policy` is the same string in all three files, and it has to
stay that way: a browser that receives several policies enforces every one of
them, so a feature one layer refuses is refused everywhere. That is how
`microphone=()` quietly broke voice notes in chat and the interview coach's
recorder while the buttons stayed on screen. The policy now lets the site
itself use the microphone (`microphone=(self)`), keeps the camera, location and
screen capture off because nothing in the client asks for them, and delegates
`payment` to Stripe's frame on js.stripe.com so the wallet buttons inside its
payment form can work. The motion sensors (`accelerometer`, `gyroscope`,
`magnetometer`) are off as well. One thing does ask for two of them: the
classroom page's YouTube and Vimeo embed lists `accelerometer; gyroscope` in
its `allow` attribute, which is YouTube's standard embed snippet and only
matters for steering a 360-degree video by tilting the phone. The header wins
over the attribute, so that one gesture is unavailable and the player may log
a permissions-policy warning in the console; ordinary videos are unaffected.
Widen those two directives to the three video origins if 360-degree lessons
are ever wanted. A jest test in the client (`permissions-policy.test.ts` under
`src/__tests__/`) fails if the three files drift apart or the policy stops
matching what the client code uses.

Verify at securityheaders.com after the first deploy on the new domain.

---

## 7. Monitoring & Alerts

The repository's own uptime workflow (`.github/workflows/uptime.yml`) probes
the API and the web app from GitHub on a schedule and opens an issue when either
stops answering; it needs the `PRODUCTION_API_URL` and `PRODUCTION_SITE_URL`
repository variables, which change with the domain.

### SSL Certificate Expiry Monitoring

Cloudflare, Netlify and the API host renew their own certificates. The ACM
certificate for the CDN renews itself while the DNS validation record it asked
for stays in place, so keep that CNAME. One alarm is still worth having:

```yaml
# AWS CloudWatch alarm on the ACM certificate
alarm:
  name: ssl-certificate-expiry
  metric: DaysToExpiry
  threshold: 30
  actions:
    - <SNS topic that reaches a phone>
```

### External health check

```yaml
# Route 53 health check, or Better Stack / UptimeRobot at a one-minute interval
health_check:
  type: HTTPS
  fqdn: api.<your-domain>
  port: 443
  path: /readyz
  interval: 30
  failure_threshold: 3
```

---

## 8. Deployment Checklist

### Pre-Launch

- [ ] DNS records propagated (check with `dig` and `nslookup`)
- [ ] SSL certificates issued and valid on `<your-domain>`, `api.` and `cdn.`
- [ ] Security headers verified (securityheaders.com)
- [ ] SSL Labs grade A achieved (ssllabs.com/ssltest)
- [ ] CDN distribution deployed; `MEDIA_EXPOSURE` ok on `/health/launch-readiness?probe=media`
- [ ] Cloudflare proxy enabled on web and API names; SendGrid CNAMEs left DNS only
- [ ] SendGrid domain authenticated (three CNAMEs verified) and DMARC published at `p=none`
- [ ] A real verification email received and passing SPF, DKIM and DMARC in its headers
- [ ] `CLIENT_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `API_URL`, `CDN_URL` on the API and `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MEDIA_HOST` on Netlify changed to the new names, and both redeployed
- [ ] HSTS preload submitted (hstspreload.org) only once every subdomain serves HTTPS

### Post-Launch

- [ ] Monitor certificate renewal
- [ ] Read the first DMARC aggregate reports; tighten to `p=quarantine` when clean
- [ ] Review Cloudflare analytics
- [ ] Test failover scenarios
- [ ] Document any issues

---

## 9. Emergency Procedures

### SSL Certificate Emergency Renewal

```bash
# Managed hosts (Cloudflare, Netlify, Render, Fly) renew on their own; check
# Cloudflare Dashboard > SSL/TLS > Edge Certificates, and the host's domain page.
# If a self-managed origin with Let's Encrypt is ever run:
certbot renew --force-renewal
```

### DNS Failover

```bash
# Point to a backup origin if the primary fails
# Update Cloudflare DNS via API
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records/<RECORD_ID>" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"content":"<BACKUP_TARGET>"}'
```

---

## References

- [Cloudflare SSL/TLS Documentation](https://developers.cloudflare.com/ssl/)
- [SendGrid: How to set up domain authentication](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/how-to-set-up-domain-authentication)
- [DMARC.org overview](https://dmarc.org/overview/)
- [AWS Certificate Manager](https://docs.aws.amazon.com/acm/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [HSTS Preload Submission](https://hstspreload.org/)
