const { validateFile } = require('../../lib/mediaValidators')

describe('mediaValidators', () => {
  test('validates a good png', async () => {
    const file = new Blob(['x'], { type: 'image/png' })
    Object.defineProperty(file, 'name', { value: 'ok.png' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(Buffer.from('x')) })

    const r = await validateFile(file)
    expect(r.ok).toBeTruthy()
    expect(r.mime).toBe('image/png')
  })

  test('rejects invalid type', async () => {
    const file = new Blob(['x'], { type: 'text/plain' })
    Object.defineProperty(file, 'name', { value: 'ok.txt' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(Buffer.from('x')) })

    const r = await validateFile(file)
    expect(r.ok).toBeFalsy()
    expect(r.error).toMatch(/Invalid file type/i)
  })

  test('rejects large files', async () => {
    const size = Number(process.env.MAX_POST_FILE_SIZE_BYTES || 12 * 1024 * 1024)
    const big = Buffer.alloc(size + 1)
    const file = new Blob([big], { type: 'image/png' })
    Object.defineProperty(file, 'name', { value: 'big.png' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(big) })

    const r = await validateFile(file)
    expect(r.ok).toBeFalsy()
    expect(r.error).toMatch(/File too large/i)
  })
})
