import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json, LeaveType, PlanItemKind, TaskRow } from '@/lib/database.types'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { DayDetail, PrefillItem, ReportMetrics } from './types'

export const dailyKeys = {
  myDay: ['day', 'me'] as const,
  prefill: ['day', 'prefill'] as const,
  detail: (userId: string, date: string) => ['day', 'detail', userId, date] as const,
  team: (date: string) => ['day', 'team', date] as const,
  history: ['day', 'history'] as const,
  leaves: ['leaves'] as const,
  myOpenTasks: ['tasks', 'mine', 'open'] as const,
}

export function useMyDay() {
  return useQuery({
    queryKey: dailyKeys.myDay,
    queryFn: async (): Promise<DayDetail> => {
      const { data, error } = await supabase.rpc('fn_my_day')
      throwIfError(error)
      return data as unknown as DayDetail
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}

export function useDayDetail(userId: string, date: string) {
  return useQuery({
    queryKey: dailyKeys.detail(userId, date),
    queryFn: async (): Promise<DayDetail> => {
      const { data, error } = await supabase.rpc('fn_day_detail', { p_user: userId, p_date: date })
      throwIfError(error)
      return data as unknown as DayDetail
    },
  })
}

export function usePlanPrefill(enabled: boolean) {
  return useQuery({
    queryKey: dailyKeys.prefill,
    enabled,
    queryFn: async (): Promise<PrefillItem[]> => {
      const { data, error } = await supabase.rpc('fn_plan_prefill')
      throwIfError(error)
      return (data as unknown as PrefillItem[]) ?? []
    },
    staleTime: Infinity,
  })
}

export function useMyOpenTasks(userId: string) {
  return useQuery({
    queryKey: dailyKeys.myOpenTasks,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assignee_id', userId)
        .in('status', ['todo', 'doing', 'blocked'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(100)
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Làm mới mọi dữ liệu liên quan đến ngày làm việc */
function useInvalidateDay() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['day'] }),
      qc.invalidateQueries({ queryKey: ['tasks'] }),
      qc.invalidateQueries({ queryKey: dailyKeys.leaves }),
    ])
}

export function useSubmitPlan() {
  const invalidate = useInvalidateDay()
  return useMutation({
    mutationFn: async (input: { items: Json; routePlan: string; note: string }) => {
      const { error } = await supabase.rpc('fn_submit_daily_plan', {
        p_items: input.items,
        p_route_plan: input.routePlan || null,
        p_note: input.note || null,
      })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useAddPlanItem() {
  const invalidate = useInvalidateDay()
  return useMutation({
    mutationFn: async (input: {
      title: string
      kind: PlanItemKind
      taskId?: string | null
      estimate?: number | null
    }) => {
      const { error } = await supabase.rpc('fn_add_plan_item', {
        p_title: input.title,
        p_kind: input.kind,
        p_task_id: input.taskId ?? null,
        p_estimate_minutes: input.estimate ?? null,
      })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useRemovePlanItem() {
  const invalidate = useInvalidateDay()
  return useMutation({
    mutationFn: async (input: { itemId: string; reason?: string | null }) => {
      const { error } = await supabase.rpc('fn_remove_plan_item', {
        p_item: input.itemId,
        p_reason: input.reason ?? null,
      })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useUpdatePlanMeta() {
  const invalidate = useInvalidateDay()
  return useMutation({
    mutationFn: async (input: { routePlan: string; note: string }) => {
      const { error } = await supabase.rpc('fn_update_plan_meta', {
        p_route_plan: input.routePlan || null,
        p_note: input.note || null,
      })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export interface ReportInput {
  items: { plan_item_id: string; result: string; reason: string | null }[]
  metrics: ReportMetrics
  blockers: string
  needDecision: string
  tomorrowNote: string
}

export function useSubmitReport() {
  const invalidate = useInvalidateDay()
  return useMutation({
    mutationFn: async (input: ReportInput) => {
      const { error } = await supabase.rpc('fn_submit_daily_report', {
        p_items: input.items as unknown as Json,
        p_metrics: input.metrics as unknown as Json,
        p_blockers: input.blockers || null,
        p_need_decision: input.needDecision || null,
        p_tomorrow_note: input.tomorrowNote || null,
      })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useAddAmendment() {
  const invalidate = useInvalidateDay()
  return useMutation({
    mutationFn: async (input: { reportId: string; body: string }) => {
      const { error } = await supabase
        .from('report_amendments')
        .insert({ report_id: input.reportId, body: input.body.trim() })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useDeclareLeave() {
  const invalidate = useInvalidateDay()
  return useMutation({
    mutationFn: async (input: { userId: string; date: string; type: LeaveType; note: string }) => {
      const { error } = await supabase.from('leaves').insert({
        user_id: input.userId,
        date: input.date,
        type: input.type,
        note: input.note.trim() || null,
      })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useReview() {
  const invalidate = useInvalidateDay()
  return useMutation({
    mutationFn: async (input: { kind: 'plan' | 'report'; id: string; comment: string }) => {
      const { error } =
        input.kind === 'plan'
          ? await supabase.rpc('fn_review_plan', {
              p_plan: input.id,
              p_comment: input.comment || null,
            })
          : await supabase.rpc('fn_review_report', {
              p_report: input.id,
              p_comment: input.comment || null,
            })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

/** Số liệu trong ngày để tự điền báo cáo (Sale: check-in, lead, báo giá, đơn; MKT: lead, chờ duyệt) */
export function useReportAutofill() {
  return useQuery({
    queryKey: ['day', 'autofill'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_report_autofill', {})
      throwIfError(error)
      return (data ?? {}) as Record<string, Record<string, number>>
    },
    staleTime: 0,
  })
}
