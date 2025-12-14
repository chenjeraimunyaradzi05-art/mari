## Copilot Prompt: Integrate a 3rd-party moderation provider (OpenAI/AWS/Google)

Goal: Replace or augment the local keyword moderation heuristics with a pluggable 3rd-party moderation provider and ensure results map to our moderation model (violations, severity, confidence). Provide tests, config, and fallback behaviour.

Prompt (copy into Copilot / use directly):

Create a new moderation provider adapter that implements `App\Services\Moderation\ProviderInterface`.
- Name: `OpenAIModerationProvider` (also prepare `AWSModerationProvider` and `GoogleModerationProvider` stubs)
- Should read provider settings from `config('moderation')` and use env vars for credentials.
- Implement `scanText(string $text)` and `scanFile(array $fileInfo)` returning normalized violations array [{type, confidence, match}].
- Use HTTP client built into Laravel (`Http::withToken(...)`) for calls; implement timeouts and graceful fallback to local heuristics if the provider is unavailable.

Update `app/Services/ContentModerationService.php`:
- When `config('moderation.provider')` is 'local' use existing heuristics.
- When set to 'openai' (or another provider), use the provider adapter by resolving it via the container and calling `scanText`/`scanFile`.
- Ensure we log failures and fallback to local heuristics.

Add `config/moderation.php` to provide provider selection, dictionary, severity weights and action mapping.

Add CI-safe tests:
- Unit tests for provider adapters using HTTP fakes to assert provider call & response parsing.
- Feature tests for social post creation where provider returns 'pornographic' and ensures that a public post is rejected and moderation_status set to 'pending_review' when appropriate.

Add an exception/retry policy (simple) to avoid blocking when provider is down — short timeout and safe fallback.

Finally, include docs and examples for operations team (env var names, rate limits, expected quotas) and update the staging env to set `MODERATION_PROVIDER=openai` with a sample key.
