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
      className={cn(
        'inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1',
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'min-h-9 shrink-0 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap text-slate-500 transition-all duration-200 hover:text-slate-900',
            value === item.value && 'bg-white text-slate-900 shadow-sm',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
