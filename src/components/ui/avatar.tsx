import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Avatar({
  name,
  src,
  className,
}: {
  name: string | null | undefined
  src?: string | null
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  )
}
