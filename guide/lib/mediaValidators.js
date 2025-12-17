const path = require('path')

const DEFAULT_MAX_FILE_SIZE = Number(process.env.MAX_POST_FILE_SIZE_BYTES || 12 * 1024 * 1024)
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'])

function mimeFromFilename(filename) {
  if (!filename) return null
  const ext = (path.extname(filename) || '').toLowerCase()
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg'
  if (['.png'].includes(ext)) return 'image/png'
  if (['.gif'].includes(ext)) return 'image/gif'
  if (['.mp4'].includes(ext)) return 'video/mp4'
  if (['.webm'].includes(ext)) return 'video/webm'
  return null
}

async function validateFile(file, opts = {}) {
  const maxSize = opts.maxSize || DEFAULT_MAX_FILE_SIZE
  const allowedMimes = opts.allowedMimes || ALLOWED_MIMES

  if (!file || typeof file.arrayBuffer !== 'function') return { ok: false, error: 'No file provided' }

  const filename = file.name
  const mime = file.type || mimeFromFilename(filename)
  if (!mime || !allowedMimes.has(mime)) return { ok: false, error: 'Invalid file type' }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > maxSize) return { ok: false, error: `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)` }

  return { ok: true, size: buffer.length, mime }
}

module.exports = { validateFile, mimeFromFilename, ALLOWED_MIMES }
