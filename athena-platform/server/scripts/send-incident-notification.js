#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Incident notification helper: an alert to the people who run the platform.
 *
 * It is operator-side only. It posts to a webhook and/or emails the addresses
 * in INCIDENT_NOTIFY_EMAILS, and it never contacts a member. Telling members
 * about a breach is a different job with different rules, done from the breach
 * register (POST /api/admin/breaches/:id/notify-users, the admin Data breach
 * page), which tells members who use Safe Mode in the app and not by email.
 *
 * Usage:
 *   node scripts/send-incident-notification.js --message "API latency above threshold"
 *   node scripts/send-incident-notification.js --safety-critical --message "What is known"
 *
 * --safety-critical is for an incident that may have exposed Safe Mode, safe
 * chat or safety-report data. It makes the alert critical, tags it so nobody
 * reads it as routine, appends the rules for telling members (see
 * docs/security/incident-response.md, "Safety-critical addendum"), and prints
 * the same text here. It changes what the alert says, not who gets it.
 *
 * Env:
 *   INCIDENT_WEBHOOK_URL   Optional webhook endpoint (Slack/Teams/custom)
 *   INCIDENT_NOTIFY_EMAILS Optional comma-separated recipient emails
 *   SENDGRID_API_KEY       Optional, used when INCIDENT_NOTIFY_EMAILS is set
 *   SENDGRID_FROM_EMAIL    Required with INCIDENT_NOTIFY_EMAILS: an address on a domain
 *                          authenticated with SendGrid. There is no default; the one
 *                          that used to be here (noreply@athena.com) is a domain
 *                          ATHENA does not own, so SendGrid would refuse it.
 */

/** What a safety-critical alert tells whoever reads it. Mirrors docs/security/incident-response.md. */
const SAFETY_CRITICAL_ADDENDUM = [
  'SAFETY-CRITICAL: Safe Mode, safe chat or safety-report data may be exposed. Treat as SEV-1; everything else stops.',
  '- Do not tell members by email alone. Someone they are protecting themselves from may share their device or inbox.',
  '- Get privacy counsel before any member is told anything. Counsel approves the wording, and whether any email goes at all.',
  '- Tell members from the breach register (admin, Data breach, Tell the people affected). Members who use Safe Mode or have reported someone are told in the app only, in neutral words, unless counsel has signed off on an email and given the subject.',
  '- Use docs/security/templates/safety-breach-notice.md for the wording. Say nothing about Safe Mode, safety reports or violence in anything a member can see on a lock screen or in an inbox.',
  '- This message went to the operators only. It has not told any member.',
].join('\n');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function getArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ''}`);
  }
}

async function sendWebhookNotification(webhookUrl, payload) {
  await postJson(webhookUrl, payload);
}

async function sendSendGridNotification({ recipients, subject, body }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is not set');
  }

  const from = (process.env.SENDGRID_FROM_EMAIL || '').trim();
  if (!from) {
    throw new Error('SENDGRID_FROM_EMAIL is not set');
  }

  await postJson('https://api.sendgrid.com/v3/mail/send', {
    personalizations: [
      {
        to: recipients.map((email) => ({ email })),
        subject,
      },
    ],
    from: { email: from },
    content: [
      {
        type: 'text/plain',
        value: body,
      },
    ],
  }, {
    Authorization: `Bearer ${apiKey}`,
  });
}

async function main() {
  const safetyCritical = hasFlag('safety-critical');
  // A safety-critical incident is SEV-1 whatever the caller thought of it.
  const severity = safetyCritical ? 'critical' : getArg('severity', process.env.INCIDENT_SEVERITY || 'high');
  const message =
    getArg('message', process.env.INCIDENT_MESSAGE || 'Launch incident detected. Investigate immediately.') ||
    'Launch incident detected. Investigate immediately.';
  const service = getArg('service', process.env.INCIDENT_SERVICE || 'athena-platform');

  const timestamp = new Date().toISOString();
  const subject = `[ATHENA INCIDENT][${severity.toUpperCase()}]${safetyCritical ? '[SAFETY-CRITICAL]' : ''} ${service}`;
  const body =
    `${subject}\n\nTime: ${timestamp}\nService: ${service}\nSeverity: ${severity}\n\nMessage:\n${message}` +
    (safetyCritical ? `\n\n${SAFETY_CRITICAL_ADDENDUM}` : '');
  if (safetyCritical) {
    console.log(SAFETY_CRITICAL_ADDENDUM);
  }

  const webhookUrl = process.env.INCIDENT_WEBHOOK_URL;
  const recipients = (process.env.INCIDENT_NOTIFY_EMAILS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  // An incident notifier with no channel configured used to print one line and
  // exit 0, which reads to every caller — a workflow step, a shell `&&`, a
  // human watching a log — as "the notification was sent". It was not: nobody
  // was told, and the exit code said the opposite. On a platform whose whole
  // alerting story is this script, the run where it reaches nobody is the run
  // that matters most, so it fails, the way the panic button reports
  // NOBODY_REACHED rather than success.
  if (!webhookUrl && recipients.length === 0) {
    console.error(
      'NOBODY WAS NOTIFIED: neither INCIDENT_WEBHOOK_URL nor INCIDENT_NOTIFY_EMAILS is set, ' +
        'so this incident reached no one. Configure one of them on whatever runs this.'
    );
    console.error(`Unsent notification: ${subject}`);
    process.exitCode = 1;
    return;
  }

  let hasFailure = false;

  if (webhookUrl) {
    try {
      await sendWebhookNotification(webhookUrl, {
        text: body,
        severity,
        service,
        timestamp,
      });
      console.log('✅ Incident webhook notification sent');
    } catch (error) {
      hasFailure = true;
      console.error('❌ Failed to send webhook notification:', error instanceof Error ? error.message : error);
    }
  }

  if (recipients.length > 0) {
    try {
      await sendSendGridNotification({
        recipients,
        subject,
        body,
      });
      console.log(`✅ Incident email notification sent to ${recipients.length} recipient(s)`);
    } catch (error) {
      hasFailure = true;
      console.error('❌ Failed to send incident email notification:', error instanceof Error ? error.message : error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
    return;
  }

  console.log('Incident notification flow completed successfully.');
}

main().catch((error) => {
  console.error('Incident notification script failed:', error);
  process.exitCode = 1;
});
