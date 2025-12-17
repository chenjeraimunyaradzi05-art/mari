const fs = require('fs')
const path = require('path')
const { randomBytes } = require('crypto')
const { prisma } = require('../lib/prisma')
const { validateFile } = require('./mediaValidators')

const MAX_MEDIA = Number(process.env.MAX_POST_MEDIA || 5)

async function handlePost(req, userId) {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }

  const contentType = req.headers && (req.headers.get ? req.headers.get('content-type') : (req.headers['content-type'] || '')) || ''

  let text = null
  let imagePath = null

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const b = form.get('body') || form.get('content') || form.get('caption')
    if (b) text = String(b).trim()

    let mediaEntries = []
    if (typeof form.getAll === 'function') {
      mediaEntries = form.getAll('media') || []
    } else {
      const m = form.get('media')
      if (m === undefined || m === null) mediaEntries = []
      else if (Array.isArray(m)) mediaEntries = m
      else mediaEntries = [m]
    }

    if (mediaEntries.length > MAX_MEDIA) {
      return { status: 400, body: { error: `You can attach up to ${MAX_MEDIA} files per post.` } }
    }

    const destDir = path.resolve(process.cwd(), 'public', 'uploads')
    await fs.promises.mkdir(destDir, { recursive: true })

    const savedPaths = []

    for (const file of mediaEntries) {
      const v = await validateFile(file)
      if (!v.ok) return { status: 400, body: { error: v.error } }

      const filename = file.name || `upload-${randomBytes(6).toString('hex')}`
      const ext = path.extname(filename) || ''
      const safeName = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
      const dest = path.join(destDir, safeName)
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.promises.writeFile(dest, buffer)
      savedPaths.push(`/uploads/${safeName}`)
    }

    if (savedPaths.length > 0) imagePath = savedPaths[0]
  } else {
    const body = await req.json()
    text = typeof body.body === 'string' ? body.body.trim() : typeof body.content === 'string' ? body.content.trim() : null
    if (body.imagePath && typeof body.imagePath === 'string') imagePath = body.imagePath
  }

  if (!text || text.length === 0) return { status: 400, body: { error: 'Body is required' } }
  if (text.length > 2000) return { status: 400, body: { error: 'Body too long' } }

  const data = { authorId: userId, content: text }
  if (imagePath) data.imagePath = imagePath

  const post = await prisma.post.create({ data })
  return { status: 200, body: { post } }
}

module.exports = { handlePost }
