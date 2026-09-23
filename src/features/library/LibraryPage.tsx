import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldError, Input, Select } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { useMe } from '@/features/auth/auth-context'
import { useSetting, useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { LibraryItemRow, ProductRow } from '@/lib/database.types'
import { formatDateVN, todayVN } from '@/lib/date-vn'
import { useCanApprove, useLibraryItems, useProducts, useReviewItem } from './api'
import { ItemCard, ItemSheet, ItemThumb, StatusBadge } from './LibraryParts'
import {
  filterLibrary,
  previewPath,
  SECTIONS_BY_DRIVE,
  suggestSection,
  type LibraryFilters,
  type Section,
} from './library-rules'
import { UploadPanel } from './UploadPanel'

const t = vi.library
type Tab = 'browse' | 'upload' | 'review' | 'mine'
const KINDS = ['image', 'video', 'document', 'design', 'youtube'] as const

function Grid({ items, onOpen }: { items: LibraryItemRow[]; onOpen: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {t.empty}
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((i) => (
        <ItemCard key={i.id} item={i} onOpen={() => onOpen(i.id)} />
      ))}
    </div>
  )
}

function Browse({
  items,
  products,
  onOpen,
}: {
  items: LibraryItemRow[]
  products: ProductRow[]
  onOpen: (id: string) => void
}) {
  const channels = useSetting<string[]>('library_channels') ?? []
  const [f, setF] = useState<LibraryFilters>({ q: '', product: '', kind: '', channel: '', tag: '' })
  const approved = items.filter((i) => i.status === 'approved')
  const tags = [...new Set(approved.flatMap((i) => i.tags))].sort()
  const list = filterLibrary(approved, f)
  const byLine = new Map<string, ProductRow[]>()
  for (const p of products) {
    const k = p.line ?? vi.productCategories[p.category]
    byLine.set(k, [...(byLine.get(k) ?? []), p])
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <Input
          className="col-span-2 md:w-64"
          placeholder={t.search}
          aria-label={t.search}
          value={f.q}
          onChange={(e) => setF({ ...f, q: e.target.value })}
        />
        <Select
          className="md:w-auto"
          aria-label={t.product}
          value={f.product}
          onChange={(e) => setF({ ...f, product: e.target.value })}
        >
          <option value="">{t.allProducts}</option>
          <option value="none">{t.general}</option>
          {[...byLine.entries()].map(([line, list]) => (
            <optgroup key={line} label={line}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <Select
          className="md:w-auto"
          aria-label={t.kind}
          value={f.kind}
          onChange={(e) => setF({ ...f, kind: e.target.value })}
        >
          <option value="">{t.allKinds}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {vi.libraryKinds[k]}
            </option>
          ))}
        </Select>
        <Select
          className="md:w-auto"
          aria-label={t.channels}
          value={f.channel}
          onChange={(e) => setF({ ...f, channel: e.target.value })}
        >
          <option value="">{t.allChannels}</option>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        {tags.length > 0 && (
          <Select
            className="md:w-auto"
            aria-label="Tag"
            value={f.tag}
            onChange={(e) => setF({ ...f, tag: e.target.value })}
          >
            <option value="">Tag: {vi.sales.filters.all}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </Select>
        )}
      </div>
      <Grid items={list} onOpen={onOpen} />
    </div>
  )
}

function ReviewRow({
  item,
  products,
  onOpen,
}: {
  item: LibraryItemRow
  products: ProductRow[]
  onOpen: () => void
}) {
  const review = useReviewItem()
  const users = useUsers()
  const product = products.find((p) => p.id === item.product_id)
  const [section, setSection] = useState<Section>(
    suggestSection(item.shared_drive, item.kind, Boolean(item.product_id)),
  )
  const [eventName, setEventName] = useState('')
  const month = todayVN().slice(0, 7)
  const uploader = users.data?.find((u) => u.id === item.uploaded_by)
  const needsEvent = section === 'events' && !eventName.trim()

  return (
    <li className="grid gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[8rem_1fr]">
      <button type="button" onClick={onOpen}>
        <ItemThumb item={item} className="aspect-[4/3] w-full rounded-lg" />
      </button>
      <div className="grid gap-2">
        <div>
          <p className="font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {vi.libraryKinds[item.kind]} · {product?.name ?? t.general} ·{' '}
            {t.drives[item.shared_drive]} ·{' '}
            {t.uploadedBy(uploader?.full_name ?? '', formatDateVN(item.created_at))}
          </p>
        </div>
        {item.kind !== 'youtube' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              aria-label={t.target}
              value={section}
              onChange={(e) => setSection(e.target.value as Section)}
            >
              {SECTIONS_BY_DRIVE[item.shared_drive].map((s) => (
                <option key={s} value={s}>
                  {t.sections[s]}
                </option>
              ))}
            </Select>
            {section === 'events' && (
              <Input
                value={eventName}
                placeholder={t.eventName}
                aria-label={t.eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            )}
            <p className="font-mono text-xs text-muted-foreground sm:col-span-2">
              → {previewPath(section, item.kind, product?.line, eventName, month)}
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={review.isPending || needsEvent}
            onClick={() =>
              review.mutate({ itemId: item.id, action: 'approve', section, eventName })
            }
          >
            {t.approve}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={review.isPending}
            onClick={() => {
              const reason = window.prompt(t.rejectPrompt)?.trim()
              if (reason) review.mutate({ itemId: item.id, action: 'reject', reason })
            }}
          >
            {t.reject}
          </Button>
        </div>
        <FieldError>{review.error?.message}</FieldError>
      </div>
    </li>
  )
}

export function LibraryPage() {
  const me = useMe()
  const items = useLibraryItems()
  const products = useProducts()
  const canApprove = useCanApprove()
  const [params, setParams] = useSearchParams()
  const approver = Boolean(canApprove.data?.library || canApprove.data?.sales_private)

  const pending = (items.data ?? []).filter(
    (i) => i.status === 'pending' && i.uploaded_by !== me.id && canApprove.data?.[i.shared_drive],
  )
  const mine = (items.data ?? []).filter((i) => i.uploaded_by === me.id)
  const tabs: Tab[] = ['browse', 'upload', ...(approver ? (['review'] as Tab[]) : []), 'mine']
  const raw = params.get('tab') as Tab | null
  const tab: Tab = raw && tabs.includes(raw) ? raw : 'browse'
  const itemId = params.get('item')
  const open = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('item', id)
      return next
    })
  const openItem = (items.data ?? []).find((i) => i.id === itemId) ?? null

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <Tabs
        value={tab}
        onChange={(v) => setParams(v === 'browse' ? {} : { tab: v }, { replace: true })}
        items={tabs.map((v) => ({
          value: v,
          label: v === 'review' ? `${t.tabs.review} (${pending.length})` : t.tabs[v],
        }))}
      />
      {(items.isPending || products.isPending) && <Spinner />}
      {items.error && <ErrorBox error={items.error} onRetry={() => items.refetch()} />}
      {items.data && products.data && (
        <>
          {tab === 'browse' && <Browse items={items.data} products={products.data} onOpen={open} />}
          {tab === 'upload' && <UploadPanel products={products.data} />}
          {tab === 'review' && (
            <Card>
              <CardContent className="p-0">
                {pending.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">{t.reviewEmpty}</p>
                )}
                <ul>
                  {pending.map((i) => (
                    <ReviewRow
                      key={i.id}
                      item={i}
                      products={products.data}
                      onOpen={() => open(i.id)}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {tab === 'mine' && (
            <Card>
              <CardContent className="p-0">
                {mine.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">{t.mineEmpty}</p>
                )}
                <ul>
                  {mine.map((i) => (
                    <li key={i.id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted"
                        onClick={() => open(i.id)}
                      >
                        <ItemThumb item={i} size={200} className="size-14 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{i.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateVN(i.created_at)} · {vi.libraryKinds[i.kind]}
                            {i.reject_reason ? ` · ${t.rejectedReason(i.reject_reason)}` : ''}
                          </p>
                        </div>
                        <StatusBadge status={i.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <ItemSheet
            item={openItem}
            products={products.data}
            onClose={() =>
              setParams((prev) => {
                const next = new URLSearchParams(prev)
                next.delete('item')
                return next
              })
            }
          />
        </>
      )}
    </div>
  )
}
