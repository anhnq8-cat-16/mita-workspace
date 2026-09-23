import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { teamIds, useMe } from '@/features/auth/auth-context'
import { useSetting } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { ReportResult } from '@/lib/database.types'
import { formatDateTimeVN, formatTimeVN } from '@/lib/date-vn'
import { formatVND } from '@/lib/format'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { useAddAmendment, useReportAutofill, useSubmitReport } from './api'
import { ReportBadge } from './badges'
import { reportState } from './day-status'
import {
  activeItems,
  initialMetrics,
  normalizeMetrics,
  templatesFor,
  toReportItems,
  validateReport,
  type AutofillValues,
  type ItemResult,
  type ReportTemplates,
} from './report-draft'
import type { DayDetail, DayReport, MetricField, PlanItem } from './types'

const t = vi.daily
const RESULTS: ReportResult[] = ['done', 'partial', 'not_done']

function ResultPicker({
  value,
  onChange,
}: {
  value: ReportResult | null
  onChange: (r: ReportResult) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
      {RESULTS.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={cn(
            'min-h-10 rounded-md px-2 text-xs font-medium text-muted-foreground',
            value === r && r === 'done' && 'bg-success text-white',
            value === r && r === 'partial' && 'bg-warning text-warning-foreground',
            value === r && r === 'not_done' && 'bg-destructive text-white',
          )}
        >
          {vi.results[r]}
        </button>
      ))}
    </div>
  )
}

function ReportForm({ day, autofill }: { day: DayDetail; autofill: AutofillValues }) {
  const me = useMe()
  const submit = useSubmitReport()
  const templates = useSetting<ReportTemplates>('report_templates')
  const groups = templatesFor(teamIds(me), templates)
  const items = activeItems(day.plan!.items)
  const [results, setResults] = useState<Record<string, ItemResult>>({})
  const [metrics, setMetrics] = useState<Record<string, Record<string, string>>>(() =>
    initialMetrics(groups, autofill),
  )
  const [blockers, setBlockers] = useState('')
  const [needDecision, setNeedDecision] = useState('')
  const [tomorrowNote, setTomorrowNote] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  function setResult(id: string, patch: Partial<ItemResult>) {
    setResults((prev) => ({
      ...prev,
      [id]: { result: prev[id]?.result ?? null, reason: prev[id]?.reason ?? '', ...patch },
    }))
  }

  async function onSubmit() {
    const problem = validateReport(items, results)
    setLocalError(problem)
    if (problem) return
    await submit.mutateAsync({
      items: toReportItems(items, results),
      metrics: normalizeMetrics(groups, metrics),
      blockers,
      needDecision,
      tomorrowNote,
    })
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {items.map((item) => {
          const r = results[item.id]
          return (
            <li key={item.id} className="grid gap-2 border-b border-border pb-3 last:border-b-0">
              <p className="text-sm font-medium">{item.title}</p>
              <ResultPicker
                value={r?.result ?? null}
                onChange={(result) => setResult(item.id, { result })}
              />
              {r?.result && r.result !== 'done' && (
                <Input
                  value={r.reason}
                  placeholder={t.reasonPlaceholder}
                  aria-label={t.reasonPlaceholder}
                  onChange={(e) => setResult(item.id, { reason: e.target.value })}
                />
              )}
            </li>
          )
        })}
      </ul>

      {groups.map(({ team, fields }) => (
        <fieldset key={team} className="grid gap-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">
            {t.metrics} · {vi.teams[team] ?? team}
          </legend>
          {fields.some((f) => f.auto) && (
            <p className="text-xs text-muted-foreground">{vi.checkin.autofill}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <MetricInput
                key={f.key}
                field={f}
                value={metrics[team]?.[f.key] ?? ''}
                onChange={(v) =>
                  setMetrics((prev) => ({ ...prev, [team]: { ...prev[team], [f.key]: v } }))
                }
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="grid gap-1.5">
        <Label htmlFor="blockers">{t.blockers}</Label>
        <Textarea
          id="blockers"
          rows={2}
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="need-decision">{t.needDecision}</Label>
        <Textarea
          id="need-decision"
          rows={2}
          value={needDecision}
          onChange={(e) => setNeedDecision(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tomorrow">{t.tomorrowNote}</Label>
        <Textarea
          id="tomorrow"
          rows={2}
          value={tomorrowNote}
          onChange={(e) => setTomorrowNote(e.target.value)}
        />
      </div>
      <FieldError>{localError ?? submit.error?.message}</FieldError>
      <Button size="lg" onClick={onSubmit} disabled={submit.isPending}>
        {submit.isPending ? t.submitting : t.submitReport}
      </Button>
    </div>
  )
}

/** Chờ số liệu tự điền (check-in, lead, đơn trong ngày) rồi mới hiện form */
function ReportFormLoader({ day }: { day: DayDetail }) {
  const autofill = useReportAutofill()
  if (autofill.isPending)
    return <p className="text-sm text-muted-foreground">{vi.common.loading}</p>
  return <ReportForm day={day} autofill={autofill.data ?? {}} />
}

function MetricInput({
  field,
  value,
  onChange,
}: {
  field: MetricField
  value: string
  onChange: (v: string) => void
}) {
  const id = `metric-${field.key}`
  if (field.type === 'links') {
    return (
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea
          id={id}
          rows={2}
          value={value}
          placeholder={t.linksPlaceholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  return (
    <div className={cn('grid gap-1.5', field.type === 'money' && 'col-span-2')}>
      <Label htmlFor={id} className="text-xs">
        {field.label}
      </Label>
      <Input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** Nội dung báo cáo đã nộp (chỉ đọc) */
export function ReportContent({ day, report }: { day: DayDetail; report: DayReport }) {
  const me = useMe()
  const templates = useSetting<ReportTemplates>('report_templates')
  const itemsById = new Map((day.plan?.items ?? []).map((i) => [i.id, i] as const))
  const metrics = (report.metrics ?? {}) as Record<string, Record<string, number | string>>

  return (
    <div className="grid gap-3 text-sm">
      <ul>
        {report.items.map((ri) => {
          const item: PlanItem | undefined = ri.plan_item_id
            ? itemsById.get(ri.plan_item_id)
            : undefined
          return (
            <li
              key={ri.id}
              className="flex items-start gap-2 border-b border-border py-2 last:border-b-0"
            >
              <span
                className={cn(
                  'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  ri.result === 'done' && 'bg-success/15 text-success',
                  ri.result === 'partial' && 'bg-warning/20 text-warning-foreground',
                  ri.result === 'not_done' && 'bg-destructive/10 text-destructive',
                )}
              >
                {vi.results[ri.result]}
              </span>
              <div className="min-w-0">
                <p>{item?.title ?? '—'}</p>
                {ri.reason && <p className="text-xs text-muted-foreground">{ri.reason}</p>}
              </div>
            </li>
          )
        })}
      </ul>
      {Object.entries(metrics).map(([team, values]) => {
        const fields = templates?.[team] ?? []
        const entries = Object.entries(values)
        if (entries.length === 0) return null
        return (
          <div key={team} className="rounded-lg bg-muted p-3">
            <p className="mb-1 font-medium">
              {t.metrics} · {vi.teams[team] ?? team}
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              {entries.map(([key, v]) => {
                const f = fields.find((x) => x.key === key)
                return (
                  <div key={key} className={f?.type === 'links' ? 'col-span-2' : ''}>
                    <dt className="text-xs text-muted-foreground">{f?.label ?? key}</dt>
                    <dd className="break-words whitespace-pre-line">
                      {f?.type === 'money' ? formatVND(Number(v)) : String(v)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        )
      })}
      {[
        [t.blockers, report.blockers],
        [t.needDecision, report.need_decision],
        [t.tomorrowNote, report.tomorrow_note],
      ].map(([label, text]) =>
        text ? (
          <div key={label}>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="whitespace-pre-line">{text}</p>
          </div>
        ) : null,
      )}
      {report.reviewed_at && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="font-medium text-success">{t.reviewed}</p>
          {report.review_comment && <p>{report.review_comment}</p>}
        </div>
      )}
      <Amendments
        report={report}
        canAdd={report.user_id === me.id && Boolean(report.submitted_at)}
      />
    </div>
  )
}

function Amendments({ report, canAdd }: { report: DayReport; canAdd: boolean }) {
  const add = useAddAmendment()
  const [body, setBody] = useState('')
  if (!canAdd && report.amendments.length === 0) return null
  return (
    <div className="grid gap-2 border-t border-border pt-3">
      <p className="font-medium">{t.amendments}</p>
      {report.amendments.map((a) => (
        <div key={a.id} className="rounded-lg bg-muted p-2">
          <p className="whitespace-pre-line">{a.body}</p>
          <p className="text-xs text-muted-foreground">
            {a.author_name} · {formatDateTimeVN(a.created_at)}
          </p>
        </div>
      ))}
      {canAdd && (
        <>
          <Textarea
            rows={2}
            value={body}
            placeholder={t.amendmentPlaceholder}
            aria-label={t.addAmendment}
            onChange={(e) => setBody(e.target.value)}
          />
          <FieldError>{add.error?.message}</FieldError>
          <Button
            variant="secondary"
            size="sm"
            className="justify-self-start"
            disabled={!body.trim() || add.isPending}
            onClick={async () => {
              await add.mutateAsync({ reportId: report.id, body })
              setBody('')
            }}
          >
            {t.addAmendment}
          </Button>
        </>
      )}
    </div>
  )
}

/** Báo cáo cuối ngày hôm nay: chưa mở / form / đã khóa */
export function ReportCard({ day }: { day: DayDetail }) {
  const now = useNow()
  const state = reportState(day, now)
  const report = day.report

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>{t.reportTitle}</CardTitle>
        {report && <ReportBadge submitted={Boolean(report.submitted_at)} status={report.status} />}
      </CardHeader>
      <CardContent className="grid gap-3">
        {state === 'no_plan' && <p className="text-sm text-muted-foreground">{t.reportNoPlan}</p>}
        {state === 'not_open' && (
          <p className="text-sm text-muted-foreground">
            {t.reportNotOpen(formatTimeVN(day.deadlines.report_open))} ·{' '}
            {t.reportDeadline(formatTimeVN(day.deadlines.report_deadline))}
          </p>
        )}
        {(state === 'open' || state === 'open_late') && (
          <>
            <p
              className={cn(
                'text-sm',
                state === 'open_late' ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {state === 'open_late'
                ? t.reportLateWarning(formatTimeVN(day.deadlines.report_deadline))
                : t.reportDeadline(formatTimeVN(day.deadlines.report_deadline))}
            </p>
            <ReportFormLoader day={day} />
          </>
        )}
        {state === 'missed' && <p className="text-sm text-destructive">{t.reportMissed}</p>}
        {state === 'locked' && report && (
          <>
            <p className="text-xs text-muted-foreground">
              {t.reportLocked} · {formatDateTimeVN(report.submitted_at)}
            </p>
            <ReportContent day={day} report={report} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
