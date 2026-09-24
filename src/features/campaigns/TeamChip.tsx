import { vi } from '@/i18n/vi'
import { teamColor } from '@/lib/team-colors'
import { cn } from '@/lib/utils'

/** Chip team: chấm màu + tên team */
export function TeamChip({ team, className }: { team: string | null; className?: string }) {
  if (!team) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground',
        className,
      )}
    >
      <span className="size-2 rounded-full" style={{ background: teamColor(team) }} />
      {vi.teams[team] ?? team}
    </span>
  )
}
