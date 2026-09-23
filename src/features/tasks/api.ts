import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  TaskChecklistItemRow,
  TaskCommentRow,
  TaskLinkRow,
  TaskRow,
  TaskStatusHistoryRow,
} from '@/lib/database.types'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export const taskKeys = {
  all: ['tasks'] as const,
  list: ['tasks', 'list'] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  checklist: (id: string) => ['tasks', 'checklist', id] as const,
  comments: (id: string) => ['tasks', 'comments', id] as const,
  links: (id: string) => ['tasks', 'links', id] as const,
  history: (id: string) => ['tasks', 'history', id] as const,
  byGoal: (goalId: string) => ['tasks', 'goal', goalId] as const,
}

/** Số ngày giữ việc Hoàn thành trên bảng */
const DONE_WINDOW_DAYS = 30

/** Mọi việc người dùng xem được (RLS lọc); việc xong chỉ lấy 30 ngày gần nhất */
export function useTasks() {
  return useQuery({
    queryKey: taskKeys.list,
    queryFn: async (): Promise<TaskRow[]> => {
      const since = new Date(Date.now() - DONE_WINDOW_DAYS * 86_400_000).toISOString()
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .or(`status.neq.done,completed_at.gte.${since}`)
        .order('position')
        .limit(1000)
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<TaskRow | null> => {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id!).maybeSingle()
      throwIfError(error)
      return data
    },
  })
}

export function useGoalTasks(goalId: string, enabled: boolean) {
  return useQuery({
    queryKey: taskKeys.byGoal(goalId),
    enabled,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('weekly_goal_id', goalId)
        .order('created_at')
      throwIfError(error)
      return data ?? []
    },
  })
}

/** Realtime: có thay đổi việc (của người khác) thì tải lại */
export function useTasksRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => qc.invalidateQueries({ queryKey: taskKeys.all }), 300)
    }
    const channel = supabase
      .channel('tasks-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, refresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_checklist_items' },
        refresh,
      )
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [qc])
}

export type TaskPatch = Partial<
  Pick<
    TaskRow,
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'due_date'
    | 'start_date'
    | 'estimate_minutes'
    | 'assignee_id'
    | 'team_id'
    | 'weekly_goal_id'
    | 'is_sensitive'
    | 'blocked_reason'
    | 'position'
  >
>

/** Sửa việc – cập nhật lạc quan (bảng Kanban phản hồi ngay), lỗi thì hoàn tác */
export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskPatch }) => {
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      throwIfError(error)
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: taskKeys.list })
      const previous = qc.getQueryData<TaskRow[]>(taskKeys.list)
      qc.setQueryData<TaskRow[]>(taskKeys.list, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.list, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export type NewTask = Pick<TaskRow, 'title' | 'team_id' | 'assignee_id'> &
  Partial<
    Pick<
      TaskRow,
      | 'description'
      | 'due_date'
      | 'priority'
      | 'estimate_minutes'
      | 'weekly_goal_id'
      | 'is_sensitive'
    >
  >

/** Tạo 1 hoặc nhiều việc trong 1 lệnh (giao việc hàng loạt) */
export function useCreateTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tasks: NewTask[]) => {
      const { error } = await supabase.from('tasks').insert(tasks)
      throwIfError(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      throwIfError(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

// --- Checklist ---------------------------------------------------------------
export function useChecklist(taskId: string) {
  return useQuery({
    queryKey: taskKeys.checklist(taskId),
    queryFn: async (): Promise<TaskChecklistItemRow[]> => {
      const { data, error } = await supabase
        .from('task_checklist_items')
        .select('*')
        .eq('task_id', taskId)
        .order('position')
        .order('created_at')
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useChecklistMutations(taskId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: taskKeys.checklist(taskId) })
  return {
    add: useMutation({
      mutationFn: async (input: { text: string; position: number }) => {
        const { error } = await supabase
          .from('task_checklist_items')
          .insert({ task_id: taskId, text: input.text.trim(), position: input.position })
        throwIfError(error)
      },
      onSuccess: invalidate,
    }),
    toggle: useMutation({
      mutationFn: async (input: { id: string; done: boolean }) => {
        const { error } = await supabase
          .from('task_checklist_items')
          .update({ done: input.done })
          .eq('id', input.id)
        throwIfError(error)
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('task_checklist_items').delete().eq('id', id)
        throwIfError(error)
      },
      onSuccess: invalidate,
    }),
  }
}

// --- Bình luận ------------------------------------------------------------------
export function useComments(taskId: string) {
  return useQuery({
    queryKey: taskKeys.comments(taskId),
    queryFn: async (): Promise<TaskCommentRow[]> => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at')
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useCommentMutations(taskId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: taskKeys.comments(taskId) })
  return {
    add: useMutation({
      mutationFn: async (input: { body: string; mentions: string[] }) => {
        const { error } = await supabase
          .from('task_comments')
          .insert({ task_id: taskId, body: input.body.trim(), mentions: input.mentions })
        throwIfError(error)
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('task_comments').delete().eq('id', id)
        throwIfError(error)
      },
      onSuccess: invalidate,
    }),
  }
}

// --- Link tư liệu -------------------------------------------------------------
export function useLinks(taskId: string) {
  return useQuery({
    queryKey: taskKeys.links(taskId),
    queryFn: async (): Promise<TaskLinkRow[]> => {
      const { data, error } = await supabase
        .from('task_links')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at')
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useLinkMutations(taskId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: taskKeys.links(taskId) })
  return {
    add: useMutation({
      mutationFn: async (input: { url: string; label: string }) => {
        const { error } = await supabase
          .from('task_links')
          .insert({ task_id: taskId, url: input.url.trim(), label: input.label.trim() || null })
        throwIfError(error)
      },
      onSuccess: invalidate,
    }),
    addLibrary: useMutation({
      mutationFn: async (input: { itemId: string; label: string }) => {
        const { error } = await supabase
          .from('task_links')
          .insert({ task_id: taskId, library_item_id: input.itemId, label: input.label })
        throwIfError(error)
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('task_links').delete().eq('id', id)
        throwIfError(error)
      },
      onSuccess: invalidate,
    }),
  }
}

export function useStatusHistory(taskId: string) {
  return useQuery({
    queryKey: taskKeys.history(taskId),
    queryFn: async (): Promise<TaskStatusHistoryRow[]> => {
      const { data, error } = await supabase
        .from('task_status_history')
        .select('*')
        .eq('task_id', taskId)
        .order('changed_at')
      throwIfError(error)
      return data ?? []
    },
  })
}
