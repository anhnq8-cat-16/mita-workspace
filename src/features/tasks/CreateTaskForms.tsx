import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { useMilestoneLookup } from '@/features/campaigns/api'
import { useGoalOptions } from '@/features/goals/api'
import { vi } from '@/i18n/vi'
import type { TaskPriority } from '@/lib/database.types'
import { formatDateVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import { weekStart } from '@/lib/week'
import { useCreateTasks, type NewTask } from './api'
import { PRIORITIES } from './task-rules'
import { useTaskContext } from './use-task-context'

const t = vi.tasks

/** Staff (hoặc bất kỳ ai) tự thêm việc cho mình */
export function SelfTaskForm({ onDone }: { onDone: () => void }) {
  const { me } = useTaskContext()
  const create = useCreateTasks()
  const myTeams = me.teams.map((m) => m.team_id)
  const [title, setTitle] = useState('')
  const [team, setTeam] = useState(myTeams[0] ?? '')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!title.trim()) return
        await create.mutateAsync([
          {
            title: title.trim(),
            team_id: team || null,
            assignee_id: me.id,
            due_date: due || null,
            priority,
          },
        ])
        onDone()
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="self-title">{t.fields.title}</Label>
        <Input id="self-title" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="self-team">{t.fields.team}</Label>
          <Select id="self-team" value={team} onChange={(e) => setTeam(e.target.value)}>
            {myTeams.map((id) => (
              <option key={id} value={id}>
                {vi.teams[id] ?? id}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="self-due">{t.fields.due}</Label>
          <Input id="self-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="self-priority">{t.fields.priority}</Label>
          <Select
            id="self-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {vi.priorities[p]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <FieldError>{create.error?.message}</FieldError>
      <Button type="submit" disabled={create.isPending || !title.trim()}>
        {t.newTask}
      </Button>
    </form>
  )
}

interface Row {
  key: number
  title: string
  start: string
  due: string
  priority: TaskPriority
  expected: string
}

const emptyRow = (key: number, due = ''): Row => ({
  key,
  title: '',
  start: '',
  due,
  priority: 'normal',
  expected: '',
})

export interface BulkInitial {
  team?: string
  /** 'goal:<id>' | 'ms:<id>' */
  link?: string
  due?: string
}

/** Lead/manager: nhiều việc × nhiều người trong 1 form */
export function BulkAssignForm({
  onDone,
  initial,
}: {
  onDone: (count: number) => void
  initial?: BulkInitial
}) {
  const { me, actor, assignable } = useTaskContext()
  const create = useCreateTasks()
  const teamOptions =
    me.role === 'lead' ? actor.ledTeams : ['sales_domestic', 'marketing', 'export']
  const [team, setTeam] = useState(initial?.team ?? teamOptions[0] ?? '')
  const [link, setLink] = useState(initial?.link ?? '')
  const [picked, setPicked] = useState<string[]>([])
  const [sensitive, setSensitive] = useState(false)
  const [rows, setRows] = useState<Row[]>([emptyRow(1, initial?.due)])
  const [localError, setLocalError] = useState<string | null>(null)
  const goals = useGoalOptions(team || null, weekStart())
  const milestones = useMilestoneLookup()
  const teamMilestones = (milestones.data ?? []).filter((m) => m.team_id === team && !m.done_at)

  const members = assignable.filter((u) => u.teams.some((m) => m.team_id === team))
  const filled = rows.filter((r) => r.title.trim())
  const total = filled.length * picked.length

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function submit() {
    if (!filled.length) return setLocalError(t.bulk.needTitle)
    if (!picked.length) return setLocalError(t.bulk.needPeople)
    setLocalError(null)
    const tasks: NewTask[] = filled.flatMap((r) =>
      picked.map((assignee) => ({
        title: r.title.trim(),
        team_id: team,
        assignee_id: assignee,
        start_date: r.start || null,
        due_date: r.due || null,
        priority: r.priority,
        expected_result: r.expected.trim() || null,
        weekly_goal_id: link.startsWith('goal:') ? link.slice(5) : null,
        milestone_id: link.startsWith('ms:') ? link.slice(3) : null,
        is_sensitive: sensitive,
      })),
    )
    await create.mutateAsync(tasks)
    onDone(tasks.length)
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t.bulk.hint}</p>
      <div className="grid gap-1.5">
        <Label htmlFor="bulk-team">{t.fields.team}</Label>
        <Select
          id="bulk-team"
          value={team}
          onChange={(e) => {
            setTeam(e.target.value)
            setPicked([])
            setLink('')
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
        <Label htmlFor="bulk-link">{t.fields.linkTo}</Label>
        <Select id="bulk-link" value={link} onChange={(e) => setLink(e.target.value)}>
          <option value="">{t.noGoal}</option>
          {teamMilestones.length > 0 && (
            <optgroup label={t.milestoneGroup}>
              {teamMilestones.map((m) => (
                <option key={m.id} value={`ms:${m.id}`}>
                  {m.campaign_title} · {m.title} ({formatDateVN(m.due_date).slice(0, 5)})
                </option>
              ))}
            </optgroup>
          )}
          {(goals.data ?? []).length > 0 && (
            <optgroup label={t.goalGroup}>
              {goals.data!.map((g) => (
                <option key={g.id} value={`goal:${g.id}`}>
                  {formatDateVN(g.week_start).slice(0, 5)} · {g.title}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t.bulk.people}</Label>
        <div className="flex flex-wrap gap-2">
          {members.map((u) => {
            const on = picked.includes(u.id)
            return (
              <button
                key={u.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))}
                className={cn(
                  'flex min-h-10 items-center gap-2 rounded-full border px-2 pr-3 text-sm',
                  on ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                )}
              >
                <Avatar name={u.full_name ?? u.email} src={u.avatar_url} className="size-6" />
                {u.full_name ?? u.email}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-2">
        {rows.map((r, i) => (
          <div key={r.key} className="grid gap-2 rounded-lg border border-border p-2">
            <div className="flex gap-2">
              <Input
                value={r.title}
                placeholder={`${t.fields.title} ${i + 1}`}
                aria-label={`${t.fields.title} ${i + 1}`}
                onChange={(e) => setRow(r.key, { title: e.target.value })}
              />
              {rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={vi.common.delete}
                  onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                >
                  <X />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="grid gap-1">
                <span className="text-[11px] text-muted-foreground">{t.fields.start}</span>
                <Input
                  type="date"
                  value={r.start}
                  aria-label={`${t.fields.start} ${i + 1}`}
                  onChange={(e) => setRow(r.key, { start: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <span className="text-[11px] text-muted-foreground">{t.fields.due}</span>
                <Input
                  type="date"
                  value={r.due}
                  min={r.start || undefined}
                  aria-label={`${t.fields.due} ${i + 1}`}
                  onChange={(e) => setRow(r.key, { due: e.target.value })}
                />
              </div>
              <div className="col-span-2 grid gap-1 sm:col-span-1">
                <span className="text-[11px] text-muted-foreground">{t.fields.priority}</span>
                <Select
                  value={r.priority}
                  aria-label={`${t.fields.priority} ${i + 1}`}
                  onChange={(e) => setRow(r.key, { priority: e.target.value as TaskPriority })}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {vi.priorities[p]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Input
              value={r.expected}
              placeholder={`${t.fields.expected}: ${t.fields.expectedPlaceholder.replace('Vd: ', '')}`}
              aria-label={`${t.fields.expected} ${i + 1}`}
              onChange={(e) => setRow(r.key, { expected: e.target.value })}
            />
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              emptyRow(Math.max(...prev.map((x) => x.key)) + 1, initial?.due),
            ])
          }
        >
          <Plus /> {t.bulk.addRow}
        </Button>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={sensitive}
          onChange={(e) => setSensitive(e.target.checked)}
        />
        {t.fields.sensitive}
      </label>

      <FieldError>{localError ?? create.error?.message}</FieldError>
      <Button size="lg" onClick={submit} disabled={create.isPending}>
        {t.bulk.submit(total)}
      </Button>
    </div>
  )
}
