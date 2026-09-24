import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/app/router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import '@/index.css'
import { DemoBadge } from './DemoBadge'

// Bản xem thử: mở thẳng dashboard, điều hướng trong bộ nhớ (không đổi địa chỉ trang)
const router = createMemoryRouter(routes, { initialEntries: ['/quan-ly'] })
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0, refetchOnWindowFocus: false, staleTime: Infinity } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <DemoBadge />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
