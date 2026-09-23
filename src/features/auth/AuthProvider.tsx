import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthState, type Me } from './auth-context'

async function fetchMe(userId: string): Promise<Me | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!profile) return null
  const { data: teams, error: teamsError } = await supabase
    .from('user_teams')
    .select('*')
    .eq('user_id', userId)
  if (teamsError) throw teamsError
  return { ...profile, teams: teams ?? [] }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const meQuery = useQuery({
    queryKey: ['me', userId],
    queryFn: () => fetchMe(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  })

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      session,
      me: userId ? meQuery.data : null,
      loading: sessionLoading || (Boolean(userId) && meQuery.isPending),
      refreshMe: () => meQuery.refetch(),
      signOut,
    }),
    [session, userId, meQuery, sessionLoading, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
