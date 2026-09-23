// Edge Function `drive-thumb`: ảnh thu nhỏ của file Drive (thư viện / ảnh check-in).
// Kiểm tra quyền bằng RLS của chính người gọi, cache 24h ở trình duyệt.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { HttpError } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { fetchThumbnail, getFile } from '../_shared/drive.ts'
import { serveJson } from '../_shared/handler.ts'

serveJson('drive-thumb', async (req) => {
  const url = new URL(req.url)
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const id = String(body.id ?? url.searchParams.get('id') ?? '')
  const size = Math.min(
    1600,
    Math.max(64, Number(body.size ?? url.searchParams.get('size') ?? 400)),
  )
  if (!/^[\w-]{10,}$/.test(id)) throw new HttpError(400, 'ID không hợp lệ')

  const auth = req.headers.get('Authorization')
  if (!auth) throw new HttpError(401, 'Chưa đăng nhập')
  // Client theo quyền người gọi: RLS quyết định có xem được file này không
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    },
  )
  const [lib, checkin] = await Promise.all([
    userClient.from('library_items').select('id').eq('drive_file_id', id).limit(1),
    userClient.from('check_ins').select('id').eq('photo_drive_file_id', id).limit(1),
  ])
  if (!lib.data?.length && !checkin.data?.length)
    throw new HttpError(404, 'Không tìm thấy hoặc không có quyền')

  const file = await getFile(id, 'id,thumbnailLink')
  if (!file.thumbnailLink) throw new HttpError(404, 'File chưa có ảnh thu nhỏ')
  const img = await fetchThumbnail(file.thumbnailLink, size)
  if (!img.ok) throw new HttpError(502, `Không tải được ảnh (${img.status})`)
  return new Response(img.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': img.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    },
  })
})
