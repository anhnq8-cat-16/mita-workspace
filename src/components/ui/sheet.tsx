import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { vi } from '@/i18n/vi'
import { cn } from '@/lib/utils'
import { Button } from './button'

/** Ngăn trượt: toàn màn hình trên điện thoại, cột phải trên máy tính */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={vi.common.close}
        className="absolute inset-0 hidden bg-black/40 md:block"
        onClick={onClose}
      />
      <div
        className={cn(
          'pb-safe absolute inset-0 flex flex-col bg-background md:inset-y-0 md:right-0 md:left-auto md:w-[36rem] md:border-l md:border-border md:shadow-xl',
          className,
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="min-w-0 flex-1 truncate font-semibold">{title}</div>
          <Button variant="ghost" size="icon" aria-label={vi.common.close} onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
