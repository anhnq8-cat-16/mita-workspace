import { RefreshCw } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { vi } from '@/i18n/vi'

/** Màn hình khi 1 trang lỗi (vd mất mạng lúc tải trang) – thay cho trang lỗi tiếng Anh mặc định */
export function RouteError() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : ''
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <img src="/favicon.svg" alt="" className="size-12" />
      <h1 className="text-lg font-semibold">{vi.errors.pageTitle}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{vi.errors.pageBody}</p>
      {detail && <p className="max-w-sm text-xs break-words text-muted-foreground/80">{detail}</p>}
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw /> {vi.errors.reload}
        </Button>
        <Button variant="outline" onClick={() => window.location.assign('/')}>
          {vi.common.backHome}
        </Button>
      </div>
    </div>
  )
}
