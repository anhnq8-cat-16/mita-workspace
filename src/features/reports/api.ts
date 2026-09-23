import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LeaveRow, TeamDayRow } from '@/lib/database.types'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { dailyKeys } from '@/features/daily/api'

export interface HistoryRow {
  date: string
  plan: { id: string; is_late: boolean; submitted_at: string; reviewed_at: string | null } | null
  report: {
    id: string
    status: string
    submitted_at: string | null
    reviewed_at: string | null
  } | null
}

/** Lịch sử kế hoạch/báo cáo của chính mình (60 ngày gần nhất) */
export function useMyHistory(userId: string) {
  return useQuery({
    queryKey: dailyKeys.history,
    queryFn: async (): Promise<HistoryRow[]> => {
      const [plans, reports] = await Promise.all([
        supabase
          .from('daily_plans')
          .select('id, plan_date, is_late, submitted_at, reviewed_at')
          .eq('user_id', userId)
          .order('plan_date', { ascending: false })
          .limit(60),
        supabase
          .from('daily_reports')
          .select('id, report_date, status, submitted_at, reviewed_at')
          .eq('user_id', userId)
          .order('report_date', { ascending: false })
          .limit(60),
      ])
      throwIfError(plans.error ?? reports.error)
      const map = new Map<string, HistoryRow>()
      for (const p of plans.data ?? []) {
        map.set(p.plan_date, { date: p.plan_date, plan: p, report: null })
      }
      for (const r of reports.data ?? []) {
        const row = map.get(r.report_date) ?? { date: r.report_date, plan: null, report: null }
        row.report = r
        map.set(r.report_date, row)
      }
      return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
    },
  })
}

export function useTeamDay(date: string) {
  return useQuery({
    queryKey: dailyKeys.team(date),
    queryFn: async (): Promise<TeamDayRow[]> => {
      const { data, error } = await supabase.rpc('fn_team_day', { p_date: date })
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useMyLeaves(userId: string) {
  return useQuery({
    queryKey: [...dailyKeys.leaves, 'mine'],
    queryFn: async (): Promise<LeaveRow[]> => {
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(60)
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Ngày nghỉ chờ duyệt mà người gọi có quyền duyệt (RLS giới hạn phạm vi) */
export function usePendingLeaves(myId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...dailyKeys.leaves, 'pending'],
    enabled,
    queryFn: async (): Promise<LeaveRow[]> => {
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .neq('user_id', myId)
        .is('approved_at', null)
        .is('rejected_at', null)
        .order('date')
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useLeaveDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; approve: boolean; reason?: string }) => {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('leaves')
        .update(
          input.approve
            ? { approved_at: now }
            : { rejected_at: now, reject_reason: input.reason?.trim() || null },
        )
        .eq('id', input.id)
      throwIfError(error)
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: dailyKeys.leaves }),
        qc.invalidateQueries({ queryKey: ['day'] }),
      ]),
  })
}

export function useCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leaves').delete().eq('id', id)
      throwIfError(error)
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: dailyKeys.leaves }),
        qc.invalidateQueries({ queryKey: ['day'] }),
      ]),
  })
}
