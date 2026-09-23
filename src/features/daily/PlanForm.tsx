import { Clock, Plus, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { teamIds, useMe } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import type { PlanItemKind } from '@/lib/database.types'
import { formatDateVN, formatTimeVN, todayVN } from '@/lib/date-vn'
import { formatDuration, useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { useMyOpenTasks, usePlanPrefill, useSubmitPlan } from './api'
import { KindSelect } from './KindSelect'
import {
  draftFromPrefill,
  isActive,
  isCarried,
  newKey,
  removeDraftItem,
  restoreDraftItem,
  toSubmitPayload,
  validateDraft,
  type DraftItem,
} from './plan-draft'
import type { DayDetail } from './types'

const t = vi.daily

export function DeadlineHint({ deadline }: { deadline: string }) {
  const now = useNow()
  const left = new Date(deadline).getTime() - now.getTime()
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-sm',
        left > 0 ? 'text-muted-foreground' : 'font-medium text-destructive',
      )}
    >
      <Clock className="size-4" />
      {left > 0
        ? t.deadlineLeft(formatTimeVN(deadline), formatDuration(left))
        : t.deadlinePassed(formatTimeVN(deadline))}
    </p>
  )
}

function DraftRow({
  item,
  onChange,
  onRemove,
  onRestore,
}: {
  item: DraftItem
  onChange: (patch: Partial<DraftItem>) => void
  onRemove: (reason?: string) => void
  onRestore: () => void
}) {
  const [askReason, setAskReason] = useState(false)
  const [reason, setReason] = useState('')
  const removed = !isActive(item)
  const overdue = item.due_date && item.due_date < todayVN()

  return (
    <li
      className={cn(
        'grid gap-2 border-b border-border py-3 last:border-b-0',
        removed && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {item.source === 'new' ? (
            <Input
              value={item.title}
              onChange={(e) => onChange({ title: e.target.value })}
              aria-label="Tên việc"
            />
          ) : (
            <p className={cn('pt-2 text-sm font-medium', removed && 'line-through')}>
              {item.title}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={isCarried(item) ? 'warning' : 'secondary'}>
              {t.sources[item.source]}
            </Badge>
            {item.due_date && (
              <Badge variant={overdue ? 'destructive' : 'outline'}>
                {overdue ? `${t.overdue} ` : ''}
                {formatDateVN(item.due_date)}
              </Badge>
            )}
            {removed && (
              <span className="text-xs">{t.removedWithReason(item.removed_reason!)}</span>
            )}
          </div>
        </div>
        {removed ? (
          <Button variant="ghost" size="icon" aria-label={t.restore} onClick={onRestore}>
            <RotateCcw />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={vi.common.delete}
            onClick={() => (isCarried(item) ? setAskReason(true) : onRemove())}
          >
            <X />
          </Button>
        )}
      </div>
      {!removed && (
        <div className="flex items-center gap-2">
          <KindSelect value={item.kind} onChange={(kind) => onChange({ kind })} />
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={15}
            placeholder="0"
            className="w-20"
            aria-label={t.estimate}
            value={item.estimate_minutes ?? ''}
            onChange={(e) =>
              onChange({ estimate_minutes: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
          <span className="text-sm text-muted-foreground">{t.estimate}</span>
        </div>
      )}
      {askReason && !removed && (
        <div className="grid gap-2 rounded-lg bg-muted p-3">
          <Label htmlFor={`reason-${item.key}`}>{t.removeReasonPrompt}</Label>
          <Input
            id={`reason-${item.key}`}
            value={reason}
            autoFocus
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() => {
                onRemove(reason)
                setAskReason(false)
              }}
            >
              {vi.common.delete}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAskReason(false)}>
              {vi.common.cancel}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

function PlanFormInner({ day, initial }: { day: DayDetail; initial: DraftItem[] }) {
  const me = useMe()
  const isSales = teamIds(me).includes('sales_domestic')
  const submit = useSubmitPlan()
  const openTasks = useMyOpenTasks(me.id)
  const [items, setItems] = useState<DraftItem[]>(initial)
  const [newTitle, setNewTitle] = useState('')
  const [newKind, setNewKind] = useState<PlanItemKind>('task')
  const [routePlan, setRoutePlan] = useState('')
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const activeCount = items.filter(isActive).length
  const usedTaskIds = new Set(items.map((i) => i.task_id).filter(Boolean))
  const pickable = (openTasks.data ?? []).filter((task) => !usedTaskIds.has(task.id))

  function addNew() {
    if (!newTitle.trim()) return
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        source: 'new',
        title: newTitle.trim(),
        kind: newKind,
        task_id: null,
        estimate_minutes: null,
        carried_from_item_id: null,
        removed_reason: null,
      },
    ])
    setNewTitle('')
  }

  function addExisting(taskId: string) {
    const task = openTasks.data?.find((x) => x.id === taskId)
    if (!task) return
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        source: 'existing',
        title: task.title,
        kind: 'task',
        task_id: task.id,
        estimate_minutes: task.estimate_minutes,
        carried_from_item_id: null,
        removed_reason: null,
        due_date: task.due_date,
      },
    ])
  }

  async function onSubmit() {
    const problem = validateDraft(items, day.plan_min_items)
    setLocalError(problem)
    if (problem) return
    await submit.mutateAsync({
      items: toSubmitPayload(items),
      routePlan: isSales ? routePlan : '',
      note,
    })
  }

  return (
    <div className="grid gap-4">
      <ul>
        {items.map((item) => (
          <DraftRow
            key={item.key}
            item={item}
            onChange={(patch) =>
              setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, ...patch } : i)))
            }
            onRemove={(reason) => setItems((prev) => removeDraftItem(prev, item.key, reason))}
            onRestore={() => setItems((prev) => restoreDraftItem(prev, item.key))}
          />
        ))}
      </ul>

      <div className="grid gap-2">
        <div className="flex gap-2">
          <Input
            value={newTitle}
            placeholder={t.addPlaceholder}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addNew()
              }
            }}
            aria-label={t.addPlaceholder}
          />
          <KindSelect value={newKind} onChange={setNewKind} />
          <Button size="icon" aria-label={t.addItem} onClick={addNew} disabled={!newTitle.trim()}>
            <Plus />
          </Button>
        </div>
        {pickable.length > 0 && (
          <Select
            value=""
            onChange={(e) => addExisting(e.target.value)}
            aria-label={t.pickExisting}
          >
            <option value="">{t.pickExisting}</option>
            {pickable.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
                {task.due_date ? ` · ${formatDateVN(task.due_date)}` : ''}
              </option>
            ))}
          </Select>
        )}
      </div>

      <p
        className={cn(
          'text-sm font-medium',
          activeCount >= day.plan_min_items ? 'text-success' : 'text-muted-foreground',
        )}
      >
        {t.minItems(activeCount, day.plan_min_items)}
      </p>

      {isSales && (
        <div className="grid gap-1.5">
          <Label htmlFor="route-plan">{t.routePlan}</Label>
          <Textarea
            id="route-plan"
            rows={2}
            value={routePlan}
            placeholder={t.routePlanPlaceholder}
            onChange={(e) => setRoutePlan(e.target.value)}
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="plan-note">{t.note}</Label>
        <Input id="plan-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <FieldError>{localError ?? submit.error?.message}</FieldError>
      <Button size="lg" onClick={onSubmit} disabled={submit.isPending}>
        {submit.isPending ? t.submitting : t.submitPlan}
      </Button>
    </div>
  )
}

/** Form lập kế hoạch ngày (dùng ở cổng kế hoạch và khi tự lập kế hoạch) */
export function PlanForm({ day }: { day: DayDetail }) {
  const prefill = usePlanPrefill(true)
  if (prefill.isPending) {
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    )
  }
  if (prefill.error) return <ErrorBox error={prefill.error} onRetry={() => prefill.refetch()} />
  return <PlanFormInner day={day} initial={draftFromPrefill(prefill.data)} />
}
