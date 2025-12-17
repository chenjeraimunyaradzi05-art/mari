// CommonJS shim for tests. Mirrors behavior of `lib/llm.ts` in JS so Jest can require it
function getLLMProvider() {
  const p = process.env.LLM_PROVIDER || process.env.NEXT_PUBLIC_LLM_PROVIDER
  if (!p) return 'anthropic'
  if (p === 'anthropic' || p === 'openai' || p === 'mock') return p
  return 'anthropic'
}

function getLLMModel() {
  return process.env.LLM_MODEL || process.env.NEXT_PUBLIC_LLM_MODEL || 'claude-sonnet-4.5'
}

async function generateCompletion(prompt, opts) {
  const model = (opts && opts.model) || getLLMModel()
  const provider = getLLMProvider()
  if (provider === 'mock') {
    return { text: `[mock:${model}] ${prompt.slice(0, 120)}` }
  }
  throw new Error(`LLM provider "${provider}" is not configured. Set LLM_PROVIDER env and implement provider adapter.`)
}

module.exports = { getLLMModel, getLLMProvider, generateCompletion }
