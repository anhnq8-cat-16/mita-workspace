import { Plus, SlidersHorizontal, Users } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { useGoalOptions } from '@/features/goals/api'
import { vi } from '@/i18n/vi'
import type { TaskPriority } from '@/lib/database.types'
import { todayVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import { weekStart } from '@/lib/week'
import { useTasks, useTasksRealtime } from './api'
import { BulkAssignForm, SelfTaskForm } from './CreateTaskForms'
import { KanbanBoard } from './KanbanBoard'
import { TaskCalendar } from './TaskCalendar'
import { TaskDrawer } from './TaskDrawer'
import { PeopleView, TaskListView } from './TaskListView'
import { filterTasks, PRIORITIES, type TaskFilters } from './task-rules'
import { useTaskContext } from './use-task-context'

const t = vi.tasks
type View = 'board' | 'list' | 'mine' | 'people' | 'calendar'
const VIEWS: View[] = ['board', 'list', 'mine', 'people', 'calendar']

export function TasksPage() {
  const { me, people, canAssignOthers } = useTaskContext()
  const [params, setParams] = useSearchParams()
  const tasks = useTasks()
  useTasksRealtime()
  const [createOpen, setCreateOpen] = useState<'self' | 'bulk' | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const rawView = params.get('view') as View | null
  const view: View =
    rawView && VIEWS.includes(rawView) && (rawView !== 'people' || canAssignOthers)
      ? rawView
      : 'board'
  const taskId = params.get('task')
  const filters: TaskFilters = {
    team: params.get('team') ?? undefined,
    assignee: params.get('assignee') ?? undefined,
    goal: params.get('goal') ?? undefined,
    priority: (params.get('priority') as TaskPriority | null) ?? undefined,
    overdue: params.get('overdue') === '1',
    q: params.get('q') ?? undefined,
  }
  const goalOptions = useGoalOptions(filters.team ?? null, weekStart())

  const setParam = useCallback(
    (key: string, value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace: key !== 'task' },
      ),
    [setParams],
  )
  const openTask = (id: string) => setParam('task', id)
  const closeTask = useCallback(() => setParam('task', null), [setParam])
  const showError = (message: string) => {
    setFlash(message)
    setTimeout(() => setFlash(null), 4000)
  }

  const filtered = filterTasks(tasks.data ?? [], filters, todayVN())
  const visible = view === 'mine' ? filtered.filter((x) => x.assignee_id === me.id) : filtered

  const teamIds = [...new Set((tasks.data ?? []).map((x) => x.team_id).filter(Boolean))] as string[]
  const hasFilters = ['team', 'assignee', 'goal', 'priority', 'overdue', 'q'].some((k) =>
    params.get(k),
  )
  const activeFilterCount = ['team', 'assignee', 'goal', 'priority', 'overdue'].filter((k) =>
    params.get(k),
  ).length

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateOpen('self')}>
            <Plus /> {t.newTask}
          </Button>
          {canAssignOthers && (
            <Button onClick={() => setCreateOpen('bulk')}>
              <Users /> {t.bulkAssign}
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={view}
        onChange={(v) => setParam('view', v === 'board' ? null : v)}
        items={VIEWS.filter((v) => v !== 'people' || canAssignOthers).map((v) => ({
          value: v,
          label: t.views[v],
        }))}
      />

      <div className="flex gap-2 md:hidden">
        <Input
          placeholder={t.filters.search}
          aria-label={t.filters.search}
          value={filters.q ?? ''}
          onChange={(e) => setParam('q', e.target.value || null)}
        />
        <Button
          variant="outline"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal /> {t.filters.toggle}
          {activeFilterCount > 0 && ` (${activeFilterCount})`}
        </Button>
      </div>
      <div
        className={cn('grid-cols-2 gap-2 md:flex md:flex-wrap', filtersOpen ? 'grid' : 'hidden')}
      >
        <Input
          className="hidden md:block md:w-56"
          placeholder={t.filters.search}
          aria-label={t.filters.search}
          value={filters.q ?? ''}
          onChange={(e) => setParam('q', e.target.value || null)}
        />
        <Select
          className="sm:w-auto"
          aria-label={t.filters.team}
          value={filters.team ?? ''}
          onChange={(e) => {
            setParam('team', e.target.value || null)
            setParam('goal', null)
          }}
        >
          <option value="">
            {t.filters.team}: {t.filters.all}
          </option>
          {teamIds.map((id) => (
            <option key={id} value={id}>
              {vi.teams[id] ?? id}
            </option>
          ))}
        </Select>
        {view !== 'mine' && (
          <Select
            className="sm:w-auto"
            aria-label={t.filters.assignee}
            value={filters.assignee ?? ''}
            onChange={(e) => setParam('assignee', e.target.value || null)}
          >
            <option value="">
              {t.filters.assignee}: {t.filters.all}
            </option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.email}
              </option>
            ))}
          </Select>
        )}
        <Select
          className="sm:w-auto"
          aria-label={t.filters.priority}
          value={filters.priority ?? ''}
          onChange={(e) => setParam('priority', e.target.value || null)}
        >
          <option value="">
            {t.filters.priority}: {t.filters.all}
          </option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {vi.priorities[p]}
            </option>
          ))}
        </Select>
        {filters.team && (goalOptions.data?.length ?? 0) > 0 && (
          <Select
            className="sm:w-auto"
            aria-label={t.filters.goal}
            value={filters.goal ?? ''}
            onChange={(e) => setParam('goal', e.target.value || null)}
          >
            <option value="">
              {t.filters.goal}: {t.filters.all}
            </option>
            {goalOptions.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={filters.overdue}
            onChange={(e) => setParam('overdue', e.target.checked ? '1' : null)}
          />
          {t.filters.overdue}
        </label>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setParams((prev) => {
                const next = new URLSearchParams()
                for (const k of ['view', 'task']) {
                  const v = prev.get(k)
                  if (v) next.set(k, v)
                }
                return next
              })
            }
          >
            {t.filters.clear}
          </Button>
        )}
      </div>

      {flash && (
        <div role="alert" className="rounded-lg border border-warning bg-warning/15 p-3 text-sm">
          {flash}
        </div>
      )}
      {tasks.isPending && (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      )}
      {tasks.error && <ErrorBox error={tasks.error} onRetry={() => tasks.refetch()} />}
      {tasks.data && (
        <>
          {view === 'board' && (
            <KanbanBoard tasks={visible} onOpen={openTask} onError={showError} />
          )}
          {(view === 'list' || view === 'mine') && (
            <TaskListView tasks={visible} onOpen={openTask} />
          )}
          {view === 'people' && <PeopleView tasks={visible} onOpen={openTask} />}
          {view === 'calendar' && <TaskCalendar tasks={visible} onOpen={openTask} />}
        </>
      )}

      <TaskDrawer taskId={taskId} onClose={closeTask} />
      <Sheet
        open={createOpen !== null}
        onClose={() => setCreateOpen(null)}
        title={createOpen === 'bulk' ? t.bulk.title : t.self.title}
      >
        {createOpen === 'self' && <SelfTaskForm onDone={() => setCreateOpen(null)} />}
        {createOpen === 'bulk' && (
          <BulkAssignForm
            onDone={(n) => {
              setCreateOpen(null)
              showError(t.bulk.done(n))
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
