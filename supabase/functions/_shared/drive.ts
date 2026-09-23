// Google Drive (Shared Drives) qua service account impersonate tài khoản hệ thống
import { getGoogleAccessToken } from './google.ts'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER = 'application/vnd.google-apps.folder'

export interface DriveFile {
  id: string
  name?: string
  webViewLink?: string
  thumbnailLink?: string
  mimeType?: string
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getGoogleAccessToken([DRIVE_SCOPE])
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`Drive ${res.status}: ${await res.text()}`)
  return res
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Tìm thư mục con theo tên trong parent; chưa có thì tạo */
export async function ensureFolder(parentId: string, name: string): Promise<string> {
  const q = `'${escapeQuery(parentId)}' in parents and name = '${escapeQuery(name)}' and mimeType = '${FOLDER}' and trashed = false`
  const params = new URLSearchParams({
    q,
    fields: 'files(id)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'allDrives',
  })
  const found = await (await driveFetch(`${API}/files?${params}`)).json()
  if (found.files?.[0]?.id) return found.files[0].id as string
  const created = await (
    await driveFetch(`${API}/files?supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
    })
  ).json()
  return created.id as string
}

/** Upload file nhỏ (≤ 5MB) 1 lần (multipart) */
export async function uploadSmallFile(opts: {
  parentId: string
  name: string
  mimeType: string
  data: Uint8Array
  description?: string
}): Promise<DriveFile> {
  const boundary = `mita${crypto.randomUUID()}`
  const meta = JSON.stringify({
    name: opts.name,
    parents: [opts.parentId],
    description: opts.description,
  })
  const enc = new TextEncoder()
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`,
  )
  const tail = enc.encode(`\r\n--${boundary}--`)
  const body = new Uint8Array(head.length + opts.data.length + tail.length)
  body.set(head, 0)
  body.set(opts.data, head.length)
  body.set(tail, head.length + opts.data.length)

  const res = await driveFetch(
    `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,thumbnailLink,mimeType`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  )
  return (await res.json()) as DriveFile
}

/** "2026-09" theo giờ Việt Nam */
export function monthFolderName(date = new Date()): string {
  const vn = new Date(date.getTime() + 7 * 3600_000)
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`
}
