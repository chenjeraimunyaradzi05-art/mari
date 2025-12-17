import { NextResponse } from 'next/server'
import Busboy from 'busboy'
import { uploadBuffer } from '@/lib/storage'

export async function POST(req: Request) {
  // Only accept multipart/form-data
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  }

  return new Promise<NextResponse>((resolve) => {
    const bb = new Busboy({ headers: { 'content-type': contentType } as unknown as Record<string, string> })
    let fileBuffer: Buffer | null = null
    let filename = 'upload'
    let mime = 'application/octet-stream'

    bb.on('file', (_fieldname: string, file: NodeJS.ReadableStream, fname: string, encoding: string, mimetype: string) => {
      filename = fname || filename
      mime = mimetype || mime
      const chunks: Buffer[] = []
      file.on('data', (data: Buffer) => chunks.push(data))
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks)
      })
    })

    bb.on('finish', async () => {
      try {
        if (!fileBuffer) return resolve(NextResponse.json({ error: 'No file provided' }, { status: 400 }))
        const ext = filename.split('.').pop() || 'bin'
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const url = await uploadBuffer(fileBuffer, safeName, mime)
        resolve(NextResponse.json({ url }))
      } catch (err) {
        console.error(err)
        resolve(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
      }
    })

    // Pipe Node.js request stream to busboy
    // attempt to access Node readable stream if available
    const bodyStream = (req as unknown as { body?: unknown }).body as NodeJS.ReadableStream | undefined
    if (bodyStream && typeof (bodyStream as unknown as NodeJS.ReadableStream & { pipe?: unknown }).pipe === 'function') {
      const bs = bodyStream as unknown as NodeJS.ReadableStream & { pipe: (dest: NodeJS.WritableStream) => void }
      bs.pipe(bb as unknown as NodeJS.WritableStream)
    } else {
      // fallback: read body as arrayBuffer
      req.arrayBuffer().then((buf) => {
        bb.end(Buffer.from(buf))
      })
    }
  })
}
