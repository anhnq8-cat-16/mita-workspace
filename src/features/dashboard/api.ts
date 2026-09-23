import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ComplianceDetail,
  ComplianceScoreRow,
  ComplianceTrendRow,
  DashboardInbox,
  DashboardPersonRow,
  SalesSummary,
} from '@/lib/database.types'
import { useSetting } from '@/features/settings/api'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { DEFAULT_BANDS, type Bands } from './compliance'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  people: (d: string) => ['dashboard', 'people', d] as const,
  inbox: ['dashboard', 'inbox'] as const,
  scores: (from: string, to: string) => ['dashboard', 'scores', from, to] as const,
  trend: (end: string) => ['dashboard', 'trend', end] as const,
  sales: (from: string, to: string) => ['dashboard', 'sales', from, to] as const,
  myScore: (u: string, from: string, to: string) => ['dashboard', 'my-score', u, from, to] as const,
}

export function useDashboardPeople(date: string) {
  return useQuery({
    queryKey: dashboardKeys.people(date),
    queryFn: async (): Promise<DashboardPersonRow[]> => {
      const { data, error } = await supabase.rpc('fn_dashboard_people', { p_date: date })
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useDashboardInbox() {
  return useQuery({
    queryKey: dashboardKeys.inbox,
    queryFn: async (): Promise<DashboardInbox> => {
      const { data, error } = await supabase.rpc('fn_dashboard_inbox')
      throwIfError(error)
      return data!
    },
  })
}

export function useComplianceScores(from: string, to: string) {
  return useQuery({
    queryKey: dashboardKeys.scores(from, to),
    queryFn: async (): Promise<ComplianceScoreRow[]> => {
      const { data, error } = await supabase.rpc('fn_compliance_scores', { p_from: from, p_to: to })
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useComplianceTrend(end: string) {
  return useQuery({
    queryKey: dashboardKeys.trend(end),
    queryFn: async (): Promise<ComplianceTrendRow[]> => {
      const { data, error } = await supabase.rpc('fn_compliance_trend', { p_weeks: 4, p_end: end })
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useSalesSummary(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.sales(from, to),
    enabled,
    queryFn: async (): Promise<SalesSummary> => {
      const { data, error } = await supabase.rpc('fn_dashboard_sales', { p_from: from, p_to: to })
      throwIfError(error)
      return data!
    },
  })
}

/** Điểm tuân thủ của 1 người (dùng cho thẻ "Điểm của tôi") */
export function useMyCompliance(userId: string, from: string, to: string) {
  return useQuery({
    queryKey: dashboardKeys.myScore(userId, from, to),
    queryFn: async (): Promise<ComplianceDetail> => {
      const { data, error } = await supabase.rpc('fn_compliance_score', {
        p_user: userId,
        p_from: from,
        p_to: to,
      })
      throwIfError(error)
      return data!
    },
  })
}

export function useResolveEscalation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.rpc('fn_resolve_escalation', { p_id: id, p_note: note })
      throwIfError(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKeys.inbox }),
  })
}

export function useBands(): Bands {
  return useSetting<Bands>('compliance_bands') ?? DEFAULT_BANDS
}

export type Weights = { plan: number; report: number; tasks: number; off_plan: number }

export function useWeights(): Weights {
  return (
    useSetting<Weights>('compliance_weights') ?? { plan: 30, report: 30, tasks: 30, off_plan: 10 }
  )
}
