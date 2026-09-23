import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'
import { vi } from '@/i18n/vi'

const HOUR = 60 * 60 * 1000

/**
 * Có bản mới sau khi deploy → hiện thông báo, người dùng bấm "Tải lại" khi sẵn sàng
 * (không tự tải lại để khỏi mất nội dung đang gõ dở).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => void reg.update(), HOUR)
    },
  })
  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm shadow-lg md:bottom-6"
    >
      <RefreshCw className="size-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">{vi.pwa.updateReady}</p>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        {vi.pwa.later}
      </Button>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        {vi.pwa.reload}
      </Button>
    </div>
  )
}
