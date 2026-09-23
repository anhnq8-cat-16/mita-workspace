import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { vi } from '@/i18n/vi'
import type { TaskPriority } from '@/lib/database.types'
import { cn } from '@/lib/utils'
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
  due: string
  priority: TaskPriority
}

/** Lead/manager: nhiều việc × nhiều người trong 1 form */
export function BulkAssignForm({ onDone }: { onDone: (count: number) => void }) {
  const { me, actor, assignable } = useTaskContext()
  const create = useCreateTasks()
  const teamOptions =
    me.role === 'lead' ? actor.ledTeams : ['sales_domestic', 'marketing', 'export']
  const [team, setTeam] = useState(teamOptions[0] ?? '')
  const [picked, setPicked] = useState<string[]>([])
  const [sensitive, setSensitive] = useState(false)
  const [rows, setRows] = useState<Row[]>([{ key: 1, title: '', due: '', priority: 'normal' }])
  const [localError, setLocalError] = useState<string | null>(null)

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
        due_date: r.due || null,
        priority: r.priority,
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
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={r.due}
                aria-label={t.fields.due}
                onChange={(e) => setRow(r.key, { due: e.target.value })}
              />
              <Select
                value={r.priority}
                aria-label={t.fields.priority}
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
        ))}
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                key: Math.max(...prev.map((x) => x.key)) + 1,
                title: '',
                due: '',
                priority: 'normal',
              },
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
