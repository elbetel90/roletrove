import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM ?? 'Jobs <noreply@example.com>'
const APP_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

export async function sendJobAlertDigest(
  to: string,
  searchName: string,
  jobs: Array<{ title: string; company: string; url: string; seniority?: string }>,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    // No Resend key configured — skip silently (dev environment)
    return
  }

  const jobRows = jobs
    .map(
      (j) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee">
          <a href="${j.url}" style="color:#0070f3;font-weight:600;text-decoration:none">
            ${j.title}
          </a>
          <span style="color:#555;margin-left:8px">${j.company}</span>
          ${j.seniority && j.seniority !== 'unknown'
            ? `<span style="color:#888;font-size:12px;margin-left:6px;text-transform:capitalize">${j.seniority}</span>`
            : ''}
        </td>
      </tr>`,
    )
    .join('')

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${jobs.length} new job${jobs.length > 1 ? 's' : ''} for "${searchName}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="margin-bottom:4px">New jobs for you</h2>
        <p style="color:#666;margin-top:0">Matching your saved search: <strong>${searchName}</strong></p>

        <table style="width:100%;border-collapse:collapse">
          ${jobRows}
        </table>

        <p style="color:#999;font-size:12px;margin-top:24px">
          You're receiving this because you set up a saved search on RoleTrove.<br>
          <a href="${APP_URL}/account/searches" style="color:#0070f3">Manage your alerts</a>
        </p>
      </div>
    `,
  })
}
