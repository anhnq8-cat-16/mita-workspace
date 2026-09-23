import type { AuditLogRow, Json } from '@/lib/database.types'
import { formatDateTimeVN, formatDateVN } from '@/lib/date-vn'
import { formatVND } from '@/lib/format'

/** Tên bảng hiển thị (bảng có trigger ghi nhật ký) */
export const TABLE_LABELS: Record<string, string> = {
  tasks: 'Công việc',
  daily_plans: 'Kế hoạch ngày',
  daily_reports: 'Báo cáo ngày',
  leads: 'Lead',
  customers: 'Khách hàng',
  orders: 'Đơn hàng',
  products: 'Sản phẩm',
  library_items: 'Thư viện',
  profiles: 'Người dùng',
  settings: 'Cài đặt',
  weekly_goals: 'Mục tiêu tuần',
  holidays: 'Ngày lễ',
  extra_workdays: 'Ngày làm bù',
  escalations: 'Leo thang',
}

export const FIELD_LABELS: Record<string, string> = {
  title: 'Tiêu đề',
  name: 'Tên',
  full_name: 'Họ tên',
  status: 'Trạng thái',
  stage: 'Giai đoạn',
  priority: 'Ưu tiên',
  assignee_id: 'Người được giao',
  assigned_to: 'Người phụ trách',
  owner_id: 'Người phụ trách',
  due_date: 'Hạn',
  role: 'Vai trò',
  is_active: 'Đang hoạt động',
  value: 'Giá trị',
  retail_price_vnd: 'Giá lẻ',
  wholesale_price_vnd: 'Giá buôn',
  total_value_vnd: 'Giá trị đơn',
  est_value_vnd: 'Giá trị dự kiến',
  lost_reason: 'Lý do mất',
  reviewed_at: 'Đã xem lúc',
  reviewed_by: 'Người xem',
  review_comment: 'Phản hồi',
  submitted_at: 'Nộp lúc',
  is_late: 'Trễ',
  is_sensitive: 'Việc nhạy cảm',
  description: 'Mô tả',
  phone: 'Số điện thoại',
  email: 'Email',
  target: 'Chỉ tiêu',
  actual: 'Thực tế',
  resolved_at: 'Xử lý lúc',
  resolved_note: 'Kết quả xử lý',
  approved_at: 'Duyệt lúc',
  approved_by: 'Người duyệt',
  reject_reason: 'Lý do từ chối',
  date: 'Ngày',
}

export const ACTION_LABELS = { insert: 'Tạo mới', update: 'Sửa', delete: 'Xóa' } as const

export interface FieldChange {
  field: string
  label: string
  old: Json | undefined
  new: Json | undefined
}

type Obj = { [k: string]: Json }
const isObj = (v: Json | undefined): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const HIDDEN = new Set(['id', 'created_at', 'updated_at', 'phone_norm', 'position', '_label'])

/** Các trường thay đổi. Sửa: {field: {old, new}}; tạo/xóa: toàn bộ dòng. */
export function changedFields(row: Pick<AuditLogRow, 'action' | 'diff'>): FieldChange[] {
  const d = isObj(row.diff) ? row.diff : {}
  const label = (f: string) => FIELD_LABELS[f] ?? f
  if (row.action === 'update') {
    return Object.entries(d)
      .filter(([f]) => !HIDDEN.has(f))
      .map(([f, v]) => ({
        field: f,
        label: label(f),
        old: isObj(v) ? v.old : undefined,
        new: isObj(v) ? v.new : undefined,
      }))
  }
  const whole = row.action === 'insert' ? d.new : d.old
  if (!isObj(whole)) return []
  return Object.entries(whole)
    .filter(([f, v]) => !HIDDEN.has(f) && v !== null && !(Array.isArray(v) && v.length === 0))
    .map(([f, v]) => ({
      field: f,
      label: label(f),
      old: row.action === 'delete' ? v : undefined,
      new: row.action === 'insert' ? v : undefined,
    }))
}

/** Tên bản ghi dễ đọc (tiêu đề, tên, key, ngày) */
export function recordLabel(row: Pick<AuditLogRow, 'action' | 'diff' | 'row_id'>): string {
  const d = isObj(row.diff) ? row.diff : {}
  const src = isObj(d.new) ? d.new : isObj(d.old) ? d.old : null
  const pick = (o: Obj | null) => {
    if (!o) return null
    for (const k of ['title', 'name', 'full_name', 'email', 'key', 'sku']) {
      if (typeof o[k] === 'string' && o[k]) return o[k] as string
    }
    return null
  }
  const fromDiff =
    (typeof d._label === 'string' ? d._label : null) ??
    pick(src) ??
    (isObj(d.title) && typeof d.title.new === 'string' ? d.title.new : null)
  return fromDiff ?? row.row_id ?? ''
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Định dạng giá trị: tiền, ngày giờ, có/không, id người dùng → tên */
export function formatValue(
  field: string,
  v: Json | undefined,
  nameOf: (id: string) => string | undefined = () => undefined,
): string {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Có' : 'Không'
  if (typeof v === 'number') return field.endsWith('_vnd') ? formatVND(v) : String(v)
  if (typeof v === 'string') {
    if (UUID.test(v)) return nameOf(v) ?? `${v.slice(0, 8)}…`
    if (TS.test(v)) return formatDateTimeVN(v)
    if (DATE.test(v)) return formatDateVN(v)
    return v
  }
  const s = JSON.stringify(v)
  return s.length > 160 ? `${s.slice(0, 160)}…` : s
}
