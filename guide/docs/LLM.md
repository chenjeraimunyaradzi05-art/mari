# LLM configuration and FORCE_LLM_MODEL

This document explains the newly introduced `FORCE_LLM_MODEL` environment variable.

## Purpose

`FORCE_LLM_MODEL` forces a specific LLM model across the application, overriding per-client or default settings. This is useful for rolling out a single model to all clients quickly (e.g., `claude-sonnet-4.5`).

## Behavior

- When `FORCE_LLM_MODEL` is set, `getLLMModel()` will return its value.
- Otherwise, the value of `LLM_MODEL` or `NEXT_PUBLIC_LLM_MODEL` will be used.
- Default fallback: `claude-sonnet-4.5`.

## Deployment

Set `FORCE_LLM_MODEL=claude-sonnet-4.5` in your production environment (Vercel/Netlify/Heroku/Docker) to enable it globally.

Examples:

- Vercel dashboard -> Environment Variables -> Add `FORCE_LLM_MODEL` = `claude-sonnet-4.5` for Production
- Netlify: `netlify env:set FORCE_LLM_MODEL claude-sonnet-4.5`
- Docker (compose):
  ```yaml
  environment:
    - FORCE_LLM_MODEL=claude-sonnet-4.5
  ```

## Rollout notes

- This is a global override; it will affect all clients using your deployment.
- If you have per-client model settings in the DB, consider running the admin script (coming next) to inspect/update client records safely.

---

If you want, I can also add an administrative script to detect and optionally update per-client LLM model fields in the database (dry-run first).