import { cn } from '@/lib/utils'

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: string }[]
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1', className)}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'min-h-9 shrink-0 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors',
            value === item.value && 'bg-background text-foreground shadow-sm',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
