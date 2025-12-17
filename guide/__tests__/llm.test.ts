const { getLLMModel, getLLMProvider, generateCompletion } = require('../lib/llm')

describe('LLM wrapper', () => {
  it('reads default model if unset', () => {
    const model = getLLMModel()
    expect(model).toBe('claude-sonnet-4.5')
  })

  it('reads provider fallback', () => {
    process.env.LLM_PROVIDER = 'mock'
    expect(getLLMProvider()).toBe('mock')
    delete process.env.LLM_PROVIDER
  })

  it('generateCompletion returns mock when provider is mock', async () => {
    process.env.LLM_PROVIDER = 'mock'
    process.env.LLM_MODEL = 'claude-sonnet-4.5'
    const res = await generateCompletion('Hello world')
    expect(res.text.startsWith('[mock:')).toBeTruthy()
    delete process.env.LLM_PROVIDER
    delete process.env.LLM_MODEL
  })
})
