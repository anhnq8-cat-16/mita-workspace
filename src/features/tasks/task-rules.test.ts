import type { TaskRow } from '@/lib/database.types'
import {
  allowedStatuses,
  canEditContent,
  canManageTask,
  canMoveTask,
  daysOverdue,
  extractMentions,
  filterTasks,
  groupByStatus,
  positionBetween,
  type TaskActor,
} from './task-rules'

const task = (p: Partial<TaskRow> = {}): TaskRow => ({
  id: 't',
  title: 'Việc',
  description: null,
  team_id: 'sales_domestic',
  assignee_id: 'long',
  created_by: 'mai',
  weekly_goal_id: null,
  status: 'todo',
  priority: 'normal',
  start_date: null,
  due_date: null,
  estimate_minutes: null,
  position: 0,
  is_sensitive: false,
  is_off_plan: false,
  carried_over_count: 0,
  completed_at: null,
  approved_by: null,
  blocked_reason: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...p,
})

const long: TaskActor = { id: 'long', role: 'staff', ledTeams: [] }
const kien: TaskActor = { id: 'kien', role: 'staff', ledTeams: [] }
const mai: TaskActor = { id: 'mai', role: 'lead', ledTeams: ['sales_domestic'] }
const trangMkt: TaskActor = { id: 'trang', role: 'lead', ledTeams: ['marketing'] }
const manager: TaskActor = { id: 'ha', role: 'manager', ledTeams: [] }

describe('quyền trên việc', () => {
  it('lead chỉ quản lý team mình; manager quản lý tất cả', () => {
    expect(canManageTask(mai, task())).toBe(true)
    expect(canManageTask(trangMkt, task())).toBe(false)
    expect(canManageTask(manager, task())).toBe(true)
    expect(canManageTask(long, task())).toBe(false)
  })

  it('staff chỉ đẩy đến Chờ duyệt khi bật duyệt', () => {
    expect(allowedStatuses(long, task(), true)).not.toContain('done')
    expect(allowedStatuses(long, task(), false)).toContain('done')
    expect(allowedStatuses(mai, task(), true)).toContain('done')
    expect(allowedStatuses(kien, task(), true)).toEqual([])
  })

  it('kéo thả / sửa nội dung', () => {
    expect(canMoveTask(long, task())).toBe(true)
    expect(canMoveTask(kien, task())).toBe(false)
    expect(canEditContent(long, task())).toBe(false)
    expect(canEditContent(long, task({ created_by: 'long' }))).toBe(true)
  })
})

describe('tiện ích', () => {
  it('daysOverdue', () => {
    expect(daysOverdue(task({ due_date: '2026-09-20' }), '2026-09-23')).toBe(3)
    expect(daysOverdue(task({ due_date: '2026-09-23' }), '2026-09-23')).toBe(0)
    expect(daysOverdue(task({ due_date: '2026-09-20', status: 'done' }), '2026-09-23')).toBe(0)
  })

  it('positionBetween', () => {
    expect(positionBetween()).toBe(1000)
    expect(positionBetween(1000)).toBe(2000)
    expect(positionBetween(undefined, 1000)).toBe(0)
    expect(positionBetween(1000, 2000)).toBe(1500)
  })

  it('filterTasks + groupByStatus', () => {
    const list = [
      task({ id: 'a', due_date: '2026-09-01', priority: 'high', position: 2 }),
      task({ id: 'b', status: 'doing', team_id: 'marketing' }),
      task({ id: 'c', position: 1, title: 'Gửi báo giá' }),
    ]
    expect(filterTasks(list, { overdue: true }, '2026-09-23').map((t) => t.id)).toEqual(['a'])
    expect(filterTasks(list, { team: 'marketing' }, '2026-09-23').map((t) => t.id)).toEqual(['b'])
    expect(filterTasks(list, { q: 'báo giá' }, '2026-09-23').map((t) => t.id)).toEqual(['c'])
    expect(groupByStatus(list).todo.map((t) => t.id)).toEqual(['c', 'a'])
  })

  it('extractMentions ưu tiên tên dài', () => {
    const people = [
      { id: 'quy', name: 'Quý' },
      { id: 'quyanh', name: 'Quý Anh' },
      { id: 'long', name: 'Long' },
    ]
    expect(extractMentions('@Quý Anh xem giúp, @Long nhé', people).sort()).toEqual([
      'long',
      'quyanh',
    ])
    expect(extractMentions('@Quý ơi', people)).toEqual(['quy'])
    expect(extractMentions('không nhắc ai', people)).toEqual([])
  })
})
