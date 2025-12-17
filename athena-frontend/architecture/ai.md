# AI Integration & Safety (Draft)

This document outlines initial approach to prototype `AiConcierge`, `AiWellnessCoach`, and `Tax Assistant` while prioritizing user privacy and safety.

Key points:

- Use mock endpoints for early prototyping (see `mock-api/api/ai/ask`).
- In production, prefer a managed provider (Anthropic Claude/OpenAI/GPT-4o) via a small mediator service that performs PII filtering and rate limiting.
- PII & Safety: implement input filtering (block SSN, credit card, passwords), redaction, and an allowlist for document uploads.
- Auditing & Explainability: store user prompts (hashed if necessary) and AI replies for 30–90 days for auditing.
- Guardrails: keep a risk threshold — if high, route to human advisors or decline to answer.
- Testing: evaluate hallucination rate on held-out dataset and add a human-in-the-loop review for financial/tax advice.

Next steps:

1. Implement server-side mediator service (Lambda/Express) that talks to provider and applies filters.
2. Add client-side components (`AICoach`, `AiConcierge`) with opt-in flows and consent verbiage.
3. Create an internal testset and run periodic hallucination/accuracy checks.
