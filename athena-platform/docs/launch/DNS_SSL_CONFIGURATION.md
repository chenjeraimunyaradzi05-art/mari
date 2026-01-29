# DNS & SSL Configuration Guide

**Phase 5: Mobile Parity & Production - Step 99**  
**Last Updated:** January 29, 2026

## Overview

This document outlines the DNS and SSL/TLS configuration for the ATHENA platform production deployment.

---

## 1. Domain Architecture

### Primary Domains

| Domain | Purpose | Provider |
|--------|---------|----------|
| `athena.app` | Main web application | Cloudflare |
| `api.athena.app` | API server | Cloudflare |
| `cdn.athena.app` | Static assets & media | CloudFront |
| `ws.athena.app` | WebSocket connections | Cloudflare |
| `mail.athena.app` | Email (MX) | SendGrid |

### Subdomains

| Subdomain | Purpose |
|-----------|---------|
| `staging.athena.app` | Staging environment |
| `preview.athena.app` | PR preview deployments |
| `docs.athena.app` | Developer documentation |
| `status.athena.app` | Status page |

---

## 2. DNS Configuration

### A/AAAA Records (Proxied through Cloudflare)

```dns
# Main application (Vercel)
athena.app.            A       76.76.21.21
athena.app.            AAAA    2606:4700:3033::6815:1515

# API server
api.athena.app.        A       <LOAD_BALANCER_IP>
api.athena.app.        AAAA    <LOAD_BALANCER_IPV6>

# WebSocket server
ws.athena.app.         A       <LOAD_BALANCER_IP>
```

### CNAME Records

```dns
# Vercel deployment
www.athena.app.        CNAME   cname.vercel-dns.com.
staging.athena.app.    CNAME   cname.vercel-dns.com.

# CDN (CloudFront)
cdn.athena.app.        CNAME   d123456789.cloudfront.net.

# Documentation (GitHub Pages or Vercel)
docs.athena.app.       CNAME   athena-docs.vercel.app.

# Status page (e.g., Statuspage.io)
status.athena.app.     CNAME   athena.statuspage.io.
```

### MX Records (Email)

```dns
athena.app.            MX      10 mx.sendgrid.net.
athena.app.            MX      20 mx2.sendgrid.net.
```

### TXT Records

```dns
# SPF (Email authentication)
athena.app.            TXT     "v=spf1 include:sendgrid.net include:_spf.google.com ~all"

# DKIM (Email signing)
s1._domainkey.athena.app.  TXT     "k=rsa; p=<DKIM_PUBLIC_KEY>"

# DMARC (Email policy)
_dmarc.athena.app.     TXT     "v=DMARC1; p=quarantine; rua=mailto:dmarc@athena.app; pct=100"

# Domain verification
athena.app.            TXT     "google-site-verification=<TOKEN>"
athena.app.            TXT     "stripe-verification=<TOKEN>"
```

### CAA Records (Certificate Authority Authorization)

```dns
athena.app.            CAA     0 issue "letsencrypt.org"
athena.app.            CAA     0 issue "digicert.com"
athena.app.            CAA     0 issuewild "letsencrypt.org"
athena.app.            CAA     0 iodef "mailto:security@athena.app"
```

---

## 3. SSL/TLS Configuration

### Certificate Strategy

| Domain Pattern | Certificate Type | Provider | Auto-Renewal |
|----------------|------------------|----------|--------------|
| `*.athena.app` | Wildcard | Cloudflare | ✅ Yes |
| `athena.app` | Root | Cloudflare | ✅ Yes |
| `cdn.athena.app` | ACM | AWS ACM | ✅ Yes |

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

### HSTS Configuration

```nginx
# Strict-Transport-Security header
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### TLS Cipher Suites (Modern Configuration)

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
- url: "http://*athena.app/*"
  actions:
    - always_use_https: on

# API caching bypass
- url: "api.athena.app/*"
  actions:
    - cache_level: bypass
    - disable_apps: on

# Static assets caching
- url: "cdn.athena.app/*"
  actions:
    - cache_level: cache_everything
    - edge_cache_ttl: 2678400  # 31 days
    - browser_cache_ttl: 86400  # 1 day
```

### Firewall Rules

```yaml
# Block bad bots
- expression: "(cf.client.bot)"
  action: challenge

# Rate limit API
- expression: "(http.request.uri.path contains \"/api/\")"
  action: rate_limit
  threshold: 100
  period: 60

# Allow Stripe webhooks
- expression: "(http.request.uri.path eq \"/api/webhooks/stripe\" and ip.src in {webhook.stripe.com})"
  action: allow

# Geographic restrictions (if needed)
- expression: "(ip.geoip.country in {\"RU\" \"CN\" \"KP\"})"
  action: block
```

### Workers (Edge Functions)

```javascript
// Geolocation-based routing
addEventListener('fetch', event => {
  const country = event.request.cf.country;
  
  // Route AU users to Sydney origin
  if (country === 'AU') {
    event.respondWith(fetch(event.request, {
      cf: { resolveOverride: 'au.api.athena.app' }
    }));
  }
});
```

---

## 5. AWS CloudFront Configuration

### Distribution Settings

```yaml
distribution:
  aliases:
    - cdn.athena.app
  
  origins:
    - id: s3-media
      domain_name: athena-media-prod.s3.ap-southeast-2.amazonaws.com
      s3_origin_config:
        origin_access_identity: E1234567890ABC
  
  default_cache_behavior:
    viewer_protocol_policy: redirect-to-https
    allowed_methods: [GET, HEAD, OPTIONS]
    cached_methods: [GET, HEAD]
    compress: true
    ttl:
      min: 0
      default: 86400
      max: 31536000
  
  price_class: PriceClass_All
  
  viewer_certificate:
    acm_certificate_arn: arn:aws:acm:us-east-1:123456789:certificate/abc123
    minimum_protocol_version: TLSv1.2_2021
    ssl_support_method: sni-only
```

### Signed URLs/Cookies

```javascript
// CloudFront signed URL generation
const signer = new AWS.CloudFront.Signer(keyPairId, privateKey);

const signedUrl = signer.getSignedUrl({
  url: `https://cdn.athena.app/${key}`,
  expires: Math.floor(Date.now() / 1000) + 3600, // 1 hour
});
```

---

## 6. Security Headers

### Next.js Security Headers (`next.config.js`)

```javascript
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  },
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' data: blob: https://cdn.athena.app https://*.cloudfront.net;
      font-src 'self' https://fonts.gstatic.com;
      connect-src 'self' https://api.athena.app wss://ws.athena.app https://api.stripe.com;
      frame-src https://js.stripe.com https://hooks.stripe.com;
      media-src 'self' https://cdn.athena.app blob:;
    `.replace(/\n/g, '')
  }
];
```

---

## 7. Monitoring & Alerts

### SSL Certificate Expiry Monitoring

```yaml
# AWS CloudWatch alarm
alarm:
  name: ssl-certificate-expiry
  metric: DaysToExpiry
  threshold: 30
  actions:
    - arn:aws:sns:ap-southeast-2:123456789:alerts
```

### DNS Health Checks

```yaml
# Route 53 health check
health_check:
  type: HTTPS
  fqdn: athena.app
  port: 443
  path: /api/health/live
  interval: 30
  failure_threshold: 3
```

---

## 8. Deployment Checklist

### Pre-Launch

- [ ] DNS records propagated (check with `dig` and `nslookup`)
- [ ] SSL certificates issued and valid
- [ ] HSTS preload submitted (hstspreload.org)
- [ ] Security headers verified (securityheaders.com)
- [ ] SSL Labs grade A+ achieved (ssllabs.com/ssltest)
- [ ] CDN distribution deployed
- [ ] Cloudflare proxy enabled
- [ ] Email deliverability tested (SPF, DKIM, DMARC)

### Post-Launch

- [ ] Monitor certificate renewal
- [ ] Track DNS query latency
- [ ] Review Cloudflare analytics
- [ ] Test failover scenarios
- [ ] Document any issues

---

## 9. Emergency Procedures

### SSL Certificate Emergency Renewal

```bash
# If using Let's Encrypt directly
certbot renew --force-renewal

# If using Cloudflare, certificates auto-renew
# Check status in Cloudflare Dashboard > SSL/TLS > Edge Certificates
```

### DNS Failover

```bash
# Point to backup origin if primary fails
# Update Cloudflare DNS via API
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records/<RECORD_ID>" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"content":"<BACKUP_IP>"}'
```

---

## References

- [Cloudflare SSL/TLS Documentation](https://developers.cloudflare.com/ssl/)
- [AWS Certificate Manager](https://docs.aws.amazon.com/acm/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [HSTS Preload Submission](https://hstspreload.org/)
