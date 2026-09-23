import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useGoalTasks } from '@/features/tasks/api'
import { useTaskContext } from '@/features/tasks/use-task-context'
import { vi } from '@/i18n/vi'
import type { GoalSource, WeeklyGoalProgressRow } from '@/lib/database.types'
import { formatDateVN } from '@/lib/date-vn'
import { formatNumber, formatVND } from '@/lib/format'
import { cn } from '@/lib/utils'
import { addDays, weekStart } from '@/lib/week'
import {
  useDeleteGoal,
  useSaveGoal,
  useUpdateGoalActual,
  useWeeklyGoals,
  type GoalInput,
} from './api'
import { goalPercent } from './goal-math'

const t = vi.goals
const SOURCES: GoalSource[] = ['manual', 'auto_tasks', 'auto_orders', 'auto_leads']

function formatValue(value: number | null, unit: string | null) {
  if (value === null) return '—'
  if (unit && /vnđ|vnd|đ$/i.test(unit)) return formatVND(value)
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

function GoalForm({
  week,
  goal,
  onDone,
}: {
  week: string
  goal?: WeeklyGoalProgressRow
  onDone: () => void
}) {
  const { me, actor, people } = useTaskContext()
  const save = useSaveGoal()
  const teamOptions =
    me.role === 'lead' ? actor.ledTeams : ['sales_domestic', 'marketing', 'export']
  const [form, setForm] = useState({
    team_id: goal?.team_id ?? teamOptions[0] ?? '',
    owner_id: goal?.owner_id ?? '',
    title: goal?.title ?? '',
    metric: goal?.metric ?? '',
    target: goal?.target?.toString() ?? '',
    unit: goal?.unit ?? '',
    actual_source: goal?.actual_source ?? ('manual' as GoalSource),
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))
  const members = people.filter((u) => u.teams.some((m) => m.team_id === form.team_id))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const input: GoalInput = {
      week_start: goal?.week_start ?? week,
      team_id: form.team_id,
      owner_id: form.owner_id || null,
      title: form.title.trim(),
      metric: form.metric.trim() || null,
      target: Number(form.target.replace(/[^\d.]/g, '')),
      unit: form.unit.trim() || null,
      actual_source: form.actual_source,
    }
    await save.mutateAsync({ id: goal?.id, input })
    onDone()
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="goal-team">{t.fields.team}</Label>
          <Select
            id="goal-team"
            value={form.team_id}
            disabled={Boolean(goal)}
            onChange={(e) => {
              set('team_id', e.target.value)
              set('owner_id', '')
            }}
          >
            {teamOptions.map((id) => (
              <option key={id} value={id}>
                {vi.teams[id] ?? id}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goal-owner">{t.fields.owner}</Label>
          <Select
            id="goal-owner"
            value={form.owner_id}
            onChange={(e) => set('owner_id', e.target.value)}
          >
            <option value="">{t.teamGoal}</option>
            {members.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.email}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="goal-title">{t.fields.title}</Label>
        <Input
          id="goal-title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="goal-metric">{t.fields.metric}</Label>
        <Input
          id="goal-metric"
          value={form.metric}
          onChange={(e) => set('metric', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="goal-target">{t.fields.target}</Label>
          <Input
            id="goal-target"
            inputMode="numeric"
            value={form.target}
            onChange={(e) => set('target', e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goal-unit">{t.fields.unit}</Label>
          <Input
            id="goal-unit"
            value={form.unit}
            placeholder="khách, bài, VNĐ…"
            onChange={(e) => set('unit', e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="goal-source">{t.fields.source}</Label>
        <Select
          id="goal-source"
          value={form.actual_source}
          onChange={(e) => set('actual_source', e.target.value as GoalSource)}
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {t.sources[s]}
            </option>
          ))}
        </Select>
        {(form.actual_source === 'auto_orders' || form.actual_source === 'auto_leads') && (
          <p className="text-xs text-muted-foreground">{t.autoLater}</p>
        )}
      </div>
      <FieldError>{save.error?.message}</FieldError>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? vi.common.saving : vi.common.save}
      </Button>
    </form>
  )
}

function ActualEditor({ goal }: { goal: WeeklyGoalProgressRow }) {
  const update = useUpdateGoalActual()
  const [value, setValue] = useState(goal.actual?.toString() ?? '')
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        update.mutate({
          id: goal.id,
          actual: value === '' ? null : Number(value.replace(/[^\d.]/g, '')),
        })
      }}
    >
      <Input
        className="w-32"
        inputMode="numeric"
        aria-label={t.fields.actual}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={update.isPending}>
        {t.updateActual}
      </Button>
      <FieldError>{update.error?.message}</FieldError>
    </form>
  )
}

function GoalTasks({ goalId }: { goalId: string }) {
  const tasks = useGoalTasks(goalId, true)
  const { nameOf } = useTaskContext()
  if (tasks.isPending) return <Spinner />
  if (!tasks.data?.length) return <p className="text-xs text-muted-foreground">{t.noTasks}</p>
  return (
    <ul className="grid gap-1">
      {tasks.data.map((task) => (
        <li key={task.id} className="flex items-center gap-2 text-sm">
          <Badge variant={task.status === 'done' ? 'success' : 'secondary'}>
            {vi.taskStatus[task.status]}
          </Badge>
          <Link to={`/viec?task=${task.id}`} className="min-w-0 flex-1 truncate hover:underline">
            {task.title}
          </Link>
          <span className="text-xs text-muted-foreground">{nameOf(task.assignee_id)}</span>
        </li>
      ))}
    </ul>
  )
}

function GoalCard({ goal, onEdit }: { goal: WeeklyGoalProgressRow; onEdit: () => void }) {
  const { actor, me, nameOf } = useTaskContext()
  const remove = useDeleteGoal()
  const [showTasks, setShowTasks] = useState(false)
  const canManage =
    me.role === 'manager' || me.role === 'admin' || actor.ledTeams.includes(goal.team_id)
  const percent = goalPercent(goal.actual, goal.target)
  const pending =
    goal.actual === null && goal.actual_source !== 'manual' && goal.actual_source !== 'auto_tasks'

  return (
    <li className="grid gap-2 border-b border-border p-4 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{goal.title}</p>
          <p className="text-xs text-muted-foreground">
            {goal.owner_id ? nameOf(goal.owner_id) : t.teamGoal}
            {goal.metric ? ` · ${goal.metric}` : ''} · {t.sources[goal.actual_source]}
          </p>
        </div>
        <Badge
          variant={
            goal.status === 'achieved'
              ? 'success'
              : goal.status === 'missed'
                ? 'destructive'
                : 'secondary'
          }
        >
          {t.status[goal.status]}
        </Badge>
        {canManage && (
          <Button variant="ghost" size="icon" aria-label={t.edit} onClick={onEdit}>
            <Pencil />
          </Button>
        )}
        {me.role === 'admin' && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={vi.common.delete}
            onClick={() =>
              window.confirm(`${vi.common.delete} "${goal.title}"?`) && remove.mutate(goal.id)
            }
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn('h-full rounded-full', percent >= 100 ? 'bg-success' : 'bg-primary')}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums">{percent}%</span>
      </div>
      <p className="text-sm">
        {t.fields.actual}: <strong>{formatValue(goal.actual, goal.unit)}</strong> /{' '}
        {formatValue(goal.target, goal.unit)}
        {pending && <span className="ml-2 text-xs text-muted-foreground">({t.autoLater})</span>}
      </p>
      {canManage && goal.actual_source === 'manual' && goal.status === 'open' && (
        <ActualEditor goal={goal} />
      )}
      <button
        type="button"
        className="justify-self-start text-xs font-medium text-primary"
        onClick={() => setShowTasks((v) => !v)}
      >
        {t.tasks(goal.task_done, goal.task_total)} · {showTasks ? t.hideTasks : t.showTasks}
      </button>
      {showTasks && <GoalTasks goalId={goal.id} />}
    </li>
  )
}

export function GoalsPage() {
  const { canAssignOthers } = useTaskContext()
  const [week, setWeek] = useState(weekStart())
  const goals = useWeeklyGoals(week)
  const [editing, setEditing] = useState<WeeklyGoalProgressRow | 'new' | null>(null)
  const byTeam = new Map<string, WeeklyGoalProgressRow[]>()
  for (const g of goals.data ?? []) byTeam.set(g.team_id, [...(byTeam.get(g.team_id) ?? []), g])

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        {canAssignOthers && (
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t.add}
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted p-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.prev}
          onClick={() => setWeek(addDays(week, -7))}
        >
          <ChevronLeft />
        </Button>
        <button type="button" className="text-sm font-medium" onClick={() => setWeek(weekStart())}>
          {t.week(formatDateVN(week).slice(0, 5), formatDateVN(addDays(week, 6)))}
          {week === weekStart() && ` · ${t.thisWeek}`}
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.next}
          onClick={() => setWeek(addDays(week, 7))}
        >
          <ChevronRight />
        </Button>
      </div>

      {goals.isPending && <Spinner />}
      {goals.error && <ErrorBox error={goals.error} onRetry={() => goals.refetch()} />}
      {goals.data?.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        </Card>
      )}
      {[...byTeam.entries()].map(([team, list]) => (
        <Card key={team}>
          <CardHeader>
            <CardTitle>{vi.teams[team] ?? team}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul>
              {list.map((g) => (
                <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t.add : t.edit}
      >
        {editing && (
          <GoalForm
            week={week}
            goal={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}
