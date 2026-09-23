import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Textarea } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useMe } from '@/features/auth/auth-context'
import { useDayDetail, useReview } from '@/features/daily/api'
import { PlanBadge, ReportBadge } from '@/features/daily/badges'
import { PlanItemLine, PlanMetaBlock } from '@/features/daily/PlanCard'
import { ReportContent } from '@/features/daily/ReportCard'
import { useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import { formatDateTimeVN, formatDateVN, formatTimeVN, weekdayVN } from '@/lib/date-vn'

const t = vi.reports

function ReviewBox({
  kind,
  id,
  reviewedAt,
}: {
  kind: 'plan' | 'report'
  id: string
  reviewedAt: string | null
}) {
  const review = useReview()
  const [comment, setComment] = useState('')
  return (
    <div className="grid gap-2 border-t border-border pt-3">
      {reviewedAt && (
        <p className="text-xs text-muted-foreground">
          {t.reviewedAt(formatDateTimeVN(reviewedAt))}
        </p>
      )}
      <Textarea
        rows={2}
        value={comment}
        placeholder={t.reviewPlaceholder}
        aria-label={t.reviewPlaceholder}
        onChange={(e) => setComment(e.target.value)}
      />
      <FieldError>{review.error?.message}</FieldError>
      <Button
        size="sm"
        className="justify-self-start"
        disabled={review.isPending}
        onClick={async () => {
          await review.mutateAsync({ kind, id, comment })
          setComment('')
        }}
      >
        {t.markReviewed}
      </Button>
    </div>
  )
}

/** Chi tiết 1 ngày của 1 người (kế hoạch + báo cáo) – nhân viên xem của mình, lead/manager xem & review */
export function DayDetailPage() {
  const { userId = '', date = '' } = useParams()
  const me = useMe()
  const day = useDayDetail(userId, date)
  const users = useUsers()
  const person = users.data?.find((u) => u.id === userId)
  const canReview = userId !== me.id && me.role !== 'staff'

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Link
        to={userId === me.id ? '/bao-cao' : '/bao-cao?tab=team'}
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{person?.full_name ?? person?.email ?? ''}</h1>
        {date && (
          <p className="text-sm text-muted-foreground">
            {weekdayVN(`${date}T05:00:00Z`)}, {formatDateVN(date)}
          </p>
        )}
      </div>
      {day.isPending && <Spinner />}
      {day.error && <ErrorBox error={day.error} />}
      {day.data && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>{t.plan}</CardTitle>
              <PlanBadge
                submitted={Boolean(day.data.plan)}
                isLate={day.data.plan?.is_late}
                onLeave={Boolean(day.data.leave)}
                required={day.data.plan_required}
              />
            </CardHeader>
            {day.data.plan && (
              <CardContent className="grid gap-3">
                <p className="text-xs text-muted-foreground">
                  {vi.daily.submittedAt(formatTimeVN(day.data.plan.submitted_at))}
                </p>
                <ul>
                  {day.data.plan.items.map((item) => (
                    <PlanItemLine key={item.id} item={item} />
                  ))}
                </ul>
                <PlanMetaBlock plan={day.data.plan} />
                {canReview && (
                  <ReviewBox
                    kind="plan"
                    id={day.data.plan.id}
                    reviewedAt={day.data.plan.reviewed_at}
                  />
                )}
              </CardContent>
            )}
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>{t.report}</CardTitle>
              <ReportBadge
                submitted={Boolean(day.data.report?.submitted_at)}
                status={day.data.report?.status}
                required={day.data.plan_required}
              />
            </CardHeader>
            {day.data.report?.submitted_at && (
              <CardContent className="grid gap-3">
                <p className="text-xs text-muted-foreground">
                  {formatDateTimeVN(day.data.report.submitted_at)}
                </p>
                <ReportContent day={day.data} report={day.data.report} />
                {canReview && (
                  <ReviewBox
                    kind="report"
                    id={day.data.report.id}
                    reviewedAt={day.data.report.reviewed_at}
                  />
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
