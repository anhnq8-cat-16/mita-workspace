import { ArrowLeft, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSetting } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import { formatDateVN } from '@/lib/date-vn'
import { formatVND } from '@/lib/format'
import { useProducts } from './api'
import { groupProducts, packLabel } from './product-rules'

const t = vi.products

/** Bảng giá bản in (dùng "In → Lưu dưới dạng PDF" của trình duyệt) */
export function PriceListPrint() {
  const products = useProducts()
  const note = useSetting<string>('price_list_note') ?? ''
  const active = (products.data ?? []).filter((p) => p.is_active)
  const groups = groupProducts(active)
  const coffee = groups.find((g) => g.category === 'coffee')
  const sizes = [
    ...new Set(active.filter((p) => p.category === 'coffee').map((p) => p.pack_size_g ?? 0)),
  ]
    .filter(Boolean)
    .sort((a, b) => a - b)
  const price = (v: number | null) => (v === null ? '—' : formatVND(v))

  return (
    <div className="min-h-dvh bg-white text-black">
      <div className="flex items-center gap-2 border-b p-3 print:hidden">
        <Link to="/san-pham" className="flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> {t.back}
        </Link>
        <Button className="ml-auto" onClick={() => window.print()}>
          <Printer /> {t.print}
        </Button>
      </div>
      {products.isPending && <Spinner />}
      <main className="mx-auto max-w-3xl p-6 text-sm print:p-0">
        <header className="mb-4 text-center">
          <p className="text-xs tracking-widest uppercase">CTCP XNK MITAFOOD · DALAC</p>
          <h1 className="mt-1 text-2xl font-bold">{t.printTitle}</h1>
          <p className="mt-1">{t.effective(formatDateVN(new Date()))}</p>
        </header>

        {coffee && (
          <section className="mb-5 break-inside-avoid">
            <h2 className="mb-1 text-base font-bold uppercase">
              {vi.productCategories.coffee} ({t.retail})
            </h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y border-black">
                  <th className="p-1 text-left">Dòng</th>
                  <th className="p-1 text-left">{t.origin}</th>
                  <th className="p-1 text-left">{t.flavor}</th>
                  {sizes.map((s) => (
                    <th key={s} className="p-1 text-right">
                      {packLabel(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coffee.lines.map(({ line, items }) => (
                  <tr key={line} className="border-b border-gray-300">
                    <td className="p-1 font-semibold">{line}</td>
                    <td className="p-1">{items[0]?.origin}</td>
                    <td className="p-1">{items[0]?.flavor_notes}</td>
                    {sizes.map((s) => (
                      <td key={s} className="p-1 text-right tabular-nums">
                        {price(items.find((i) => i.pack_size_g === s)?.retail_price_vnd ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs italic">{t.grindNote}</p>
          </section>
        )}

        {groups
          .filter((g) => g.category !== 'coffee')
          .map((g) => (
            <section key={g.category} className="mb-5 break-inside-avoid">
              <h2 className="mb-1 text-base font-bold uppercase">
                {vi.productCategories[g.category]}
              </h2>
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {g.lines.flatMap(({ items }) =>
                    items.map((p) => (
                      <tr key={p.id} className="border-b border-gray-300">
                        <td className="p-1 font-semibold">{p.name}</td>
                        <td className="p-1">{p.description}</td>
                        <td className="p-1 text-right tabular-nums">{price(p.retail_price_vnd)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </section>
          ))}

        {note && <p className="mt-6 text-xs">{note}</p>}
      </main>
    </div>
  )
}
