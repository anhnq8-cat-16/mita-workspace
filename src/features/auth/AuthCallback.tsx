import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/spinner'
import { vi } from '@/i18n/vi'
import { useAuth } from './auth-context'
import { describeAuthError } from './auth-errors'

/**
 * Trang nhận redirect từ Google. Supabase client (detectSessionInUrl + PKCE) tự đổi `code`
 * lấy phiên đăng nhập; trang này chỉ chờ phiên rồi chuyển hướng.
 */
export function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const error = params.get('error_description') ?? params.get('error')
  const next = params.get('next') ?? '/'

  useEffect(() => {
    if (error) {
      navigate(`/dang-nhap?error=${encodeURIComponent(describeAuthError(error))}`, {
        replace: true,
      })
    } else if (!loading && session) {
      navigate(next.startsWith('/') ? next : '/', { replace: true })
    }
  }, [error, loading, session, navigate, next])

  useEffect(() => {
    if (error) return
    // Không nhận được phiên sau 10 giây → quay lại trang đăng nhập
    const timer = setTimeout(() => {
      navigate(`/dang-nhap?error=${encodeURIComponent(vi.auth.callbackError)}`, { replace: true })
    }, 10000)
    return () => clearTimeout(timer)
  }, [error, navigate])

  return <FullPageSpinner />
}
