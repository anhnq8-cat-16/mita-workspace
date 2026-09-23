import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AuthCallback } from '@/features/auth/AuthCallback'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ComingSoon } from '@/features/common/ComingSoon'
import { HomePage } from '@/features/home/HomePage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { AppLayout } from './AppLayout'
import { LibraryLayout } from './LibraryLayout'
import { RequireNav } from './RequireNav'

export const router = createBrowserRouter([
  { path: '/dang-nhap', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      {
        // /thu-vien: trang độc lập để gửi link riêng
        path: '/thu-vien',
        element: <LibraryLayout />,
        children: [{ index: true, element: <ComingSoon navKey="library" milestone="M4" /> }],
      },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'viec', element: <ComingSoon navKey="tasks" milestone="M2" /> },
          { path: 'muc-tieu', element: <ComingSoon navKey="goals" milestone="M2" /> },
          {
            path: 'khach',
            element: (
              <RequireNav navKey="sales">
                <ComingSoon navKey="sales" milestone="M3" />
              </RequireNav>
            ),
          },
          {
            path: 'check-in',
            element: (
              <RequireNav navKey="checkin">
                <ComingSoon navKey="checkin" milestone="M3" />
              </RequireNav>
            ),
          },
          { path: 'san-pham', element: <ComingSoon navKey="products" milestone="M4" /> },
          { path: 'bao-cao', element: <ComingSoon navKey="reports" milestone="M1" /> },
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
