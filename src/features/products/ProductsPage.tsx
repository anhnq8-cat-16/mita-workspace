import { FileDown, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { useMe } from '@/features/auth/auth-context'
import { useLibraryItems } from '@/features/library/api'
import { ItemCard } from '@/features/library/LibraryParts'
import { useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { ProductCategory, ProductRow } from '@/lib/database.types'
import { formatDateTimeVN } from '@/lib/date-vn'
import { formatVND, parseVND } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePriceHistory, useProducts, useSavePrices, useSaveProduct } from './api'
import { CATEGORIES, diffPrices, groupProducts, packLabel } from './product-rules'

const t = vi.products
type Edits = Record<string, { retail: number | null; wholesale: number | null }>

function Price({ value }: { value: number | null }) {
  return value === null ? (
    <span className="text-muted-foreground">{t.noPrice}</span>
  ) : (
    <span className="tabular-nums">{formatVND(value)}</span>
  )
}

function PriceInput({
  value,
  onChange,
  label,
}: {
  value: number | null
  onChange: (v: number | null) => void
  label: string
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  return (
    <Input
      inputMode="numeric"
      aria-label={label}
      className="h-9 min-h-9 text-right tabular-nums"
      value={text}
      placeholder="—"
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseVND(e.target.value))
      }}
    />
  )
}

function ProductForm({ product, onDone }: { product?: ProductRow; onDone: () => void }) {
  const save = useSaveProduct()
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    line: product?.line ?? '',
    category: product?.category ?? ('coffee' as ProductCategory),
    origin: product?.origin ?? '',
    flavor_notes: product?.flavor_notes ?? '',
    pack_size_g: product?.pack_size_g?.toString() ?? '',
    description: product?.description ?? '',
    is_active: product?.is_active ?? true,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))
  const input = (
    k: 'sku' | 'name' | 'line' | 'origin' | 'flavor_notes' | 'pack_size_g',
    label: string,
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`pf-${k}`}>{label}</Label>
      <Input id={`pf-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  )
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        await save.mutateAsync({
          id: product?.id,
          input: {
            sku: form.sku.trim().toUpperCase(),
            name: form.name.trim(),
            line: form.line.trim() || null,
            category: form.category,
            origin: form.origin.trim() || null,
            flavor_notes: form.flavor_notes.trim() || null,
            pack_size_g: form.pack_size_g ? Number(form.pack_size_g) : null,
            description: form.description.trim() || null,
            is_active: form.is_active,
          },
        })
        onDone()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {input('sku', t.sku)}
        <div className="grid gap-1.5">
          <Label htmlFor="pf-category">{t.fields.category}</Label>
          <Select
            id="pf-category"
            value={form.category}
            onChange={(e) => set('category', e.target.value as ProductCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {vi.productCategories[c]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {input('name', t.fields.name)}
      <div className="grid grid-cols-2 gap-3">
        {input('line', t.fields.line)}
        {input('pack_size_g', t.fields.pack)}
        {input('origin', t.origin)}
        {input('flavor_notes', t.flavor)}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pf-desc">{t.fields.description}</Label>
        <Textarea
          id="pf-desc"
          rows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={form.is_active}
          onChange={(e) => set('is_active', e.target.checked)}
        />
        {t.active}
      </label>
      <FieldError>{save.error?.message}</FieldError>
      <Button type="submit" disabled={save.isPending || !form.sku.trim() || !form.name.trim()}>
        {vi.common.save}
      </Button>
    </form>
  )
}

function ProductSheet({ product, onClose }: { product: ProductRow | null; onClose: () => void }) {
  const me = useMe()
  const users = useUsers()
  const history = usePriceHistory(product?.id ?? null)
  const library = useLibraryItems()
  const [editing, setEditing] = useState(false)
  const nameOf = (id: string | null) => users.data?.find((u) => u.id === id)?.full_name ?? ''
  if (!product)
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    )
  const assets = (library.data ?? []).filter(
    (i) => i.product_id === product.id && i.status === 'approved',
  )

  return (
    <Sheet
      open
      onClose={() => {
        setEditing(false)
        onClose()
      }}
      title={product.name}
    >
      {editing ? (
        <ProductForm product={product} onDone={() => setEditing(false)} />
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{product.sku}</Badge>
            <Badge>{vi.productCategories[product.category]}</Badge>
            {!product.is_active && <Badge variant="secondary">{t.inactive}</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t.retail}</dt>
              <dd className="text-lg font-semibold">
                <Price value={product.retail_price_vnd} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.wholesale}</dt>
              <dd className="text-lg font-semibold">
                <Price value={product.wholesale_price_vnd} />
              </dd>
            </div>
            {product.origin && (
              <div>
                <dt className="text-xs text-muted-foreground">{t.origin}</dt>
                <dd>{product.origin}</dd>
              </div>
            )}
            {product.flavor_notes && (
              <div>
                <dt className="text-xs text-muted-foreground">{t.flavor}</dt>
                <dd>{product.flavor_notes}</dd>
              </div>
            )}
            {product.description && <dd className="col-span-2">{product.description}</dd>}
            <dd className="col-span-2 text-xs text-muted-foreground">
              {t.updated(formatDateTimeVN(product.updated_at), nameOf(product.updated_by))}
            </dd>
          </dl>
          {me.role === 'admin' && (
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setEditing(true)}
            >
              <Pencil /> {vi.common.edit}
            </Button>
          )}
          <section className="grid gap-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">{t.history}</h3>
            {history.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">{t.noHistory}</p>
            )}
            <ul className="grid gap-1 text-xs">
              {history.data?.map((h) => (
                <li key={h.id}>
                  {formatDateTimeVN(h.changed_at)} · {nameOf(h.changed_by)}:{' '}
                  {h.old_retail !== h.new_retail && (
                    <span>
                      {t.retail} {h.old_retail === null ? '—' : formatVND(h.old_retail)} →{' '}
                      {h.new_retail === null ? '—' : formatVND(h.new_retail)}.{' '}
                    </span>
                  )}
                  {h.old_wholesale !== h.new_wholesale && (
                    <span>
                      {t.wholesale} {h.old_wholesale === null ? '—' : formatVND(h.old_wholesale)} →{' '}
                      {h.new_wholesale === null ? '—' : formatVND(h.new_wholesale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">{t.assets}</h3>
            {assets.length === 0 && <p className="text-sm text-muted-foreground">{t.noAssets}</p>}
            <div className="grid grid-cols-2 gap-2">
              {assets.map((a) => (
                <Link key={a.id} to={`/thu-vien?item=${a.id}`}>
                  <ItemCard item={a} onOpen={() => undefined} />
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </Sheet>
  )
}

export function ProductsPage() {
  const me = useMe()
  const products = useProducts()
  const savePrices = useSavePrices()
  const [edits, setEdits] = useState<Edits | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const canPrice = me.role === 'manager' || me.role === 'admin'
  const groups = groupProducts(products.data ?? [])
  const changes = edits ? diffPrices(products.data ?? [], edits) : []

  const setEdit = (p: ProductRow, key: 'retail' | 'wholesale', v: number | null) =>
    setEdits((prev) => {
      const cur = prev?.[p.id] ?? { retail: p.retail_price_vnd, wholesale: p.wholesale_price_vnd }
      return { ...prev, [p.id]: { ...cur, [key]: v } }
    })

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/san-pham/in">
            <Button variant="outline">
              <FileDown /> {t.printPdf}
            </Button>
          </Link>
          {canPrice && !edits && (
            <Button variant="outline" onClick={() => setEdits({})}>
              <Pencil /> {t.editPrices}
            </Button>
          )}
          {me.role === 'admin' && !edits && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t.newProduct}
            </Button>
          )}
        </div>
      </div>
      {edits && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-card p-3 shadow-sm">
          <span className="flex-1 text-sm">{t.editPrices}</span>
          <Button variant="ghost" onClick={() => setEdits(null)}>
            {t.cancelEdit}
          </Button>
          <Button
            disabled={changes.length === 0 || savePrices.isPending}
            onClick={() => savePrices.mutate(changes, { onSuccess: () => setEdits(null) })}
          >
            {t.savePrices(changes.length)}
          </Button>
          <FieldError>{savePrices.error?.message}</FieldError>
        </div>
      )}
      {products.isPending && <Spinner />}
      {products.error && <ErrorBox error={products.error} />}
      <p className="text-xs text-muted-foreground">{t.grindNote}</p>

      {groups.map((g) => (
        <Card key={g.category}>
          <CardHeader>
            <CardTitle>{vi.productCategories[g.category]}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {g.lines.map(({ line, items }) => (
              <div key={line} className="grid gap-1">
                {line && line !== vi.productCategories[g.category] && (
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="font-semibold">{line}</h3>
                    {items[0]?.origin && g.category === 'coffee' && (
                      <span className="text-xs text-muted-foreground">
                        {items[0].origin} · {items[0].flavor_notes}
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 text-xs text-muted-foreground">
                  <span />
                  <span className="w-28 text-right">{t.retail}</span>
                  <span className="w-28 text-right">{t.wholesale}</span>
                </div>
                <ul>
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className={cn(
                        'grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-border py-2 text-sm last:border-b-0',
                        !p.is_active && 'opacity-50',
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 text-left hover:underline"
                        onClick={() => setOpenId(p.id)}
                      >
                        {g.category === 'coffee' && p.pack_size_g
                          ? packLabel(p.pack_size_g)
                          : p.name}
                        {p.description && g.category !== 'coffee' && (
                          <span className="block text-xs text-muted-foreground">
                            {p.description}
                          </span>
                        )}
                      </button>
                      {edits ? (
                        <>
                          <span className="w-28">
                            <PriceInput
                              value={p.retail_price_vnd}
                              label={`${t.retail} ${p.name}`}
                              onChange={(v) => setEdit(p, 'retail', v)}
                            />
                          </span>
                          <span className="w-28">
                            <PriceInput
                              value={p.wholesale_price_vnd}
                              label={`${t.wholesale} ${p.name}`}
                              onChange={(v) => setEdit(p, 'wholesale', v)}
                            />
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-28 text-right">
                            <Price value={p.retail_price_vnd} />
                          </span>
                          <span className="w-28 text-right">
                            <Price value={p.wholesale_price_vnd} />
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <ProductSheet
        product={(products.data ?? []).find((p) => p.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
      <Sheet open={creating} onClose={() => setCreating(false)} title={t.newProduct}>
        {creating && <ProductForm onDone={() => setCreating(false)} />}
      </Sheet>
    </div>
  )
}
