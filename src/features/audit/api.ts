import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { AuditAction, AuditLogRow, CronRunRow, OutboxRow } from '@/lib/database.types'
import { vnDateTime } from '@/lib/date-vn'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/week'

export const PAGE_SIZE = 50

export interface AuditFilters {
  table?: string
  actor?: string
  action?: AuditAction
  from?: string
  to?: string
}

/** Nhật ký thay đổi (RLS: chỉ quản lý/admin đọc được), mới nhất trước, tải thêm theo trang */
export function useAuditLog(f: AuditFilters) {
  return useInfiniteQuery({
    queryKey: ['audit', f],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<AuditLogRow[]> => {
      let q = supabase
        .from('audit_log')
        .select('*')
        .order('at', { ascending: false })
        .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1)
      if (f.table) q = q.eq('table_name', f.table)
      if (f.actor === 'system') q = q.is('actor_id', null)
      else if (f.actor) q = q.eq('actor_id', f.actor)
      if (f.action) q = q.eq('action', f.action)
      if (f.from) q = q.gte('at', vnDateTime(f.from, '00:00').toISOString())
      if (f.to) q = q.lt('at', vnDateTime(addDays(f.to, 1), '00:00').toISOString())
      const { data, error } = await q
      throwIfError(error)
      return data ?? []
    },
    getNextPageParam: (last, all) => (last.length === PAGE_SIZE ? all.length : undefined),
  })
}

/** Lịch tự động đã chạy (admin) */
export function useCronRuns(enabled: boolean) {
  return useQuery({
    queryKey: ['audit', 'cron'],
    enabled,
    queryFn: async (): Promise<CronRunRow[]> => {
      const { data, error } = await supabase
        .from('cron_runs')
        .select('*')
        .order('ran_at', { ascending: false })
        .limit(60)
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Email / Google Chat gần đây (admin) */
export function useOutbox(enabled: boolean, onlyProblems: boolean) {
  return useQuery({
    queryKey: ['audit', 'outbox', onlyProblems],
    enabled,
    queryFn: async (): Promise<OutboxRow[]> => {
      let q = supabase
        .from('outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60)
      if (onlyProblems) q = q.in('status', ['pending', 'failed'])
      const { data, error } = await q
      throwIfError(error)
      return data ?? []
    },
  })
}
