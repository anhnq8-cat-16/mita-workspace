import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { taskKeys } from '@/features/tasks/api'
import type {
  CampaignListRow,
  CampaignMilestoneRow,
  CampaignRow,
  MilestoneProgressRow,
} from '@/lib/database.types'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: ['campaigns', 'list'] as const,
  milestones: (id: string) => ['campaigns', 'milestones', id] as const,
  week: (w: string) => ['campaigns', 'week', w] as const,
  lookup: ['campaigns', 'lookup'] as const,
}

export function useCampaigns() {
  return useQuery({
    queryKey: campaignKeys.list,
    queryFn: async (): Promise<CampaignListRow[]> => {
      const { data, error } = await supabase.rpc('fn_campaigns', {})
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useCampaignMilestones(campaignId: string | null) {
  return useQuery({
    queryKey: campaignKeys.milestones(campaignId ?? ''),
    enabled: Boolean(campaignId),
    queryFn: async (): Promise<MilestoneProgressRow[]> => {
      const { data, error } = await supabase.rpc('fn_milestones', { p_campaign: campaignId })
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Mốc của 1 tuần (KPI tuần theo đầu mục) */
export function useWeekMilestones(week: string) {
  return useQuery({
    queryKey: campaignKeys.week(week),
    queryFn: async (): Promise<MilestoneProgressRow[]> => {
      const { data, error } = await supabase.rpc('fn_milestones', { p_week: week })
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Tra cứu mốc → chiến dịch (hiện tên chiến dịch trên thẻ việc, chọn mốc khi giao việc) */
export function useMilestoneLookup() {
  return useQuery({
    queryKey: campaignKeys.lookup,
    staleTime: 60_000,
    queryFn: async () => {
      const [c, m] = await Promise.all([
        supabase.from('campaigns').select('id, title, team_id, status'),
        supabase
          .from('campaign_milestones')
          .select('id, title, campaign_id, week_start, due_date, done_at')
          .order('week_start'),
      ])
      throwIfError(c.error ?? m.error)
      const campaigns = new Map((c.data ?? []).map((x) => [x.id, x]))
      return (m.data ?? [])
        .filter((x) => campaigns.get(x.campaign_id)?.status !== 'cancelled')
        .map((x) => ({
          ...x,
          campaign_title: campaigns.get(x.campaign_id)?.title ?? '',
          team_id: campaigns.get(x.campaign_id)?.team_id ?? '',
        }))
    },
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: campaignKeys.all }),
      qc.invalidateQueries({ queryKey: taskKeys.all }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
}

export type CampaignInput = Pick<
  CampaignRow,
  | 'team_id'
  | 'title'
  | 'goal'
  | 'description'
  | 'start_date'
  | 'end_date'
  | 'status'
  | 'owner_id'
  | 'links'
>

export function useSaveCampaign() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: CampaignInput }): Promise<string> => {
      const res = id
        ? await supabase.from('campaigns').update(input).eq('id', id).select('id').single()
        : await supabase.from('campaigns').insert(input).select('id').single()
      throwIfError(res.error)
      return res.data!.id
    },
    onSuccess: invalidate,
  })
}

export function useDeleteCampaign() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export type MilestoneInput = Pick<
  CampaignMilestoneRow,
  | 'campaign_id'
  | 'title'
  | 'description'
  | 'week_start'
  | 'due_date'
  | 'owner_id'
  | 'links'
  | 'position'
>

export function useSaveMilestones() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, rows }: { id?: string; rows: MilestoneInput[] }) => {
      const { error } = id
        ? await supabase.from('campaign_milestones').update(rows[0]!).eq('id', id)
        : await supabase.from('campaign_milestones').insert(rows)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useSetMilestoneDone() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from('campaign_milestones')
        .update({ done_at: done ? new Date().toISOString() : null })
        .eq('id', id)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMilestone() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_milestones').delete().eq('id', id)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function usePullForward() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (campaignId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('fn_campaign_pull_forward', {
        p_campaign: campaignId,
      })
      throwIfError(error)
      return data ?? 0
    },
    onSuccess: invalidate,
  })
}
