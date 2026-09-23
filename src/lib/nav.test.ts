import { bottomTabs, canAccess, navKeyForPath, visibleNav } from './nav'

const keys = (items: { key: string }[]) => items.map((i) => i.key)

describe('điều hướng theo vai trò', () => {
  it('staff Sale thấy Khách + Check-in, không thấy Quản lý/Cài đặt', () => {
    const u = { role: 'staff' as const, teams: ['sales_domestic'] }
    const v = keys(visibleNav(u))
    expect(v).toContain('sales')
    expect(v).toContain('checkin')
    expect(v).not.toContain('dashboard')
    expect(v).not.toContain('settings')
    expect(keys(bottomTabs(u))).toEqual(['today', 'sales', 'checkin', 'tasks'])
  })

  it('staff Marketing vào Lead (tạo lead), không thấy Check-in; tab dưới có Việc + Thư viện', () => {
    const u = { role: 'staff' as const, teams: ['marketing'] }
    expect(canAccess('sales', u)).toBe(true)
    expect(canAccess('checkin', u)).toBe(false)
    expect(keys(bottomTabs(u))).toEqual(['today', 'tasks', 'library', 'reports'])
  })

  it('staff vừa MKT vừa Sale (Kiên) thấy Khách', () => {
    const u = { role: 'staff' as const, teams: ['marketing', 'sales_domestic'] }
    expect(canAccess('sales', u)).toBe(true)
  })

  it('lead thấy Quản lý, không thấy Cài đặt', () => {
    const u = { role: 'lead' as const, teams: ['sales_domestic'] }
    expect(canAccess('dashboard', u)).toBe(true)
    expect(canAccess('settings', u)).toBe(false)
  })

  it('manager thấy Khách dù không thuộc team Sale', () => {
    const u = { role: 'manager' as const, teams: [] }
    expect(canAccess('sales', u)).toBe(true)
    expect(canAccess('settings', u)).toBe(false)
    expect(keys(bottomTabs(u))).toEqual(['today', 'dashboard', 'tasks', 'sales'])
  })

  it('admin thấy tất cả', () => {
    const u = { role: 'admin' as const, teams: [] }
    expect(visibleNav(u)).toHaveLength(10)
  })

  it('xuất khẩu: Thư viện + Sản phẩm', () => {
    const u = { role: 'staff' as const, teams: ['export'] }
    expect(keys(bottomTabs(u))).toEqual(['today', 'tasks', 'library', 'products'])
    expect(canAccess('sales', u)).toBe(false)
  })

  it('navKeyForPath', () => {
    expect(navKeyForPath('/')).toBe('today')
    expect(navKeyForPath('/viec/123')).toBe('tasks')
    expect(navKeyForPath('/cai-dat')).toBe('settings')
    expect(navKeyForPath('/khong-co')).toBeNull()
  })
})
