import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GoalSource, WeeklyGoalProgressRow, WeeklyGoalRow } from '@/lib/database.types'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { taskKeys } from '@/features/tasks/api'

export const goalKeys = {
  all: ['goals'] as const,
  week: (w: string) => ['goals', 'week', w] as const,
  options: (team: string, from: string) => ['goals', 'options', team, from] as const,
}

export function useWeeklyGoals(week: string) {
  return useQuery({
    queryKey: goalKeys.week(week),
    queryFn: async (): Promise<WeeklyGoalProgressRow[]> => {
      const { data, error } = await supabase.rpc('fn_weekly_goals', { p_week_start: week })
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Mục tiêu của 1 team từ tuần `from` trở đi (để gắn việc) */
export function useGoalOptions(team: string | null, from: string) {
  return useQuery({
    queryKey: goalKeys.options(team ?? '', from),
    enabled: Boolean(team),
    queryFn: async (): Promise<WeeklyGoalRow[]> => {
      const { data, error } = await supabase
        .from('weekly_goals')
        .select('*')
        .eq('team_id', team!)
        .gte('week_start', from)
        .order('week_start')
      throwIfError(error)
      return data ?? []
    },
  })
}

export interface GoalInput {
  week_start: string
  team_id: string
  owner_id: string | null
  title: string
  metric: string | null
  target: number
  unit: string | null
  actual_source: GoalSource
}

export function useSaveGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: GoalInput }) => {
      const { error } = id
        ? await supabase.from('weekly_goals').update(input).eq('id', id)
        : await supabase.from('weekly_goals').insert(input)
      throwIfError(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  })
}

export function useUpdateGoalActual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, actual }: { id: string; actual: number | null }) => {
      const { error } = await supabase.from('weekly_goals').update({ actual }).eq('id', id)
      throwIfError(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weekly_goals').delete().eq('id', id)
      throwIfError(error)
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: goalKeys.all }),
        qc.invalidateQueries({ queryKey: taskKeys.all }),
      ]),
  })
}
