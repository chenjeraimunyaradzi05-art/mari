export async function sendAlert(message: string, context?: Record<string, unknown>) {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) {
    console.error('[ALERT]', message, context);
    return;
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, context }),
    });
  } catch (err) {
    console.error('Failed to send alert', err);
  }
}
