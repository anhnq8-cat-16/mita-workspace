import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useSetting, useUsers } from '@/features/settings/api'
import { goalPercent } from '@/features/goals/goal-math'
import { vi } from '@/i18n/vi'
import type { OrderRow } from '@/lib/database.types'
import { formatDateVN, todayVN } from '@/lib/date-vn'
import { formatVND } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCustomers, useOrders, useSalesActor } from './api'
import { OrderForm } from './CustomersView'
import { canReadAllSales, monthRange, orderStatusVariant, revenue } from './sales-rules'

const t = vi.sales

function shiftMonth(ym: string, d: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number]
  const date = new Date(Date.UTC(y, m - 1 + d, 1))
  return date.toISOString().slice(0, 7)
}

export function OrdersView() {
  const actor = useSalesActor()
  const users = useUsers()
  const customers = useCustomers()
  const kpi = useSetting<number>('kpi_monthly_revenue_vnd') ?? 150_000_000
  const [ym, setYm] = useState(todayVN().slice(0, 7))
  const { from, to } = monthRange(ym)
  const orders = useOrders(from, to)
  const [editing, setEditing] = useState<OrderRow | 'new' | null>(null)
  const all = canReadAllSales(actor)
  const total = revenue(orders.data ?? [])
  const percent = goalPercent(total, kpi)
  const customerName = (id: string) => customers.data?.find((c) => c.id === id)?.name ?? ''
  const salesName = (id: string | null) => users.data?.find((u) => u.id === id)?.full_name ?? ''
  const mine = (customers.data ?? []).filter((c) => all || c.owner_id === actor.id)

  // Doanh số theo người (quản lý xem)
  const bySales = new Map<string, OrderRow[]>()
  for (const o of orders.data ?? [])
    bySales.set(o.sales_id ?? '', [...(bySales.get(o.sales_id ?? '') ?? []), o])

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-lg bg-muted p-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tháng trước"
          onClick={() => setYm(shiftMonth(ym, -1))}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium">
          {t.month} {ym.slice(5)}/{ym.slice(0, 4)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tháng sau"
          onClick={() => setYm(shiftMonth(ym, 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-2 p-4">
          <p className="text-sm text-muted-foreground">{all ? t.teamRevenue : t.myRevenue}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatVND(total)}</p>
          {all && (
            <>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={percent}
              >
                <div
                  className={cn(
                    'h-full rounded-full',
                    percent >= 100 ? 'bg-success' : 'bg-primary',
                  )}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.kpi(`${percent}%`, formatVND(kpi))}
              </p>
              <ul className="mt-2 grid gap-1 text-sm">
                {[...bySales.entries()].map(([id, list]) => (
                  <li key={id || 'none'} className="flex justify-between">
                    <span>{salesName(id) || '—'}</span>
                    <span className="tabular-nums">{formatVND(revenue(list))}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-xs text-muted-foreground">{t.accountingNote}</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setEditing('new')} disabled={mine.length === 0}>
          <Plus /> {t.newOrder}
        </Button>
      </div>

      {orders.isPending && <Spinner />}
      {orders.error && <ErrorBox error={orders.error} />}
      <Card>
        <CardContent className="p-0">
          {orders.data?.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">{t.ordersEmpty}</p>
          )}
          <ul>
            {orders.data?.map((o) => (
              <li key={o.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  className="grid w-full gap-1 px-4 py-3 text-left hover:bg-muted"
                  onClick={() => setEditing(o)}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {customerName(o.customer_id)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatVND(o.total_value_vnd)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateVN(o.order_date)}</span>
                    <Badge variant={orderStatusVariant(o.status)}>{vi.orderStatus[o.status]}</Badge>
                    {all && <span>{salesName(o.sales_id)}</span>}
                    {o.items_summary && <span className="truncate">{o.items_summary}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t.newOrder : t.orders}
      >
        {editing && (
          <OrderForm
            order={editing === 'new' ? undefined : editing}
            customers={editing === 'new' ? mine : (customers.data ?? [])}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}
