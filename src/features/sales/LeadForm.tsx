import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { useSetting } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { LeadDuplicateRow } from '@/lib/database.types'
import { parseVND } from '@/lib/format'
import { useCreateLead, useSalesActor } from './api'
import { inSales, isSalesAdmin } from './sales-rules'

const t = vi.sales

export function DuplicateList({ items }: { items: LeadDuplicateRow[] }) {
  return (
    <div className="grid gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" /> {t.duplicatesTitle}
      </p>
      <p className="text-xs text-muted-foreground">{t.duplicatesHint}</p>
      <ul className="grid gap-1">
        {items.map((d) => (
          <li key={`${d.kind}-${d.id}`}>
            <strong>{t.duplicateKind[d.kind]}:</strong> {d.name}
            {d.company ? ` (${d.company})` : ''} · {t.duplicateMatch[d.matched]}
            {d.owner_name ? ` · ${d.owner_name}` : ` · ${t.unassigned}`}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Form tạo lead: kiểm tra trùng trước khi lưu */
export function LeadForm({
  onDone,
  initialName = '',
}: {
  onDone: (id: string) => void
  initialName?: string
}) {
  const actor = useSalesActor()
  const create = useCreateLead()
  const sources = useSetting<string[]>('lead_sources') ?? []
  const segments = useSetting<string[]>('lead_segments') ?? []
  const [form, setForm] = useState({
    name: initialName,
    company: '',
    contact_name: '',
    phone: '',
    email: '',
    zalo: '',
    address: '',
    district: '',
    source: '',
    segment: '',
    est_value_vnd: '',
    notes: '',
  })
  const [assignToMe, setAssignToMe] = useState(inSales(actor) && !isSalesAdmin(actor))
  const [duplicates, setDuplicates] = useState<LeadDuplicateRow[] | null>(null)
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k === 'phone' || k === 'email' || k === 'company') setDuplicates(null)
  }

  async function submit(force: boolean) {
    const payload = {
      ...form,
      est_value_vnd: parseVND(form.est_value_vnd),
      assign_to_me: assignToMe,
      assigned_to: assignToMe ? actor.id : null,
    }
    const res = await create.mutateAsync({ lead: payload, force })
    if ('duplicates' in res) setDuplicates(res.duplicates)
    else onDone(res.id)
  }

  const field = (
    k: keyof typeof form,
    label: string,
    props: React.ComponentProps<'input'> = {},
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`lead-${k}`}>{label}</Label>
      <Input id={`lead-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </div>
  )

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit(false)
      }}
    >
      {field('name', t.fields.name, { required: true, autoFocus: true })}
      <div className="grid grid-cols-2 gap-3">
        {field('phone', t.fields.phone, { inputMode: 'tel', type: 'tel' })}
        {field('contact_name', t.fields.contact)}
      </div>
      {field('company', t.fields.company)}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lead-source">{t.fields.source}</Label>
          <Select
            id="lead-source"
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
          >
            <option value="">—</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lead-segment">{t.fields.segment}</Label>
          <Select
            id="lead-segment"
            value={form.segment}
            onChange={(e) => set('segment', e.target.value)}
          >
            <option value="">—</option>
            {segments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('email', t.fields.email, { type: 'email', inputMode: 'email' })}
        {field('zalo', t.fields.zalo)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('address', t.fields.address)}
        {field('district', t.fields.district)}
      </div>
      {field('est_value_vnd', t.fields.estValue, { inputMode: 'numeric' })}
      <div className="grid gap-1.5">
        <Label htmlFor="lead-notes">{t.fields.notes}</Label>
        <Textarea
          id="lead-notes"
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
      {inSales(actor) && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={assignToMe}
            onChange={(e) => setAssignToMe(e.target.checked)}
          />
          {t.assignToMe}
        </label>
      )}
      {duplicates && <DuplicateList items={duplicates} />}
      <FieldError>{create.error?.message}</FieldError>
      {duplicates ? (
        <Button variant="outline" disabled={create.isPending} onClick={() => submit(true)}>
          {t.createAnyway}
        </Button>
      ) : (
        <Button type="submit" disabled={create.isPending || !form.name.trim()}>
          {t.newLead}
        </Button>
      )}
    </form>
  )
}
