# Incident Response Runbook

## Severity Levels

### P0 - Critical (Platform Down)

- **Response Time**: Immediate (< 5 min)
- **Examples**: Complete outage, data breach, payment system failure
- **Actions**:
  1. Page on-call engineer immediately
  2. Create #incident-p0 Slack channel
  3. Notify leadership within 15 minutes
  4. Update status page every 15 minutes

### P1 - High (Major Feature Broken)

- **Response Time**: < 30 min
- **Examples**: Dashboard crashes, job applications failing, login issues
- **Actions**:
  1. Alert on-call engineer
  2. Create #incident-p1 Slack channel
  3. Update status page within 1 hour

### P2 - Medium (Minor Feature Degraded)

- **Response Time**: < 2 hours
- **Examples**: Slow loading, search partially broken, images not loading

### P3 - Low (Cosmetic Issues)

- **Response Time**: < 24 hours
- **Examples**: UI glitches, typos, minor formatting issues

## Common Incidents & Resolutions

### Database Connection Failures

**Symptoms**: 500 errors, "Connection refused" in logs

**Diagnosis**:

```bash
# Check database status
mysql -u athena_user -p -h db.athena.com -e "SELECT 1"

# Check connection pool
php artisan horizon:status

# Check slow queries
mysql -u athena_user -p -e "SHOW FULL PROCESSLIST"
```

**Resolution**:

1. Restart database connection pool: `php artisan db:reconnect`
2. If persistent, restart database service
3. Check for long-running queries and kill if necessary
4. Scale up database if resource exhaustion

### Redis Cache/Queue Failures

**Symptoms**: "Connection timed out", jobs not processing

**Diagnosis**:

```bash
# Check Redis status
redis-cli -h cache.athena.com ping

# Check memory usage
redis-cli info memory

# Check queue depth
php artisan horizon:list
```

**Resolution**:

1. Restart Redis: `systemctl restart redis`
2. Clear specific queue: `php artisan queue:flush`
3. Restart Horizon: `php artisan horizon:terminate`
4. Scale up Redis if memory full

### S3 Upload Failures

**Symptoms**: "Unable to upload file", media not saving

**Diagnosis**:

```bash
# Check S3 credentials
aws s3 ls s3://athena-media-bucket

# Check upload queue
php artisan queue:failed
```

**Resolution**:

1. Verify AWS credentials in `.env`
2. Retry failed jobs: `php artisan queue:retry all`
3. Check S3 bucket policy and CORS settings
4. Monitor S3 request rates

## Post-Incident Review (PIR)

Within 48 hours of P0/P1 incidents, conduct PIR:

1. **Timeline**: Detailed incident timeline
2. **Root Cause**: Technical and process failures
3. **Impact**: Users affected, revenue loss, reputation damage
4. **Resolution**: How issue was resolved
5. **Action Items**: Preventive measures with owners and deadlines

Template: [docs/templates/pir-template.md](./templates/pir-template.md)
