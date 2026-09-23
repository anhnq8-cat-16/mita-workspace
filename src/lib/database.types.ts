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
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type PlanItemKind = 'task' | 'visit' | 'meeting' | 'content' | 'other'
export type ReportStatus = 'on_time' | 'late' | 'missed'
export type ReportResult = 'done' | 'partial' | 'not_done'
export type GoalSource = 'manual' | 'auto_orders' | 'auto_leads' | 'auto_tasks'
export type GoalStatus = 'open' | 'achieved' | 'missed'

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
  notification_prefs: Json
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
  rejected_by: string | null
  rejected_at: string | null
  reject_reason: string | null
  created_at: string
  updated_at: string
}

export type ExtraWorkdayRow = {
  date: string
  name: string
  team_ids: string[]
  created_at: string
  updated_at: string
}

export type TaskRow = {
  id: string
  title: string
  description: string | null
  team_id: string | null
  assignee_id: string | null
  created_by: string | null
  weekly_goal_id: string | null
  status: TaskStatus
  priority: TaskPriority
  start_date: string | null
  due_date: string | null
  estimate_minutes: number | null
  position: number
  is_sensitive: boolean
  is_off_plan: boolean
  carried_over_count: number
  completed_at: string | null
  approved_by: string | null
  blocked_reason: string | null
  created_at: string
  updated_at: string
}

export type TaskChecklistItemRow = {
  id: string
  task_id: string
  text: string
  done: boolean
  position: number
  created_at: string
  updated_at: string
}

export type TaskCommentRow = {
  id: string
  task_id: string
  author_id: string
  body: string
  mentions: string[]
  created_at: string
  updated_at: string
}

export type TaskLinkRow = {
  id: string
  task_id: string
  library_item_id: string | null
  url: string | null
  label: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TaskStatusHistoryRow = {
  id: string
  task_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  changed_by: string | null
  changed_at: string
}

export type WeeklyGoalRow = {
  id: string
  week_start: string
  team_id: string
  owner_id: string | null
  title: string
  metric: string | null
  target: number
  unit: string | null
  actual: number | null
  actual_source: GoalSource
  status: GoalStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export type WeeklyGoalProgressRow = Omit<WeeklyGoalRow, 'created_at' | 'updated_at'> & {
  task_total: number
  task_done: number
}

export type DailyPlanRow = {
  id: string
  user_id: string
  plan_date: string
  submitted_at: string
  is_late: boolean
  route_plan: string | null
  note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_comment: string | null
  created_at: string
  updated_at: string
}

export type DailyPlanItemRow = {
  id: string
  plan_id: string
  task_id: string | null
  title: string
  kind: PlanItemKind
  estimate_minutes: number | null
  is_carried_over: boolean
  carried_from_item_id: string | null
  removed_reason: string | null
  is_off_plan: boolean
  position: number
  created_at: string
  updated_at: string
}

export type DailyReportRow = {
  id: string
  user_id: string
  report_date: string
  submitted_at: string | null
  status: ReportStatus
  metrics: Json
  blockers: string | null
  need_decision: string | null
  tomorrow_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_comment: string | null
  created_at: string
  updated_at: string
}

export type DailyReportItemRow = {
  id: string
  report_id: string
  plan_item_id: string | null
  task_id: string | null
  result: ReportResult
  reason: string | null
  created_at: string
  updated_at: string
}

export type ReportAmendmentRow = {
  id: string
  report_id: string
  author_id: string
  body: string
  created_at: string
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

export type TeamDayRow = {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  role: Role
  teams: string[]
  plan_required: boolean
  leave_id: string | null
  leave_type: LeaveType | null
  leave_approved: boolean | null
  plan_id: string | null
  plan_submitted_at: string | null
  plan_is_late: boolean | null
  plan_reviewed_at: string | null
  plan_item_count: number | null
  report_id: string | null
  report_status: ReportStatus | null
  report_submitted_at: string | null
  report_reviewed_at: string | null
  need_decision: string | null
  blockers: string | null
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
      extra_workdays: Table<ExtraWorkdayRow, 'date' | 'name'>
      tasks: Table<TaskRow, 'title'>
      daily_plans: Table<DailyPlanRow, 'user_id' | 'plan_date'>
      daily_plan_items: Table<DailyPlanItemRow, 'plan_id' | 'title'>
      daily_reports: Table<DailyReportRow, 'user_id' | 'report_date' | 'status'>
      daily_report_items: Table<DailyReportItemRow, 'report_id' | 'result'>
      report_amendments: Table<ReportAmendmentRow, 'report_id' | 'body'>
      task_checklist_items: Table<TaskChecklistItemRow, 'task_id' | 'text'>
      task_comments: Table<TaskCommentRow, 'task_id' | 'body'>
      task_links: Table<TaskLinkRow, 'task_id'>
      task_status_history: Table<TaskStatusHistoryRow, 'task_id' | 'to_status'>
      weekly_goals: Table<WeeklyGoalRow, 'week_start' | 'team_id' | 'title' | 'target'>
    }
    Views: { [_ in never]: never }
    Functions: {
      fn_today_vn: { Args: Record<string, never>; Returns: string }
      fn_is_workday: { Args: { p_date: string }; Returns: boolean }
      fn_my_day: { Args: Record<string, never>; Returns: Json }
      fn_day_detail: { Args: { p_user: string; p_date: string }; Returns: Json }
      fn_plan_prefill: { Args: Record<string, never>; Returns: Json }
      fn_submit_daily_plan: {
        Args: { p_items: Json; p_route_plan?: string | null; p_note?: string | null }
        Returns: string
      }
      fn_add_plan_item: {
        Args: {
          p_title: string
          p_kind?: PlanItemKind
          p_task_id?: string | null
          p_estimate_minutes?: number | null
        }
        Returns: string
      }
      fn_remove_plan_item: {
        Args: { p_item: string; p_reason?: string | null }
        Returns: undefined
      }
      fn_update_plan_meta: {
        Args: { p_route_plan: string | null; p_note: string | null }
        Returns: undefined
      }
      fn_submit_daily_report: {
        Args: {
          p_items: Json
          p_metrics?: Json
          p_blockers?: string | null
          p_need_decision?: string | null
          p_tomorrow_note?: string | null
        }
        Returns: string
      }
      fn_review_plan: { Args: { p_plan: string; p_comment?: string | null }; Returns: undefined }
      fn_review_report: {
        Args: { p_report: string; p_comment?: string | null }
        Returns: undefined
      }
      fn_team_day: { Args: { p_date?: string | null }; Returns: TeamDayRow[] }
      fn_weekly_goals: { Args: { p_week_start: string }; Returns: WeeklyGoalProgressRow[] }
    }
    Enums: {
      role_enum: Role
      leave_type: LeaveType
      audit_action: AuditAction
      task_status: TaskStatus
      task_priority: TaskPriority
      plan_item_kind: PlanItemKind
      report_status: ReportStatus
      report_result: ReportResult
      goal_source: GoalSource
      goal_status: GoalStatus
    }
    CompositeTypes: { [_ in never]: never }
  }
}
