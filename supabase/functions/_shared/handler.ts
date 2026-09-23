// Khung chung cho function gọi từ trình duyệt: CORS, lỗi tiếng Việt
import { corsHeaders, json } from './cors.ts'
import { HttpError } from './auth.ts'

export function serveJson(name: string, handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
      return await handler(req)
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      const message = e instanceof Error ? e.message : String(e)
      if (status === 500) console.error(name, message)
      return json({ error: message }, status)
    }
  })
}
