import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  FastForward,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LinkList } from '@/components/LinksEditor'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldError } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { BulkAssignForm } from '@/features/tasks/CreateTaskForms'
import { useTaskContext } from '@/features/tasks/use-task-context'
import { vi } from '@/i18n/vi'
import type { CampaignListRow, MilestoneProgressRow } from '@/lib/database.types'
import { formatDateVN, todayVN } from '@/lib/date-vn'
import { teamColor } from '@/lib/team-colors'
import { cn } from '@/lib/utils'
import { weekStart } from '@/lib/week'
import {
  useCampaignMilestones,
  useCampaigns,
  useDeleteCampaign,
  useDeleteMilestone,
  usePullForward,
  useSetMilestoneDone,
} from './api'
import { campaignWeeks, milestoneState, percent, type MilestoneState } from './campaign-rules'
import { CampaignForm, MilestoneForm } from './CampaignForms'
import { TeamChip } from './TeamChip'

const t = vi.campaigns

const STATE_VARIANT: Record<MilestoneState, 'success' | 'destructive' | 'default' | 'secondary'> = {
  done: 'success',
  late: 'destructive',
  current: 'default',
  upcoming: 'secondary',
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full', value >= 100 ? 'bg-success' : 'bg-primary')}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Danh sách
// ---------------------------------------------------------------------------
function CampaignCard({ c, onOpen }: { c: CampaignListRow; onOpen: () => void }) {
  const pct = percent(c.milestone_done, c.milestone_total)
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ borderLeftColor: teamColor(c.team_id) }}
      className="grid gap-2 rounded-xl border border-l-4 border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <TeamChip team={c.team_id} />
        <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
          {t.status[c.status]}
        </Badge>
        {c.can_pull && c.can_manage && (
          <Badge variant="success">
            <FastForward className="size-3" /> {t.pullTitle}
          </Badge>
        )}
      </div>
      <p className="font-semibold">{c.title}</p>
      {c.goal && <p className="text-sm text-muted-foreground">{c.goal}</p>}
      <p className="text-xs text-muted-foreground">
        {t.period(formatDateVN(c.start_date), formatDateVN(c.end_date))}
        {c.current_week_total > 0 && ` · ${t.thisWeek(c.current_week_done, c.current_week_total)}`}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Progress value={pct} label={c.title} />
        </div>
        <span className="text-xs font-medium tabular-nums">
          {t.progress(c.milestone_done, c.milestone_total)}
        </span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Chi tiết
// ---------------------------------------------------------------------------
function MilestoneItem({
  m,
  manage,
  onEdit,
  onAssign,
}: {
  m: MilestoneProgressRow
  manage: boolean
  onEdit: () => void
  onAssign: () => void
}) {
  const { nameOf } = useTaskContext()
  const toggle = useSetMilestoneDone()
  const remove = useDeleteMilestone()
  const state = milestoneState(m, todayVN())
  const owner = nameOf(m.owner_id)
  const Icon = m.done_at ? CheckCircle2 : Circle
  return (
    <li className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          disabled={!manage || toggle.isPending}
          aria-pressed={Boolean(m.done_at)}
          aria-label={m.done_at ? t.markUndone : t.markDone}
          title={manage ? (m.done_at ? t.markUndone : t.markDone) : t.autoDone}
          onClick={() => toggle.mutate({ id: m.id, done: !m.done_at })}
          className="-m-1 flex size-9 shrink-0 items-center justify-center rounded-full disabled:cursor-default"
        >
          <Icon className={cn('size-5', m.done_at ? 'text-success' : 'text-muted-foreground')} />
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={cn('text-sm font-medium', m.done_at && 'text-muted-foreground line-through')}
          >
            {m.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant={STATE_VARIANT[state]}>{t.state[state]}</Badge>
            <span>
              {t.milestone.due}: {formatDateVN(m.due_date)}
            </span>
            {m.task_total > 0 && <span>· {t.tasksCount(m.task_done, m.task_total)}</span>}
            {owner && (
              <span className="inline-flex items-center gap-1">
                · <Avatar name={owner} className="size-5 text-[9px]" /> {owner}
              </span>
            )}
          </div>
          {m.description && (
            <p className="mt-1 text-xs whitespace-pre-line text-muted-foreground">
              {m.description}
            </p>
          )}
          {m.links.length > 0 && (
            <div className="mt-2">
              <LinkList links={m.links} />
            </div>
          )}
        </div>
      </div>
      {manage && (
        <div className="flex flex-wrap gap-1 pl-9">
          {!m.done_at && (
            <Button size="sm" variant="outline" onClick={onAssign}>
              <UserPlus /> {t.assign}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil /> {vi.common.edit}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={remove.isPending}
            onClick={() => window.confirm(t.confirmDeleteMilestone) && remove.mutate(m.id)}
          >
            <Trash2 /> {t.delete}
          </Button>
        </div>
      )}
      <FieldError>{toggle.error?.message ?? remove.error?.message}</FieldError>
    </li>
  )
}

type Editing =
  | { kind: 'campaign' }
  | { kind: 'milestone'; week?: string; milestone?: MilestoneProgressRow }
  | { kind: 'assign'; milestone: MilestoneProgressRow }

function CampaignDetail({ c, onBack }: { c: CampaignListRow; onBack: () => void }) {
  const { nameOf } = useTaskContext()
  const milestones = useCampaignMilestones(c.id)
  const pull = usePullForward()
  const remove = useDeleteCampaign()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const list = milestones.data ?? []
  const first = list.reduce((a, m) => (m.week_start < a ? m.week_start : a), c.start_date)
  const last = list.reduce((a, m) => (m.due_date > a ? m.due_date : a), c.end_date)
  const weeks = campaignWeeks(first < c.start_date ? first : c.start_date, last)
  const thisWeek = weekStart()
  const nextPosition = list.reduce((a, m) => Math.max(a, Number(m.position)), 0) + 1
  const manage = c.can_manage
  const pct = percent(c.milestone_done, c.milestone_total)

  return (
    <div className="grid gap-4">
      <Button variant="ghost" size="sm" className="justify-self-start" onClick={onBack}>
        <ArrowLeft /> {t.back}
      </Button>

      <Card style={{ borderTopColor: teamColor(c.team_id) }} className="border-t-4">
        <CardContent className="grid gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <TeamChip team={c.team_id} />
            <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
              {t.status[c.status]}
            </Badge>
            {manage && (
              <div className="ml-auto flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing({ kind: 'campaign' })}
                >
                  <Pencil /> {vi.common.edit}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    if (!window.confirm(t.confirmDelete)) return
                    await remove.mutateAsync(c.id)
                    onBack()
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
          <h2 className="text-lg font-semibold">{c.title}</h2>
          {c.goal && (
            <p className="rounded-lg bg-primary/5 p-3 text-sm">
              <span className="block text-xs font-medium text-muted-foreground">
                {t.fields.goal}
              </span>
              {c.goal}
            </p>
          )}
          {c.description && <p className="text-sm whitespace-pre-line">{c.description}</p>}
          <p className="text-sm text-muted-foreground">
            {t.period(formatDateVN(c.start_date), formatDateVN(c.end_date))}
            {c.owner_id && ` · ${t.fields.owner}: ${nameOf(c.owner_id)}`}
          </p>
          <LinkList links={c.links} />
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Progress value={pct} label={c.title} />
            </div>
            <span className="text-sm font-medium tabular-nums">
              {t.progress(c.milestone_done, c.milestone_total)}
            </span>
          </div>
          <FieldError>{remove.error?.message}</FieldError>
        </CardContent>
      </Card>

      {c.can_pull && manage && (
        <div className="grid gap-2 rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-success">
            <FastForward className="size-5" /> {t.pullTitle}
          </p>
          <p className="text-sm">{t.pullBody}</p>
          <Button
            className="justify-self-start"
            disabled={pull.isPending}
            onClick={() =>
              pull.mutate(c.id, {
                onSuccess: (n) => {
                  setFlash(t.pulled(n))
                  setTimeout(() => setFlash(null), 4000)
                },
              })
            }
          >
            <FastForward /> {t.pull}
          </Button>
          <FieldError>{pull.error?.message}</FieldError>
        </div>
      )}
      {flash && (
        <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">
          {flash}
        </p>
      )}

      <h3 className="text-base font-semibold">{t.milestones}</h3>
      {milestones.isPending && <Spinner />}
      {milestones.error && <ErrorBox error={milestones.error} />}
      <ol className="grid gap-4">
        {weeks.map((w) => {
          const items = list.filter((m) => m.week_start === w.week_start)
          const done = items.filter((m) => m.done_at).length
          const current = w.week_start === thisWeek
          return (
            <li
              key={w.week_start}
              className={cn(
                'grid gap-2 rounded-xl border p-3',
                current ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/40',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {w.label} <span className="font-normal text-muted-foreground">· {w.range}</span>
                </p>
                {current && <Badge>{t.state.current}</Badge>}
                {items.length > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t.weekKpiDone(done, items.length)}
                  </span>
                )}
                {manage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setEditing({ kind: 'milestone', week: w.week_start })}
                  >
                    <Plus /> {t.addMilestone}
                  </Button>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.noMilestones}</p>
              ) : (
                <ul className="grid gap-2">
                  {items.map((m) => (
                    <MilestoneItem
                      key={m.id}
                      m={m}
                      manage={manage}
                      onEdit={() => setEditing({ kind: 'milestone', milestone: m })}
                      onAssign={() => setEditing({ kind: 'assign', milestone: m })}
                    />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing?.kind === 'campaign'
            ? t.edit
            : editing?.kind === 'assign'
              ? vi.tasks.bulk.forMilestone(editing.milestone.title)
              : editing?.kind === 'milestone' && editing.milestone
                ? t.editMilestone
                : t.addMilestones
        }
      >
        {editing?.kind === 'campaign' && (
          <CampaignForm campaign={c} onDone={() => setEditing(null)} />
        )}
        {editing?.kind === 'milestone' && (
          <MilestoneForm
            campaign={c}
            week={editing.week}
            milestone={editing.milestone}
            nextPosition={nextPosition}
            onDone={() => setEditing(null)}
          />
        )}
        {editing?.kind === 'assign' && (
          <BulkAssignForm
            initial={{
              team: c.team_id,
              link: `ms:${editing.milestone.id}`,
              due: editing.milestone.due_date,
            }}
            onDone={(n) => {
              setEditing(null)
              setFlash(vi.tasks.bulk.done(n))
              setTimeout(() => setFlash(null), 4000)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

/** Tab Chiến dịch trong /muc-tieu: danh sách → chi tiết (?c=<id>) */
export function CampaignsTab() {
  const { canAssignOthers } = useTaskContext()
  const [params, setParams] = useSearchParams()
  const campaigns = useCampaigns()
  const [creating, setCreating] = useState(false)
  const openId = params.get('c')
  const open = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', 'campaigns')
        if (id) next.set('c', id)
        else next.delete('c')
        return next
      },
      { replace: !id },
    )
  const current = campaigns.data?.find((c) => c.id === openId)

  if (openId && current) return <CampaignDetail c={current} onBack={() => open(null)} />

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-xl text-sm text-muted-foreground">{t.intro}</p>
        {canAssignOthers && (
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t.add}
          </Button>
        )}
      </div>
      {campaigns.isPending && <Spinner />}
      {campaigns.error && <ErrorBox error={campaigns.error} onRetry={() => campaigns.refetch()} />}
      {campaigns.data?.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {campaigns.data?.map((c) => (
          <CampaignCard key={c.id} c={c} onOpen={() => open(c.id)} />
        ))}
      </div>
      <Sheet open={creating} onClose={() => setCreating(false)} title={t.add}>
        {creating && (
          <CampaignForm
            onDone={(id) => {
              setCreating(false)
              open(id)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
