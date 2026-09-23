// Quyền thư viện (khớp fn_can_approve_library / fn_can_view_drive trong DB)
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { type Caller, getSetting, HttpError } from './auth.ts'
import { ensureFolder } from './drive.ts'
import { PENDING_FOLDER, type SharedDrive } from './library-paths.ts'

export function isSharedDrive(v: unknown): v is SharedDrive {
  return v === 'library' || v === 'sales_private'
}

export function canViewDrive(caller: Caller, drive: SharedDrive): boolean {
  if (drive === 'library') return true
  return (
    caller.role === 'manager' ||
    caller.role === 'admin' ||
    caller.teams.some((t) => t.team_id === 'sales_domestic')
  )
}

export async function canApprove(
  admin: SupabaseClient,
  caller: Caller,
  drive: SharedDrive,
): Promise<boolean> {
  if (caller.role === 'manager' || caller.role === 'admin') return true
  if (caller.role !== 'lead') return false
  const map = (await getSetting<Record<string, string[]>>(admin, 'library_approver_teams')) ?? {}
  const teams = map[drive] ?? []
  return caller.teams.some((t) => t.is_lead && teams.includes(t.team_id))
}

/** ID gốc Shared Drive từ settings.drive.folders */
export async function driveRoot(admin: SupabaseClient, drive: SharedDrive): Promise<string> {
  const folders = (await getSetting<Record<string, string>>(admin, 'drive.folders')) ?? {}
  const id = folders[drive]
  if (!id) {
    throw new HttpError(
      500,
      `Chưa cấu hình ID Shared Drive "${drive}" (Cài đặt → Thông số → drive.folders)`,
    )
  }
  return id
}

export async function pendingFolder(admin: SupabaseClient, drive: SharedDrive): Promise<string> {
  return ensureFolder(await driveRoot(admin, drive), PENDING_FOLDER)
}

/** Origin được phép cho phiên upload (phải khớp đúng origin trình duyệt) */
export function uploadOrigin(req: Request): string {
  const app = Deno.env.get('APP_ORIGIN') ?? ''
  const origin = req.headers.get('origin') ?? ''
  if (origin && (origin === app || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))
    return origin
  return app
}
