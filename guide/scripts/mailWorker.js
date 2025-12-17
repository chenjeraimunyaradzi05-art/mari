#!/usr/bin/env node
// Simple mail worker that processes 'email' jobs from Bull and sends them immediately.
require('dotenv').config()
const Queue = require('bull')
const nodemailer = require('nodemailer')
const sgMail = require('@sendgrid/mail')

const provider = process.env.EMAIL_PROVIDER || 'log'
const fromAddress = process.env.EMAIL_FROM || 'no-reply@example.com'
const redisUrl = process.env.REDIS_URL
const queueOptions = redisUrl ? { redis: { url: redisUrl } } : undefined

const queue = queueOptions ? new Queue('email', queueOptions) : new Queue('email')

console.log('Mail worker starting, provider=', provider)

async function handleJob(job) {
  const { to, subject, text = '', html = '' } = job.data
  try {
    if (provider === 'smtp') {
      const host = process.env.SMTP_HOST
      const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
      const user = process.env.SMTP_USER
      const pass = process.env.SMTP_PASS
      const secure = process.env.SMTP_SECURE === 'true'
      const transport = nodemailer.createTransport({ host, port, secure: secure ?? !!(port === 465), auth: user && pass ? { user, pass } : undefined })
      await transport.sendMail({ from: fromAddress, to, subject, text, html })
      return
    }

    if (provider === 'sendgrid') {
      const apiKey = process.env.SENDGRID_API_KEY
      if (!apiKey) throw new Error('SENDGRID_API_KEY not configured')
      sgMail.setApiKey(apiKey)
      await sgMail.send({ to, from: fromAddress, subject, text: text || '', html: html || '' })
      return
    }

    console.info('Email (not sent - log mode) ->', { to, subject, text, html })
  } catch (err) {
    console.error('Error sending email', err)
    throw err
  }
}

queue.process(async (job) => {
  await handleJob(job)
})

process.on('SIGINT', async () => {
  console.log('Shutting down mail worker')
  try {
    await queue.close()
  } catch (e) {
    // ignore
  }
  process.exit(0)
})
