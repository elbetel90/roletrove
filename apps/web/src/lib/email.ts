import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'Jobs <noreply@example.com>'

export async function sendVerificationEmail(
  to: string,
  verificationUrl: string,
): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your email — Jobs',
    html: `
      <p>Thanks for signing up!</p>
      <p>
        <a href="${verificationUrl}" style="color:#0070f3">
          Click here to verify your email
        </a>
      </p>
      <p style="color:#666;font-size:12px">
        This link expires in 24 hours. If you didn't sign up, ignore this email.
      </p>
    `,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your password — Jobs',
    html: `
      <p>You requested a password reset.</p>
      <p>
        <a href="${resetUrl}" style="color:#0070f3">
          Click here to reset your password
        </a>
      </p>
      <p style="color:#666;font-size:12px">
        This link expires in 1 hour. If you didn't request this, ignore this email.
      </p>
    `,
  })
}

export async function sendJobAlertDigest(
  to: string,
  jobs: Array<{ title: string; company: string; url: string; seniority?: string }>,
): Promise<void> {
  const jobRows = jobs
    .map(
      (j) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee">
            <a href="${j.url}" style="color:#0070f3;font-weight:bold">${j.title}</a>
            <span style="color:#666;margin-left:8px">${j.company}</span>
            ${j.seniority ? `<span style="color:#888;font-size:12px;margin-left:4px">${j.seniority}</span>` : ''}
          </td>
        </tr>
      `,
    )
    .join('')

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your saved search`,
    html: `
      <h2>New jobs for you</h2>
      <table style="width:100%;border-collapse:collapse">
        ${jobRows}
      </table>
      <p style="color:#666;font-size:12px;margin-top:16px">
        You're receiving this because you set up a saved search.
        <a href="${process.env.BETTER_AUTH_URL}/account/searches">Manage your alerts</a>
      </p>
    `,
  })
}
