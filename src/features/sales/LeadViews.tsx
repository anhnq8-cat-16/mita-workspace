import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { LeadRow, LeadStage, SubmittedLeadRow } from '@/lib/database.types'
import { formatDateTimeVN, formatDateVN } from '@/lib/date-vn'
import { formatVND } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAssignLead, useSalesActor, useUpdateLead } from './api'
import { SlaBadge, StageBadge } from './badges'
import { applyLeadFilters, canWriteLead, slaState, STAGES, type LeadFilters } from './sales-rules'

const t = vi.sales

function useNames() {
  const users = useUsers()
  return (id: string | null) => {
    const u = users.data?.find((x) => x.id === id)
    return u?.full_name ?? u?.email ?? ''
  }
}

function LeadCard({
  lead,
  onOpen,
  dragging,
}: {
  lead: LeadRow
  onOpen?: () => void
  dragging?: boolean
}) {
  const nameOf = useNames()
  const overdue = slaState(lead) === 'overdue'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
      className={cn(
        'grid gap-1.5 rounded-lg border bg-card p-3 text-left text-sm shadow-sm',
        overdue ? 'border-2 border-destructive' : 'border-border',
        dragging && 'rotate-1 shadow-lg ring-2 ring-primary/40',
      )}
    >
      <p className="font-medium">{lead.name}</p>
      {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <SlaBadge lead={lead} />
        {lead.est_value_vnd ? (
          <span className="text-muted-foreground">{formatVND(lead.est_value_vnd)}</span>
        ) : null}
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          {lead.assigned_to ? (
            <>
              <Avatar name={nameOf(lead.assigned_to)} className="size-5 text-[9px]" />
              {nameOf(lead.assigned_to)}
            </>
          ) : (
            <Badge variant="warning">{t.unassigned}</Badge>
          )}
        </span>
      </div>
    </div>
  )
}

function DraggableLead({
  lead,
  disabled,
  onOpen,
}: {
  lead: LeadRow
  disabled: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, disabled })
  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-30')} {...attributes} {...listeners}>
      <LeadCard lead={lead} onOpen={onOpen} />
    </div>
  )
}

function StageColumn({
  stage,
  leads,
  children,
}: {
  stage: LeadStage
  leads: LeadRow[]
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const total = leads.reduce((s, l) => s + Number(l.est_value_vnd ?? 0), 0)
  return (
    <section
      className={cn(
        'flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-xl bg-muted/60 md:w-60',
        isOver && 'ring-2 ring-primary/40',
      )}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{vi.stages[stage]}</h3>
          <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">
            {leads.length}
          </span>
        </div>
        {total > 0 && <p className="text-xs text-muted-foreground">{formatVND(total)}</p>}
      </header>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
        {children}
      </div>
    </section>
  )
}

/** Pipeline kéo-thả theo giai đoạn */
export function LeadPipeline({
  leads,
  onOpen,
  onError,
}: {
  leads: LeadRow[]
  onOpen: (id: string) => void
  onError: (m: string) => void
}) {
  const actor = useSalesActor()
  const update = useUpdateLead()
  const [active, setActive] = useState<LeadRow | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  function onDragEnd(e: DragEndEvent) {
    setActive(null)
    const lead = leads.find((l) => l.id === e.active.id)
    const stage = e.over?.id as LeadStage | undefined
    if (!lead || !stage || stage === lead.stage) return
    if (!canWriteLead(actor, lead)) return onError(vi.tasks.dragNotAllowed)
    if (stage === 'won') {
      onOpen(lead.id)
      return onError('Bấm "Chốt đơn" trong chi tiết lead để tạo khách hàng và đơn hàng.')
    }
    if (lead.stage === 'won') return onError('Lead đã chốt không kéo được')
    if (stage === 'lost') {
      const reason = window.prompt(t.lostPrompt)?.trim()
      if (!reason) return
      update.mutate(
        { id: lead.id, patch: { stage, lost_reason: reason } },
        { onError: (err) => onError(err.message) },
      )
      return
    }
    update.mutate(
      { id: lead.id, patch: { stage, lost_reason: null } },
      { onError: (err) => onError(err.message) },
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActive(leads.find((l) => l.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:scroll-px-0 md:px-0">
        {STAGES.map((stage) => {
          const list = leads.filter((l) => l.stage === stage)
          return (
            <StageColumn key={stage} stage={stage} leads={list}>
              {list.map((l) => (
                <DraggableLead
                  key={l.id}
                  lead={l}
                  disabled={!canWriteLead(actor, l) || l.stage === 'won'}
                  onOpen={() => onOpen(l.id)}
                />
              ))}
            </StageColumn>
          )
        })}
      </div>
      <DragOverlay>{active && <LeadCard lead={active} dragging />}</DragOverlay>
    </DndContext>
  )
}

export function LeadRows({
  leads,
  onOpen,
  empty = t.emptyLeads,
}: {
  leads: LeadRow[]
  onOpen: (id: string) => void
  empty?: string
}) {
  const nameOf = useNames()
  if (leads.length === 0)
    return <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <ul>
      {leads.map((l) => (
        <li key={l.id} className="border-b border-border last:border-b-0">
          <button
            type="button"
            onClick={() => onOpen(l.id)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted',
              slaState(l) === 'overdue' && 'border-l-4 border-destructive',
            )}
          >
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium">
                  {l.name}
                  {l.company && (
                    <span className="font-normal text-muted-foreground"> · {l.company}</span>
                  )}
                </p>
                <StageBadge stage={l.stage} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <SlaBadge lead={l} />
                {l.source && <span>{l.source}</span>}
                {l.next_follow_up_at && <span>↻ {formatDateTimeVN(l.next_follow_up_at)}</span>}
                <span className="ml-auto">
                  {l.assigned_to ? nameOf(l.assigned_to) : t.unassigned}
                </span>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function LeadList({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: string) => void }) {
  const users = useUsers()
  const [f, setF] = useState<LeadFilters>({
    stage: '',
    source: '',
    assignee: '',
    overdue: false,
    followup: false,
  })
  const sources = [...new Set(leads.map((l) => l.source).filter(Boolean))] as string[]
  const assignees = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))] as string[]
  const list = applyLeadFilters(leads, f)

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <Select
          className="md:w-auto"
          aria-label={t.filters.stage}
          value={f.stage}
          onChange={(e) => setF({ ...f, stage: e.target.value })}
        >
          <option value="">
            {t.filters.stage}: {t.filters.all}
          </option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {vi.stages[s]}
            </option>
          ))}
        </Select>
        <Select
          className="md:w-auto"
          aria-label={t.filters.source}
          value={f.source}
          onChange={(e) => setF({ ...f, source: e.target.value })}
        >
          <option value="">
            {t.filters.source}: {t.filters.all}
          </option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {assignees.length > 1 && (
          <Select
            className="md:w-auto"
            aria-label={t.filters.assignee}
            value={f.assignee}
            onChange={(e) => setF({ ...f, assignee: e.target.value })}
          >
            <option value="">
              {t.filters.assignee}: {t.filters.all}
            </option>
            <option value="none">{t.unassigned}</option>
            {assignees.map((id) => (
              <option key={id} value={id}>
                {users.data?.find((u) => u.id === id)?.full_name ?? id}
              </option>
            ))}
          </Select>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={f.overdue}
            onChange={(e) => setF({ ...f, overdue: e.target.checked })}
          />
          {t.filters.overdue}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={f.followup}
            onChange={(e) => setF({ ...f, followup: e.target.checked })}
          />
          {t.filters.followup}
        </label>
      </div>
      <Card>
        <CardContent className="p-0">
          <LeadRows leads={list} onOpen={onOpen} />
        </CardContent>
      </Card>
    </div>
  )
}

/** Hàng chờ phân công (trưởng nhóm Sale) */
export function LeadQueue({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: string) => void }) {
  const users = useUsers()
  const assign = useAssignLead()
  const queue = leads.filter((l) => !l.assigned_to && l.stage !== 'won' && l.stage !== 'lost')
  const sales = (users.data ?? []).filter(
    (u) => u.is_active && u.teams.some((m) => m.team_id === 'sales_domestic'),
  )
  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {t.queueEmpty}
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul>
          {queue.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 last:border-b-0"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpen(l.id)}
              >
                <p className="text-sm font-medium">{l.name}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {l.source ?? '—'} · {formatDateVN(l.created_at)} <SlaBadge lead={l} />
                </p>
              </button>
              <Select
                className="w-40"
                value=""
                aria-label={t.assign}
                onChange={(e) =>
                  e.target.value && assign.mutate({ leadId: l.id, userId: e.target.value })
                }
              >
                <option value="">{t.assign}…</option>
                {sales.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? u.email}
                  </option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
        {assign.error && <p className="p-3 text-sm text-destructive">{assign.error.message}</p>}
      </CardContent>
    </Card>
  )
}

/** Marketing: lead mình đã gửi (chỉ trạng thái) */
export function SubmittedLeads({ rows }: { rows: SubmittedLeadRow[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {t.submittedHint}
        </p>
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">{t.submittedEmpty}</p>
        )}
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium">
                  {r.name}
                  {r.company && (
                    <span className="font-normal text-muted-foreground"> · {r.company}</span>
                  )}
                </p>
                <StageBadge stage={r.stage} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateVN(r.created_at)} · {r.source ?? '—'} · {r.assigned_name ?? t.unassigned}
                {r.phone ? ` · ${r.phone}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function ErrorFlash({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-warning bg-warning/15 p-3 text-sm"
    >
      <span className="flex-1">{message}</span>
      <Button size="sm" variant="ghost" onClick={onClose}>
        {vi.common.close}
      </Button>
    </div>
  )
}
