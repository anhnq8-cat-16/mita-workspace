/**
 * Kiểu dữ liệu Postgres cho Supabase client.
 * Khi có Supabase CLI: `npx supabase gen types typescript --local > src/lib/database.types.ts`
 * (hiện viết tay cho các bảng của M0, cập nhật theo từng milestone).
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Role = 'admin' | 'manager' | 'lead' | 'staff'
export type TeamId = 'sales_domestic' | 'marketing' | 'export'
export type LeaveType = 'nghi_phep' | 'cong_tac' | 'om' | 'khac'
export type AuditAction = 'insert' | 'update' | 'delete'

type Table<Row, Required extends keyof Row = never> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: []
}

export type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: Role
  is_active: boolean
  activated_at: string | null
  title: string | null
  created_at: string
  updated_at: string
}

export type TeamRow = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type UserTeamRow = {
  user_id: string
  team_id: string
  is_lead: boolean
  created_at: string
}

export type InvitationRow = {
  email: string
  full_name: string | null
  role: Role
  teams: string[]
  lead_teams: string[]
  title: string | null
  invited_by: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export type SettingRow = {
  key: string
  value: Json
  description: string | null
  updated_by: string | null
  updated_at: string
}

export type HolidayRow = {
  date: string
  name: string
  created_at: string
  updated_at: string
}

export type LeaveRow = {
  id: string
  user_id: string
  date: string
  type: LeaveType
  note: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export type NotificationRow = {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
  updated_at: string
}

export type AuditLogRow = {
  id: string
  table_name: string
  row_id: string | null
  action: AuditAction
  actor_id: string | null
  diff: Json
  at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id' | 'email'>
      teams: Table<TeamRow, 'id' | 'name'>
      user_teams: Table<UserTeamRow, 'user_id' | 'team_id'>
      invitations: Table<InvitationRow, 'email'>
      settings: Table<SettingRow, 'key' | 'value'>
      holidays: Table<HolidayRow, 'date' | 'name'>
      leaves: Table<LeaveRow, 'user_id' | 'date'>
      notifications: Table<NotificationRow, 'user_id' | 'type' | 'title'>
      audit_log: Table<AuditLogRow, 'table_name' | 'action'>
    }
    Views: { [_ in never]: never }
    Functions: {
      fn_today_vn: { Args: Record<string, never>; Returns: string }
      fn_is_workday: { Args: { p_date: string }; Returns: boolean }
    }
    Enums: {
      role_enum: Role
      leave_type: LeaveType
      audit_action: AuditAction
    }
    CompositeTypes: { [_ in never]: never }
  }
}
