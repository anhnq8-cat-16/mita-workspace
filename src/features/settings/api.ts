import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ExtraWorkdayRow,
  HolidayRow,
  InvitationRow,
  Json,
  ProfileRow,
  Role,
  SettingRow,
  TeamRow,
  UserTeamRow,
} from '@/lib/database.types'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export interface UserWithTeams extends ProfileRow {
  teams: UserTeamRow[]
}

export const settingsKeys = {
  users: ['admin', 'users'] as const,
  invitations: ['admin', 'invitations'] as const,
  teams: ['teams'] as const,
  settings: ['settings'] as const,
}

export function useTeams() {
  return useQuery({
    queryKey: settingsKeys.teams,
    queryFn: async (): Promise<TeamRow[]> => {
      const { data, error } = await supabase.from('teams').select('*').order('name')
      throwIfError(error)
      return data ?? []
    },
    staleTime: Infinity,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: settingsKeys.users,
    queryFn: async (): Promise<UserWithTeams[]> => {
      const [{ data: profiles, error }, { data: memberships, error: e2 }] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('user_teams').select('*'),
      ])
      throwIfError(error ?? e2)
      return (profiles ?? []).map((p) => ({
        ...p,
        teams: (memberships ?? []).filter((m) => m.user_id === p.id),
      }))
    },
  })
}

export function usePendingInvitations() {
  return useQuery({
    queryKey: settingsKeys.invitations,
    queryFn: async (): Promise<InvitationRow[]> => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
      throwIfError(error)
      return data ?? []
    },
  })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: settingsKeys.users }),
      qc.invalidateQueries({ queryKey: settingsKeys.invitations }),
      qc.invalidateQueries({ queryKey: ['me'] }),
    ])
}

export interface InviteInput {
  email: string
  full_name: string
  title: string
  role: Role
  teams: string[]
  lead_teams: string[]
}

export function useInviteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (input: InviteInput) => {
      const { error } = await supabase.from('invitations').insert({
        email: input.email.trim().toLowerCase(),
        full_name: input.full_name.trim() || null,
        title: input.title.trim() || null,
        role: input.role,
        teams: input.teams,
        lead_teams: input.lead_teams.filter((t) => input.teams.includes(t)),
      })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useRevokeInvitation() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('invitations').delete().eq('email', email)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useUpdateProfile() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<ProfileRow, 'role' | 'is_active' | 'full_name' | 'title' | 'phone'>>
    }) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useSetMembership() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async ({
      userId,
      teamId,
      member,
      isLead,
    }: {
      userId: string
      teamId: string
      member: boolean
      isLead: boolean
    }) => {
      if (!member) {
        const { error } = await supabase
          .from('user_teams')
          .delete()
          .eq('user_id', userId)
          .eq('team_id', teamId)
        throwIfError(error)
        return
      }
      const { error } = await supabase
        .from('user_teams')
        .upsert({ user_id: userId, team_id: teamId, is_lead: isLead })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.settings,
    queryFn: async (): Promise<SettingRow[]> => {
      const { data, error } = await supabase.from('settings').select('*').order('key')
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Đọc 1 giá trị cài đặt (đã có cache) */
export function useSetting<T>(key: string): T | undefined {
  const { data } = useSettings()
  return data?.find((s) => s.key === key)?.value as T | undefined
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      const { error } = await supabase.from('settings').update({ value }).eq('key', key)
      throwIfError(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.settings }),
  })
}

export const calendarKeys = {
  holidays: ['holidays'] as const,
  extra: ['extra_workdays'] as const,
}

export function useHolidays() {
  return useQuery({
    queryKey: calendarKeys.holidays,
    queryFn: async (): Promise<HolidayRow[]> => {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: false })
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useExtraWorkdays() {
  return useQuery({
    queryKey: calendarKeys.extra,
    queryFn: async (): Promise<ExtraWorkdayRow[]> => {
      const { data, error } = await supabase
        .from('extra_workdays')
        .select('*')
        .order('date', { ascending: false })
      throwIfError(error)
      return data ?? []
    },
  })
}

function useInvalidateCalendar() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: calendarKeys.holidays }),
      qc.invalidateQueries({ queryKey: calendarKeys.extra }),
      qc.invalidateQueries({ queryKey: ['day'] }),
    ])
}

export function useSaveCalendarDay() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (
      input:
        | { kind: 'holiday'; date: string; name: string }
        | { kind: 'extra'; date: string; name: string; team_ids: string[] },
    ) => {
      const { error } =
        input.kind === 'holiday'
          ? await supabase.from('holidays').upsert({ date: input.date, name: input.name.trim() })
          : await supabase
              .from('extra_workdays')
              .upsert({ date: input.date, name: input.name.trim(), team_ids: input.team_ids })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteCalendarDay() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (input: { kind: 'holiday' | 'extra'; date: string }) => {
      const { error } = await supabase
        .from(input.kind === 'holiday' ? 'holidays' : 'extra_workdays')
        .delete()
        .eq('date', input.date)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}
