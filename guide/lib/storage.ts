import fs from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'local'

const ensureUploads = () => {
  const uploads = path.join(process.cwd(), 'public', 'uploads', 'profiles')
  fs.mkdirSync(uploads, { recursive: true })
  return uploads
}

async function uploadToLocal(buffer: Buffer, fileName: string) {
  const uploads = ensureUploads()
  const dest = path.join(uploads, fileName)
  await fs.promises.writeFile(dest, buffer)
  return `/uploads/profiles/${fileName}`
}

async function uploadToS3(buffer: Buffer, fileName: string, contentType: string) {
  const bucket = process.env.AWS_S3_BUCKET
  const region = process.env.AWS_REGION
  if (!bucket || !region) throw new Error('Missing S3 config (AWS_S3_BUCKET/AWS_REGION)')

  const client = new S3Client({ region })
  const Key = `profiles/${fileName}`
  const cmd = new PutObjectCommand({ Bucket: bucket, Key, Body: buffer, ContentType: contentType, ACL: 'public-read' })
  await client.send(cmd)

  // Allow custom base URL override
  const base = process.env.AWS_S3_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`
  return `${base}/${Key}`
}

export async function uploadBuffer(buffer: Buffer, fileName: string, contentType: string) {
  if (STORAGE_DRIVER === 's3') {
    return uploadToS3(buffer, fileName, contentType)
  }
  return uploadToLocal(buffer, fileName)
}
