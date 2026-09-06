# ATHENA AI System Card
_Version 1.0 — 2026-08-18. Covers every AI-powered surface across the active code lines._

## AI features in the product

| Feature | Surface | Data it touches | Provider |
|---|---|---|---|
| Career coach / interview coach | athena-frontend `/ai/*`, coach API routes; server `ai.routes.ts` | career history, free-text conversation | OpenAI SDK present (`openai` in app-backend deps) **[FOUNDER: confirm provider/model list]** |
| Concierge assistant | money/concierge routes, `concierge.service.ts` | financial goals, free text | same |
| Resume/CV tools | resume-parser, cv-builder routes | full resume content (PII-dense) | same |
| Matching & ranking | `ml/` FastAPI (career_compass, light/heavy ranker, mentor_match, safety_score, income_stream) | profile features, behaviour | in-house models (artifacts not yet shipped; placeholders blocked in production) |
| Moderation assistance | `moderation.service.ts`, contentSafety utils | user content | in-house heuristics + provider |

## Commitments (safe to state publicly once verified)

- AI features are assistive; **no fully-automated adverse decisions** (account bans, verification rejections) without a human path — appeals exist.
- User content is **not used to train third-party models** — requires the provider agreement to say so **[FOUNDER: verify DPA/opt-out]**.
- Safety-score and matching models are blocked from serving placeholder output in production (`model_loader.py` guardrails).

## Known risks and required controls

| Risk | Control | Status |
|---|---|---|
| **Prompt injection** (content in a resume/job post/message instructs the model) | Treat all user/document text as data: delimit it, instruct the model to ignore embedded instructions, strip/flag suspicious patterns before prompting | **Missing — implement in the shared AI service layer, not per-route** |
| **Cross-user leakage** | Per-user retrieval namespaces; never batch multiple users' private data in one context | Partially structural — audit each route (`coach/context/[personaCode]`) |
| **PII over-sharing to provider** | Redact emails/phones/addresses from prompts where the feature doesn't need them; minimum-necessary context | Missing |
| **Hallucinated advice** (career/financial) | UI disclaimers ("AI-generated, verify before acting"), no fabricated statistics, cite sources where possible | Partial — standardise disclaimer component |
| **Injection via AI output** (model output rendered as HTML/markdown) | Render as plain text / sanitised markdown (`lib/utils/sanitize.ts` exists in client) | Verify on every AI surface |
| **Abuse of AI endpoints** (cost, harassment content) | Per-user AI rate limits (usage tests exist: `ai.chat.usage.test.ts`), content-safety filter on inputs and outputs | Partial |
| **Bias in matching/ranking** | Pre-launch fairness evaluation on ranker outputs across cohorts; document features used; no protected-attribute features without justification | Required before ML serving goes live |

## Retention

AI prompts/responses: 30-day abuse-review window then deletion (policy — see
retention-and-deletion.md); logs must never contain full prompt bodies.

## Test plan (add to CI before expanding AI surface)

1. Injection suite: adversarial resumes/messages ("ignore previous instructions…") must not alter model behaviour or exfiltrate other context.
2. Leakage suite: user A's data must never appear in user B's AI responses.
3. Redaction unit tests on the prompt-builder.
4. Output-sanitisation tests on every AI-rendering component.
