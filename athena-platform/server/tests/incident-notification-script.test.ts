/**
 * The operator alert and what it says about a safety-critical incident.
 *
 * scripts/send-incident-notification.js alerts the people who run the platform
 * and never contacts a member. When Safe Mode or safety-report data may be
 * exposed, the alert has to say so in a way nobody can read as routine, and has
 * to carry the rules for telling members: counsel first, never email alone.
 * The script is run for real, against a local server standing in for the
 * webhook, and the payload it sends is what is checked.
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const script = path.resolve(__dirname, '..', 'scripts', 'send-incident-notification.js');

let server: http.Server;
let url: string;
const received: Array<Record<string, unknown>> = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      received.push(JSON.parse(raw));
      res.writeHead(200).end('ok');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/hook`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function run(args: string[], env: Record<string, string | undefined> = { INCIDENT_WEBHOOK_URL: url }) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env } as NodeJS.ProcessEnv,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('send-incident-notification --safety-critical', () => {
  it('makes the alert critical, tags it, and carries the rules for telling members', async () => {
    received.length = 0;

    const { code, stdout } = await run(['--safety-critical', '--severity', 'low', '--message', 'A backup of safe chats was readable.']);

    expect(code).toBe(0);
    expect(received).toHaveLength(1);
    const alert = received[0] as { text: string; severity: string };
    // Whatever the caller thought of it, it is SEV-1.
    expect(alert.severity).toBe('critical');
    expect(alert.text).toContain('[ATHENA INCIDENT][CRITICAL][SAFETY-CRITICAL] athena-platform');
    expect(alert.text).toContain('A backup of safe chats was readable.');
    expect(alert.text).toMatch(/Treat as SEV-1/);
    expect(alert.text).toMatch(/Do not tell members by email alone/);
    expect(alert.text).toMatch(/Get privacy counsel before any member is told anything/);
    expect(alert.text).toContain('docs/security/templates/safety-breach-notice.md');
    // It says plainly that it told no member.
    expect(alert.text).toMatch(/operators only\. It has not told any member/);
    // The same rules are printed for the person running it.
    expect(stdout).toContain('SAFETY-CRITICAL:');
  });

  it('leaves an ordinary alert as it was: no tag, no addendum, the severity it was given', async () => {
    received.length = 0;

    const { code, stdout } = await run(['--severity', 'high', '--message', 'API latency above threshold']);

    expect(code).toBe(0);
    const alert = received[0] as { text: string; severity: string };
    expect(alert.severity).toBe('high');
    expect(alert.text).toContain('[ATHENA INCIDENT][HIGH] athena-platform');
    expect(alert.text).not.toContain('SAFETY-CRITICAL');
    expect(stdout).not.toContain('SAFETY-CRITICAL');
  });

  it('still fails, rather than report success, when nobody is configured to be told', async () => {
    const { code, stderr } = await run(['--safety-critical', '--message', 'x'], {});

    expect(code).toBe(1);
    expect(stderr).toMatch(/NOBODY WAS NOTIFIED/);
  });
});

describe('what the script says it is', () => {
  const source = fs.readFileSync(script, 'utf8');

  it('says in its header that it is operator-side only and points at the breach register for members', () => {
    const header = source.slice(0, source.indexOf('function '));
    expect(header).toMatch(/operator-side only/);
    expect(header).toMatch(/never contacts a member/);
    expect(header).toContain('/api/admin/breaches/:id/notify-users');
  });

  it('keeps its addendum in step with the runbook it mirrors', () => {
    const runbook = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'docs', 'security', 'incident-response.md'), 'utf8');
    const addendum = runbook.slice(runbook.indexOf('## Safety-critical addendum'), runbook.indexOf('## Preparedness checklist'));

    expect(addendum).toContain('--safety-critical');
    expect(addendum).toContain('safety-breach-notice.md');
    expect(addendum).toContain('notify-users');
    expect(addendum).toContain('counselConsulted');
    expect(addendum).toContain('neutralSubject');
    expect(addendum).toContain('safetyNotificationContent');
  });
});
