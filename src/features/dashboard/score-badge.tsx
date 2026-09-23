import { CheckCircle2, CircleDashed, TriangleAlert, XCircle } from 'lucide-react'
import { vi } from '@/i18n/vi'
import { cn } from '@/lib/utils'
import { formatScore, scoreBand, type Band, type Bands } from './compliance'

// Tách riêng (không kéo theo thư viện biểu đồ) để trang Báo cáo dùng được.
const t = vi.dashboard

// ---------------------------------------------------------------------------
// Mức điểm
// ---------------------------------------------------------------------------
const BAND_STYLE: Record<Band, { cls: string; Icon: typeof CheckCircle2 }> = {
  good: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', Icon: CheckCircle2 },
  warn: { cls: 'bg-amber-50 text-amber-800 ring-amber-600/20', Icon: TriangleAlert },
  bad: { cls: 'bg-rose-50 text-rose-700 ring-rose-600/15', Icon: XCircle },
  none: { cls: 'bg-slate-100 text-slate-500 ring-slate-500/10', Icon: CircleDashed },
}

/** Màu + biểu tượng + chữ (không chỉ dựa vào màu) */
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
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        cls,
        className,
      )}
      title={t.compliance.bands[band]}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="tabular-nums">{formatScore(score)}</span>
      {showLabel ? (
        <span className="font-medium opacity-80">· {t.compliance.bands[band]}</span>
      ) : (
        <span className="sr-only">{t.compliance.bands[band]}</span>
      )}
    </span>
  )
}
