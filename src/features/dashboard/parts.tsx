import { CheckCircle2, CircleDashed, Download, TriangleAlert, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { vi } from '@/i18n/vi'
import { downloadCsv, type CsvCell } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { formatScore, scoreBand, type Band, type Bands } from './compliance'

const t = vi.dashboard

/** Khung 1 khối dashboard: tiêu đề + nút phụ (CSV…) */
export function Block({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

export function CsvButton({
  filename,
  header,
  rows,
}: {
  filename: string
  header: string[]
  rows: () => CsvCell[][]
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      title={t.exportTitle}
      onClick={() => downloadCsv(filename, header, rows())}
    >
      <Download /> {t.exportCsv}
    </Button>
  )
}

const BAND_STYLE: Record<Band, { cls: string; Icon: typeof CheckCircle2 }> = {
  good: { cls: 'bg-success/15 text-success', Icon: CheckCircle2 },
  warn: { cls: 'bg-warning/20 text-warning-foreground', Icon: TriangleAlert },
  bad: { cls: 'bg-destructive/10 text-destructive', Icon: XCircle },
  none: { cls: 'bg-muted text-muted-foreground', Icon: CircleDashed },
}

/** Mức điểm: màu + biểu tượng + chữ (không chỉ dựa vào màu) */
export function ScoreBadge({
  score,
  bands,
  showLabel = true,
  className,
}: {
  score: number | null | undefined
  bands: Bands
  showLabel?: boolean
  className?: string
}) {
  const band = scoreBand(score, bands)
  const { cls, Icon } = BAND_STYLE[band]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        cls,
        className,
      )}
      title={t.compliance.bands[band]}
    >
      <Icon className="size-3.5" aria-hidden />
      {score === null || score === undefined ? '—' : formatScore(score)}
      {showLabel ? (
        <span className="font-normal">· {t.compliance.bands[band]}</span>
      ) : (
        <span className="sr-only">{t.compliance.bands[band]}</span>
      )}
    </span>
  )
}

const BAND_FILL: Record<Band, string> = {
  good: 'var(--color-success)',
  warn: 'var(--color-warning)',
  bad: 'var(--color-destructive)',
  none: 'var(--color-muted-foreground)',
}

/** Đường xu hướng nhỏ (thang cố định 0–100), chấm màu theo mức, di chuột xem số */
export function Sparkline({
  points,
  bands,
}: {
  points: { label: string; value: number | null }[]
  bands: Bands
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 104
  const H = 32
  const PAD = 6
  const x = (i: number) =>
    points.length <= 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (points.length - 1)
  const y = (v: number) => PAD + ((100 - Math.max(0, Math.min(100, v))) * (H - 2 * PAD)) / 100

  // Nối các tuần liền nhau có dữ liệu; tuần trống để khoảng hở
  const segments: string[] = []
  let cur: string[] = []
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur.length > 1) segments.push(cur.join(' '))
      cur = []
    } else cur.push(`${x(i)},${y(p.value)}`)
  })
  if (cur.length > 1) segments.push(cur.join(' '))

  const label = points.map((p) => `${p.label}: ${formatScore(p.value)}`).join('; ')
  const h = hover === null ? null : points[hover]

  return (
    <div className="relative inline-block" onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line
          x1={PAD}
          x2={W - PAD}
          y1={y(bands.good)}
          y2={y(bands.good)}
          stroke="var(--color-border)"
          strokeDasharray="2 3"
        />
        {segments.map((s) => (
          <polyline
            key={s}
            points={s}
            fill="none"
            stroke="var(--color-muted-foreground)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {points.map((p, i) =>
          p.value === null ? null : (
            <circle
              key={p.label}
              cx={x(i)}
              cy={y(p.value)}
              r={4}
              fill={BAND_FILL[scoreBand(p.value, bands)]}
              stroke="var(--color-card)"
              strokeWidth={2}
            />
          ),
        )}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.label}`}
            x={x(i) - (W - 2 * PAD) / (2 * Math.max(1, points.length - 1))}
            y={0}
            width={(W - 2 * PAD) / Math.max(1, points.length - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-xs whitespace-nowrap shadow-md"
          style={{ left: x(hover) }}
        >
          <span className="text-muted-foreground">{h.label}</span>{' '}
          <strong className="text-foreground">{formatScore(h.value)}</strong>
        </div>
      )}
    </div>
  )
}

/** Danh sách thanh ngang 1 màu (độ lớn), nhãn giá trị ở cuối thanh */
export function BarList({
  rows,
}: {
  rows: { key: string; label: string; value: number; valueLabel: string; tooltip?: string }[]
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const [hover, setHover] = useState<string | null>(null)
  return (
    <ul className="grid gap-2" onMouseLeave={() => setHover(null)}>
      {rows.map((r) => (
        <li
          key={r.key}
          className={cn(
            'grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2 rounded-md px-1 text-sm sm:grid-cols-[minmax(0,10rem)_1fr_auto]',
            hover === r.key && 'bg-muted',
          )}
          onMouseEnter={() => setHover(r.key)}
          title={r.tooltip}
        >
          <span className="truncate text-muted-foreground">{r.label}</span>
          <span className="flex min-h-7 items-center">
            <span
              className="h-3 rounded-r-[4px] bg-primary"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 2 : 0 }}
            />
          </span>
          <span className="text-right text-xs font-medium whitespace-nowrap text-foreground tabular-nums">
            {r.valueLabel}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Thanh tiến độ so với chỉ tiêu, có vạch "tiến độ kỳ vọng" (tùy chọn) */
export function ProgressBar({
  percent,
  expected,
  label,
}: {
  percent: number
  expected?: number
  label: string
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div
      className="relative h-3 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full', percent >= 100 ? 'bg-success' : 'bg-primary')}
        style={{ width: `${clamped}%` }}
      />
      {expected !== undefined && (
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/60"
          style={{ left: `${Math.max(0, Math.min(100, expected))}%` }}
        />
      )}
    </div>
  )
}

export function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  tone?: 'bad'
}) {
  return (
    <div className="grid content-start gap-0.5 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums',
          tone === 'bad' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}
