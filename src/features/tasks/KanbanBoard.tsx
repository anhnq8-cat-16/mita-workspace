import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { vi } from '@/i18n/vi'
import type { TaskRow, TaskStatus } from '@/lib/database.types'
import { cn } from '@/lib/utils'
import { useUpdateTask } from './api'
import { TaskCard } from './TaskCard'
import {
  allowedStatuses,
  canMoveTask,
  groupByStatus,
  positionBetween,
  STATUSES,
} from './task-rules'
import { useTaskContext } from './use-task-context'

function SortableCard({
  task,
  assigneeName,
  disabled,
  onOpen,
}: {
  task: TaskRow
  assigneeName: string
  disabled: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
    data: { status: task.status },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-30', !disabled && 'touch-manipulation')}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} assigneeName={assigneeName} onOpen={onOpen} />
    </div>
  )
}

function Column({
  status,
  tasks,
  children,
}: {
  status: TaskStatus
  tasks: TaskRow[]
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, data: { status } })
  return (
    <section
      className={cn(
        'flex w-[82vw] max-w-80 shrink-0 snap-start flex-col rounded-xl bg-muted/60 md:w-64 xl:w-auto xl:max-w-none xl:min-w-0 xl:flex-1',
        isOver && 'ring-2 ring-primary/40',
      )}
    >
      <header className="flex items-center justify-between px-3 pt-3 pb-2">
        <h3 className="text-sm font-semibold">{vi.taskStatus[status]}</h3>
        <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
        {children}
      </div>
    </section>
  )
}

export function KanbanBoard({
  tasks,
  onOpen,
  onError,
}: {
  tasks: TaskRow[]
  onOpen: (id: string) => void
  onError: (message: string) => void
}) {
  const { actor, nameOf, requireReview } = useTaskContext()
  const update = useUpdateTask()
  const [activeId, setActiveId] = useState<string | null>(null)
  const columns = groupByStatus(tasks)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const active = activeId ? tasks.find((t) => t.id === activeId) : undefined

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const task = tasks.find((t) => t.id === e.active.id)
    if (!task || !e.over) return
    const overId = String(e.over.id)
    const target: TaskStatus = overId.startsWith('col:')
      ? (overId.slice(4) as TaskStatus)
      : (tasks.find((t) => t.id === overId)?.status ?? task.status)

    if (!canMoveTask(actor, task)) return onError(vi.tasks.dragNotAllowed)
    if (target !== task.status && !allowedStatuses(actor, task, requireReview).includes(target)) {
      return onError(vi.tasks.needReview)
    }

    // Vị trí mới trong cột đích
    const list = columns[target].filter((t) => t.id !== task.id)
    let index = overId.startsWith('col:') ? list.length : list.findIndex((t) => t.id === overId)
    if (index < 0) index = list.length
    const position = positionBetween(list[index - 1]?.position, list[index]?.position)

    const patch: Parameters<typeof update.mutate>[0]['patch'] = { position }
    if (target !== task.status) {
      patch.status = target
      if (target === 'blocked') {
        const reason = window.prompt(vi.tasks.blockedReasonPrompt)?.trim()
        if (!reason) return
        patch.blocked_reason = reason
      }
    } else if (index === columns[target].findIndex((t) => t.id === task.id)) {
      return // không đổi gì
    }
    update.mutate({ id: task.id, patch }, { onError: (err) => onError(err.message) })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:scroll-px-0 md:px-0">
        {STATUSES.map((status) => (
          <Column key={status} status={status} tasks={columns[status]}>
            <SortableContext
              items={columns[status].map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {columns[status].map((task) => (
                <SortableCard
                  key={task.id}
                  task={task}
                  assigneeName={nameOf(task.assignee_id)}
                  disabled={!canMoveTask(actor, task)}
                  onOpen={() => onOpen(task.id)}
                />
              ))}
            </SortableContext>
          </Column>
        ))}
      </div>
      <DragOverlay>
        {active && <TaskCard task={active} assigneeName={nameOf(active.assignee_id)} dragging />}
      </DragOverlay>
    </DndContext>
  )
}
