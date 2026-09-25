import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { useMe } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import type { PlanItemKind } from '@/lib/database.types'
import { formatTimeVN } from '@/lib/date-vn'
import { useNow } from '@/lib/use-now'
import { useAddPlanItem, useMyOpenTasks, useRemovePlanItem } from './api'
import { PlanBadge } from './badges'
import { beforePlanDeadline } from './day-status'
import { KindSelect } from './KindSelect'
import type { DayDetail, DayPlan, PlanItem } from './types'

const t = vi.daily

export function PlanItemLine({ item, right }: { item: PlanItem; right?: React.ReactNode }) {
  const removed = Boolean(item.removed_reason)
  return (
    <li className="flex items-start gap-2 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className={removed ? 'text-sm text-muted-foreground line-through' : 'text-sm'}>
          {item.title}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge variant="outline">{vi.kinds[item.kind]}</Badge>
          {item.is_carried_over && <Badge variant="warning">{t.sources.carried}</Badge>}
          {item.is_off_plan && <Badge variant="destructive">{t.offPlan}</Badge>}
          {item.task_status && <Badge variant="secondary">{vi.taskStatus[item.task_status]}</Badge>}
          {item.estimate_minutes ? (
            <span className="text-xs text-muted-foreground">
              {item.estimate_minutes} {t.estimate}
            </span>
          ) : null}
          {removed && (
            <span className="text-xs text-muted-foreground">
              {t.removedWithReason(item.removed_reason!)}
            </span>
          )}
        </div>
      </div>
      {right}
    </li>
  )
}

export function PlanMetaBlock({ plan }: { plan: DayPlan }) {
  return (
    <>
      {plan.route_plan && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium">{t.routePlan}</p>
          <p className="whitespace-pre-line">{plan.route_plan}</p>
        </div>
      )}
      {plan.note && <p className="text-sm text-muted-foreground">{plan.note}</p>}
      {plan.reviewed_at && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          <p className="font-medium text-success">{t.reviewed}</p>
          {plan.review_comment && <p>{plan.review_comment}</p>}
        </div>
      )}
    </>
  )
}

function RemoveButton({ item }: { item: PlanItem }) {
  const remove = useRemovePlanItem()
  const [ask, setAsk] = useState(false)
  const [reason, setReason] = useState('')
  if (ask) {
    return (
      <div className="flex w-48 flex-col gap-1">
        <Input
          value={reason}
          placeholder={t.reasonPlaceholder}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="destructive"
            disabled={!reason.trim() || remove.isPending}
            onClick={() => remove.mutate({ itemId: item.id, reason })}
          >
            {vi.common.delete}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAsk(false)}>
            {vi.common.cancel}
          </Button>
        </div>
        <FieldError>{remove.error?.message}</FieldError>
      </div>
    )
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={vi.common.delete}
      disabled={remove.isPending}
      onClick={() => (item.is_carried_over ? setAsk(true) : remove.mutate({ itemId: item.id }))}
    >
      <X />
    </Button>
  )
}

function AddItemForm({ afterDeadline }: { afterDeadline: boolean }) {
  const me = useMe()
  const add = useAddPlanItem()
  const openTasks = useMyOpenTasks(me.id)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<PlanItemKind>('task')

  async function submit() {
    if (!title.trim()) return
    await add.mutateAsync({ title: title.trim(), kind })
    setTitle('')
  }

  return (
    <div className="grid gap-2 border-t border-border pt-3">
      {afterDeadline && <p className="text-xs text-warning-foreground">{t.offPlanWarning}</p>}
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <Input
          className="basis-full sm:basis-auto"
          value={title}
          placeholder={t.addPlaceholder}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
          }}
          aria-label={t.addPlaceholder}
        />
        <KindSelect value={kind} onChange={setKind} className="flex-1 sm:flex-none" />
        <Button size="icon" aria-label={t.addItem} onClick={submit} disabled={add.isPending}>
          <Plus />
        </Button>
      </div>
      {(openTasks.data?.length ?? 0) > 0 && (
        <Select
          value=""
          aria-label={t.pickExisting}
          onChange={(e) => {
            const task = openTasks.data?.find((x) => x.id === e.target.value)
            if (task) add.mutate({ title: task.title, kind: 'task', taskId: task.id })
          }}
        >
          <option value="">{t.pickExisting}</option>
          {openTasks.data?.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </Select>
      )}
      <FieldError>{add.error?.message}</FieldError>
    </div>
  )
}

/** Kế hoạch hôm nay đã nộp: xem, bỏ việc (trước hạn), thêm việc */
export function PlanCard({ day }: { day: DayDetail }) {
  const now = useNow()
  const plan = day.plan!
  const editable = beforePlanDeadline(day, now)

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <CardTitle className="whitespace-nowrap">{t.planTitle}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t.submittedAt(formatTimeVN(plan.submitted_at))}
          </span>
          <PlanBadge submitted isLate={plan.is_late} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {editable && (
          <Label className="text-xs font-normal text-muted-foreground">
            {t.editBeforeDeadline(formatTimeVN(day.deadlines.plan_deadline))}
          </Label>
        )}
        <ul>
          {plan.items.map((item) => (
            <PlanItemLine
              key={item.id}
              item={item}
              right={
                editable && !item.removed_reason && !day.report ? (
                  <RemoveButton item={item} />
                ) : null
              }
            />
          ))}
        </ul>
        <PlanMetaBlock plan={plan} />
        {!day.report && <AddItemForm afterDeadline={!editable} />}
      </CardContent>
    </Card>
  )
}
