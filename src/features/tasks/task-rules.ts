import type { Role, TaskPriority, TaskRow, TaskStatus } from '@/lib/database.types'

export const STATUSES: TaskStatus[] = ['todo', 'doing', 'review', 'done', 'blocked']
export const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'normal', 'low']

export interface TaskActor {
  id: string
  role: Role
  /** team mà người này là trưởng nhóm */
  ledTeams: string[]
}

type TaskLike = Pick<TaskRow, 'team_id' | 'assignee_id' | 'created_by' | 'status'>

/** Lead của team việc, hoặc manager/admin (khớp fn_can_manage_task) */
export function canManageTask(actor: TaskActor, task: Pick<TaskRow, 'team_id'>): boolean {
  if (actor.role === 'manager' || actor.role === 'admin') return true
  return Boolean(task.team_id && actor.role === 'lead' && actor.ledTeams.includes(task.team_id))
}

/** Checklist, link (khớp fn_can_work_task) */
export function canWorkTask(actor: TaskActor, task: TaskLike): boolean {
  return task.assignee_id === actor.id || task.created_by === actor.id || canManageTask(actor, task)
}

/** Được đổi trạng thái / kéo thả (khớp RLS update của tasks) */
export function canMoveTask(actor: TaskActor, task: TaskLike): boolean {
  return task.assignee_id === actor.id || canManageTask(actor, task)
}

/** Được sửa nội dung (tên, mô tả, hạn, ưu tiên, ước lượng) */
export function canEditContent(actor: TaskActor, task: TaskLike): boolean {
  if (canManageTask(actor, task)) return true
  return task.created_by === actor.id && task.assignee_id === actor.id
}

/** Trạng thái được phép chuyển tới. Staff không tự Hoàn thành khi bật duyệt. */
export function allowedStatuses(
  actor: TaskActor,
  task: TaskLike,
  requireReview: boolean,
): TaskStatus[] {
  if (!canMoveTask(actor, task)) return []
  if (canManageTask(actor, task) || !requireReview) return STATUSES
  return STATUSES.filter((s) => s !== 'done' || task.status === 'done')
}

/** Số ngày quá hạn (0 nếu chưa quá hạn / đã xong) */
export function daysOverdue(task: Pick<TaskRow, 'due_date' | 'status'>, today: string): number {
  if (!task.due_date || task.status === 'done' || task.due_date >= today) return 0
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${task.due_date}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** Vị trí mới khi thả giữa 2 thẻ */
export function positionBetween(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return 1000
  if (prev === undefined) return next! - 1000
  if (next === undefined) return prev + 1000
  return (prev + next) / 2
}

export function sortTasks<T extends Pick<TaskRow, 'position' | 'created_at'>>(tasks: T[]): T[] {
  return [...tasks].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  )
}

export interface TaskFilters {
  team?: string
  assignee?: string
  goal?: string
  priority?: TaskPriority
  overdue?: boolean
  q?: string
}

export function filterTasks<T extends TaskRow>(tasks: T[], f: TaskFilters, today: string): T[] {
  const q = f.q?.trim().toLowerCase()
  return tasks.filter(
    (t) =>
      (!f.team || t.team_id === f.team) &&
      (!f.assignee || t.assignee_id === f.assignee) &&
      (!f.goal || t.weekly_goal_id === f.goal) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.overdue || daysOverdue(t, today) > 0) &&
      (!q || t.title.toLowerCase().includes(q)),
  )
}

export function groupByStatus<T extends TaskRow>(tasks: T[]): Record<TaskStatus, T[]> {
  const out = { todo: [], doing: [], review: [], done: [], blocked: [] } as Record<TaskStatus, T[]>
  for (const t of sortTasks(tasks)) out[t.status].push(t)
  return out
}

/** Tách @Tên trong bình luận thành danh sách id người được nhắc */
export function extractMentions(body: string, people: { id: string; name: string }[]): string[] {
  const found = new Set<string>()
  // Tên dài trước để "@Quý Anh" không bị bắt thành "@Quý"
  const sorted = [...people].sort((a, b) => b.name.length - a.name.length)
  let text = body
  for (const p of sorted) {
    const token = `@${p.name}`
    if (p.name && text.includes(token)) {
      found.add(p.id)
      text = text.split(token).join(' ')
    }
  }
  return [...found]
}
