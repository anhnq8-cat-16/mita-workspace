import { Camera, ExternalLink, LogOut, MapPin, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MapView } from '@/components/MapView'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { useMe } from '@/features/auth/auth-context'
import {
  useCreateLead,
  useCustomers,
  useLeads,
  useSalesActor,
  useSaveCustomer,
} from '@/features/sales/api'
import { DuplicateList } from '@/features/sales/LeadForm'
import { inSales } from '@/features/sales/sales-rules'
import { useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { CheckInRow, LeadDuplicateRow } from '@/lib/database.types'
import { formatTimeVN, todayVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import {
  uploadCheckInPhoto,
  useCheckIns,
  useCheckOut,
  useCreateCheckIn,
  useRoutePlans,
} from './api'
import { compressImage, getPosition, type GeoFix } from './image'

const t = vi.checkin
type Target = 'customer' | 'lead' | 'new'

function CheckInFlow({ onDone }: { onDone: () => void }) {
  const me = useMe()
  const customers = useCustomers()
  const leads = useLeads()
  const createLead = useCreateLead()
  const createCheckIn = useCreateCheckIn()
  const saveCustomer = useSaveCustomer()
  const fileRef = useRef<HTMLInputElement>(null)

  const [fix, setFix] = useState<GeoFix | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [locating, setLocating] = useState(true)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [target, setTarget] = useState<Target>('customer')
  const [customerId, setCustomerId] = useState('')
  const [leadId, setLeadId] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [note, setNote] = useState('')
  const [saveLocation, setSaveLocation] = useState(true)
  const [duplicates, setDuplicates] = useState<LeadDuplicateRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const myCustomers = (customers.data ?? []).filter(
    (c) => c.owner_id === me.id && c.status === 'active',
  )
  const myLeads = (leads.data ?? []).filter(
    (l) => l.assigned_to === me.id && l.stage !== 'won' && l.stage !== 'lost',
  )
  const customer = myCustomers.find((c) => c.id === customerId)

  async function locate() {
    setLocating(true)
    setGeoError(null)
    try {
      setFix(await getPosition())
    } catch {
      setGeoError(t.locationError)
    } finally {
      setLocating(false)
    }
  }

  // Lấy GPS ngay khi mở form
  useEffect(() => {
    getPosition()
      .then(setFix)
      .catch(() => setGeoError(t.locationError))
      .finally(() => setLocating(false))
  }, [])

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setCompressing(true)
    try {
      const blob = await compressImage(file)
      setPhoto(blob)
      setPreview(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCompressing(false)
    }
  }

  async function submit(forceNewLead = false) {
    setError(null)
    if (!fix) return setError(t.locationError)
    if (!photo) return setError(t.photoRequired)
    if (target === 'customer' && !customerId) return setError(t.pick)
    if (target === 'lead' && !leadId) return setError(t.pick)
    if (target === 'new' && !newName.trim()) return setError(t.newPointName)

    try {
      let lead: string | null = target === 'lead' ? leadId : null
      if (target === 'new') {
        const res = await createLead.mutateAsync({
          lead: {
            name: newName.trim(),
            phone: newPhone.trim(),
            source: 'Sale tự tìm',
            assign_to_me: true,
          },
          force: forceNewLead,
        })
        if ('duplicates' in res) {
          setDuplicates(res.duplicates)
          return
        }
        lead = res.id
      }
      const place =
        target === 'customer'
          ? (customer?.name ?? '')
          : target === 'lead'
            ? (myLeads.find((l) => l.id === leadId)?.name ?? '')
            : newName.trim()
      setBusy(t.uploading)
      const uploaded = await uploadCheckInPhoto(photo, place)
      await createCheckIn.mutateAsync({
        customer_id: target === 'customer' ? customerId : null,
        lead_id: lead,
        lat: fix.lat,
        lng: fix.lng,
        accuracy_m: fix.accuracy,
        photo_drive_file_id: uploaded.id,
        photo_web_link: uploaded.webViewLink,
        place_name: place,
        note: note.trim() || null,
      })
      if (target === 'customer' && customer && saveLocation && customer.lat === null) {
        await saveCustomer.mutateAsync({ id: customer.id, input: { lat: fix.lat, lng: fix.lng } })
      }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4">
      {/* 1. GPS */}
      <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
        <MapPin className={cn('size-5 shrink-0', fix ? 'text-success' : 'text-muted-foreground')} />
        <div className="min-w-0 flex-1">
          {locating && t.locating}
          {!locating &&
            fix &&
            (fix.accuracy <= 100 ? t.locationOk(fix.accuracy) : t.locationWeak(fix.accuracy))}
          {!locating && geoError && <span className="text-destructive">{geoError}</span>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.retryLocation}
          onClick={locate}
          disabled={locating}
        >
          <RefreshCw />
        </Button>
      </div>

      {/* 2. Ảnh */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onPhoto(e.target.files?.[0])}
      />
      {preview ? (
        <div className="grid gap-2">
          <img src={preview} alt="" className="max-h-64 w-full rounded-lg object-cover" />
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => fileRef.current?.click()}
          >
            <Camera /> {t.retakePhoto}
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={compressing}
        >
          <Camera /> {compressing ? t.compressing : t.photo}
        </Button>
      )}

      {/* 3. Tại đâu */}
      <div className="grid gap-2">
        <Label>{t.target}</Label>
        <Tabs
          value={target}
          onChange={(v) => {
            setTarget(v)
            setDuplicates(null)
          }}
          items={[
            { value: 'customer', label: t.targetCustomer },
            { value: 'lead', label: t.targetLead },
            { value: 'new', label: t.targetNew },
          ]}
        />
        {target === 'customer' && (
          <>
            <Select
              value={customerId}
              aria-label={t.targetCustomer}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">{t.pick}</option>
              {myCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.district ? ` · ${c.district}` : ''}
                </option>
              ))}
            </Select>
            {customer && customer.lat === null && (
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={saveLocation}
                  onChange={(e) => setSaveLocation(e.target.checked)}
                />
                {t.saveLocation}
              </label>
            )}
          </>
        )}
        {target === 'lead' && (
          <Select
            value={leadId}
            aria-label={t.targetLead}
            onChange={(e) => setLeadId(e.target.value)}
          >
            <option value="">{t.pick}</option>
            {myLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
        {target === 'new' && (
          <div className="grid gap-2">
            <Input
              value={newName}
              placeholder={t.newPointName}
              aria-label={t.newPointName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              type="tel"
              inputMode="tel"
              value={newPhone}
              placeholder={t.newPointPhone}
              aria-label={t.newPointPhone}
              onChange={(e) => {
                setNewPhone(e.target.value)
                setDuplicates(null)
              }}
            />
            {duplicates && <DuplicateList items={duplicates} />}
          </div>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ci-note">{t.note}</Label>
        <Textarea id="ci-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <FieldError>{error}</FieldError>
      {duplicates ? (
        <Button size="lg" variant="outline" onClick={() => submit(true)} disabled={Boolean(busy)}>
          {vi.sales.createAnyway}
        </Button>
      ) : (
        <Button size="lg" onClick={() => submit()} disabled={Boolean(busy) || !fix || !photo}>
          {busy ?? t.submit}
        </Button>
      )}
    </div>
  )
}

function CheckInItem({
  c,
  showCheckout,
  who,
}: {
  c: CheckInRow
  showCheckout: boolean
  who?: string
}) {
  const checkout = useCheckOut()
  return (
    <li className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">
        {formatTimeVN(c.checked_in_at)}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {who && <span className="text-muted-foreground">{who} · </span>}
          {c.place_name || '—'}
        </p>
        {c.note && <p className="text-muted-foreground">{c.note}</p>}
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          ±{Math.round(c.accuracy_m ?? 0)}m
          {c.checked_out_at && <span>{t.checkedOut(formatTimeVN(c.checked_out_at))}</span>}
          {c.photo_web_link && (
            <a
              href={c.photo_web_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary"
            >
              <ExternalLink className="size-3.5" /> {t.viewPhoto}
            </a>
          )}
        </p>
      </div>
      {showCheckout && !c.checked_out_at && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => checkout.mutate(c.id)}
          disabled={checkout.isPending}
        >
          <LogOut /> {t.checkOut}
        </Button>
      )}
    </li>
  )
}

function MineTab() {
  const me = useMe()
  const today = todayVN()
  const list = useCheckIns(today, me.id)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  return (
    <div className="grid gap-4">
      {open ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckInFlow
              onDone={() => {
                setOpen(false)
                setSaved(true)
              }}
            />
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setOpen(false)}>
              {vi.common.cancel}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSaved(false)
            setOpen(true)
          }}
          className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-md active:scale-[0.99]"
        >
          <MapPin className="size-8" />
          {t.start}
        </button>
      )}
      {saved && <p className="rounded-lg bg-success/10 p-3 text-sm text-success">{t.saved}</p>}
      <Card>
        <CardHeader>
          <CardTitle>
            {t.today} ({list.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.isPending && <Spinner />}
          {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
          <ul>
            {list.data?.map((c) => (
              <CheckInItem key={c.id} c={c} showCheckout />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

const COLORS = ['#7a4520', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2']

/** Quản lý / trưởng nhóm: bản đồ + dòng thời gian check-in theo người/ngày, so với lịch trình dự kiến */
export function TeamCheckIns({ date: initialDate }: { date?: string }) {
  const users = useUsers()
  const [date, setDate] = useState(initialDate ?? todayVN())
  const [person, setPerson] = useState('')
  const list = useCheckIns(date, person || null)
  const routes = useRoutePlans(date, true)
  const people = [...new Set((list.data ?? []).map((c) => c.user_id))]
  const color = (id: string) => COLORS[Math.max(0, people.indexOf(id)) % COLORS.length]!
  const nameOf = (id: string) => users.data?.find((u) => u.id === id)?.full_name ?? ''
  const sales = (users.data ?? []).filter(
    (u) => u.is_active && u.teams.some((m) => m.team_id === 'sales_domestic'),
  )

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          value={date}
          max={todayVN()}
          aria-label={t.date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <Select value={person} aria-label={t.person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">{t.allPeople}</option>
          {sales.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name ?? u.email}
            </option>
          ))}
        </Select>
      </div>
      {list.error && <ErrorBox error={list.error} />}
      <MapView
        className="h-72"
        points={(list.data ?? []).map((c) => ({
          id: c.id,
          lat: c.lat,
          lng: c.lng,
          color: color(c.user_id),
          popup: (
            <span>
              <strong>{formatTimeVN(c.checked_in_at)}</strong> · {nameOf(c.user_id)}
              <br />
              {c.place_name}
            </span>
          ),
        }))}
      />
      {(person ? [person] : people).map((uid) => {
        const route = routes.data?.find((r) => r.user_id === uid)?.route_plan
        const items = (list.data ?? []).filter((c) => c.user_id === uid)
        return (
          <Card key={uid}>
            <CardHeader className="flex-row items-center gap-3">
              <span className="size-3 rounded-full" style={{ background: color(uid) }} />
              <Avatar name={nameOf(uid)} className="size-8" />
              <CardTitle className="flex-1">
                {nameOf(uid)} · {items.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{t.routePlan}</p>
                <p className="whitespace-pre-line">{route || t.noRoutePlan}</p>
              </div>
              <ul>
                {items.map((c) => (
                  <CheckInItem key={c.id} c={c} showCheckout={false} />
                ))}
              </ul>
              {items.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
            </CardContent>
          </Card>
        )
      })}
      {list.data?.length === 0 && !person && (
        <p className="text-center text-sm text-muted-foreground">{t.empty}</p>
      )}
    </div>
  )
}

export function CheckInPage() {
  const me = useMe()
  const actor = useSalesActor()
  const canTeam = me.role !== 'staff'
  const canCheckIn = inSales(actor)
  const [tab, setTab] = useState<'mine' | 'team'>(canCheckIn ? 'mine' : 'team')

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      {canTeam && canCheckIn && (
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'mine', label: t.tabs.mine },
            { value: 'team', label: t.tabs.team },
          ]}
        />
      )}
      {tab === 'mine' && canCheckIn ? <MineTab /> : <TeamCheckIns />}
    </div>
  )
}
