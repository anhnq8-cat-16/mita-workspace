// Lấy access token Google bằng service account + domain-wide delegation
// (impersonate tài khoản hệ thống). Dùng chung cho Gmail và Drive.

export interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

const TOKEN_URI = 'https://oauth2.googleapis.com/token'

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlEncodeString(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text))
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function loadServiceAccount(): ServiceAccount {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!raw) throw new Error('Thiếu secret GOOGLE_SERVICE_ACCOUNT_JSON')
  const sa = JSON.parse(raw) as ServiceAccount
  if (!sa.client_email || !sa.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON không hợp lệ')
  }
  return sa
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/** Access token cho `subject` (người được impersonate) với các scope đã cho */
export async function getGoogleAccessToken(
  scopes: string[],
  subject = Deno.env.get('GOOGLE_SYSTEM_USER') ?? '',
): Promise<string> {
  if (!subject) throw new Error('Thiếu secret GOOGLE_SYSTEM_USER')
  const cacheKey = `${subject}|${scopes.join(' ')}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const sa = loadServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = base64UrlEncodeString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64UrlEncodeString(
    JSON.stringify({
      iss: sa.client_email,
      sub: subject,
      scope: scopes.join(' '),
      aud: sa.token_uri ?? TOKEN_URI,
      iat: now,
      exp: now + 3600,
    }),
  )
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const unsigned = `${header}.${claims}`
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  )
  const assertion = `${unsigned}.${base64UrlEncode(signature)}`

  const res = await fetch(sa.token_uri ?? TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Google token lỗi ${res.status}: ${json.error_description ?? json.error}`)
  }
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  })
  return json.access_token as string
}
