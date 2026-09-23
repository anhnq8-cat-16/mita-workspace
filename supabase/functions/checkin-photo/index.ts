// Edge Function `checkin-photo`: nhận ảnh check-in (đã nén ở trình duyệt), tải lên
// Shared Drive "MITA Sales Private/CheckIns/<YYYY-MM>". Trả về id + link Drive.
// Thư mục gốc lấy từ settings.drive.folders.checkins.
import { corsHeaders, json } from '../_shared/cors.ts'
import { getSetting, HttpError, requireCaller, serviceClient } from '../_shared/auth.ts'
import { ensureFolder, monthFolderName, uploadSmallFile } from '../_shared/drive.ts'

const MAX_BYTES = 5 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const admin = serviceClient()
    const caller = await requireCaller(req, admin)
    const isSales = caller.teams.some((t) => t.team_id === 'sales_domestic')
    if (!isSales && caller.role !== 'admin') throw new HttpError(403, 'Chỉ team Sale check-in')

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new HttpError(400, 'Thiếu ảnh')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new HttpError(400, 'Chỉ nhận ảnh JPEG/PNG/WebP')
    }
    if (file.size > MAX_BYTES) throw new HttpError(400, 'Ảnh quá lớn (tối đa 5MB)')

    const folders = (await getSetting<Record<string, string>>(admin, 'drive.folders')) ?? {}
    const root = folders.checkins
    if (!root) {
      throw new HttpError(
        500,
        'Chưa cấu hình thư mục CheckIns (Cài đặt → Thông số → drive.folders.checkins)',
      )
    }

    const month = await ensureFolder(root, monthFolderName())
    const stamp = new Date(Date.now() + 7 * 3600_000)
      .toISOString()
      .slice(0, 16)
      .replace(/[:T]/g, '')
    const place = String(form.get('place') ?? '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .slice(0, 60)
      .trim()
    const user = caller.email.split('@')[0]
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const uploaded = await uploadSmallFile({
      parentId: month,
      name: `${stamp}_${user}${place ? `_${place}` : ''}.${ext}`,
      mimeType: file.type,
      data: new Uint8Array(await file.arrayBuffer()),
      description: `Check-in bởi ${caller.email}`,
    })
    return json({ id: uploaded.id, webViewLink: uploaded.webViewLink })
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    const message = e instanceof Error ? e.message : String(e)
    if (status === 500) console.error('checkin-photo', message)
    return json({ error: message }, status)
  }
})
