import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { useMe } from '@/features/auth/auth-context'
import { PlanBadge, ReportBadge } from '@/features/daily/badges'
import { LeaveForm } from '@/features/daily/LeaveForm'
import { MyComplianceCard } from '@/features/dashboard/MyComplianceCard'
import { useSetting, useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { LeaveRow, ReportStatus } from '@/lib/database.types'
import { formatDateVN, todayVN, weekdayVN } from '@/lib/date-vn'
import {
  useCancelLeave,
  useLeaveDecision,
  useMyHistory,
  useMyLeaves,
  usePendingLeaves,
  useTeamDay,
} from './api'

const t = vi.reports
type Tab = 'mine' | 'team' | 'leaves'

function leaveStatus(l: LeaveRow): keyof typeof t.leaveStatus {
  if (l.approved_at) return 'approved'
  if (l.rejected_at) return 'rejected'
  return 'pending'
}

function RowLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted">
        {children}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}

function MineTab() {
  const me = useMe()
  const history = useMyHistory(me.id)
  const scored = useSetting<string[]>('plan_required_roles') ?? ['lead', 'staff']
  return (
    <div className="grid gap-4">
      {scored.includes(me.role) && <MyComplianceCard userId={me.id} />}
      <Card>
        <CardContent className="p-0">
          {history.isPending && (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          )}
          {history.error && <ErrorBox error={history.error} />}
          {history.data?.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">{t.noHistory}</p>
          )}
          <ul>
            {history.data?.map((row) => (
              <RowLink key={row.date} to={`/bao-cao/${me.id}/${row.date}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {weekdayVN(`${row.date}T05:00:00Z`)}, {formatDateVN(row.date)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <PlanBadge prefix submitted={Boolean(row.plan)} isLate={row.plan?.is_late} />
                    <ReportBadge
                      prefix
                      submitted={Boolean(row.report?.submitted_at)}
                      status={row.report?.status as ReportStatus | undefined}
                    />
                    {(row.plan?.reviewed_at || row.report?.reviewed_at) && (
                      <Badge variant="outline">{vi.daily.reviewed}</Badge>
                    )}
                  </div>
                </div>
              </RowLink>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function PendingLeaves() {
  const me = useMe()
  const pending = usePendingLeaves(me.id, true)
  const users = useUsers()
  const decide = useLeaveDecision()
  const nameOf = (id: string) => {
    const u = users.data?.find((x) => x.id === id)
    return u?.full_name ?? u?.email ?? ''
  }
  if (!pending.data?.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.pendingLeaves}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {pending.data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{nameOf(l.user_id)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateVN(l.date)} · {vi.leaveTypes[l.type]}
                  {l.note ? ` · ${l.note}` : ''}
                </p>
              </div>
              <Button size="sm" onClick={() => decide.mutate({ id: l.id, approve: true })}>
                {t.approve}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const reason = window.prompt(t.rejectReason)
                  if (reason !== null) decide.mutate({ id: l.id, approve: false, reason })
                }}
              >
                {t.reject}
              </Button>
            </li>
          ))}
        </ul>
        <FieldError>{decide.error?.message}</FieldError>
      </CardContent>
    </Card>
  )
}

function TeamTab() {
  const [date, setDate] = useState(todayVN())
  const team = useTeamDay(date)

  return (
    <div className="grid gap-4">
      <PendingLeaves />
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t.tabs.team}</CardTitle>
          <Input
            type="date"
            className="w-auto"
            value={date}
            max={todayVN()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label={t.date}
          />
        </CardHeader>
        <CardContent className="p-0">
          {team.isPending && (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          )}
          {team.error && <ErrorBox error={team.error} />}
          {team.data?.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">{t.teamEmpty}</p>
          )}
          <ul>
            {team.data?.map((row) => (
              <RowLink key={row.user_id} to={`/bao-cao/${row.user_id}/${date}`}>
                <Avatar name={row.full_name ?? row.email} src={row.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.full_name ?? row.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <PlanBadge
                      prefix
                      submitted={Boolean(row.plan_id)}
                      isLate={row.plan_is_late}
                      onLeave={Boolean(row.leave_id)}
                      required={row.plan_required}
                    />
                    <ReportBadge
                      prefix
                      submitted={Boolean(row.report_submitted_at)}
                      status={row.report_status}
                      required={row.plan_required}
                    />
                    {row.plan_id && !row.plan_reviewed_at && (
                      <Badge variant="outline">{t.planNotReviewed}</Badge>
                    )}
                    {row.report_submitted_at && !row.report_reviewed_at && (
                      <Badge variant="outline">{t.reportNotReviewed}</Badge>
                    )}
                  </div>
                  {row.need_decision && (
                    <p className="mt-1 line-clamp-2 text-xs text-destructive">
                      {t.needDecision}: {row.need_decision}
                    </p>
                  )}
                </div>
              </RowLink>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function LeavesTab() {
  const me = useMe()
  const leaves = useMyLeaves(me.id)
  const cancel = useCancelLeave()
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t.declareLeave}</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.myLeaves}</CardTitle>
        </CardHeader>
        <CardContent>
          {leaves.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.noLeaves}</p>
          )}
          <ul className="divide-y divide-border">
            {leaves.data?.map((l) => {
              const status = leaveStatus(l)
              return (
                <li key={l.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatDateVN(l.date)} · {vi.leaveTypes[l.type]}
                    </p>
                    {(l.note || l.reject_reason) && (
                      <p className="text-xs text-muted-foreground">{l.reject_reason ?? l.note}</p>
                    )}
                  </div>
                  <Badge
                    variant={
                      status === 'approved'
                        ? 'success'
                        : status === 'rejected'
                          ? 'destructive'
                          : 'warning'
                    }
                  >
                    {t.leaveStatus[status]}
                  </Badge>
                  {status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(l.id)}>
                      {t.cancelLeave}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <FieldError>{cancel.error?.message}</FieldError>
        </CardContent>
      </Card>
    </div>
  )
}

export function ReportsPage() {
  const me = useMe()
  const [params, setParams] = useSearchParams()
  const canTeam = me.role !== 'staff'
  const raw = params.get('tab')
  const tab: Tab = raw === 'team' && canTeam ? 'team' : raw === 'leaves' ? 'leaves' : 'mine'

  const items: { value: Tab; label: string }[] = [
    { value: 'mine', label: t.tabs.mine },
    ...(canTeam ? [{ value: 'team' as const, label: t.tabs.team }] : []),
    { value: 'leaves', label: t.tabs.leaves },
  ]

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <Tabs
        value={tab}
        onChange={(next) => setParams(next === 'mine' ? {} : { tab: next }, { replace: true })}
        items={items}
      />
      {tab === 'mine' && <MineTab />}
      {tab === 'team' && <TeamTab />}
      {tab === 'leaves' && <LeavesTab />}
    </div>
  )
}
