/**
 * Email Service for ATHENA Platform
 * Handles all transactional and marketing emails
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Email templates
const templates = {
  welcome: (data: { firstName: string; referralCode?: string }): EmailTemplate => ({
    subject: 'Welcome to ATHENA - Your Journey Begins! 🚀',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ATHENA</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
          <p style="color: #666; margin: 5px 0;">The Life Operating System for Women</p>
        </div>
        
        <h2 style="color: #1f2937;">Welcome, ${data.firstName}! 👋</h2>
        
        <p>We're thrilled to have you join ATHENA - where ambitious women connect, grow, and thrive together.</p>
        
        <div style="background: linear-gradient(135deg, #7c3aed, #ec4899); padding: 20px; border-radius: 12px; color: white; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">Get Started</h3>
          <p style="margin: 0;">Complete your profile, explore jobs, connect with mentors, and join our community.</p>
        </div>
        
        <h3 style="color: #1f2937;">What you can do on ATHENA:</h3>
        <ul style="padding-left: 20px;">
          <li>🎯 Find your dream job with AI-powered matching</li>
          <li>👩‍🏫 Connect with mentors who've been there</li>
          <li>📚 Access courses to level up your skills</li>
          <li>🤝 Join a supportive community of women</li>
          <li>🤖 Use AI tools to optimize your career</li>
        </ul>
        
        ${data.referralCode ? `
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: 600;">Your Referral Code: <span style="color: #7c3aed; font-size: 18px;">${data.referralCode}</span></p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Share with friends - you both get 100 credits when they sign up!</p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #666; text-align: center;">
          Questions? Reply to this email or visit our <a href="${process.env.CLIENT_URL}/help" style="color: #7c3aed;">Help Center</a>.
        </p>
        
        <p style="font-size: 12px; color: #999; text-align: center;">
          © ${new Date().getFullYear()} ATHENA. All rights reserved.
        </p>
      </body>
      </html>
    `,
    text: `
Welcome to ATHENA, ${data.firstName}!

We're thrilled to have you join ATHENA - where ambitious women connect, grow, and thrive together.

What you can do on ATHENA:
- Find your dream job with AI-powered matching
- Connect with mentors who've been there
- Access courses to level up your skills
- Join a supportive community of women
- Use AI tools to optimize your career

${data.referralCode ? `Your Referral Code: ${data.referralCode}\nShare with friends - you both get 100 credits when they sign up!\n` : ''}

Get started: ${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard

Questions? Reply to this email.

© ${new Date().getFullYear()} ATHENA. All rights reserved.
    `,
  }),

  referralSignup: (data: { referrerName: string; referredName: string; credits: number }): EmailTemplate => ({
    subject: `🎉 ${data.referredName} joined ATHENA with your referral!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Referral Success!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 60px; margin-bottom: 10px;">🎉</div>
          <h2 style="color: #1f2937; margin: 0;">Great news, ${data.referrerName}!</h2>
        </div>
        
        <p style="text-align: center; font-size: 18px;">
          <strong>${data.referredName}</strong> just signed up using your referral link!
        </p>
        
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 12px; color: white; text-align: center; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;">You've earned</p>
          <p style="margin: 5px 0; font-size: 36px; font-weight: bold;">${data.credits} Credits</p>
        </div>
        
        <p style="text-align: center;">Keep sharing and earning! Every friend who joins gets you both credits.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/referrals" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Your Referrals</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center;">
          © ${new Date().getFullYear()} ATHENA. All rights reserved.
        </p>
      </body>
      </html>
    `,
    text: `
Great news, ${data.referrerName}!

${data.referredName} just signed up using your referral link!

You've earned ${data.credits} Credits!

Keep sharing and earning! Every friend who joins gets you both credits.

View your referrals: ${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/referrals

© ${new Date().getFullYear()} ATHENA.
    `,
  }),

  reEngagement: (data: { firstName: string; daysInactive: number }): EmailTemplate => ({
    subject: `We miss you, ${data.firstName}! 💜`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>We Miss You!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
        </div>
        
        <h2 style="color: #1f2937;">Hey ${data.firstName},</h2>
        
        <p>It's been ${data.daysInactive} days since we last saw you on ATHENA. A lot has been happening while you were away!</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #1f2937;">What's new:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>🆕 New job opportunities matching your profile</li>
            <li>👩‍🏫 Fresh mentor availability</li>
            <li>📚 New courses added to the learning hub</li>
            <li>💬 Community discussions you might like</li>
          </ul>
        </div>
        
        <p>Your community is waiting for you. Jump back in and continue your journey!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">Return to ATHENA</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center;">
          Don't want these emails? <a href="${process.env.CLIENT_URL}/settings/notifications" style="color: #666;">Manage preferences</a>
        </p>
      </body>
      </html>
    `,
    text: `
Hey ${data.firstName},

It's been ${data.daysInactive} days since we last saw you on ATHENA. A lot has been happening while you were away!

What's new:
- New job opportunities matching your profile
- Fresh mentor availability
- New courses added to the learning hub
- Community discussions you might like

Your community is waiting for you. Jump back in and continue your journey!

Return to ATHENA: ${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard

Don't want these emails? Manage preferences: ${process.env.CLIENT_URL}/settings/notifications
    `,
  }),

  weeklyDigest: (data: { 
    firstName: string; 
    newJobs: number; 
    newConnections: number;
    upcomingEvents: number;
  }): EmailTemplate => ({
    subject: `Your ATHENA Weekly Update 📊`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Weekly Digest</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
          <p style="color: #666; margin: 5px 0;">Your Weekly Update</p>
        </div>
        
        <h2 style="color: #1f2937;">Hi ${data.firstName}! 👋</h2>
        
        <p>Here's what happened on ATHENA this week:</p>
        
        <div style="display: flex; gap: 15px; margin: 20px 0;">
          <div style="flex: 1; background: #ede9fe; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #7c3aed;">${data.newJobs}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">New Jobs</p>
          </div>
          <div style="flex: 1; background: #fce7f3; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ec4899;">${data.newConnections}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">New Connections</p>
          </div>
          <div style="flex: 1; background: #d1fae5; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #10b981;">${data.upcomingEvents}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Events</p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">Explore Now</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center;">
          <a href="${process.env.CLIENT_URL}/settings/notifications" style="color: #666;">Unsubscribe</a> • 
          © ${new Date().getFullYear()} ATHENA
        </p>
      </body>
      </html>
    `,
    text: `
Hi ${data.firstName}!

Here's what happened on ATHENA this week:

- ${data.newJobs} New Jobs
- ${data.newConnections} New Connections
- ${data.upcomingEvents} Upcoming Events

Explore now: ${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard

Unsubscribe: ${process.env.CLIENT_URL}/settings/notifications
© ${new Date().getFullYear()} ATHENA
    `,
  }),

  // Phase 2: Additional transactional email templates
  passwordReset: (data: { firstName: string; resetLink: string; expiresIn: string }): EmailTemplate => ({
    subject: 'Reset Your ATHENA Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Password Reset</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
        </div>
        <h2 style="color: #1f2937;">Password Reset Request</h2>
        <p>Hi ${data.firstName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetLink}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">This link will expire in ${data.expiresIn}. If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} ATHENA. All rights reserved.</p>
      </body>
      </html>
    `,
    text: `Hi ${data.firstName},\n\nWe received a request to reset your password.\n\nReset your password: ${data.resetLink}\n\nThis link expires in ${data.expiresIn}.\n\n© ${new Date().getFullYear()} ATHENA`,
  }),

  mentorBookingConfirmed: (data: { 
    menteeName: string; 
    mentorName: string; 
    dateTime: string; 
    duration: string;
    sessionLink: string;
    topics: string[];
  }): EmailTemplate => ({
    subject: `✅ Mentor Session Confirmed with ${data.mentorName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Booking Confirmed</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
        </div>
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 60px; margin-bottom: 10px;">✅</div>
          <h2 style="color: #1f2937; margin: 0;">Session Confirmed!</h2>
        </div>
        <p>Hi ${data.menteeName},</p>
        <p>Your mentor session with <strong>${data.mentorName}</strong> has been confirmed.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>📅 Date & Time:</strong> ${data.dateTime}</p>
          <p style="margin: 5px 0;"><strong>⏱️ Duration:</strong> ${data.duration}</p>
          ${data.topics.length > 0 ? `<p style="margin: 5px 0;"><strong>📋 Topics:</strong> ${data.topics.join(', ')}</p>` : ''}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.sessionLink}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Session Details</a>
        </div>
        <p style="color: #666; font-size: 14px;">💡 Tip: Prepare your questions in advance to make the most of your session!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} ATHENA</p>
      </body>
      </html>
    `,
    text: `Hi ${data.menteeName},\n\nYour session with ${data.mentorName} is confirmed!\n\nDate & Time: ${data.dateTime}\nDuration: ${data.duration}\n${data.topics.length > 0 ? `Topics: ${data.topics.join(', ')}\n` : ''}\nView details: ${data.sessionLink}`,
  }),

  applicationUpdate: (data: {
    firstName: string;
    jobTitle: string;
    companyName: string;
    status: 'REVIEWED' | 'SHORTLISTED' | 'INTERVIEW' | 'OFFERED' | 'REJECTED';
    message?: string;
    actionLink: string;
  }): EmailTemplate => {
    const statusMessages = {
      REVIEWED: { emoji: '👀', text: 'Your application has been reviewed' },
      SHORTLISTED: { emoji: '⭐', text: 'Congratulations! You\'ve been shortlisted' },
      INTERVIEW: { emoji: '🎤', text: 'Great news! You\'re invited for an interview' },
      OFFERED: { emoji: '🎉', text: 'Congratulations! You\'ve received an offer' },
      REJECTED: { emoji: '📝', text: 'Update on your application' },
    };
    const statusInfo = statusMessages[data.status];
    
    return {
      subject: `${statusInfo.emoji} ${data.jobTitle} at ${data.companyName} - Application Update`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Application Update</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
          </div>
          <h2 style="color: #1f2937;">${statusInfo.text}</h2>
          <p>Hi ${data.firstName},</p>
          <p>There's an update on your application for <strong>${data.jobTitle}</strong> at <strong>${data.companyName}</strong>.</p>
          ${data.message ? `<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0;">${data.message}</p></div>` : ''}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.actionLink}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Application</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} ATHENA</p>
        </body>
        </html>
      `,
      text: `Hi ${data.firstName},\n\n${statusInfo.text} for ${data.jobTitle} at ${data.companyName}.\n\n${data.message || ''}\n\nView application: ${data.actionLink}`,
    };
  },

  paymentReceipt: (data: {
    firstName: string;
    amount: string;
    currency: string;
    description: string;
    transactionId: string;
    date: string;
    receiptUrl?: string;
  }): EmailTemplate => ({
    subject: `Payment Receipt - ${data.amount} ${data.currency}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Payment Receipt</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
        </div>
        <h2 style="color: #1f2937;">Payment Receipt</h2>
        <p>Hi ${data.firstName},</p>
        <p>Thank you for your payment. Here are the details:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666;">Amount</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${data.amount} ${data.currency}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Description</td><td style="padding: 8px 0; text-align: right;">${data.description}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Transaction ID</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${data.transactionId}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; text-align: right;">${data.date}</td></tr>
          </table>
        </div>
        ${data.receiptUrl ? `<div style="text-align: center; margin: 30px 0;"><a href="${data.receiptUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">Download Receipt</a></div>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} ATHENA</p>
      </body>
      </html>
    `,
    text: `Hi ${data.firstName},\n\nPayment Receipt\n\nAmount: ${data.amount} ${data.currency}\nDescription: ${data.description}\nTransaction ID: ${data.transactionId}\nDate: ${data.date}\n\n© ${new Date().getFullYear()} ATHENA`,
  }),

  sessionReminder: (data: {
    firstName: string;
    partnerName: string;
    dateTime: string;
    minutesUntil: number;
    sessionLink: string;
  }): EmailTemplate => ({
    subject: `⏰ Reminder: Session with ${data.partnerName} in ${data.minutesUntil} minutes`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Session Reminder</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
        </div>
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 60px; margin-bottom: 10px;">⏰</div>
          <h2 style="color: #1f2937; margin: 0;">Your session starts soon!</h2>
        </div>
        <p>Hi ${data.firstName},</p>
        <p>Your session with <strong>${data.partnerName}</strong> starts in <strong>${data.minutesUntil} minutes</strong>.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 18px;"><strong>${data.dateTime}</strong></p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.sessionLink}" style="display: inline-block; background: #10b981; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Join Session Now</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} ATHENA</p>
      </body>
      </html>
    `,
    text: `Hi ${data.firstName},\n\nYour session with ${data.partnerName} starts in ${data.minutesUntil} minutes!\n\n${data.dateTime}\n\nJoin now: ${data.sessionLink}`,
  }),

  courseCompleted: (data: {
    firstName: string;
    courseName: string;
    instructorName: string;
    certificateUrl?: string;
    completionDate: string;
  }): EmailTemplate => ({
    subject: `🎓 Congratulations! You completed "${data.courseName}"`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Course Completed</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0;">ATHENA</h1>
        </div>
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #7c3aed, #ec4899); border-radius: 12px; color: white; margin-bottom: 20px;">
          <div style="font-size: 60px; margin-bottom: 10px;">🎓</div>
          <h2 style="margin: 0;">Course Completed!</h2>
        </div>
        <p>Congratulations, ${data.firstName}!</p>
        <p>You've successfully completed <strong>"${data.courseName}"</strong> by ${data.instructorName}.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>📚 Course:</strong> ${data.courseName}</p>
          <p style="margin: 5px 0;"><strong>👩‍🏫 Instructor:</strong> ${data.instructorName}</p>
          <p style="margin: 5px 0;"><strong>📅 Completed:</strong> ${data.completionDate}</p>
        </div>
        ${data.certificateUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.certificateUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Certificate</a>
        </div>
        ` : ''}
        <p style="color: #666;">Keep learning! Check out more courses recommended for you on ATHENA.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} ATHENA</p>
      </body>
      </html>
    `,
    text: `Congratulations, ${data.firstName}!\n\nYou've completed "${data.courseName}" by ${data.instructorName}.\n\nCompleted: ${data.completionDate}\n\n${data.certificateUrl ? `View certificate: ${data.certificateUrl}` : ''}`,
  }),
};

/**
 * Send an email using the configured provider
 * Currently logs to console; integrate with SendGrid/SES for production
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // In production, integrate with SendGrid, AWS SES, or similar
  // For now, log the email
  console.log('📧 Email would be sent:');
  console.log(`   To: ${options.to}`);
  console.log(`   Subject: ${options.subject}`);
  
  // Simulate async email sending
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('   ✅ Email sent successfully (simulated)');
      resolve(true);
    }, 100);
  });
}

/**
 * Email service class
 */
export const emailService = {
  /**
   * Generic send email method for custom emails
   */
  async sendEmail(options: { to: string; subject: string; template?: string; data?: Record<string, any>; html?: string; text?: string }): Promise<boolean> {
    // In production, would use template engine to render template with data
    const html = options.html || `<p>${JSON.stringify(options.data)}</p>`;
    const text = options.text || JSON.stringify(options.data);
    
    return sendEmail({
      to: options.to,
      subject: options.subject,
      html,
      text,
    });
  },
  
  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(to: string, firstName: string, referralCode?: string): Promise<boolean> {
    const template = templates.welcome({ firstName, referralCode });
    return sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  },

  /**
   * Notify referrer about successful referral
   */
  async sendReferralNotification(
    to: string,
    referrerName: string,
    referredName: string,
    credits: number
  ): Promise<boolean> {
    const template = templates.referralSignup({ referrerName, referredName, credits });
    return sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  },

  /**
   * Send re-engagement email to inactive users
   */
  async sendReEngagementEmail(to: string, firstName: string, daysInactive: number): Promise<boolean> {
    const template = templates.reEngagement({ firstName, daysInactive });
    return sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  },

  /**
   * Send weekly digest email
   */
  async sendWeeklyDigest(
    to: string,
    firstName: string,
    stats: { newJobs: number; newConnections: number; upcomingEvents: number }
  ): Promise<boolean> {
    const template = templates.weeklyDigest({ firstName, ...stats });
    return sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  },
};

export default emailService;

// Re-export auth-related email functions from utils/email for a single import point
export {
  sendEmail as sendTransactionalEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail as sendWelcomeVerificationEmail,
} from '../utils/email';
