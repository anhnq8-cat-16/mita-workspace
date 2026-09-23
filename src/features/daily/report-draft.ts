import type { ReportResult } from '@/lib/database.types'
import type { MetricField, PlanItem, ReportMetrics } from './types'

export interface ItemResult {
  result: ReportResult | null
  reason: string
}

export type ReportTemplates = Record<string, MetricField[]>

/** Các nhóm chỉ số áp dụng cho người dùng (theo team, giữ thứ tự của template) */
export function templatesFor(teams: string[], templates: ReportTemplates | undefined) {
  if (!templates) return []
  return Object.entries(templates)
    .filter(([team]) => teams.includes(team))
    .map(([team, fields]) => ({ team, fields }))
}

export function activeItems(items: PlanItem[]): PlanItem[] {
  return items.filter((i) => !i.removed_reason)
}

export function validateReport(
  items: PlanItem[],
  results: Record<string, ItemResult | undefined>,
): string | null {
  for (const item of activeItems(items)) {
    const r = results[item.id]
    if (!r?.result) return `Chọn kết quả cho việc "${item.title}"`
    if (r.result !== 'done' && !r.reason.trim())
      return `Cần lý do cho việc chưa xong "${item.title}"`
  }
  return null
}

export function toReportItems(items: PlanItem[], results: Record<string, ItemResult | undefined>) {
  return activeItems(items).map((item) => {
    const r = results[item.id]!
    return {
      plan_item_id: item.id,
      result: r.result!,
      reason: r.result === 'done' ? null : r.reason.trim(),
    }
  })
}

/** Chuẩn hóa chỉ số: chuỗi số → number, chuỗi rỗng → bỏ */
export function normalizeMetrics(
  groups: { team: string; fields: MetricField[] }[],
  raw: Record<string, Record<string, string>>,
): ReportMetrics {
  const out: ReportMetrics = {}
  for (const { team, fields } of groups) {
    const values: Record<string, number | string | null> = {}
    for (const f of fields) {
      const v = raw[team]?.[f.key]?.trim() ?? ''
      if (v === '') continue
      if (f.type === 'links') values[f.key] = v
      else {
        const n = Number(v.replace(/[^\d-]/g, ''))
        if (Number.isFinite(n)) values[f.key] = n
      }
    }
    out[team] = values
  }
  return out
}
