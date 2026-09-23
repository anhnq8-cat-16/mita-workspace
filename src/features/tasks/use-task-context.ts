import { useMemo } from 'react'
import { useMe } from '@/features/auth/auth-context'
import { useSetting, useUsers, type UserWithTeams } from '@/features/settings/api'
import type { TaskActor } from './task-rules'

/** Người dùng hiện tại + danh bạ + cài đặt duyệt việc, dùng chung cho các màn Công việc */
export function useTaskContext() {
  const me = useMe()
  const users = useUsers()
  const requireReview = useSetting<boolean>('task_require_review') ?? true

  return useMemo(() => {
    const actor: TaskActor = {
      id: me.id,
      role: me.role,
      ledTeams: me.teams.filter((t) => t.is_lead).map((t) => t.team_id),
    }
    const people = (users.data ?? []).filter((u) => u.is_active)
    const byId = new Map<string, UserWithTeams>(people.map((u) => [u.id, u]))
    const nameOf = (id: string | null | undefined) => {
      if (!id) return ''
      const u = byId.get(id)
      return u?.full_name ?? u?.email ?? ''
    }
    /** Người lead/manager được giao việc: manager → tất cả; lead → thành viên team mình */
    const assignable = people.filter(
      (u) =>
        me.role === 'manager' ||
        me.role === 'admin' ||
        u.teams.some((m) => actor.ledTeams.includes(m.team_id)),
    )
    const canAssignOthers = me.role !== 'staff'
    return { me, actor, people, byId, nameOf, assignable, canAssignOthers, requireReview }
  }, [me, users.data, requireReview])
}
