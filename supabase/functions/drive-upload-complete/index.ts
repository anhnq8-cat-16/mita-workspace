// Edge Function `drive-upload-complete`: xác nhận file đã nằm trong 00_Cho-duyet,
// tạo library_items trạng thái pending.
import { HttpError, requireCaller, serviceClient } from '../_shared/auth.ts'
import { json } from '../_shared/cors.ts'
import { getFile } from '../_shared/drive.ts'
import { serveJson } from '../_shared/handler.ts'
import { canViewDrive, isSharedDrive, pendingFolder } from '../_shared/library-access.ts'
import { kindFromMime, PENDING_FOLDER, type LibraryKind } from '../_shared/library-paths.ts'

const KINDS: LibraryKind[] = ['image', 'video', 'document', 'design']
const strings = (v: unknown) =>
  Array.isArray(v)
    ? v
        .map((x) => String(x).trim())
        .filter(Boolean)
        .slice(0, 20)
    : []

serveJson('drive-upload-complete', async (req) => {
  const admin = serviceClient()
  const caller = await requireCaller(req, admin)
  const body = await req.json()
  const fileId = String(body.fileId ?? '')
  const drive = body.shared_drive ?? 'library'
  if (!fileId) throw new HttpError(400, 'Thiếu fileId')
  if (!isSharedDrive(drive) || !canViewDrive(caller, drive))
    throw new HttpError(403, 'Không có quyền')

  const pending = await pendingFolder(admin, drive)
  const file = await getFile(fileId)
  if (file.trashed || !file.parents?.includes(pending)) {
    throw new HttpError(400, 'File không nằm trong thư mục chờ duyệt')
  }
  const { data: existing } = await admin
    .from('library_items')
    .select('id')
    .eq('drive_file_id', fileId)
    .maybeSingle()
  if (existing) return json({ id: existing.id })

  const kind: LibraryKind = KINDS.includes(body.kind)
    ? body.kind
    : kindFromMime(file.mimeType ?? '')
  const { data, error } = await admin
    .from('library_items')
    .insert({
      title: String(body.title || file.name || 'Tư liệu').slice(0, 200),
      description: body.description ? String(body.description).slice(0, 2000) : null,
      kind,
      drive_file_id: fileId,
      mime_type: file.mimeType ?? null,
      size_bytes: file.size ? Number(file.size) : null,
      web_view_link: file.webViewLink ?? null,
      shared_drive: drive,
      folder_path: PENDING_FOLDER,
      folder_id: pending,
      product_id: body.product_id || null,
      tags: strings(body.tags),
      channels: strings(body.channels),
      uploaded_by: caller.id,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw new HttpError(400, error.message)
  return json({ id: data.id })
})
