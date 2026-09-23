import { Download } from 'lucide-react'
import { useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { vi } from '@/i18n/vi'
import { downloadCsv, type CsvCell } from '@/lib/csv'
import { formatDateVN } from '@/lib/date-vn'
import { formatVND } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CHART, compactVND, STATUS, useReducedMotion, type CumulativePoint } from './chart-theme'
import { formatScore, scoreBand, type Bands } from './compliance'

const t = vi.dashboard

// ---------------------------------------------------------------------------
// Khung thẻ bento
// ---------------------------------------------------------------------------
const HOVER = {
  /** thẻ nhỏ/vừa: phóng nhẹ 2% + bóng mịn */
  scale: 'motion-safe:hover:scale-[1.02]',
  /** thẻ bảng dữ liệu rộng: phóng 1% để chữ không nhòe */
  subtle: 'motion-safe:hover:scale-[1.01]',
  /** thẻ có bản đồ: chỉ tăng bóng (bản đồ bị lệch khi phóng to) */
  lift: '',
} as const

export function BentoCard({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  hover = 'scale',
  delay = 0,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  icon?: typeof Download
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  hover?: keyof typeof HOVER
  /** thứ tự xuất hiện khi tải trang (ms) */
  delay?: number
}) {
  return (
    <section
      className={cn(
        'animate-fade-up flex min-w-0 flex-col rounded-2xl border border-slate-200/70 bg-card p-5 shadow-sm transition-[transform,box-shadow] duration-300 ease-out hover:shadow-[0_18px_40px_-18px_rgba(15,23,42,0.22)] sm:p-6',
        HOVER[hover],
        className,
      )}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {(title || actions) && (
        <header className="mb-5 flex items-start gap-3">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <Icon className="size-[18px]" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-[15px] leading-6 font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', bodyClassName)}>{children}</div>
    </section>
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
    <button
      type="button"
      title={t.exportTitle}
      aria-label={t.exportTitle}
      onClick={() => downloadCsv(filename, header, rows())}
      className="flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-9"
    >
      <Download className="size-4" />
    </button>
  )
}

/** Điều khiển dạng viên (Ngày / Tuần / Tháng) */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl bg-slate-100 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'min-h-9 rounded-lg px-3.5 text-sm font-medium text-slate-500 transition-all duration-200 hover:text-slate-900',
            value === it.value && 'bg-white text-slate-900 shadow-sm',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tooltip chung cho biểu đồ
// ---------------------------------------------------------------------------
function Tip({
  title,
  rows,
}: {
  title: React.ReactNode
  rows: [React.ReactNode, React.ReactNode][]
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg shadow-slate-900/10 backdrop-blur">
      <p className="mb-1 font-medium text-slate-500">{title}</p>
      {rows.map(([k, v], i) => (
        <p key={i} className="flex items-center justify-between gap-4">
          <span className="text-slate-500">{k}</span>
          <strong className="font-semibold text-slate-900 tabular-nums">{v}</strong>
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thẻ chỉ số (KPI)
// ---------------------------------------------------------------------------
export function KpiTile({
  label,
  value,
  foot,
  visual,
  tone,
  delay,
}: {
  label: string
  value: React.ReactNode
  foot?: React.ReactNode
  visual?: React.ReactNode
  tone?: 'bad'
  delay?: number
}) {
  return (
    <BentoCard hover="scale" delay={delay}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 pt-1 text-xs font-medium text-muted-foreground">{label}</p>
        {visual && <div className="-mt-1 -mr-1 shrink-0">{visual}</div>}
      </div>
      <p
        className={cn(
          'mt-2 text-[28px] leading-9 font-semibold tracking-tight tabular-nums',
          tone === 'bad' ? 'text-rose-600' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {foot && <div className="mt-1 text-xs text-muted-foreground">{foot}</div>}
    </BentoCard>
  )
}

/** Vòng tiến độ 0–100% (có hiệu ứng khi tải) */
export function Ring({
  percent,
  color = CHART.accent,
  size = 52,
  label,
}: {
  percent: number
  color?: string
  size?: number
  label: string
}) {
  const reduced = useReducedMotion()
  const v = Math.max(0, Math.min(100, percent))
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={label}>
      <RadialBarChart
        width={size}
        height={size}
        innerRadius={size / 2 - 7}
        outerRadius={size / 2}
        data={[{ value: v }]}
        startAngle={90}
        endAngle={-270}
        barSize={6}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar
          dataKey="value"
          background={{ fill: CHART.accentSoft }}
          cornerRadius={8}
          fill={color}
          isAnimationActive={!reduced}
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </RadialBarChart>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground tabular-nums">
        {Math.round(percent)}%
      </span>
    </div>
  )
}

/** Vùng xu hướng nhỏ (điểm trung bình theo tuần) */
export function MiniArea({ points }: { points: { label: string; value: number | null }[] }) {
  const reduced = useReducedMotion()
  return (
    <div className="h-12 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="mini-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, 100]} />
          <Tooltip
            cursor={{ stroke: CHART.grid }}
            wrapperStyle={{ zIndex: 20 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Tip
                  title={(payload[0]!.payload as { label: string }).label}
                  rows={[[t.compliance.avg, formatScore(payload[0]!.value as number | null)]]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={CHART.accent}
            strokeWidth={2}
            fill="url(#mini-area)"
            connectNulls
            dot={false}
            activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
            isAnimationActive={!reduced}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Xu hướng 4 tuần của 1 người: chấm màu theo mức, di chuột xem điểm */
export function Sparkline({
  points,
  bands,
}: {
  points: { label: string; value: number | null }[]
  bands: Bands
}) {
  const reduced = useReducedMotion()
  const label = points.map((p) => `${p.label}: ${formatScore(p.value)}`).join('; ')
  return (
    <div className="h-9 w-28" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <YAxis hide domain={[0, 100]} />
          <ReferenceLine y={bands.good} stroke={CHART.grid} strokeDasharray="2 3" />
          <Tooltip
            cursor={{ stroke: CHART.grid }}
            wrapperStyle={{ zIndex: 20 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Tip
                  title={(payload[0]!.payload as { label: string }).label}
                  rows={[[t.compliance.score, formatScore(payload[0]!.value as number | null)]]}
                />
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART.reference}
            strokeWidth={2}
            isAnimationActive={!reduced}
            animationDuration={800}
            dot={(p: { cx?: number; cy?: number; index?: number; value?: number | null }) =>
              p.value === null || p.value === undefined || p.cx === undefined ? (
                <g key={`d-${p.index}`} />
              ) : (
                <circle
                  key={`d-${p.index}`}
                  cx={p.cx}
                  cy={p.cy}
                  r={4}
                  fill={STATUS[scoreBand(p.value, bands)]}
                  stroke={CHART.surface}
                  strokeWidth={2}
                />
              )
            }
            activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Thanh ngang 1 màu (độ lớn), số ở cuối thanh, di chuột xem chi tiết */
export function HBarChart({
  rows,
  name,
}: {
  rows: { key: string; label: string; value: number; detail?: string }[]
  name: string
}) {
  const reduced = useReducedMotion()
  return (
    <div style={{ height: rows.length * 40 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
          barCategoryGap={10}
        >
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            type="category"
            dataKey="label"
            width={118}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART.axis, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0]!.payload as (typeof rows)[number]
              const extra: [string, string][] = r.detail ? [['', r.detail]] : []
              return <Tip title={r.label} rows={[[name, r.value], ...extra]} />
            }}
          />
          <Bar
            dataKey="value"
            fill={CHART.accent}
            radius={[0, 4, 4, 0]}
            maxBarSize={16}
            activeBar={{ fill: '#4338ca' }}
            isAnimationActive={!reduced}
            animationDuration={900}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              style={{ fill: CHART.ink, fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Doanh số lũy kế trong tháng so với đường tiến độ KPI (1 trục) */
export function RevenueChart({ data, kpi }: { data: CumulativePoint[]; kpi: number }) {
  const reduced = useReducedMotion()
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: CHART.accent }} />
          {t.sales.cumulative}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: CHART.reference }} />
          {t.sales.pace}
        </span>
      </div>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rev-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART.accent} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 4" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(8, 10)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART.axis, fontSize: 11 }}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={compactVND}
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART.axis, fontSize: 11 }}
              width={52}
              domain={[0, (max: number) => Math.max(max, kpi)]}
            />
            <ReferenceLine
              y={kpi}
              stroke={CHART.reference}
              strokeDasharray="4 4"
              label={{
                value: `KPI ${compactVND(kpi)}`,
                position: 'insideTopRight',
                fill: CHART.axis,
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ stroke: CHART.reference, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]!.payload as CumulativePoint
                return (
                  <Tip
                    title={formatDateVN(p.date)}
                    rows={[
                      [t.sales.cumulative, formatVND(p.actual)],
                      [t.sales.pace, formatVND(p.pace)],
                    ]}
                  />
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="pace"
              stroke={CHART.reference}
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="none"
              dot={false}
              activeDot={false}
              isAnimationActive={!reduced}
              animationDuration={900}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke={CHART.accent}
              strokeWidth={2}
              fill="url(#rev-area)"
              dot={false}
              activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
              isAnimationActive={!reduced}
              animationDuration={1100}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Thanh xếp chồng trạng thái (Đúng giờ / Trễ / Chưa nộp / Nghỉ) + chú thích có số */
export function StatusBar({
  segments,
}: {
  segments: { key: string; label: string; value: number; color: string }[]
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const [hover, setHover] = useState<string | null>(null)
  if (total === 0) return null
  return (
    <div className="grid gap-2.5">
      <div className="animate-bar-grow flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.value}`}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                'h-full transition-opacity duration-200 first:rounded-l-full last:rounded-r-full',
                hover && hover !== s.key && 'opacity-40',
              )}
              style={{ width: `${(100 * s.value) / total}%`, background: s.color }}
            />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((s) => (
          <li
            key={s.key}
            className={cn(
              'flex items-center gap-1.5 text-muted-foreground transition-opacity',
              hover && hover !== s.key && 'opacity-40',
            )}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
            <strong className="font-semibold text-foreground tabular-nums">{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Thanh tiến độ có hiệu ứng, vạch "tiến độ kỳ vọng" tùy chọn */
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
      className="relative h-2 rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          'animate-bar-grow h-full rounded-full',
          percent >= 100 ? 'bg-emerald-500' : 'bg-primary',
        )}
        style={{ width: `${clamped}%` }}
      />
      {expected !== undefined && (
        <div
          className="absolute -inset-y-1 w-0.5 rounded-full bg-slate-400"
          style={{ left: `${Math.max(0, Math.min(100, expected))}%` }}
          title={t.sales.pace}
        />
      )}
    </div>
  )
}
