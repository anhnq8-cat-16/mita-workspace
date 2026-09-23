import type { ProductCategory, ProductRow } from '@/lib/database.types'

export const CATEGORIES: ProductCategory[] = ['coffee', 'accessory', 'gift_set', 'fruit']

/** Nhóm sản phẩm: danh mục → dòng → sản phẩm (giữ thứ tự position) */
export function groupProducts(products: ProductRow[]) {
  return CATEGORIES.map((category) => {
    const inCat = products
      .filter((p) => p.category === category)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'vi'))
    const lines = new Map<string, ProductRow[]>()
    for (const p of inCat) {
      const key = p.line ?? ''
      lines.set(key, [...(lines.get(key) ?? []), p])
    }
    return { category, lines: [...lines.entries()].map(([line, items]) => ({ line, items })) }
  }).filter((g) => g.lines.length > 0)
}

/** "100g" / "1kg" */
export function packLabel(g: number | null): string {
  if (!g) return ''
  return g >= 1000 ? `${g / 1000}kg` : `${g}g`
}

/** Thay đổi giá so với bản gốc (bỏ qua dòng không đổi) */
export function diffPrices(
  original: ProductRow[],
  edits: Record<string, { retail: number | null; wholesale: number | null }>,
) {
  return original
    .filter((p) => edits[p.id])
    .map((p) => ({ p, e: edits[p.id]! }))
    .filter(({ p, e }) => e.retail !== p.retail_price_vnd || e.wholesale !== p.wholesale_price_vnd)
    .map(({ p, e }) => ({ id: p.id, retail_price_vnd: e.retail, wholesale_price_vnd: e.wholesale }))
}
