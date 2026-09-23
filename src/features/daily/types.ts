import type {
  DailyPlanItemRow,
  DailyPlanRow,
  DailyReportItemRow,
  DailyReportRow,
  LeaveRow,
  PlanItemKind,
  ReportAmendmentRow,
  TaskStatus,
} from '@/lib/database.types'

export interface PlanItem extends DailyPlanItemRow {
  task_status: TaskStatus | null
  task_due_date: string | null
}

export interface DayPlan extends DailyPlanRow {
  items: PlanItem[]
}

export interface Amendment extends ReportAmendmentRow {
  author_name: string | null
}

export interface DayReport extends DailyReportRow {
  items: DailyReportItemRow[]
  amendments: Amendment[]
}

/** Kết quả của fn_my_day / fn_day_detail */
export interface DayDetail {
  user_id: string
  date: string
  now: string
  is_today: boolean
  is_workday: boolean
  plan_required: boolean
  leave: LeaveRow | null
  plan_min_items: number
  deadlines: {
    plan_deadline: string
    report_open: string
    report_deadline: string
    report_missed: string
  }
  plan: DayPlan | null
  report: DayReport | null
}

/** Gợi ý từ fn_plan_prefill */
export interface PrefillItem {
  source: 'carried' | 'due' | 'doing'
  task_id: string | null
  title: string
  kind: PlanItemKind
  estimate_minutes: number | null
  carried_from_item_id?: string
  from_date?: string
  due_date?: string | null
  status?: TaskStatus
}

/** Metrics của báo cáo: { team_id: { key: value } } */
export type ReportMetrics = Record<string, Record<string, number | string | null>>

export interface MetricField {
  key: string
  label: string
  type: 'number' | 'money' | 'links'
  auto?: string
}
