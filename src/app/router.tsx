import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AuthCallback } from '@/features/auth/AuthCallback'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ComingSoon } from '@/features/common/ComingSoon'
import { CheckInPage } from '@/features/checkin/CheckInPage'
import { DailyGate } from '@/features/daily/DailyGate'
import { GoalsPage } from '@/features/goals/GoalsPage'
import { HomePage } from '@/features/home/HomePage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { PriceListPrint } from '@/features/products/PriceListPrint'
import { ProductsPage } from '@/features/products/ProductsPage'
import { DayDetailPage } from '@/features/reports/DayDetailPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SalesPage } from '@/features/sales/SalesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { AppLayout } from './AppLayout'
import { LibraryLayout } from './LibraryLayout'
import { RequireNav } from './RequireNav'

export const router = createBrowserRouter([
  { path: '/dang-nhap', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
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
        element: <PriceListPrint />,
      },
      {
        element: <AppLayout />,
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
            element: (
              <RequireNav navKey="dashboard">
                <ComingSoon navKey="dashboard" milestone="M5" />
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
])
