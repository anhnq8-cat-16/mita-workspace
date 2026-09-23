// Xác thực JWT người gọi và lấy hồ sơ + team (Edge Function luôn kiểm tra quyền)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export interface Caller {
  id: string
  email: string
  role: 'admin' | 'manager' | 'lead' | 'staff'
  teams: { team_id: string; is_lead: boolean }[]
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function requireCaller(req: Request, admin: SupabaseClient): Promise<Caller> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Chưa đăng nhập')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ')

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!profile?.is_active) throw new HttpError(403, 'Tài khoản chưa được kích hoạt')
  const { data: teams } = await admin
    .from('user_teams')
    .select('team_id, is_lead')
    .eq('user_id', profile.id)
  return { id: profile.id, email: profile.email, role: profile.role, teams: teams ?? [] }
}

export async function getSetting<T>(admin: SupabaseClient, key: string): Promise<T | undefined> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle()
  return data?.value as T | undefined
}
