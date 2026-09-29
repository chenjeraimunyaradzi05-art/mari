import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * services/ai-safety.service.ts, the screen in front of the AI chat.
 *
 * The chat route has a suite of its own (src/routes/__tests__/ai.chat.safety),
 * which proves the plumbing: a flagged message never reaches the model, costs
 * no quota and raises a staff flag. What it cannot do in a handful of cases is
 * hold the phrase screen itself in place, and the screen is where the two
 * expensive mistakes live:
 *
 *   - a miss, where a woman writes that he is hurting her and gets a career
 *     answer from a general-purpose model;
 *   - a false alarm on a topic rather than a person, where a woman asking about
 *     a job at a refuge or a course on family violence is answered with crisis
 *     lines every time she asks.
 *
 * The patterns are anchored on the member herself ("me", "us", "my kids") for
 * the second reason, and the cases below are chosen to break that anchoring if
 * it slips. The replies are held too: 000 first when she is in danger, the
 * lines copied from the wellness library rather than retyped, and a way back
 * if the screen misread her.
 */

jest.mock('../src/utils/prisma', () => ({
  prisma: { adminFlag: { create: jest.fn(async () => ({})) } },
}));

const moderation = { configured: true, verdict: { action: 'allow', categories: [] as string[], reason: '' } };
jest.mock('../src/services/moderation.service', () => ({
  isTextModerationConfigured: () => moderation.configured,
  moderateText: jest.fn(async () => moderation.verdict),
}));

const failures: string[] = [];
jest.mock('../src/utils/ops-metrics', () => ({
  recordFailure: (operation: string) => {
    failures.push(operation);
  },
}));

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  detectChatCrisis,
  crisisReply,
  raiseChatCrisisFlag,
  screenMemberMessage,
  screenAssistantReply,
  AI_CHAT_DISCLAIMER,
} from '../src/services/ai-safety.service';
import { CRISIS_LINES } from '../src/services/wellness/wellness-library';
import { prisma as prismaTyped } from '../src/utils/prisma';

/** A mocked async function whose resolved values the tests set. */
type AsyncMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

const prisma = prismaTyped as unknown as { adminFlag: { create: AsyncMock } };

beforeEach(() => {
  failures.length = 0;
  moderation.configured = true;
  moderation.verdict = { action: 'allow', categories: [], reason: '' };
  jest.clearAllMocks();
});

describe('detectChatCrisis: a person in danger', () => {
  const inDanger = [
    'He is going to kill me if I leave',
    'my partner threatened to hurt my kids last night',
    'he keeps hitting me when he drinks',
    'He punched me and I think my wrist is broken',
    'My husband has been following me to work',
    "I'm not safe at home",
    'we are in danger, what do I do',
    'I am scared for my life',
    "I'm terrified he will find us",
    'I need to get out tonight, where can I go',
    'I need a refuge for me and the kids',
    'my ex is stalking me',
  ];

  for (const text of inDanger) {
    it(`flags "${text}" as immediate danger`, () => {
      const check = detectChatCrisis(text);
      expect(check).toEqual(expect.objectContaining({ flagged: true, kind: 'immediate_danger', source: 'phrase' }));
      expect(check.matches.length).toBeGreaterThan(0);
    });
  }
});

describe('detectChatCrisis: suicide and self-harm', () => {
  const selfHarm = [
    'I want to die',
    "I don't want to be here any more",
    'I have been thinking about suicide',
    "I can't go on like this",
    'I keep cutting myself',
    'everyone would be better off without me',
  ];

  for (const text of selfHarm) {
    it(`flags "${text}" as self-harm`, () => {
      expect(detectChatCrisis(text)).toEqual(expect.objectContaining({ flagged: true, kind: 'self_harm', source: 'phrase' }));
    });
  }

  it('leads with self-harm when both are present, and keeps every match', () => {
    const check = detectChatCrisis('He is hitting me and I want to die');
    expect(check.kind).toBe('self_harm');
    expect(check.matches).toEqual(expect.arrayContaining(['want to die', 'hitting me']));
  });
});

describe('detectChatCrisis: the topic is not the person', () => {
  const ordinary = [
    'How do I apply for a case manager job at a domestic violence refuge?',
    'Can you help me write a cover letter for a family violence support worker role?',
    'I am studying a Certificate IV in Community Services with a unit on domestic violence',
    'What does a safety plan template for clients usually include?',
    'My manager keeps following up on my timesheets',
    'Is it safe to negotiate salary in my first week?',
    'The deadline is killing me, how do I prioritise?',
    'How do I end my lease early in Queensland?',
  ];

  for (const text of ordinary) {
    it(`answers "${text}" normally`, () => {
      expect(detectChatCrisis(text)).toEqual({ flagged: false, kind: null, source: null, matches: [] });
    });
  }
});

describe('crisisReply', () => {
  const phone = (key: string) => CRISIS_LINES.find((line) => line.key === key)?.phone as string;

  it('puts 000 first for immediate danger, then 1800RESPECT, and says a person is needed', () => {
    const { text, lines } = crisisReply('immediate_danger');

    expect(lines.map((line) => line.key)).toEqual(['emergency', '1800respect', 'lifeline']);
    expect(text).toMatch(/I am an AI assistant/);
    expect(text.indexOf(phone('emergency'))).toBeLessThan(text.indexOf(phone('1800respect')));
    // A way back if the screen misread her.
    expect(text).toMatch(/misread your message/);
  });

  it('puts Lifeline first for self-harm and still carries 1800RESPECT', () => {
    const { text, lines } = crisisReply('self_harm');

    expect(lines.map((line) => line.key)).toEqual(['lifeline', 'emergency', '1800respect']);
    expect(text).toContain(phone('lifeline'));
    expect(text).toContain(phone('1800respect'));
    expect(text).toMatch(/call 000/);
  });

  it('takes its numbers from the wellness library, the one place they are kept', () => {
    for (const kind of ['immediate_danger', 'self_harm'] as const) {
      const { text, lines } = crisisReply(kind);
      for (const line of lines) {
        expect(CRISIS_LINES).toContainEqual(line);
        expect(text).toContain(line.phone);
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps the emergency numbers in the disclaimer that goes with every reply', () => {
    for (const key of ['emergency', 'lifeline', '1800respect']) {
      expect(AI_CHAT_DISCLAIMER).toContain(phone(key));
    }
  });
});

describe('raiseChatCrisisFlag', () => {
  it('flags the account for staff with the phrases that matched, never her message', async () => {
    const message = 'He is hitting me and I do not know who else to tell';
    const check = detectChatCrisis(message);
    if (!check.flagged || !check.kind) throw new Error('expected the screen to flag this message');

    await raiseChatCrisisFlag('ada', { ...check, flagged: true, kind: check.kind });

    const { data } = prisma.adminFlag.create.mock.calls[0][0] as { data: Record<string, string> };
    expect(data).toEqual(
      expect.objectContaining({ userId: 'ada', type: 'SAFETY_CONCERN', severity: 'HIGH', flaggedById: 'system' })
    );
    expect(data.notes).toContain('hitting me');
    expect(JSON.stringify(data)).not.toContain('who else to tell');
  });

  it('does not throw when the flag cannot be written: the reply must still reach her', async () => {
    prisma.adminFlag.create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      raiseChatCrisisFlag('ada', { flagged: true, kind: 'self_harm', source: 'phrase', matches: ['want to die'] })
    ).resolves.toBeUndefined();
  });
});

describe('The provider screens, over her message and over the model reply', () => {
  it('routes a provider self-harm verdict on her message to the crisis reply, not a refusal', async () => {
    moderation.verdict = { action: 'block', categories: ['self-harm/intent'], reason: 'self-harm' };

    expect(await screenMemberMessage('something the phrase list did not catch')).toEqual({
      decision: 'crisis',
      check: { flagged: true, kind: 'self_harm', source: 'provider', matches: ['self-harm/intent'] },
    });
  });

  it('refuses her message only for harm aimed at someone else', async () => {
    moderation.verdict = { action: 'block', categories: ['violence'], reason: 'Threat of violence' };
    expect(await screenMemberMessage('a threat')).toEqual({ decision: 'block', reason: 'Threat of violence' });
  });

  it('lets her message through, and counts it, when no provider is configured', async () => {
    moderation.configured = false;

    expect(await screenMemberMessage('hello')).toEqual({ decision: 'allow' });
    expect(failures).toEqual(['moderation.unscreened_publish']);
  });

  it('turns a model reply carrying self-harm content into the crisis reply, and counts it', async () => {
    moderation.verdict = { action: 'review', categories: ['self-harm'], reason: 'self-harm' };

    const screening = await screenAssistantReply('a reply');

    expect(screening).toEqual(expect.objectContaining({ decision: 'crisis' }));
    expect(failures).toEqual(['ai.chat.reply_self_harm']);
  });

  it('withholds a blocked model reply and counts it as an incident', async () => {
    moderation.verdict = { action: 'block', categories: ['hate'], reason: 'Hateful content' };

    expect(await screenAssistantReply('a reply')).toEqual({ decision: 'block', reason: 'Hateful content' });
    expect(failures).toEqual(['ai.chat.reply_blocked']);
  });

  it('does not send an empty reply to the provider', async () => {
    expect(await screenAssistantReply('   ')).toEqual({ decision: 'allow' });
  });
});
