import nodemailer from 'nodemailer'
import sgMail from '@sendgrid/mail'

const provider = process.env.EMAIL_PROVIDER || 'log' // 'smtp' | 'sendgrid' | 'log'
const fromAddress = process.env.EMAIL_FROM || 'no-reply@example.com'

let smtpTransport: nodemailer.Transporter | null = null

function getSmtpTransport() {
  if (smtpTransport) return smtpTransport
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = process.env.SMTP_SECURE === 'true'

  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure: secure ?? !!(port === 465),
    auth: user && pass ? { user, pass } : undefined,
  })
  return smtpTransport
}

async function sendMail({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string }) {
  const useQueue = process.env.EMAIL_USE_QUEUE === 'true'

  if (useQueue) {
    try {
      const { enqueueEmail } = await import('@/lib/mailQueue')
      await enqueueEmail({ to, subject, text, html })
      return
    } catch (err) {
      console.error('Failed to enqueue email, falling back to direct send', err)
      // fall through to direct send
    }
  }

  if (provider === 'smtp') {
    const transport = getSmtpTransport()
    await transport.sendMail({ from: fromAddress, to, subject, text, html })
    return
  }

  if (provider === 'sendgrid') {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) throw new Error('SENDGRID_API_KEY not configured')
    sgMail.setApiKey(apiKey)
    await sgMail.send({ to, from: fromAddress, subject, text: text ?? '', html: html ?? '' })
    return
  }

  // Default: log the email for local/dev environments
  console.info('Email (not sent) ->', { to, subject, text, html })
}

export async function sendVerificationEmail(email: string, token: string) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const url = `${base}/auth/verify?token=${encodeURIComponent(token)}`
  const subject = 'Verify your email'
  const text = `Click to verify: ${url}`
  const html = `<p>Click to verify your email: <a href="${url}">${url}</a></p>`
  await sendMail({ to: email, subject, text, html })
}

export async function sendResetPasswordEmail(email: string, token: string) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const url = `${base}/auth/reset-password?token=${encodeURIComponent(token)}`
  const subject = 'Reset your password'
  const text = `Reset your password: ${url}`
  const html = `<p>Reset your password: <a href="${url}">${url}</a></p>`
  await sendMail({ to: email, subject, text, html })
}
