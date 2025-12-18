type Provider = 'anthropic' | 'openai' | 'mock'

export function getLLMProvider(): Provider {
  const p = process.env.LLM_PROVIDER || process.env.NEXT_PUBLIC_LLM_PROVIDER
  if (!p) return 'anthropic'
  if (p === 'anthropic' || p === 'openai' || p === 'mock') return p
  return 'anthropic'
}

export function getLLMModel(): string {
  // FORCE_LLM_MODEL, when set, overrides any other model setting to force a model globally.
  return (process.env.FORCE_LLM_MODEL || process.env.LLM_MODEL || process.env.NEXT_PUBLIC_LLM_MODEL || 'claude-sonnet-4.5')
}

export async function generateCompletion(prompt: string, opts?: { model?: string; temperature?: number }) {
  const model = opts?.model || getLLMModel()
  const provider = getLLMProvider()

  // If provider is mock, return deterministic stub (useful in tests)
  if (provider === 'mock') {
    return { text: `[mock:${model}] ${prompt.slice(0, 120)}` }
  }

  // For now we implement a simple provider-agnostic stub that throws if provider is not configured
  // In future add real Anthropic/OpenAI integration here.
  throw new Error(`LLM provider "${provider}" is not configured. Set LLM_PROVIDER env and implement provider adapter.`)
}
