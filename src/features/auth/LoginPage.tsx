import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorBox } from '@/components/ui/spinner'
import { vi } from '@/i18n/vi'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

export function LoginPage() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(params.get('error'))

  if (!loading && session) {
    return <Navigate to={params.get('next') ?? '/'} replace />
  }

  async function signIn() {
    setBusy(true)
    setError(null)
    const next = params.get('next') ?? '/'
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          prompt: 'select_account',
          ...(env.googleHostedDomain ? { hd: env.googleHostedDomain } : {}),
        },
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-6 p-6 pt-8 text-center">
          <img src="/favicon.svg" alt="" className="size-16" />
          <div>
            <h1 className="text-2xl font-bold">{vi.appName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{vi.auth.loginSubtitle}</p>
          </div>
          {error && <ErrorBox error={new Error(error)} />}
          <Button size="lg" variant="outline" className="w-full" onClick={signIn} disabled={busy}>
            <GoogleIcon />
            {busy ? vi.auth.signingIn : vi.auth.loginWithGoogle}
          </Button>
          <p className="text-xs text-muted-foreground">
            {vi.auth.loginHint(env.googleHostedDomain)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
