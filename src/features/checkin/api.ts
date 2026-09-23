import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CheckInRow, DailyPlanRow } from '@/lib/database.types'
import { vnDateTime } from '@/lib/date-vn'
import { throwIfError, UserFacingError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export const checkinKeys = {
  all: ['checkins'] as const,
  day: (date: string, userId: string | null) => ['checkins', date, userId ?? 'all'] as const,
  routes: (date: string) => ['checkins', 'routes', date] as const,
}

function dayRange(date: string) {
  return {
    from: vnDateTime(date, '00:00').toISOString(),
    to: new Date(vnDateTime(date, '00:00').getTime() + 86_400_000).toISOString(),
  }
}

/** Check-in trong 1 ngày (RLS: của mình / team / tất cả tùy vai trò) */
export function useCheckIns(date: string, userId: string | null) {
  return useQuery({
    queryKey: checkinKeys.day(date, userId),
    queryFn: async (): Promise<CheckInRow[]> => {
      const { from, to } = dayRange(date)
      let q = supabase
        .from('check_ins')
        .select('*')
        .gte('checked_in_at', from)
        .lt('checked_in_at', to)
        .order('checked_in_at')
      if (userId) q = q.eq('user_id', userId)
      const { data, error } = await q
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Lịch trình dự kiến trong kế hoạch sáng (để so với check-in thực tế) */
export function useRoutePlans(date: string, enabled: boolean) {
  return useQuery({
    queryKey: checkinKeys.routes(date),
    enabled,
    queryFn: async (): Promise<Pick<DailyPlanRow, 'user_id' | 'route_plan'>[]> => {
      const { data, error } = await supabase
        .from('daily_plans')
        .select('user_id, route_plan')
        .eq('plan_date', date)
      throwIfError(error)
      return data ?? []
    },
  })
}

export async function uploadCheckInPhoto(
  blob: Blob,
  place: string,
): Promise<{ id: string; webViewLink: string }> {
  const form = new FormData()
  form.append('file', new File([blob], 'checkin.jpg', { type: 'image/jpeg' }))
  form.append('place', place)
  const { data, error } = await supabase.functions.invoke('checkin-photo', { body: form })
  if (error) {
    // Lấy thông báo lỗi tiếng Việt từ function nếu có
    const ctx = (error as { context?: Response }).context
    const body = ctx ? await ctx.json().catch(() => null) : null
    throw new UserFacingError(body?.error ?? error.message)
  }
  return data as { id: string; webViewLink: string }
}

export interface NewCheckIn {
  customer_id: string | null
  lead_id: string | null
  lat: number
  lng: number
  accuracy_m: number
  photo_drive_file_id: string
  photo_web_link: string
  place_name: string
  note: string | null
}

export function useCreateCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewCheckIn) => {
      const { error } = await supabase.from('check_ins').insert(input)
      throwIfError(error)
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: checkinKeys.all }),
        qc.invalidateQueries({ queryKey: ['sales'] }),
      ]),
  })
}

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('check_ins')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', id)
      throwIfError(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: checkinKeys.all }),
  })
}
