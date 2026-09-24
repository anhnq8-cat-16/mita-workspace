import { ExternalLink, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { vi } from '@/i18n/vi'
import type { LinkItem } from '@/lib/database.types'

const t = vi.campaigns

/** Danh sách link tài liệu (Drive, Canva, website…) – nhập tên + địa chỉ */
export function LinksEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: LinkItem[]
  onChange: (v: LinkItem[]) => void
  idPrefix: string
}) {
  const set = (i: number, patch: Partial<LinkItem>) =>
    onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  return (
    <div className="grid gap-2">
      {value.map((l, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
          <Input
            id={`${idPrefix}-label-${i}`}
            placeholder={t.linkLabel}
            aria-label={t.linkLabel}
            value={l.label}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <Input
            id={`${idPrefix}-url-${i}`}
            type="url"
            placeholder={t.linkUrl}
            aria-label={t.linkUrl}
            value={l.url}
            onChange={(e) => set(i, { url: e.target.value })}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={vi.common.delete}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => onChange([...value, { label: '', url: '' }])}
      >
        <Plus /> {t.linkAdd}
      </Button>
    </div>
  )
}

export function LinkList({ links }: { links: LinkItem[] }) {
  if (!links.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <li key={l.url}>
          <a
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border px-2.5 text-xs font-medium text-primary hover:bg-muted"
          >
            <ExternalLink className="size-3.5" /> {l.label}
          </a>
        </li>
      ))}
    </ul>
  )
}
