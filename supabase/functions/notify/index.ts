// Edge Function `notify`: gửi các tin đang chờ trong bảng outbox
// (email qua Gmail API, tin Google Chat qua webhook). Được gọi bởi pg_cron
// (fn_flush_outbox) với header x-cron-secret. Tắt verify_jwt trong config.toml.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { base64UrlEncodeString, getGoogleAccessToken } from '../_shared/google.ts'
import { buildMimeMessage } from '../_shared/mime.ts'

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const BATCH = 50
const MAX_ATTEMPTS = 5

interface OutboxRow {
  id: string
  channel: 'email' | 'chat'
  recipient: string
  subject: string | null
  body: string
  attempts: number
}

async function sendEmail(row: OutboxRow, systemUser: string) {
  const token = await getGoogleAccessToken([GMAIL_SCOPE], systemUser)
  const raw = base64UrlEncodeString(
    buildMimeMessage({
      from: systemUser,
      fromName: 'Mita Workspace',
      to: row.recipient,
      subject: row.subject ?? '[Mita Workspace]',
      text: row.body,
    }),
  )
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`)
}

async function sendChat(row: OutboxRow) {
  const res = await fetch(row.recipient, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ text: row.body }),
  })
  if (!res.ok) throw new Error(`Google Chat ${res.status}: ${await res.text()}`)
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
  const systemUser = Deno.env.get('GOOGLE_SYSTEM_USER') ?? ''

  const { data: rows, error } = await supabase
    .from('outbox')
    .select('id, channel, recipient, subject, body, attempts')
    .eq('status', 'pending')
    .order('created_at')
    .limit(BATCH)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let sent = 0
  let failed = 0
  for (const row of (rows ?? []) as OutboxRow[]) {
    try {
      if (row.channel === 'email') await sendEmail(row, systemUser)
      else await sendChat(row)
      await supabase
        .from('outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: row.attempts + 1 })
        .eq('id', row.id)
      sent++
    } catch (e) {
      const attempts = row.attempts + 1
      await supabase
        .from('outbox')
        .update({
          attempts,
          last_error: String(e instanceof Error ? e.message : e).slice(0, 1000),
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        })
        .eq('id', row.id)
      failed++
    }
  }
  return Response.json({ sent, failed })
})
