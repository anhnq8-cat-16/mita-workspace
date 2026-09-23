import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useMe } from '@/features/auth/auth-context'
import { useMyDay } from '@/features/daily/api'
import { PlanCard } from '@/features/daily/PlanCard'
import { DeadlineHint, PlanForm } from '@/features/daily/PlanForm'
import { ReportCard } from '@/features/daily/ReportCard'
import { vi } from '@/i18n/vi'
import { formatDateVN, weekdayVN } from '@/lib/date-vn'

export function HomePage() {
  const me = useMe()
  const day = useMyDay()
  const [planOpen, setPlanOpen] = useState(false)
  const firstName = (me.full_name ?? me.email).trim().split(/\s+/).pop() ?? ''

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div>
        <h1 className="text-xl font-semibold">{vi.home.greeting(firstName)}</h1>
        <p className="text-sm text-muted-foreground">
          {vi.home.todayIs(weekdayVN(new Date()), formatDateVN(new Date()))}
        </p>
      </div>

      {day.isPending && (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      )}
      {day.error && <ErrorBox error={day.error} onRetry={() => day.refetch()} />}

      {day.data && (
        <>
          {day.data.leave && (
            <Card>
              <CardContent className="p-4 text-sm">
                {vi.daily.onLeave(
                  vi.leaveTypes[day.data.leave.type],
                  Boolean(day.data.leave.approved_at),
                )}
              </CardContent>
            </Card>
          )}

          {day.data.plan ? (
            <>
              <PlanCard day={day.data} />
              <ReportCard day={day.data} />
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{vi.daily.planTitle}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {planOpen ? (
                  <>
                    <DeadlineHint deadline={day.data.deadlines.plan_deadline} />
                    <PlanForm day={day.data} />
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {day.data.is_workday ? vi.daily.notRequired : vi.home.notWorkday}
                    </p>
                    <Button
                      variant="secondary"
                      className="justify-self-start"
                      onClick={() => setPlanOpen(true)}
                    >
                      {vi.daily.createPlanAnyway}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
