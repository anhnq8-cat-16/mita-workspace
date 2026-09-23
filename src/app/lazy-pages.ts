import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'mita:chunk-reload'

/**
 * Tải trang theo nhu cầu (tách mã) để trang đầu mở nhanh trên 4G.
 * Sau khi deploy bản mới, file cũ bị xóa → tải lại trang 1 lần để lấy bản mới.
 */
function page<T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) {
  return lazy(async () => {
    try {
      const m = await load()
      sessionStorage.removeItem(RELOAD_KEY)
      return { default: m[name] as ComponentType }
    } catch (e) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1')
        window.location.reload()
      }
      throw e
    }
  })
}

export const TasksPage = page(() => import('@/features/tasks/TasksPage'), 'TasksPage')
export const GoalsPage = page(() => import('@/features/goals/GoalsPage'), 'GoalsPage')
export const SalesPage = page(() => import('@/features/sales/SalesPage'), 'SalesPage')
export const CheckInPage = page(() => import('@/features/checkin/CheckInPage'), 'CheckInPage')
export const LibraryPage = page(() => import('@/features/library/LibraryPage'), 'LibraryPage')
export const ProductsPage = page(() => import('@/features/products/ProductsPage'), 'ProductsPage')
export const PriceListPrint = page(
  () => import('@/features/products/PriceListPrint'),
  'PriceListPrint',
)
export const ReportsPage = page(() => import('@/features/reports/ReportsPage'), 'ReportsPage')
export const DayDetailPage = page(() => import('@/features/reports/DayDetailPage'), 'DayDetailPage')
export const DashboardPage = page(
  () => import('@/features/dashboard/DashboardPage'),
  'DashboardPage',
)
export const SettingsPage = page(() => import('@/features/settings/SettingsPage'), 'SettingsPage')
export const AuditPage = page(() => import('@/features/audit/AuditPage'), 'AuditPage')
