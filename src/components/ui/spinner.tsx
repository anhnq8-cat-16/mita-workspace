import { Loader2 } from 'lucide-react'
import { vi } from '@/i18n/vi'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} />
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-2 text-muted-foreground">
      <Spinner /> {vi.common.loading}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : vi.common.error
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="mt-2 font-medium underline" onClick={onRetry}>
          {vi.common.retry}
        </button>
      )}
    </div>
  )
}
