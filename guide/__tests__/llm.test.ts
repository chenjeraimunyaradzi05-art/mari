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

  it('respects FORCE_LLM_MODEL override for getLLMModel', () => {
    process.env.FORCE_LLM_MODEL = 'forced-model'
    process.env.LLM_MODEL = 'other-model'
    expect(getLLMModel()).toBe('forced-model')
    delete process.env.FORCE_LLM_MODEL
    delete process.env.LLM_MODEL
  })

  it('respects FORCE_LLM_MODEL for generateCompletion with mock provider', async () => {
    process.env.LLM_PROVIDER = 'mock'
    process.env.FORCE_LLM_MODEL = 'forced-model'
    const res = await generateCompletion('Hello X')
    expect(res.text.startsWith('[mock:forced-model]')).toBeTruthy()
    delete process.env.LLM_PROVIDER
    delete process.env.FORCE_LLM_MODEL
  })
})
