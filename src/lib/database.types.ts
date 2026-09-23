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
export type LeadStage =
  'new' | 'contacted' | 'consulting' | 'sample_sent' | 'quoted' | 'won' | 'lost'
export type ActivityType =
  'call' | 'zalo' | 'meeting' | 'visit' | 'email' | 'sample' | 'quote' | 'note'
export type CustomerType =
  'cafe' | 'agent' | 'retail_store' | 'corporate_gift' | 'individual' | 'fruit_b2b' | 'other'
export type CustomerStatus = 'active' | 'inactive'
export type OrderStatus = 'draft' | 'confirmed' | 'delivered' | 'cancelled'
export type ProductCategory = 'coffee' | 'accessory' | 'gift_set' | 'fruit'
export type LibraryKind = 'image' | 'video' | 'document' | 'design' | 'youtube'
export type SharedDriveKind = 'library' | 'sales_private'
export type LibraryStatus = 'pending' | 'approved' | 'rejected'

export type EscalationRow = {
  id: string
  user_id: string
  period_month: string
  level: 1 | 2
  reason: string
  task_id: string | null
  resolved_by: string | null
  resolved_at: string | null
  resolved_note: string | null
  created_at: string
  updated_at: string
}

/** Kết quả fn_compliance_score / cột detail của fn_compliance_scores (null = không có dữ liệu để tính) */
export type ComplianceDetail = {
  score: number | null
  plan: number | null
  report: number | null
  tasks: number | null
  off_plan: number | null
  plan_days: number
  report_days: number
  tasks_due: number
  tasks_done_on_time: number
  plan_items: number
  off_plan_items: number
}

export type ComplianceScoreRow = {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  teams: string[]
  score: number | null
  plan: number | null
  report: number | null
  tasks: number | null
  off_plan: number | null
  detail: ComplianceDetail
}

export type ComplianceTrendRow = { user_id: string; week_start: string; score: number | null }

export type DashboardPersonRow = {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  role: Role
  teams: string[]
  plan_required: boolean
  leave_type: LeaveType | null
  leave_approved: boolean
  plan_id: string | null
  plan_submitted_at: string | null
  plan_is_late: boolean | null
  plan_reviewed_at: string | null
  report_id: string | null
  report_status: ReportStatus | null
  report_submitted_at: string | null
  report_reviewed_at: string | null
  tasks_due: number
  tasks_overdue: number
  last_checkin_at: string | null
  last_checkin_place: string | null
  checkins: number
}

export type DashboardInbox = {
  plans: { id: string; user_id: string; name: string; date: string; is_late: boolean }[]
  reports: { id: string; user_id: string; name: string; date: string; status: ReportStatus }[]
  decisions: { id: string; user_id: string; name: string; date: string; text: string }[]
  tasks_review: {
    id: string
    title: string
    assignee_id: string | null
    name: string | null
    due_date: string | null
  }[]
  library_pending: number
  leaves_pending: { id: string; user_id: string; name: string; date: string; type: LeaveType }[]
  escalations: {
    id: string
    user_id: string
    name: string
    level: 1 | 2
    reason: string
    period_month: string
    task_id: string | null
  }[]
}

export type SalesSummary = {
  new_leads: number
  contacted_in_sla: number
  sla_due: number
  overdue_now: number
  won: number
  lost: number
  revenue: number
  revenue_month: number
  kpi_month: number
  pipeline: { stage: LeadStage; count: number; value: number }[]
  lost_reasons: { reason: string | null; count: number }[]
  by_source: { source: string; count: number }[]
}

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

export type LeadRow = {
  id: string
  name: string
  company: string | null
  contact_name: string | null
  phone: string | null
  phone_norm: string | null
  email: string | null
  zalo: string | null
  address: string | null
  district: string | null
  source: string | null
  segment: string | null
  product_interest: string[]
  stage: LeadStage
  lost_reason: string | null
  assigned_to: string | null
  created_by: string | null
  first_contact_due_at: string
  first_contacted_at: string | null
  sla_notified_at: string | null
  next_follow_up_at: string | null
  est_value_vnd: number | null
  notes: string | null
  customer_id: string | null
  won_at: string | null
  created_at: string
  updated_at: string
}

export type LeadActivityRow = {
  id: string
  lead_id: string
  user_id: string | null
  type: ActivityType
  content: string | null
  happened_at: string
  created_at: string
  updated_at: string
}

export type CustomerRow = {
  id: string
  name: string
  type: CustomerType
  contact_name: string | null
  phone: string | null
  phone_norm: string | null
  email: string | null
  address: string | null
  district: string | null
  lat: number | null
  lng: number | null
  owner_id: string | null
  status: CustomerStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrderRow = {
  id: string
  customer_id: string
  sales_id: string | null
  lead_id: string | null
  order_date: string
  total_value_vnd: number
  items_summary: string | null
  status: OrderStatus
  note: string | null
  created_at: string
  updated_at: string
}

export type CheckInRow = {
  id: string
  user_id: string
  customer_id: string | null
  lead_id: string | null
  checked_in_at: string
  lat: number
  lng: number
  accuracy_m: number | null
  photo_drive_file_id: string | null
  photo_web_link: string | null
  place_name: string | null
  note: string | null
  checked_out_at: string | null
  created_at: string
  updated_at: string
}

export type LeadDuplicateRow = {
  kind: 'lead' | 'customer'
  id: string
  name: string
  company: string | null
  stage: string
  owner_name: string | null
  matched: 'phone' | 'email' | 'company'
}

export type SubmittedLeadRow = {
  id: string
  name: string
  company: string | null
  stage: LeadStage
  source: string | null
  segment: string | null
  assigned_name: string | null
  phone: string | null
  email: string | null
  created_at: string
}

export type CustomerDirectoryRow = {
  id: string
  name: string
  district: string | null
  owner_id: string | null
  owner_name: string | null
  lat: number | null
  lng: number | null
}

export type ProductRow = {
  id: string
  sku: string
  name: string
  line: string | null
  category: ProductCategory
  origin: string | null
  flavor_notes: string | null
  pack_size_g: number | null
  retail_price_vnd: number | null
  wholesale_price_vnd: number | null
  is_active: boolean
  description: string | null
  position: number
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ProductPriceHistoryRow = {
  id: string
  product_id: string
  old_retail: number | null
  new_retail: number | null
  old_wholesale: number | null
  new_wholesale: number | null
  changed_by: string | null
  changed_at: string
}

export type LibraryItemRow = {
  id: string
  title: string
  description: string | null
  kind: LibraryKind
  drive_file_id: string | null
  youtube_url: string | null
  mime_type: string | null
  size_bytes: number | null
  web_view_link: string | null
  shared_drive: SharedDriveKind
  folder_path: string | null
  folder_id: string | null
  product_id: string | null
  tags: string[]
  channels: string[]
  status: LibraryStatus
  reject_reason: string | null
  uploaded_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
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
      leads: Table<LeadRow, 'name' | 'first_contact_due_at'>
      lead_activities: Table<LeadActivityRow, 'lead_id' | 'type'>
      customers: Table<CustomerRow, 'name'>
      orders: Table<OrderRow, 'customer_id'>
      check_ins: Table<CheckInRow, 'lat' | 'lng'>
      products: Table<ProductRow, 'sku' | 'name' | 'category'>
      product_price_history: Table<ProductPriceHistoryRow, 'product_id'>
      library_items: Table<LibraryItemRow, 'title' | 'kind'>
      escalations: Table<EscalationRow, 'user_id' | 'period_month' | 'level' | 'reason'>
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
      fn_create_lead: { Args: { p: Json; p_force?: boolean }; Returns: Json }
      fn_find_lead_duplicates: {
        Args: {
          p_phone?: string | null
          p_email?: string | null
          p_company?: string | null
          p_exclude?: string | null
        }
        Returns: LeadDuplicateRow[]
      }
      fn_assign_lead: { Args: { p_lead: string; p_user: string }; Returns: undefined }
      fn_mark_lead_won: {
        Args: {
          p_lead: string
          p_customer_id?: string | null
          p_customer?: Json | null
          p_order_value?: number | null
          p_items?: string | null
        }
        Returns: Json
      }
      fn_merge_leads: { Args: { p_keep: string; p_remove: string }; Returns: undefined }
      fn_merge_customers: { Args: { p_keep: string; p_remove: string }; Returns: undefined }
      fn_my_submitted_leads: { Args: Record<string, never>; Returns: SubmittedLeadRow[] }
      fn_customer_directory: { Args: { p_q?: string }; Returns: CustomerDirectoryRow[] }
      fn_report_autofill: { Args: { p_date?: string | null }; Returns: Json }
      fn_can_approve_library: { Args: { p_drive: SharedDriveKind }; Returns: boolean }
      fn_compliance_score: {
        Args: { p_user: string; p_from: string; p_to: string }
        Returns: ComplianceDetail
      }
      fn_compliance_scores: {
        Args: { p_from: string; p_to: string }
        Returns: ComplianceScoreRow[]
      }
      fn_compliance_trend: {
        Args: { p_weeks?: number; p_end?: string | null }
        Returns: ComplianceTrendRow[]
      }
      fn_dashboard_people: { Args: { p_date?: string | null }; Returns: DashboardPersonRow[] }
      fn_dashboard_inbox: { Args: Record<string, never>; Returns: DashboardInbox }
      fn_dashboard_sales: { Args: { p_from: string; p_to: string }; Returns: SalesSummary }
      fn_resolve_escalation: { Args: { p_id: string; p_note: string }; Returns: undefined }
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
      lead_stage: LeadStage
      activity_type: ActivityType
      customer_type: CustomerType
      customer_status: CustomerStatus
      order_status: OrderStatus
      product_category: ProductCategory
      library_kind: LibraryKind
      shared_drive_kind: SharedDriveKind
      library_status: LibraryStatus
    }
    CompositeTypes: { [_ in never]: never }
  }
}
