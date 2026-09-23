import type { PlanItemKind } from '@/lib/database.types'
import type { PrefillItem } from './types'

export type DraftSource = PrefillItem['source'] | 'new' | 'existing'

export interface DraftItem {
  /** khóa tạm ở client */
  key: string
  source: DraftSource
  title: string
  kind: PlanItemKind
  task_id: string | null
  estimate_minutes: number | null
  carried_from_item_id: string | null
  /** chỉ dùng cho việc tồn: bỏ có lý do */
  removed_reason: string | null
  due_date?: string | null
}

let seq = 0
export const newKey = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`

export function draftFromPrefill(prefill: PrefillItem[]): DraftItem[] {
  return prefill.map((p) => ({
    key: newKey(),
    source: p.source,
    title: p.title,
    kind: p.kind,
    task_id: p.task_id,
    estimate_minutes: p.estimate_minutes,
    carried_from_item_id: p.carried_from_item_id ?? null,
    removed_reason: null,
    due_date: p.due_date ?? null,
  }))
}

export const isActive = (item: DraftItem) => !item.removed_reason?.trim()
export const isCarried = (item: DraftItem) => item.source === 'carried'

/** Trả về câu lỗi (tiếng Việt) hoặc null nếu hợp lệ */
export function validateDraft(items: DraftItem[], minItems: number): string | null {
  const active = items.filter(isActive)
  if (active.some((i) => !i.title.trim())) return 'Tên việc không được để trống'
  if (active.length < minItems)
    return `Kế hoạch cần ít nhất ${minItems} việc (hiện có ${active.length})`
  const taskIds = active.map((i) => i.task_id).filter(Boolean)
  if (new Set(taskIds).size !== taskIds.length) return 'Có việc bị trùng trong kế hoạch'
  return null
}

/** Payload cho fn_submit_daily_plan. Việc thường bị bỏ thì không gửi; việc tồn bị bỏ gửi kèm lý do. */
export function toSubmitPayload(items: DraftItem[]) {
  return items
    .filter((i) => isActive(i) || isCarried(i))
    .map((i) => ({
      title: i.title.trim(),
      kind: i.kind,
      task_id: i.task_id,
      estimate_minutes: i.estimate_minutes,
      carried_from_item_id: i.carried_from_item_id,
      removed_reason: isActive(i) ? null : i.removed_reason!.trim(),
    }))
}

/** Bỏ 1 việc khỏi bản nháp: việc tồn cần lý do (giữ lại, gạch ngang), việc khác xóa hẳn */
export function removeDraftItem(items: DraftItem[], key: string, reason?: string): DraftItem[] {
  const item = items.find((i) => i.key === key)
  if (!item) return items
  if (isCarried(item)) {
    if (!reason?.trim()) throw new Error('Bỏ việc chuyển từ hôm trước cần ghi lý do')
    return items.map((i) => (i.key === key ? { ...i, removed_reason: reason.trim() } : i))
  }
  return items.filter((i) => i.key !== key)
}

export function restoreDraftItem(items: DraftItem[], key: string): DraftItem[] {
  return items.map((i) => (i.key === key ? { ...i, removed_reason: null } : i))
}
