import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { vi } from '@/i18n/vi'

/** Layout gọn cho /thu-vien để gửi link riêng (không có menu công việc) */
export function LibraryLayout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
        <img src="/favicon.svg" alt="" className="size-7" />
        <span className="truncate font-semibold">
          {vi.nav.library}
          <span className="hidden sm:inline"> · {vi.company}</span>
        </span>
        <Link
          to="/"
          className="ml-auto flex min-h-11 shrink-0 items-center gap-1 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {vi.appName}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-6xl p-4">
        <Suspense
          fallback={
            <div className="flex justify-center p-10">
              <Spinner />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
