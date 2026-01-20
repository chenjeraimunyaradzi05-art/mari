# DNS & SSL Checklist

## DNS
- [ ] Configure root and www records to hosting provider.
- [ ] Verify TXT records for domain ownership.
- [ ] Ensure API subdomain points to backend.

## SSL
- [ ] Provision wildcard certs for web + API.
- [ ] Configure auto-renewal.
- [ ] Validate HTTPS redirects.

## Validation
- [ ] Verify all environments (staging/production).
- [ ] Confirm HSTS policy.
