import type { Role } from './database.types'

export type NavKey =
  | 'today'
  | 'tasks'
  | 'goals'
  | 'sales'
  | 'checkin'
  | 'library'
  | 'products'
  | 'reports'
  | 'dashboard'
  | 'settings'

export interface NavItem {
  key: NavKey
  path: string
}

export interface NavUser {
  role: Role
  teams: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'today', path: '/' },
  { key: 'tasks', path: '/viec' },
  { key: 'goals', path: '/muc-tieu' },
  { key: 'sales', path: '/khach' },
  { key: 'checkin', path: '/check-in' },
  { key: 'library', path: '/thu-vien' },
  { key: 'products', path: '/san-pham' },
  { key: 'reports', path: '/bao-cao' },
  { key: 'dashboard', path: '/quan-ly' },
  { key: 'settings', path: '/cai-dat' },
]

const isManagerOrAdmin = (u: NavUser) => u.role === 'manager' || u.role === 'admin'
const inSales = (u: NavUser) => u.teams.includes('sales_domestic')

/** Người dùng có được vào mục này không (chỉ là lớp giao diện – RLS mới là lớp bảo vệ chính) */
export function canAccess(key: NavKey, user: NavUser): boolean {
  switch (key) {
    case 'sales':
      // Marketing vào để tạo lead và theo dõi trạng thái lead mình gửi
      return inSales(user) || user.teams.includes('marketing') || isManagerOrAdmin(user)
    case 'checkin':
      return inSales(user) || isManagerOrAdmin(user)
    case 'dashboard':
      return user.role !== 'staff'
    case 'settings':
      return user.role === 'admin'
    default:
      return true
  }
}

export function visibleNav(user: NavUser): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccess(item.key, user))
}

/**
 * Tối đa 4 tab chính ở thanh dưới trên mobile (tab thứ 5 là "Thêm").
 * Sale thấy Khách + Check-in; Marketing thấy Việc + Thư viện; quản lý thấy Quản lý.
 */
export function bottomTabs(user: NavUser): NavItem[] {
  let order: NavKey[]
  if (isManagerOrAdmin(user)) {
    order = ['today', 'dashboard', 'tasks', 'sales']
  } else if (inSales(user)) {
    order = ['today', 'sales', 'checkin', 'tasks']
  } else if (user.teams.includes('marketing')) {
    order = ['today', 'tasks', 'library', 'reports']
  } else {
    order = ['today', 'tasks', 'library', 'products']
  }
  const visible = visibleNav(user)
  return order
    .map((key) => visible.find((i) => i.key === key))
    .filter((i): i is NavItem => Boolean(i))
}

/** Tìm mục điều hướng theo đường dẫn (khớp tiền tố dài nhất) */
export function navKeyForPath(pathname: string): NavKey | null {
  const match = NAV_ITEMS.filter((i) =>
    i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(`${i.path}/`),
  ).sort((a, b) => b.path.length - a.path.length)[0]
  return match?.key ?? null
}
