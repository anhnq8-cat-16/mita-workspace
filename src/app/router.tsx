import { Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/spinner'
import { AuthCallback } from '@/features/auth/AuthCallback'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { DailyGate } from '@/features/daily/DailyGate'
import { HomePage } from '@/features/home/HomePage'
import { AppLayout } from './AppLayout'
import {
  AuditPage,
  CheckInPage,
  DashboardPage,
  DayDetailPage,
  GoalsPage,
  LibraryPage,
  PriceListPrint,
  ProductsPage,
  ReportsPage,
  SalesPage,
  SettingsPage,
  TasksPage,
} from './lazy-pages'
import { LibraryLayout } from './LibraryLayout'
import { RequireNav } from './RequireNav'
import { RouteError } from './RouteError'

// Trang Hôm nay + cổng kế hoạch tải ngay; các trang khác tải khi mở (xem lazy-pages.ts)
export const routes: RouteObject[] = [
  { path: '/dang-nhap', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    errorElement: <RouteError />,
    element: (
      <RequireAuth>
        <DailyGate>
          <Outlet />
        </DailyGate>
      </RequireAuth>
    ),
    children: [
      {
        // /thu-vien: trang độc lập để gửi link riêng
        path: '/thu-vien',
        element: <LibraryLayout />,
        children: [{ index: true, element: <LibraryPage /> }],
      },
      {
        // Bảng giá bản in / PDF (không có menu)
        path: '/san-pham/in',
        element: (
          <Suspense fallback={<FullPageSpinner />}>
            <PriceListPrint />
          </Suspense>
        ),
      },
      {
        element: <AppLayout />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'viec', element: <TasksPage /> },
          { path: 'muc-tieu', element: <GoalsPage /> },
          {
            path: 'khach',
            element: (
              <RequireNav navKey="sales">
                <SalesPage />
              </RequireNav>
            ),
          },
          {
            path: 'check-in',
            element: (
              <RequireNav navKey="checkin">
                <CheckInPage />
              </RequireNav>
            ),
          },
          { path: 'san-pham', element: <ProductsPage /> },
          { path: 'bao-cao', element: <ReportsPage /> },
          { path: 'bao-cao/:userId/:date', element: <DayDetailPage /> },
          {
            path: 'quan-ly',
            handle: { theme: 'premium', wide: true },
            element: (
              <RequireNav navKey="dashboard">
                <DashboardPage />
              </RequireNav>
            ),
          },
          {
            path: 'nhat-ky',
            element: (
              <RequireNav navKey="audit">
                <AuditPage />
              </RequireNav>
            ),
          },
          {
            path: 'cai-dat',
            element: (
              <RequireNav navKey="settings">
                <SettingsPage />
              </RequireNav>
            ),
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
