import { Clock, Lock } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { vi } from '@/i18n/vi'
import { useAuth } from './auth-context'

/** Màn hình cho tài khoản chưa được kích hoạt hoặc đã bị khóa */
export function PendingPage() {
  const { me, session, refreshMe, signOut } = useAuth()
  const [checking, setChecking] = useState(false)
  // Đã từng được kích hoạt mà giờ is_active = false → bị admin khóa
  const locked = Boolean(me && !me.is_active && me.activated_at)
  const Icon = locked ? Lock : Clock

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-6 pt-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-warning/20 text-warning-foreground">
            <Icon className="size-7" />
          </span>
          <h1 className="text-xl font-semibold">
            {locked ? vi.auth.lockedTitle : vi.auth.pendingTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locked ? vi.auth.lockedBody : vi.auth.pendingBody}
          </p>
          <p className="text-sm">
            {vi.auth.signedInAs} <strong>{session?.user.email}</strong>
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={checking}
              onClick={async () => {
                setChecking(true)
                await refreshMe()
                setChecking(false)
              }}
            >
              {vi.auth.checkAgain}
            </Button>
            <Button className="flex-1" variant="outline" onClick={signOut}>
              {vi.auth.logout}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
