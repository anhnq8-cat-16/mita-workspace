import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { ProfileRow, UserTeamRow } from '@/lib/database.types'

export interface Me extends ProfileRow {
  teams: UserTeamRow[]
}

export interface AuthState {
  session: Session | null
  /** undefined = đang tải; null = chưa có hồ sơ */
  me: Me | null | undefined
  loading: boolean
  refreshMe: () => Promise<unknown>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return ctx
}

/** Hồ sơ người dùng đã kích hoạt (dùng bên trong các trang đã qua cổng đăng nhập) */
export function useMe(): Me {
  const { me } = useAuth()
  if (!me) throw new Error('useMe chỉ dùng sau khi đã đăng nhập')
  return me
}

export function teamIds(me: Me): string[] {
  return me.teams.map((t) => t.team_id)
}
