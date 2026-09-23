import { ChevronRight, ExternalLink, Plus } from 'lucide-react'
import { useState } from 'react'
import { MapView } from '@/components/MapView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { CustomerRow, CustomerType, OrderRow, OrderStatus } from '@/lib/database.types'
import { formatDateTimeVN, formatDateVN, todayVN } from '@/lib/date-vn'
import { formatVND, parseVND } from '@/lib/format'
import {
  useCustomer,
  useCustomerCheckIns,
  useCustomerOrders,
  useCustomers,
  useMergeCustomers,
  useSalesActor,
  useSaveCustomer,
  useSaveOrder,
  type CustomerInput,
} from './api'
import { CUSTOMER_TYPES, isSalesAdmin, ORDER_STATUSES, orderStatusVariant } from './sales-rules'

const t = vi.sales

export function CustomerForm({
  customer,
  onDone,
}: {
  customer?: CustomerRow
  onDone: (id: string) => void
}) {
  const save = useSaveCustomer()
  const actor = useSalesActor()
  const users = useUsers()
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    type: customer?.type ?? ('cafe' as CustomerType),
    contact_name: customer?.contact_name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    district: customer?.district ?? '',
    notes: customer?.notes ?? '',
    status: customer?.status ?? 'active',
    owner_id: customer?.owner_id ?? '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))
  const admin = isSalesAdmin(actor)
  const sales = (users.data ?? []).filter(
    (u) => u.is_active && u.teams.some((m) => m.team_id === 'sales_domestic'),
  )

  const input = (
    k: 'name' | 'contact_name' | 'phone' | 'email' | 'address' | 'district',
    label: string,
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`cu-${k}`}>{label}</Label>
      <Input id={`cu-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  )

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const input: CustomerInput = {
          name: form.name.trim(),
          type: form.type,
          contact_name: form.contact_name.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim().toLowerCase() || null,
          address: form.address.trim() || null,
          district: form.district.trim() || null,
          notes: form.notes.trim() || null,
          status: form.status,
        }
        if (admin && form.owner_id) input.owner_id = form.owner_id
        onDone(await save.mutateAsync({ id: customer?.id, input }))
      }}
    >
      {input('name', t.fields.name)}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cu-type">{t.fields.type}</Label>
          <Select
            id="cu-type"
            value={form.type}
            onChange={(e) => set('type', e.target.value as CustomerType)}
          >
            {CUSTOMER_TYPES.map((c) => (
              <option key={c} value={c}>
                {vi.customerTypes[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cu-status">{t.fields.status}</Label>
          <Select
            id="cu-status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
          >
            <option value="active">Đang giao dịch</option>
            <option value="inactive">Ngừng</option>
          </Select>
        </div>
        {input('contact_name', t.fields.contact)}
        {input('phone', t.fields.phone)}
        {input('email', t.fields.email)}
        {input('district', t.fields.district)}
      </div>
      {input('address', t.fields.address)}
      {admin && (
        <div className="grid gap-1.5">
          <Label htmlFor="cu-owner">{t.fields.owner}</Label>
          <Select
            id="cu-owner"
            value={form.owner_id}
            onChange={(e) => set('owner_id', e.target.value)}
          >
            <option value="">{t.none}</option>
            {sales.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.email}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="cu-notes">{t.fields.notes}</Label>
        <Textarea
          id="cu-notes"
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
      <FieldError>{save.error?.message}</FieldError>
      <Button type="submit" disabled={save.isPending || !form.name.trim()}>
        {save.isPending ? vi.common.saving : vi.common.save}
      </Button>
    </form>
  )
}

export function OrderForm({
  order,
  customers,
  defaultCustomer,
  onDone,
}: {
  order?: OrderRow
  customers: Pick<CustomerRow, 'id' | 'name'>[]
  defaultCustomer?: string
  onDone: () => void
}) {
  const save = useSaveOrder()
  const [form, setForm] = useState({
    customer_id: order?.customer_id ?? defaultCustomer ?? '',
    order_date: order?.order_date ?? todayVN(),
    total: order?.total_value_vnd?.toString() ?? '',
    status: order?.status ?? ('confirmed' as OrderStatus),
    items: order?.items_summary ?? '',
    note: order?.note ?? '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        await save.mutateAsync({
          id: order?.id,
          input: {
            customer_id: form.customer_id,
            order_date: form.order_date,
            total_value_vnd: parseVND(form.total) ?? 0,
            status: form.status,
            items_summary: form.items.trim() || null,
            note: form.note.trim() || null,
          },
        })
        onDone()
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="od-customer">{t.orderCustomer}</Label>
        <Select
          id="od-customer"
          value={form.customer_id}
          onChange={(e) => set('customer_id', e.target.value)}
          required
        >
          <option value="">{vi.checkin.pick}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="od-date">{t.orderDate}</Label>
          <Input
            id="od-date"
            type="date"
            value={form.order_date}
            onChange={(e) => set('order_date', e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="od-status">{t.fields.status}</Label>
          <Select
            id="od-status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as OrderStatus)}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {vi.orderStatus[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="od-total">{t.orderValue}</Label>
        <Input
          id="od-total"
          inputMode="numeric"
          value={form.total}
          onChange={(e) => set('total', e.target.value)}
          required
        />
        {parseVND(form.total) ? (
          <p className="text-xs text-muted-foreground">{formatVND(parseVND(form.total))}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="od-items">{t.orderItems}</Label>
        <Textarea
          id="od-items"
          rows={2}
          value={form.items}
          onChange={(e) => set('items', e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="od-note">{t.fields.notes}</Label>
        <Input id="od-note" value={form.note} onChange={(e) => set('note', e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">{t.accountingNote}</p>
      <FieldError>{save.error?.message}</FieldError>
      <Button type="submit" disabled={save.isPending || !form.customer_id}>
        {save.isPending ? vi.common.saving : vi.common.save}
      </Button>
    </form>
  )
}

function CustomerDetail({ customer }: { customer: CustomerRow }) {
  const actor = useSalesActor()
  const orders = useCustomerOrders(customer.id)
  const checkIns = useCustomerCheckIns(customer.id)
  const customers = useCustomers()
  const merge = useMergeCustomers()
  const [editing, setEditing] = useState(false)
  const [orderOpen, setOrderOpen] = useState<OrderRow | 'new' | null>(null)
  const [mergeWith, setMergeWith] = useState('')
  const canEdit = isSalesAdmin(actor) || customer.owner_id === actor.id

  return (
    <div className="grid gap-4">
      {editing ? (
        <CustomerForm customer={customer} onDone={() => setEditing(false)} />
      ) : (
        <div className="grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge>{vi.customerTypes[customer.type]}</Badge>
            {customer.status === 'inactive' && <Badge variant="secondary">Ngừng</Badge>}
          </div>
          <p>
            {customer.contact_name ?? '—'}
            {customer.phone && (
              <a
                className="ml-2 text-primary underline"
                href={`tel:${customer.phone.replace(/\s/g, '')}`}
              >
                {customer.phone}
              </a>
            )}
          </p>
          {customer.address && (
            <p className="text-muted-foreground">
              {customer.address}
              {customer.district ? `, ${customer.district}` : ''}
            </p>
          )}
          {customer.notes && <p className="whitespace-pre-line">{customer.notes}</p>}
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => setEditing(true)}
            >
              {vi.common.edit}
            </Button>
          )}
        </div>
      )}

      {customer.lat !== null && customer.lng !== null && (
        <MapView
          className="h-48"
          points={[{ id: customer.id, lat: customer.lat, lng: customer.lng }]}
        />
      )}

      <section className="grid gap-2 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t.orders}</h3>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setOrderOpen('new')}>
              <Plus /> {t.newOrder}
            </Button>
          )}
        </div>
        {orderOpen && (
          <div className="rounded-lg border border-border p-3">
            <OrderForm
              order={orderOpen === 'new' ? undefined : orderOpen}
              customers={[customer]}
              defaultCustomer={customer.id}
              onDone={() => setOrderOpen(null)}
            />
          </div>
        )}
        {orders.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.ordersEmpty}</p>
        )}
        <ul className="grid gap-1">
          {orders.data?.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setOrderOpen(o)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="w-24 text-muted-foreground">{formatDateVN(o.order_date)}</span>
                <span className="min-w-0 flex-1 truncate">{o.items_summary ?? '—'}</span>
                <Badge variant={orderStatusVariant(o.status)}>{vi.orderStatus[o.status]}</Badge>
                <span className="font-medium tabular-nums">{formatVND(o.total_value_vnd)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">{t.checkIns}</h3>
        {checkIns.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">{vi.checkin.empty}</p>
        )}
        <ul className="grid gap-1 text-sm">
          {checkIns.data?.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="text-muted-foreground">{formatDateTimeVN(c.checked_in_at)}</span>
              <span className="min-w-0 flex-1 truncate">{c.note}</span>
              {c.photo_web_link && (
                <a
                  href={c.photo_web_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary"
                  aria-label={vi.checkin.viewPhoto}
                >
                  <ExternalLink className="size-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isSalesAdmin(actor) && (
        <section className="grid gap-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t.mergeCustomer}</h3>
          <div className="flex gap-2">
            <Select
              value={mergeWith}
              aria-label={t.mergeCustomer}
              onChange={(e) => setMergeWith(e.target.value)}
            >
              <option value="">{vi.checkin.pick}</option>
              {customers.data
                ?.filter((c) => c.id !== customer.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <Button
              variant="outline"
              disabled={!mergeWith || merge.isPending}
              onClick={() => {
                const other = customers.data?.find((c) => c.id === mergeWith)
                if (other && window.confirm(t.mergeConfirm(customer.name, other.name))) {
                  merge.mutate(
                    { keep: customer.id, remove: mergeWith },
                    { onSuccess: () => setMergeWith('') },
                  )
                }
              }}
            >
              {t.merge}
            </Button>
          </div>
          <FieldError>{merge.error?.message}</FieldError>
        </section>
      )}
    </div>
  )
}

export function CustomerDrawer({
  customerId,
  onClose,
}: {
  customerId: string | null
  onClose: () => void
}) {
  const customer = useCustomer(customerId)
  return (
    <Sheet
      open={Boolean(customerId)}
      onClose={onClose}
      title={customer.data?.name ?? t.tabs.customers}
    >
      {customer.isPending && <Spinner />}
      {customer.error && <ErrorBox error={customer.error} />}
      {customer.data === null && (
        <p className="text-sm text-muted-foreground">{vi.tasks.notFound}</p>
      )}
      {customer.data && <CustomerDetail key={customer.data.updated_at} customer={customer.data} />}
    </Sheet>
  )
}

export function CustomersView({ onOpen }: { onOpen: (id: string) => void }) {
  const customers = useCustomers()
  const users = useUsers()
  const [mode, setMode] = useState<'list' | 'map'>('list')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const list = (customers.data ?? []).filter(
    (c) =>
      !q ||
      `${c.name} ${c.district ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  )
  const located = list.filter((c) => c.lat !== null && c.lng !== null)
  const ownerName = (id: string | null) => users.data?.find((u) => u.id === id)?.full_name ?? ''

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-0 flex-1"
          placeholder={vi.common.search}
          aria-label={vi.common.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Tabs
          value={mode}
          onChange={setMode}
          items={[
            { value: 'list', label: t.list },
            { value: 'map', label: t.map },
          ]}
        />
        <Button variant="outline" onClick={() => setCreating(true)}>
          <Plus /> {t.newCustomer}
        </Button>
      </div>
      {customers.isPending && <Spinner />}
      {customers.error && <ErrorBox error={customers.error} />}
      {mode === 'map' ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.map}</CardTitle>
          </CardHeader>
          <CardContent>
            <MapView
              className="h-[60vh]"
              points={located.map((c) => ({
                id: c.id,
                lat: c.lat!,
                lng: c.lng!,
                color: c.status === 'active' ? '#7a4520' : '#9ca3af',
                popup: (
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => onOpen(c.id)}
                  >
                    {c.name}
                  </button>
                ),
              }))}
            />
            <p className="mt-2 text-xs text-muted-foreground">{t.noLocation}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {customers.data && list.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.customersEmpty}</p>
            )}
            <ul>
              {list.map((c) => (
                <li key={c.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
                    onClick={() => onOpen(c.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vi.customerTypes[c.type]}
                        {c.district ? ` · ${c.district}` : ''} · {ownerName(c.owner_id)}
                      </p>
                    </div>
                    {c.status === 'inactive' && <Badge variant="secondary">Ngừng</Badge>}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Sheet open={creating} onClose={() => setCreating(false)} title={t.newCustomer}>
        {creating && (
          <CustomerForm
            onDone={(id) => {
              setCreating(false)
              onOpen(id)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
