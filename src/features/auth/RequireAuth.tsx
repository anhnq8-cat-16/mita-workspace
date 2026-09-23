import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/spinner'
import { useAuth } from './auth-context'
import { PendingPage } from './PendingPage'

/** Chặn: chưa đăng nhập → /dang-nhap; chưa kích hoạt/bị khóa → màn hình chờ */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, me, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!session) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(next)}`} replace />
  }
  if (!me || !me.is_active) return <PendingPage />
  return <>{children}</>
}
