// Edge Function `drive-upload-init`: mở phiên upload resumable vào 00_Cho-duyet.
// Trình duyệt PUT file thẳng lên Google (không qua server) – hỗ trợ file lớn, có tiến độ.
import { HttpError, requireCaller, serviceClient } from '../_shared/auth.ts'
import { json } from '../_shared/cors.ts'
import { createResumableSession } from '../_shared/drive.ts'
import { serveJson } from '../_shared/handler.ts'
import {
  canViewDrive,
  isSharedDrive,
  pendingFolder,
  uploadOrigin,
} from '../_shared/library-access.ts'

const MAX_BYTES = 2 * 1024 * 1024 * 1024 // 2GB

serveJson('drive-upload-init', async (req) => {
  const admin = serviceClient()
  const caller = await requireCaller(req, admin)
  const body = await req.json()
  const filename = String(body.filename ?? '').trim()
  const mimeType = String(body.mimeType || 'application/octet-stream')
  const size = Number(body.size)
  const drive = body.shared_drive ?? 'library'

  if (!filename) throw new HttpError(400, 'Thiếu tên file')
  if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, 'Kích thước file không hợp lệ')
  if (size > MAX_BYTES) throw new HttpError(400, 'File quá lớn (tối đa 2GB)')
  if (!isSharedDrive(drive)) throw new HttpError(400, 'Shared Drive không hợp lệ')
  if (!canViewDrive(caller, drive)) throw new HttpError(403, 'Bạn không tải lên được vào kho này')

  const parentId = await pendingFolder(admin, drive)
  const uploadUrl = await createResumableSession({
    parentId,
    name: filename.slice(0, 200),
    mimeType,
    size,
    origin: uploadOrigin(req),
    description: `Tải lên bởi ${caller.email}`,
  })
  return json({ uploadUrl })
})
