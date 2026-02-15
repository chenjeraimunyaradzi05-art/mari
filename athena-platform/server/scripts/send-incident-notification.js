#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Incident notification helper.
 *
 * Usage:
 *   node scripts/send-incident-notification.js --message "API latency above threshold"
 *
 * Env:
 *   INCIDENT_WEBHOOK_URL   Optional webhook endpoint (Slack/Teams/custom)
 *   INCIDENT_NOTIFY_EMAILS Optional comma-separated recipient emails
 *   SENDGRID_API_KEY       Optional, used when INCIDENT_NOTIFY_EMAILS is set
 *   SENDGRID_FROM_EMAIL    Optional sender (defaults to noreply@athena.com)
 */

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

  const from = process.env.SENDGRID_FROM_EMAIL || 'noreply@athena.com';

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
  const severity = getArg('severity', process.env.INCIDENT_SEVERITY || 'high');
  const message =
    getArg('message', process.env.INCIDENT_MESSAGE || 'Launch incident detected. Investigate immediately.') ||
    'Launch incident detected. Investigate immediately.';
  const service = getArg('service', process.env.INCIDENT_SERVICE || 'athena-platform');

  const timestamp = new Date().toISOString();
  const subject = `[ATHENA INCIDENT][${severity.toUpperCase()}] ${service}`;
  const body = `${subject}\n\nTime: ${timestamp}\nService: ${service}\nSeverity: ${severity}\n\nMessage:\n${message}`;

  const webhookUrl = process.env.INCIDENT_WEBHOOK_URL;
  const recipients = (process.env.INCIDENT_NOTIFY_EMAILS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!webhookUrl && recipients.length === 0) {
    console.log('No INCIDENT_WEBHOOK_URL or INCIDENT_NOTIFY_EMAILS configured. Nothing to send.');
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
