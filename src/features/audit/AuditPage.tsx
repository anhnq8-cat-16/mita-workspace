import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { useMe } from '@/features/auth/auth-context'
import { useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { AuditAction, AuditLogRow, Json } from '@/lib/database.types'
import { downloadCsv } from '@/lib/csv'
import { formatDateTimeVN, formatDateVN, todayVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import { useAuditLog, useCronRuns, useOutbox, type AuditFilters } from './api'
import { ACTION_LABELS, changedFields, formatValue, recordLabel, TABLE_LABELS } from './audit-rules'

const t = vi.audit
type Tab = 'changes' | 'system'

const ACTION_VARIANT = { insert: 'success', update: 'default', delete: 'destructive' } as const

function Entry({ row, nameOf }: { row: AuditLogRow; nameOf: (id: string) => string | undefined }) {
  const [open, setOpen] = useState(false)
  const fields = changedFields(row)
  const actor = row.actor_id ? (nameOf(row.actor_id) ?? row.actor_id.slice(0, 8)) : t.system
  const preview = row.action === 'update' ? fields.map((f) => f.label).join(', ') : ''
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted"
      >
        <Avatar name={actor} className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm sm:line-clamp-1">
            <strong className="font-medium">{actor}</strong>{' '}
            <span className="text-muted-foreground">
              {ACTION_LABELS[row.action].toLowerCase()}{' '}
              {TABLE_LABELS[row.table_name]?.toLowerCase()}
            </span>{' '}
            <span className="font-medium">{recordLabel(row)}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatDateTimeVN(row.at)}
            {preview && ` · ${preview}`}
          </p>
        </div>
        <Badge variant={ACTION_VARIANT[row.action]} className="hidden sm:inline-flex">
          {ACTION_LABELS[row.action]}
        </Badge>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="overflow-x-auto px-4 pb-3">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noFields}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">{t.field}</th>
                  {row.action !== 'insert' && <th className="py-1 pr-3 font-medium">{t.before}</th>}
                  {row.action !== 'delete' && <th className="py-1 font-medium">{t.after}</th>}
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.field} className="border-t border-border align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">
                      {f.label}
                    </td>
                    {row.action !== 'insert' && (
                      <td className="py-1.5 pr-3 break-words text-destructive/90 line-through decoration-destructive/30">
                        {formatValue(f.field, f.old, nameOf)}
                      </td>
                    )}
                    {row.action !== 'delete' && (
                      <td className="py-1.5 break-words">{formatValue(f.field, f.new, nameOf)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </li>
  )
}

function ChangesTab() {
  const [params, setParams] = useSearchParams()
  const users = useUsers()
  const filters: AuditFilters = {
    table: params.get('table') ?? undefined,
    actor: params.get('actor') ?? undefined,
    action: (params.get('action') as AuditAction | null) ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  }
  const q = useAuditLog(filters)
  const rows = q.data?.pages.flat() ?? []
  const nameOf = (id: string) => {
    const u = users.data?.find((x) => x.id === id)
    return u ? (u.full_name ?? u.email) : undefined
  }
  const set = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const hasFilter = Object.values(filters).some(Boolean)

  function exportCsv() {
    downloadCsv(
      `nhat-ky-${todayVN()}`,
      [t.time, t.actor, t.action, t.table, t.record, t.changes],
      rows.map((r) => [
        formatDateTimeVN(r.at),
        r.actor_id ? (nameOf(r.actor_id) ?? r.actor_id) : t.system,
        ACTION_LABELS[r.action],
        TABLE_LABELS[r.table_name] ?? r.table_name,
        recordLabel(r),
        changedFields(r)
          .map((f) =>
            r.action === 'update'
              ? `${f.label}: ${formatValue(f.field, f.old, nameOf)} → ${formatValue(f.field, f.new, nameOf)}`
              : `${f.label}: ${formatValue(f.field, (f.new ?? f.old) as Json, nameOf)}`,
          )
          .join('; '),
      ]),
    )
  }

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5 [&>*]:min-w-0">
        <Select
          aria-label={t.table}
          value={filters.table ?? ''}
          onChange={(e) => set('table', e.target.value)}
        >
          <option value="">{t.allTables}</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t.actor}
          value={filters.actor ?? ''}
          onChange={(e) => set('actor', e.target.value)}
        >
          <option value="">{t.allActors}</option>
          <option value="system">{t.system}</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name ?? u.email}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t.action}
          value={filters.action ?? ''}
          onChange={(e) => set('action', e.target.value)}
        >
          <option value="">{t.allActions}</option>
          {(Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label={t.from}
          title={t.from}
          value={filters.from ?? ''}
          max={todayVN()}
          onChange={(e) => set('from', e.target.value)}
        />
        <Input
          type="date"
          aria-label={t.to}
          title={t.to}
          value={filters.to ?? ''}
          max={todayVN()}
          onChange={(e) => set('to', e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filters.from || filters.to
            ? `${formatDateVN(filters.from) || '…'} – ${formatDateVN(filters.to) || '…'}`
            : null}
        </p>
        <div className="flex gap-2">
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
              {t.clear}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            {vi.dashboard.exportTitle}
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {q.isPending && (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          )}
          {q.error && <ErrorBox error={q.error} />}
          {q.data && rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">{t.empty}</p>
          )}
          <ul>
            {rows.map((r) => (
              <Entry key={r.id} row={r} nameOf={nameOf} />
            ))}
          </ul>
        </CardContent>
      </Card>
      {q.hasNextPage && (
        <Button
          variant="outline"
          className="justify-self-center"
          disabled={q.isFetchingNextPage}
          onClick={() => q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? vi.common.loading : t.loadMore}
        </Button>
      )}
    </div>
  )
}

function SystemTab() {
  const [onlyProblems, setOnlyProblems] = useState(true)
  const cron = useCronRuns(true)
  const outbox = useOutbox(true, onlyProblems)
  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <Card>
        <CardHeader>
          <CardTitle>{t.cron}</CardTitle>
          <CardDescription>{t.cronHint}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {cron.error && <ErrorBox error={cron.error} />}
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t.job}</th>
                <th className="px-2 py-2 font-medium">{t.runDate}</th>
                <th className="px-2 py-2 font-medium">{t.ranAt}</th>
                <th className="px-4 py-2 font-medium">{t.result}</th>
              </tr>
            </thead>
            <tbody>
              {cron.data?.map((r) => (
                <tr
                  key={`${r.job}-${r.run_date}`}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-2 font-mono text-xs">{r.job}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDateVN(r.run_date)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDateTimeVN(r.ran_at)}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.error ? (
                      <span className="text-destructive">{r.error}</span>
                    ) : (
                      <span className="font-mono text-muted-foreground">
                        {r.result ? JSON.stringify(r.result) : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{t.outbox}</CardTitle>
            <CardDescription>{t.outboxHint}</CardDescription>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={onlyProblems}
              onChange={(e) => setOnlyProblems(e.target.checked)}
            />
            {t.onlyProblems}
          </label>
        </CardHeader>
        <CardContent className="p-0">
          {outbox.error && <ErrorBox error={outbox.error} />}
          {outbox.data?.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">{vi.common.empty}</p>
          )}
          <ul>
            {outbox.data?.map((o) => (
              <li
                key={o.id}
                className="grid gap-0.5 border-b border-border px-4 py-2 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge
                    variant={
                      o.status === 'sent'
                        ? 'success'
                        : o.status === 'failed'
                          ? 'destructive'
                          : 'warning'
                    }
                  >
                    {t.outboxStatus[o.status]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate font-medium">{o.subject ?? o.type}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTimeVN(o.created_at)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {o.channel === 'chat' ? 'Google Chat' : o.recipient} · {t.attempts} {o.attempts}
                </p>
                {o.last_error && (
                  <p className="text-xs break-words text-destructive">{o.last_error}</p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

/** /nhat-ky: quản lý + admin xem nhật ký thay đổi; admin xem thêm tình trạng hệ thống */
export function AuditPage() {
  const me = useMe()
  const [tab, setTab] = useState<Tab>('changes')
  const isAdmin = me.role === 'admin'
  return (
    <div className="mx-auto grid max-w-4xl gap-4 [&>*]:min-w-0">
      <div>
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>
      {isAdmin && (
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'changes', label: t.tabs.changes },
            { value: 'system', label: t.tabs.system },
          ]}
        />
      )}
      {tab === 'changes' || !isAdmin ? <ChangesTab /> : <SystemTab />}
    </div>
  )
}
