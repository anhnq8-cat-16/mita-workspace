import { Phone, Trophy, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useSetting, useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { ActivityType, CustomerType, LeadRow, LeadStage } from '@/lib/database.types'
import { formatDateTimeVN, fromVNInputValue, toVNInputValue } from '@/lib/date-vn'
import { formatVND, parseVND } from '@/lib/format'
import {
  useAddActivity,
  useAssignLead,
  useCustomerDirectory,
  useLead,
  useLeadActivities,
  useLeads,
  useMarkWon,
  useMergeLeads,
  useSalesActor,
  useUpdateLead,
} from './api'
import { SlaBadge, StageBadge } from './badges'
import { canWriteLead, isSalesAdmin, OPEN_STAGES } from './sales-rules'

const t = vi.sales
const ACTIVITY_TYPES: ActivityType[] = [
  'call',
  'zalo',
  'meeting',
  'visit',
  'email',
  'sample',
  'quote',
  'note',
]
const CUSTOMER_TYPES: CustomerType[] = [
  'cafe',
  'agent',
  'retail_store',
  'corporate_gift',
  'individual',
  'fruit_b2b',
  'other',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Activities({ lead, canWrite }: { lead: LeadRow; canWrite: boolean }) {
  const list = useLeadActivities(lead.id)
  const add = useAddActivity(lead.id)
  const users = useUsers()
  const [type, setType] = useState<ActivityType>('call')
  const [content, setContent] = useState('')
  const nameOf = (id: string | null) => users.data?.find((u) => u.id === id)?.full_name ?? ''

  return (
    <Section title={t.activitiesTitle}>
      {canWrite && (
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            await add.mutateAsync({ type, content })
            setContent('')
          }}
        >
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {ACTIVITY_TYPES.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={type === a}
                onClick={() => setType(a)}
                className={
                  type === a
                    ? 'min-h-9 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground'
                    : 'min-h-9 rounded-full border border-border px-3 text-xs'
                }
              >
                {vi.activities[a]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={content}
              placeholder={t.activityPlaceholder}
              aria-label={t.activityPlaceholder}
              onChange={(e) => setContent(e.target.value)}
            />
            <Button type="submit" disabled={add.isPending}>
              {t.addActivity}
            </Button>
          </div>
          <FieldError>{add.error?.message}</FieldError>
        </form>
      )}
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t.noActivities}</p>}
      <ol className="grid gap-2">
        {list.data?.map((a) => (
          <li key={a.id} className="rounded-lg bg-muted p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{vi.activities[a.type]}</Badge>
              {formatDateTimeVN(a.happened_at)} · {nameOf(a.user_id)}
            </div>
            {a.content && <p className="mt-1 whitespace-pre-line">{a.content}</p>}
          </li>
        ))}
      </ol>
    </Section>
  )
}

function WonForm({ lead, onDone }: { lead: LeadRow; onDone: () => void }) {
  const won = useMarkWon()
  const directory = useCustomerDirectory('')
  const actor = useSalesActor()
  const mine = (directory.data ?? []).filter((c) => c.owner_id === (lead.assigned_to ?? actor.id))
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState(lead.company ?? lead.name)
  const [type, setType] = useState<CustomerType>('cafe')
  const [value, setValue] = useState(lead.est_value_vnd?.toString() ?? '')
  const [items, setItems] = useState('')

  return (
    <div className="grid gap-3 rounded-lg border border-success/40 bg-success/5 p-3">
      <p className="font-medium">{t.wonTitle}</p>
      <p className="text-xs text-muted-foreground">{t.wonHint}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === 'new' ? 'default' : 'outline'}
          onClick={() => setMode('new')}
        >
          {t.wonNew}
        </Button>
        <Button
          size="sm"
          variant={mode === 'existing' ? 'default' : 'outline'}
          onClick={() => setMode('existing')}
          disabled={mine.length === 0}
        >
          {t.wonExisting}
        </Button>
      </div>
      {mode === 'new' ? (
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={name}
            aria-label={t.wonCustomer}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            value={type}
            aria-label={t.fields.type}
            onChange={(e) => setType(e.target.value as CustomerType)}
          >
            {CUSTOMER_TYPES.map((c) => (
              <option key={c} value={c}>
                {vi.customerTypes[c]}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <Select
          value={customerId}
          aria-label={t.wonCustomer}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">{vi.checkin.pick}</option>
          {mine.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      <Input
        inputMode="numeric"
        value={value}
        placeholder={t.orderValue}
        aria-label={t.orderValue}
        onChange={(e) => setValue(e.target.value)}
      />
      <Input
        value={items}
        placeholder={t.orderItems}
        aria-label={t.orderItems}
        onChange={(e) => setItems(e.target.value)}
      />
      <FieldError>{won.error?.message}</FieldError>
      <Button
        disabled={won.isPending || (mode === 'existing' && !customerId)}
        onClick={async () => {
          await won.mutateAsync({
            leadId: lead.id,
            customerId: mode === 'existing' ? customerId : null,
            customer: mode === 'new' ? { name, type } : null,
            orderValue: parseVND(value),
            items: items.trim() || null,
          })
          onDone()
        }}
      >
        <Trophy /> {t.markWon}
      </Button>
    </div>
  )
}

function InfoForm({ lead, canWrite }: { lead: LeadRow; canWrite: boolean }) {
  const update = useUpdateLead()
  const sources = useSetting<string[]>('lead_sources') ?? []
  const segments = useSetting<string[]>('lead_segments') ?? []
  const [form, setForm] = useState({
    name: lead.name,
    company: lead.company ?? '',
    contact_name: lead.contact_name ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    zalo: lead.zalo ?? '',
    address: lead.address ?? '',
    district: lead.district ?? '',
    source: lead.source ?? '',
    segment: lead.segment ?? '',
    est_value_vnd: lead.est_value_vnd?.toString() ?? '',
    notes: lead.notes ?? '',
    next_follow_up_at: toVNInputValue(lead.next_follow_up_at),
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  if (!canWrite) {
    return (
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {(
          [
            [t.fields.contact, lead.contact_name],
            [t.fields.phone, lead.phone],
            [t.fields.company, lead.company],
            [t.fields.source, lead.source],
            [t.fields.segment, lead.segment],
            [t.fields.district, lead.district],
            [t.fields.estValue, lead.est_value_vnd ? formatVND(lead.est_value_vnd) : null],
            [t.fields.followUp, formatDateTimeVN(lead.next_follow_up_at)],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
        {lead.notes && <dd className="col-span-2 whitespace-pre-line">{lead.notes}</dd>}
      </dl>
    )
  }

  const input = (
    k: keyof typeof form,
    label: string,
    props: React.ComponentProps<'input'> = {},
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`li-${k}`}>{label}</Label>
      <Input id={`li-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </div>
  )

  return (
    <div className="grid gap-3">
      {input('name', t.fields.name)}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="li-phone">{t.fields.phone}</Label>
          <div className="flex gap-1">
            <Input
              id="li-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            {form.phone && (
              <a
                href={`tel:${form.phone.replace(/\s/g, '')}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border"
                aria-label={vi.activities.call}
              >
                <Phone className="size-4" />
              </a>
            )}
          </div>
        </div>
        {input('contact_name', t.fields.contact)}
        {input('company', t.fields.company)}
        {input('zalo', t.fields.zalo)}
        {input('email', t.fields.email, { type: 'email' })}
        {input('district', t.fields.district)}
      </div>
      {input('address', t.fields.address)}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="li-source">{t.fields.source}</Label>
          <Select
            id="li-source"
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
          >
            <option value="">—</option>
            {[...new Set([...sources, form.source].filter(Boolean))].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="li-segment">{t.fields.segment}</Label>
          <Select
            id="li-segment"
            value={form.segment}
            onChange={(e) => set('segment', e.target.value)}
          >
            <option value="">—</option>
            {[...new Set([...segments, form.segment].filter(Boolean))].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        {input('est_value_vnd', t.fields.estValue, { inputMode: 'numeric' })}
        {input('next_follow_up_at', t.fields.followUp, { type: 'datetime-local' })}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="li-notes">{t.fields.notes}</Label>
        <Textarea
          id="li-notes"
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
      <FieldError>{update.error?.message}</FieldError>
      <Button
        className="justify-self-start"
        disabled={update.isPending || !form.name.trim()}
        onClick={() =>
          update.mutate({
            id: lead.id,
            patch: {
              name: form.name.trim(),
              company: form.company.trim() || null,
              contact_name: form.contact_name.trim() || null,
              phone: form.phone.trim() || null,
              email: form.email.trim().toLowerCase() || null,
              zalo: form.zalo.trim() || null,
              address: form.address.trim() || null,
              district: form.district.trim() || null,
              source: form.source || null,
              segment: form.segment || null,
              est_value_vnd: parseVND(form.est_value_vnd),
              notes: form.notes.trim() || null,
              next_follow_up_at: fromVNInputValue(form.next_follow_up_at),
            },
          })
        }
      >
        {update.isPending ? vi.common.saving : vi.common.save}
      </Button>
    </div>
  )
}

function MergeBox({ lead }: { lead: LeadRow }) {
  const leads = useLeads()
  const merge = useMergeLeads()
  const [other, setOther] = useState('')
  const candidates = (leads.data ?? []).filter((l) => l.id !== lead.id)
  return (
    <Section title={t.merge}>
      <p className="text-xs text-muted-foreground">{t.mergeHint}</p>
      <div className="flex gap-2">
        <Select value={other} aria-label={t.merge} onChange={(e) => setOther(e.target.value)}>
          <option value="">{vi.checkin.pick}</option>
          {candidates.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.phone ? ` · ${l.phone}` : ''}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          disabled={!other || merge.isPending}
          onClick={() => {
            const o = candidates.find((l) => l.id === other)
            if (o && window.confirm(t.mergeConfirm(lead.name, o.name))) {
              merge.mutate({ keep: lead.id, remove: other }, { onSuccess: () => setOther('') })
            }
          }}
        >
          {t.merge}
        </Button>
      </div>
      <FieldError>{merge.error?.message}</FieldError>
    </Section>
  )
}

export function LeadDrawer({
  leadId,
  onClose,
  onOpenCustomer,
}: {
  leadId: string | null
  onClose: () => void
  onOpenCustomer: (id: string) => void
}) {
  const actor = useSalesActor()
  const lead = useLead(leadId)
  const update = useUpdateLead()
  const assign = useAssignLead()
  const users = useUsers()
  const [wonOpen, setWonOpen] = useState(false)
  const salesPeople = (users.data ?? []).filter(
    (u) => u.is_active && u.teams.some((m) => m.team_id === 'sales_domestic'),
  )

  const l = lead.data
  const canWrite = l ? canWriteLead(actor, l) : false
  const admin = isSalesAdmin(actor)
  const closed = l?.stage === 'won' || l?.stage === 'lost'

  function changeStage(stage: LeadStage) {
    if (!l) return
    if (stage === 'lost') {
      const reason = window.prompt(t.lostPrompt)?.trim()
      if (!reason) return
      update.mutate({ id: l.id, patch: { stage, lost_reason: reason } })
      return
    }
    update.mutate({ id: l.id, patch: { stage, lost_reason: null } })
  }

  return (
    <Sheet
      open={Boolean(leadId)}
      onClose={() => {
        setWonOpen(false)
        onClose()
      }}
      title={l?.name ?? t.title}
    >
      {lead.isPending && <Spinner />}
      {lead.error && <ErrorBox error={lead.error} />}
      {lead.data === null && <p className="text-sm text-muted-foreground">{vi.tasks.notFound}</p>}
      {l && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={l.stage} />
            <SlaBadge lead={l} />
            {l.lost_reason && <span className="text-xs text-destructive">{l.lost_reason}</span>}
            {!canWrite && <span className="text-xs text-muted-foreground">{t.readOnly}</span>}
          </div>

          {canWrite && !closed && (
            <div className="grid gap-2">
              <Label htmlFor="lead-stage">{t.fields.stage}</Label>
              <Select
                id="lead-stage"
                value={l.stage}
                onChange={(e) => changeStage(e.target.value as LeadStage)}
              >
                {[...OPEN_STAGES, 'lost' as const].map((s) => (
                  <option key={s} value={s}>
                    {vi.stages[s]}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setWonOpen((v) => !v)}>
                  <Trophy /> {t.markWon}
                </Button>
                <Button size="sm" variant="outline" onClick={() => changeStage('lost')}>
                  <XCircle /> {t.markLost}
                </Button>
              </div>
              <FieldError>{update.error?.message}</FieldError>
            </div>
          )}
          {canWrite && l.stage === 'lost' && (
            <Button
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => changeStage('contacted')}
            >
              {vi.tasks.returnTask}
            </Button>
          )}
          {wonOpen && <WonForm lead={l} onDone={() => setWonOpen(false)} />}
          {l.customer_id && (
            <Button
              variant="secondary"
              className="justify-self-start"
              onClick={() => onOpenCustomer(l.customer_id!)}
            >
              {t.openCustomer}
            </Button>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="lead-assignee">{t.fields.assignee}</Label>
            {admin ? (
              <Select
                id="lead-assignee"
                value={l.assigned_to ?? ''}
                onChange={(e) =>
                  e.target.value && assign.mutate({ leadId: l.id, userId: e.target.value })
                }
              >
                <option value="">{t.unassigned}</option>
                {salesPeople.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? u.email}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-sm">
                {users.data?.find((u) => u.id === l.assigned_to)?.full_name ?? t.unassigned}
              </p>
            )}
            <FieldError>{assign.error?.message}</FieldError>
          </div>

          <InfoForm key={l.updated_at} lead={l} canWrite={canWrite} />
          <Activities lead={l} canWrite={canWrite} />
          {admin && <MergeBox lead={l} />}
        </div>
      )}
    </Sheet>
  )
}
