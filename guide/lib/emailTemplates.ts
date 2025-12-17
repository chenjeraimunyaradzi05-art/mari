export function verificationHtml(url: string, displayName?: string) {
  const name = displayName || 'Friend'
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Verify your email</title>
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f7fafc;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:24px 0;text-align:center;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="padding:24px;text-align:center;background:linear-gradient(90deg,#06b6d4,#7c3aed);color:white;">
              <h1 style="margin:0;font-size:20px">Verify your email</h1>
            </div>
            <div style="padding:24px;color:#111827;">
              <p style="margin:0 0 12px">Hi ${name},</p>
              <p style="margin:0 0 16px">Thanks for creating an account. Click the button below to verify your email address.</p>
              <p style="text-align:center;margin:24px 0"><a href="${url}" style="display:inline-block;padding:10px 18px;background:#06b6d4;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Verify Email</a></p>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break:break-all;color:#2563eb;font-size:12px">${url}</p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eef2f7" />
              <p style="margin:0;color:#6b7280;font-size:12px">Need help? Reply to this email and we'll assist.</p>
              <p style="margin:8px 0 0;color:#6b7280;font-size:12px">&copy; ${new Date().getFullYear()} Athena</p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function resetPasswordHtml(url: string, displayName?: string) {
  const name = displayName || 'Friend'
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Reset your password</title>
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f7fafc;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:24px 0;text-align:center;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="padding:24px;text-align:center;background:linear-gradient(90deg,#06b6d4,#7c3aed);color:white;">
              <h1 style="margin:0;font-size:20px">Reset your password</h1>
            </div>
            <div style="padding:24px;color:#111827;">
              <p style="margin:0 0 12px">Hi ${name},</p>
              <p style="margin:0 0 16px">You requested a password reset. Click the button below to set a new password. This link will expire shortly.</p>
              <p style="text-align:center;margin:24px 0"><a href="${url}" style="display:inline-block;padding:10px 18px;background:#06b6d4;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Reset password</a></p>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break:break-all;color:#2563eb;font-size:12px">${url}</p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eef2f7" />
              <p style="margin:0;color:#6b7280;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
              <p style="margin:8px 0 0;color:#6b7280;font-size:12px">&copy; ${new Date().getFullYear()} Athena</p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
