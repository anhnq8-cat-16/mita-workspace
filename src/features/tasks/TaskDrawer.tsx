import { BookImage, ExternalLink, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useMilestoneLookup } from '@/features/campaigns/api'
import { useGoalOptions } from '@/features/goals/api'
import { useLibraryItems } from '@/features/library/api'
import { vi } from '@/i18n/vi'
import type { TaskRow, TaskStatus } from '@/lib/database.types'
import { formatDateTimeVN, formatDateVN } from '@/lib/date-vn'
import { addDays, weekStart } from '@/lib/week'
import {
  useChecklist,
  useChecklistMutations,
  useCommentMutations,
  useComments,
  useDeleteTask,
  useLinkMutations,
  useLinks,
  useStatusHistory,
  useTask,
  useUpdateTask,
  type TaskPatch,
} from './api'
import { MentionTextarea } from './MentionTextarea'
import { TaskMeta } from './TaskCard'
import {
  allowedStatuses,
  canEditContent,
  canManageTask,
  canWorkTask,
  extractMentions,
  positionBetween,
  PRIORITIES,
} from './task-rules'
import { useTaskContext } from './use-task-context'

const t = vi.tasks

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function StatusControl({ task }: { task: TaskRow }) {
  const { actor, requireReview } = useTaskContext()
  const update = useUpdateTask()
  const allowed = allowedStatuses(actor, task, requireReview)
  const manage = canManageTask(actor, task)

  function change(status: TaskStatus) {
    const patch: TaskPatch = { status }
    if (status === 'blocked') {
      const reason = window.prompt(t.blockedReasonPrompt)?.trim()
      if (!reason) return
      patch.blocked_reason = reason
    }
    update.mutate({ id: task.id, patch })
  }

  if (allowed.length === 0) {
    return <Badge variant="secondary">{vi.taskStatus[task.status]}</Badge>
  }
  return (
    <div className="grid gap-2">
      <Select
        aria-label={t.fields.status}
        value={task.status}
        onChange={(e) => change(e.target.value as TaskStatus)}
        disabled={update.isPending}
      >
        {allowed.map((s) => (
          <option key={s} value={s}>
            {vi.taskStatus[s]}
          </option>
        ))}
      </Select>
      {manage && task.status === 'review' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => change('done')}>
            {t.approve}
          </Button>
          <Button size="sm" variant="outline" onClick={() => change('doing')}>
            {t.returnTask}
          </Button>
        </div>
      )}
      {!manage && requireReview && task.status !== 'done' && (
        <p className="text-xs text-muted-foreground">{t.needReview}</p>
      )}
      <FieldError>{update.error?.message}</FieldError>
    </div>
  )
}

function DetailsForm({ task }: { task: TaskRow }) {
  const { actor, assignable, me } = useTaskContext()
  const update = useUpdateTask()
  const manage = canManageTask(actor, task)
  const editable = canEditContent(actor, task)
  const goals = useGoalOptions(task.team_id, addDays(weekStart(), -7))
  const milestones = useMilestoneLookup()
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    expected_result: task.expected_result ?? '',
    start_date: task.start_date ?? '',
    due_date: task.due_date ?? '',
    priority: task.priority,
    estimate_minutes: task.estimate_minutes?.toString() ?? '',
    assignee_id: task.assignee_id ?? '',
    team_id: task.team_id ?? '',
    link: task.milestone_id
      ? `ms:${task.milestone_id}`
      : task.weekly_goal_id
        ? `goal:${task.weekly_goal_id}`
        : '',
    is_sensitive: task.is_sensitive,
  })
  const teamMilestones = (milestones.data ?? []).filter(
    (m) => m.team_id === form.team_id && (!m.done_at || m.id === task.milestone_id),
  )
  const [editingDesc, setEditingDesc] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const teamOptions = manage
    ? me.role === 'lead'
      ? actor.ledTeams
      : ['sales_domestic', 'marketing', 'export']
    : []
  const assigneeOptions = assignable.filter((u) => u.teams.some((m) => m.team_id === form.team_id))

  function save() {
    const patch: TaskPatch = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      expected_result: form.expected_result.trim() || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      priority: form.priority,
      estimate_minutes: form.estimate_minutes === '' ? null : Number(form.estimate_minutes),
    }
    if (manage) {
      patch.assignee_id = form.assignee_id || null
      patch.team_id = form.team_id || null
      patch.weekly_goal_id = form.link.startsWith('goal:') ? form.link.slice(5) : null
      patch.milestone_id = form.link.startsWith('ms:') ? form.link.slice(3) : null
      patch.is_sensitive = form.is_sensitive
    }
    update.mutate({ id: task.id, patch }, { onSuccess: () => setEditingDesc(false) })
  }

  if (!editable) {
    return (
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">{task.title}</h2>
        {task.expected_result && (
          <div className="rounded-lg bg-primary/5 p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">{t.fields.expected}</p>
            <p className="whitespace-pre-line">{task.expected_result}</p>
          </div>
        )}
        {(task.start_date || task.due_date) && (
          <p className="text-sm text-muted-foreground">
            {task.start_date && `${t.fields.start}: ${formatDateVN(task.start_date)} · `}
            {task.due_date && `${t.fields.due}: ${formatDateVN(task.due_date)}`}
          </p>
        )}
        {task.description ? (
          <div className="prose-sm max-w-none text-sm [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
            <Markdown>{task.description}</Markdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.noDescription}</p>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="task-title">{t.fields.title}</Label>
        <Input id="task-title" value={form.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="task-expected">{t.fields.expected}</Label>
        <Textarea
          id="task-expected"
          rows={2}
          placeholder={t.fields.expectedPlaceholder}
          value={form.expected_result}
          onChange={(e) => set('expected_result', e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="task-desc">{t.fields.description}</Label>
          <Button variant="link" size="sm" onClick={() => setEditingDesc((v) => !v)}>
            {editingDesc ? t.preview : t.editDescription}
          </Button>
        </div>
        {editingDesc ? (
          <Textarea
            id="task-desc"
            rows={6}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        ) : form.description ? (
          <div className="rounded-lg border border-border p-3 text-sm [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
            <Markdown>{form.description}</Markdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.noDescription}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="task-start">{t.fields.start}</Label>
          <Input
            id="task-start"
            type="date"
            value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-due">{t.fields.due}</Label>
          <Input
            id="task-due"
            type="date"
            value={form.due_date}
            onChange={(e) => set('due_date', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-priority">{t.fields.priority}</Label>
          <Select
            id="task-priority"
            value={form.priority}
            onChange={(e) => set('priority', e.target.value as TaskRow['priority'])}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {vi.priorities[p]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-estimate">{t.fields.estimate}</Label>
          <Input
            id="task-estimate"
            type="number"
            inputMode="numeric"
            min={0}
            step={15}
            value={form.estimate_minutes}
            onChange={(e) => set('estimate_minutes', e.target.value)}
          />
        </div>
        {manage && (
          <div className="grid gap-1.5">
            <Label htmlFor="task-team">{t.fields.team}</Label>
            <Select
              id="task-team"
              value={form.team_id}
              onChange={(e) => {
                set('team_id', e.target.value)
                set('link', '')
              }}
            >
              {teamOptions.map((id) => (
                <option key={id} value={id}>
                  {vi.teams[id] ?? id}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      {manage && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="task-assignee">{t.fields.assignee}</Label>
            <Select
              id="task-assignee"
              value={form.assignee_id}
              onChange={(e) => set('assignee_id', e.target.value)}
            >
              <option value="">{t.unassigned}</option>
              {assigneeOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name ?? u.email}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-goal">{t.fields.linkTo}</Label>
            <Select id="task-goal" value={form.link} onChange={(e) => set('link', e.target.value)}>
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
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={form.is_sensitive}
              onChange={(e) => set('is_sensitive', e.target.checked)}
            />
            {t.fields.sensitive}
          </label>
        </>
      )}
      <FieldError>{update.error?.message}</FieldError>
      <Button
        onClick={save}
        disabled={update.isPending || !form.title.trim()}
        className="justify-self-start"
      >
        {update.isPending ? vi.common.saving : vi.common.save}
      </Button>
    </div>
  )
}

function Checklist({ task }: { task: TaskRow }) {
  const { actor } = useTaskContext()
  const items = useChecklist(task.id)
  const m = useChecklistMutations(task.id)
  const [text, setText] = useState('')
  const canWork = canWorkTask(actor, task)
  const list = items.data ?? []
  const done = list.filter((i) => i.done).length

  return (
    <Section title={`${t.checklist}${list.length ? ` (${done}/${list.length})` : ''}`}>
      <ul className="grid gap-1">
        {list.map((item) => (
          <li key={item.id} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              className="size-5"
              checked={item.done}
              disabled={!canWork}
              onChange={(e) => m.toggle.mutate({ id: item.id, done: e.target.checked })}
              aria-label={item.text}
            />
            <span
              className={
                item.done ? 'flex-1 text-sm text-muted-foreground line-through' : 'flex-1 text-sm'
              }
            >
              {item.text}
            </span>
            {canWork && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={vi.common.delete}
                onClick={() => m.remove.mutate(item.id)}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canWork && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!text.trim()) return
            await m.add.mutateAsync({ text, position: positionBetween(list.at(-1)?.position) })
            setText('')
          }}
        >
          <Input
            value={text}
            placeholder={t.checklistAdd}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={m.add.isPending}>
            {vi.common.add}
          </Button>
        </form>
      )}
      <FieldError>{(m.add.error ?? m.toggle.error ?? m.remove.error)?.message}</FieldError>
    </Section>
  )
}

function Links({ task }: { task: TaskRow }) {
  const { actor } = useTaskContext()
  const links = useLinks(task.id)
  const library = useLibraryItems()
  const m = useLinkMutations(task.id)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const canWork = canWorkTask(actor, task)
  if (!canWork && !links.data?.length) return null
  const linked = new Set((links.data ?? []).map((l) => l.library_item_id).filter(Boolean))
  const pickable = (library.data ?? []).filter((i) => i.status === 'approved' && !linked.has(i.id))

  return (
    <Section title={t.links}>
      <ul className="grid gap-1">
        {links.data?.map((l) => (
          <li key={l.id} className="flex min-h-11 items-center gap-2 text-sm">
            {l.library_item_id ? (
              <BookImage className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            )}
            {l.library_item_id ? (
              <Link
                to={`/thu-vien?item=${l.library_item_id}`}
                className="min-w-0 flex-1 truncate text-primary underline"
              >
                {l.label ?? vi.nav.library}
              </Link>
            ) : (
              <a
                href={l.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-primary underline"
              >
                {l.label || l.url}
              </a>
            )}
            {canWork && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={vi.common.delete}
                onClick={() => m.remove.mutate(l.id)}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canWork && pickable.length > 0 && (
        <Select
          value=""
          aria-label={vi.library.pickForTask}
          onChange={(e) => {
            const item = pickable.find((i) => i.id === e.target.value)
            if (item) m.addLibrary.mutate({ itemId: item.id, label: item.title })
          }}
        >
          <option value="">{vi.library.pickForTask}</option>
          {pickable.map((i) => (
            <option key={i.id} value={i.id}>
              {vi.libraryKinds[i.kind]} · {i.title}
            </option>
          ))}
        </Select>
      )}
      {canWork && (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!/^https?:\/\//i.test(url.trim())) return
            await m.add.mutateAsync({ url, label })
            setUrl('')
            setLabel('')
          }}
        >
          <Input
            type="url"
            value={url}
            placeholder={t.linkUrl}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Input
            value={label}
            placeholder={t.linkLabel}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={m.add.isPending}>
            {vi.common.add}
          </Button>
        </form>
      )}
      <FieldError>{(m.add.error ?? m.addLibrary.error ?? m.remove.error)?.message}</FieldError>
    </Section>
  )
}

function Comments({ task }: { task: TaskRow }) {
  const { people, nameOf, byId, me } = useTaskContext()
  const comments = useComments(task.id)
  const m = useCommentMutations(task.id)
  const [body, setBody] = useState('')
  const mentionable = people
    .filter((p) => p.id !== me.id)
    .map((p) => ({ id: p.id, name: p.full_name ?? p.email, avatar_url: p.avatar_url }))

  return (
    <Section title={t.comments}>
      <ul className="grid gap-3">
        {comments.data?.map((c) => (
          <li key={c.id} className="flex gap-2">
            <Avatar
              name={nameOf(c.author_id)}
              src={byId.get(c.author_id)?.avatar_url}
              className="size-8"
            />
            <div className="min-w-0 flex-1 rounded-lg bg-muted p-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{nameOf(c.author_id)}</span>
                {formatDateTimeVN(c.created_at)}
                {c.author_id === me.id && (
                  <button
                    type="button"
                    className="ml-auto"
                    aria-label={vi.common.delete}
                    onClick={() => m.remove.mutate(c.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm break-words whitespace-pre-line">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!body.trim()) return
          await m.add.mutateAsync({ body, mentions: extractMentions(body, mentionable) })
          setBody('')
        }}
      >
        <MentionTextarea
          value={body}
          onChange={setBody}
          people={mentionable}
          placeholder={t.commentPlaceholder}
        />
        <FieldError>{m.add.error?.message}</FieldError>
        <Button
          type="submit"
          size="sm"
          className="justify-self-end"
          disabled={!body.trim() || m.add.isPending}
        >
          {t.send}
        </Button>
      </form>
    </Section>
  )
}

function History({ taskId }: { taskId: string }) {
  const { nameOf } = useTaskContext()
  const history = useStatusHistory(taskId)
  return (
    <Section title={t.history}>
      <ol className="grid gap-1 text-xs text-muted-foreground">
        {history.data?.map((h) => (
          <li key={h.id}>
            {formatDateTimeVN(h.changed_at)} · {nameOf(h.changed_by) || 'Hệ thống'}:{' '}
            {h.from_status ? `${vi.taskStatus[h.from_status]} → ` : `${t.created} · `}
            <span className="font-medium text-foreground">{vi.taskStatus[h.to_status]}</span>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/** Chi tiết việc (ngăn trượt), mở bằng ?task=<id> */
export function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { nameOf, me } = useTaskContext()
  const task = useTask(taskId)
  const remove = useDeleteTask()

  return (
    <Sheet open={Boolean(taskId)} onClose={onClose} title={task.data?.title ?? vi.tasks.title}>
      {task.isPending && <Spinner />}
      {task.error && <ErrorBox error={task.error} />}
      {task.data === null && <p className="text-sm text-muted-foreground">{t.notFound}</p>}
      {task.data && (
        <div className="grid gap-4">
          <TaskMeta task={task.data} assigneeName={nameOf(task.data.assignee_id)} />
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <p>
              {vi.tasks.fields.team}: {task.data.team_id ? vi.teams[task.data.team_id] : t.noTeam}
            </p>
            <p>Người giao: {nameOf(task.data.created_by)}</p>
          </div>
          <StatusControl task={task.data} />
          <DetailsForm key={task.data.updated_at} task={task.data} />
          <Checklist task={task.data} />
          <Links task={task.data} />
          <Comments task={task.data} />
          <History taskId={task.data.id} />
          {me.role === 'admin' && (
            <Button
              variant="destructive"
              size="sm"
              className="justify-self-start"
              onClick={async () => {
                if (!window.confirm(t.confirmDelete)) return
                await remove.mutateAsync(task.data!.id)
                onClose()
              }}
            >
              {t.deleteTask}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  )
}
