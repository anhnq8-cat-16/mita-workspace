import { Download, Share, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { vi } from '@/i18n/vi'
import { isIOS, isStandalone, useInstallPrompt } from './install'

const KEY = 'mita:install-dismissed'
const t = vi.pwa

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Gợi ý cài ứng dụng lên màn hình chính (điện thoại, chưa cài, chưa tắt gợi ý) */
export function InstallBanner() {
  const { canPrompt, install } = useInstallPrompt()
  const [hidden, setHidden] = useState(dismissed)
  const ios = isIOS()
  if (hidden || isStandalone() || (!canPrompt && !ios)) return null

  const close = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // bỏ qua (chế độ ẩn danh)
    }
    setHidden(true)
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm md:hidden">
      <img src="/pwa-192.png" alt="" className="size-10 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t.title}</p>
        {ios ? (
          <p className="mt-0.5 text-muted-foreground">
            {t.iosBefore} <Share className="inline size-4 align-text-bottom" aria-label="Chia sẻ" />{' '}
            {t.iosAfter}
          </p>
        ) : (
          <p className="mt-0.5 text-muted-foreground">{t.androidHint}</p>
        )}
        {canPrompt && (
          <Button size="sm" className="mt-2" onClick={() => install().then((ok) => ok && close())}>
            <Download /> {t.install}
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label={vi.common.close}
        className="-m-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
