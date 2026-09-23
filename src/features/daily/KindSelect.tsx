import { Select } from '@/components/ui/input'
import { vi } from '@/i18n/vi'
import type { PlanItemKind } from '@/lib/database.types'
import { cn } from '@/lib/utils'

const KINDS: PlanItemKind[] = ['task', 'visit', 'meeting', 'content', 'other']

export function KindSelect({
  value,
  onChange,
  className,
}: {
  value: PlanItemKind
  onChange: (kind: PlanItemKind) => void
  className?: string
}) {
  return (
    <Select
      aria-label="Loại việc"
      value={value}
      onChange={(e) => onChange(e.target.value as PlanItemKind)}
      className={cn('w-auto shrink-0', className)}
    >
      {KINDS.map((k) => (
        <option key={k} value={k}>
          {vi.kinds[k]}
        </option>
      ))}
    </Select>
  )
}
