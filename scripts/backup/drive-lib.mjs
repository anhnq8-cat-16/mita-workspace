// Thư viện nhỏ cho backup: đăng nhập Google bằng service account (ủy quyền domain-wide,
// đóng vai tài khoản hệ thống) + các thao tác Drive cần cho backup. Không cần thư viện ngoài.
import { createSign } from 'node:crypto'

export const BACKUP_RE = /^\d{4}-\d{2}-\d{2}\.sql\.gz$/
const FOLDER = 'application/vnd.google-apps.folder'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

/** Tên file theo ngày Việt Nam: 2026-10-05.sql.gz */
export function backupName(now = new Date()) {
  const d = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return `${d}.sql.gz`
}

/** Giữ `keep` bản mới nhất (theo tên ngày); trả về các file cần đưa vào thùng rác */
export function selectForDeletion(files, keep) {
  return files
    .filter((f) => BACKUP_RE.test(f.name))
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
    .slice(keep)
}

/** Bản mới nhất (theo tên ngày) */
export function latest(files) {
  return files.filter((f) => BACKUP_RE.test(f.name)).sort((a, b) => (a.name < b.name ? 1 : -1))[0]
}

const b64url = (s) => Buffer.from(s).toString('base64url')

export async function accessToken(saJson, subject, fetchImpl = fetch) {
  const sa = typeof saJson === 'string' ? JSON.parse(saJson) : saJson
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: sa.client_email,
    sub: subject,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url')
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Google token: ${res.status} ${JSON.stringify(body)}`)
  return body.access_token
}

export function drive(token, fetchImpl = fetch) {
  const call = async (url, init = {}) => {
    const res = await fetchImpl(url, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    })
    if (!res.ok)
      throw new Error(`Drive ${init.method ?? 'GET'} ${url}: ${res.status} ${await res.text()}`)
    return res
  }
  const common = 'supportsAllDrives=true'

  return {
    /** Liệt kê file (không lấy thư mục con) trong thư mục */
    async list(parent, extraQ = '') {
      const out = []
      let pageToken = ''
      do {
        const q = `'${parent}' in parents and trashed = false${extraQ}`
        const url = `${API}/files?${common}&includeItemsFromAllDrives=true&pageSize=200&fields=nextPageToken,files(id,name,size,mimeType,createdTime)&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ''}`
        const body = await (await call(url)).json()
        out.push(...body.files)
        pageToken = body.nextPageToken ?? ''
      } while (pageToken)
      return out
    },

    async ensureFolder(parent, name) {
      const found = await this.list(parent, ` and mimeType = '${FOLDER}' and name = '${name}'`)
      if (found[0]) return found[0].id
      const res = await call(`${API}/files?${common}&fields=id`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
      })
      return (await res.json()).id
    },

    /** Upload resumable (file lớn không lỗi), trả về id */
    async upload(parent, name, bytes, mimeType = 'application/gzip') {
      const init = await call(`${UPLOAD}/files?uploadType=resumable&${common}&fields=id`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-type': mimeType,
          'x-upload-content-length': String(bytes.length),
        },
        body: JSON.stringify({ name, parents: [parent], mimeType }),
      })
      const location = init.headers.get('location')
      if (!location) throw new Error('Drive không trả về địa chỉ upload')
      const res = await fetchImpl(location, {
        method: 'PUT',
        headers: { 'content-type': mimeType, 'content-length': String(bytes.length) },
        body: bytes,
      })
      if (!res.ok) throw new Error(`Drive upload: ${res.status} ${await res.text()}`)
      return (await res.json()).id
    },

    /** Đưa vào thùng rác (Content manager được phép; Drive tự xóa hẳn sau 30 ngày) */
    async trash(id) {
      await call(`${API}/files/${id}?${common}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      })
    },

    async download(id) {
      const res = await call(`${API}/files/${id}?${common}&alt=media`)
      return Buffer.from(await res.arrayBuffer())
    },
  }
}
