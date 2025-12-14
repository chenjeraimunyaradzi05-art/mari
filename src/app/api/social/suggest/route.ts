import { NextRequest, NextResponse } from 'next/server';

const FALLBACK = [
  'Thanks for the intro—excited to learn more about the role and team.',
  'Can we add a timebox for QA so I can plan deliverables?',
  'Here is my availability this week for a quick sync.',
];

function normalizeContent(content: string | null | undefined): string[] {
  if (!content) return FALLBACK;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === 'string' && s.trim()).slice(0, 5) as string[];
    }
  } catch {
    // ignore json parse failure
  }
  return content
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const body = await request.json().catch(() => ({}));
  const prompt: string = body?.prompt || 'Provide brief, encouraging replies for a professional conversation.';

  if (!apiKey) {
    return NextResponse.json({ data: FALLBACK, note: 'OPENAI_API_KEY missing; using fallback suggestions.' });
  }

  try {
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: 'You are a concise career and wellness copilot. Return 3-5 short, supportive DM replies as a JSON array of strings. Avoid emojis unless present in the prompt.',
          },
          {
            role: 'user',
            content: `Conversation context: ${prompt}`,
          },
        ],
      }),
    });

    if (!completion.ok) {
      return NextResponse.json({ data: FALLBACK, note: 'Upstream model call failed; using fallback.' }, { status: 200 });
    }

    const json = await completion.json();
    const content = json?.choices?.[0]?.message?.content as string | null | undefined;
    const suggestions = normalizeContent(content);
    if (!suggestions.length) return NextResponse.json({ data: FALLBACK });
    return NextResponse.json({ data: suggestions });
  } catch {
    return NextResponse.json({ data: FALLBACK, note: 'Model call error; using fallback.' }, { status: 200 });
  }
}
