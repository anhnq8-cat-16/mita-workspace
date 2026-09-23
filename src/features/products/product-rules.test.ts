import type { ProductRow } from '@/lib/database.types'
import { diffPrices, groupProducts, packLabel } from './product-rules'

const p = (x: Partial<ProductRow>) =>
  ({
    id: 'x',
    name: 'x',
    category: 'coffee',
    line: null,
    position: 0,
    retail_price_vnd: null,
    wholesale_price_vnd: null,
    ...x,
  }) as ProductRow

describe('sản phẩm', () => {
  it('nhóm theo danh mục/dòng', () => {
    const g = groupProducts([
      p({ id: 'b', line: 'Arabica Natural', position: 12 }),
      p({ id: 'a', line: 'Arabica Natural', position: 11 }),
      p({ id: 'c', category: 'accessory', line: 'Phụ kiện' }),
    ])
    expect(g.map((x) => x.category)).toEqual(['coffee', 'accessory'])
    expect(g[0]!.lines[0]!.items.map((i) => i.id)).toEqual(['a', 'b'])
  })
  it('packLabel', () => {
    expect(packLabel(250)).toBe('250g')
    expect(packLabel(1000)).toBe('1kg')
    expect(packLabel(null)).toBe('')
  })
  it('diffPrices chỉ lấy dòng thay đổi', () => {
    const orig = [p({ id: 'a', retail_price_vnd: 100 }), p({ id: 'b' })]
    expect(
      diffPrices(orig, { a: { retail: 100, wholesale: null }, b: { retail: 5, wholesale: null } }),
    ).toEqual([{ id: 'b', retail_price_vnd: 5, wholesale_price_vnd: null }])
  })
})
