// Edge Function `drive-move`: duyệt (chuyển file vào thư mục đích) hoặc từ chối tư liệu.
import { HttpError, requireCaller, serviceClient } from '../_shared/auth.ts'
import { json } from '../_shared/cors.ts'
import { ensurePath, getFile, moveFile } from '../_shared/drive.ts'
import { serveJson } from '../_shared/handler.ts'
import { canApprove, driveRoot } from '../_shared/library-access.ts'
import { type Section, targetPath } from '../_shared/library-paths.ts'

serveJson('drive-move', async (req) => {
  const admin = serviceClient()
  const caller = await requireCaller(req, admin)
  const body = await req.json()
  const { data: item } = await admin
    .from('library_items')
    .select('*')
    .eq('id', String(body.itemId ?? ''))
    .maybeSingle()
  if (!item) throw new HttpError(404, 'Không tìm thấy tư liệu')
  if (!(await canApprove(admin, caller, item.shared_drive))) {
    throw new HttpError(403, 'Bạn không có quyền duyệt tư liệu này')
  }

  if (body.action === 'reject') {
    const reason = String(body.reason ?? '').trim()
    if (!reason) throw new HttpError(400, 'Cần lý do từ chối')
    const { error } = await admin
      .from('library_items')
      .update({
        status: 'rejected',
        reject_reason: reason,
        approved_by: caller.id,
        approved_at: null,
      })
      .eq('id', item.id)
    if (error) throw new HttpError(400, error.message)
    return json({ ok: true })
  }
  if (body.action !== 'approve') throw new HttpError(400, 'Thao tác không hợp lệ')

  let folderPath: string | null = item.folder_path
  let folderId: string | null = item.folder_id
  let webViewLink: string | null = item.web_view_link
  if (item.drive_file_id) {
    let productLine: string | null = null
    if (item.product_id) {
      const { data: p } = await admin
        .from('products')
        .select('line')
        .eq('id', item.product_id)
        .maybeSingle()
      productLine = p?.line ?? null
    }
    let path: string[]
    try {
      path = targetPath({
        drive: item.shared_drive,
        section: body.section as Section,
        kind: item.kind,
        productLine,
        eventName: body.eventName ?? null,
        eventMonth: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7),
      })
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : String(e))
    }
    const root = await driveRoot(admin, item.shared_drive)
    folderId = await ensurePath(root, path)
    const file = await getFile(item.drive_file_id, 'id,parents,webViewLink')
    const from = (file.parents ?? []).filter((p) => p !== folderId)
    const moved = from.length ? await moveFile(item.drive_file_id, folderId, from) : file
    folderPath = path.join('/')
    webViewLink = moved.webViewLink ?? webViewLink
  }

  const { error } = await admin
    .from('library_items')
    .update({
      status: 'approved',
      approved_by: caller.id,
      approved_at: new Date().toISOString(),
      reject_reason: null,
      folder_path: folderPath,
      folder_id: folderId,
      web_view_link: webViewLink,
    })
    .eq('id', item.id)
  if (error) throw new HttpError(400, error.message)
  return json({ ok: true, folderPath })
})
