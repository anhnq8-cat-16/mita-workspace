import { LogOut } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorBox, FullPageSpinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import { formatDateVN, weekdayVN } from '@/lib/date-vn'
import { useMyDay } from './api'
import { gateBlocks } from './day-status'
import { LeaveForm } from './LeaveForm'
import { DeadlineHint, PlanForm } from './PlanForm'
import type { DayDetail } from './types'

const t = vi.daily

/** Màn hình toàn trang "Kế hoạch hôm nay" – không vào được màn hình khác */
function PlanGatePage({ day }: { day: DayDetail }) {
  const { signOut } = useAuth()
  const [leaveOpen, setLeaveOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
        <img src="/favicon.svg" alt="" className="size-7" />
        <span className="font-semibold">{vi.appName}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={signOut}
          aria-label={vi.auth.logout}
        >
          <LogOut /> {vi.auth.logout}
        </Button>
      </header>
      <main className="mx-auto grid w-full max-w-2xl gap-4 p-4 pb-12">
        <div>
          <h1 className="text-xl font-semibold">{t.gateTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {weekdayVN(day.now)}, {formatDateVN(day.date)} · {t.gateSubtitle}
          </p>
          <div className="mt-2">
            <DeadlineHint deadline={day.deadlines.plan_deadline} />
          </div>
        </div>
        <Card>
          <CardContent className="p-4">
            <PlanForm day={day} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {leaveOpen ? (
              <LeaveForm fixedDate={day.date} />
            ) : (
              <Button variant="link" className="w-full" onClick={() => setLeaveOpen(true)}>
                {t.declareLeave}
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

/** Cổng kế hoạch ngày: chặn toàn bộ ứng dụng cho đến khi nộp kế hoạch hôm nay */
export function DailyGate({ children }: { children: ReactNode }) {
  const day = useMyDay()
  if (day.isPending) return <FullPageSpinner />
  if (day.error) {
    return (
      <div className="mx-auto max-w-md p-4">
        <ErrorBox error={day.error} onRetry={() => day.refetch()} />
      </div>
    )
  }
  if (gateBlocks(day.data)) return <PlanGatePage day={day.data} />
  return <>{children}</>
}
