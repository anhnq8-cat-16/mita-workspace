import {
  Download,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Palette,
  PlayCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { useMe } from '@/features/auth/auth-context'
import { useSetting, useUsers } from '@/features/settings/api'
import { vi } from '@/i18n/vi'
import type { LibraryItemRow, LibraryKind, ProductRow } from '@/lib/database.types'
import { formatDateVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import { driveDownloadUrl, useCanApprove, useDeleteItem, useDriveThumb, useUpdateItem } from './api'
import { formatBytes, parseTags, youtubeId } from './library-rules'

const t = vi.library

const KIND_ICON: Record<LibraryKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  document: FileText,
  design: Palette,
  youtube: PlayCircle,
}

/** Ảnh thu nhỏ: YouTube lấy ảnh công khai; file Drive qua drive-thumb (kiểm tra quyền) */
export function ItemThumb({
  item,
  size = 400,
  className,
}: {
  item: LibraryItemRow
  size?: number
  className?: string
}) {
  const yt = item.kind === 'youtube' && item.youtube_url ? youtubeId(item.youtube_url) : null
  const thumb = useDriveThumb(item.kind === 'youtube' ? null : item.drive_file_id, size)
  const src = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : thumb.data
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const Icon = KIND_ICON[item.kind]
  const show = src && failedSrc !== src
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-muted',
        className,
      )}
    >
      {show ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Icon className="size-10 text-muted-foreground/60" />
      )}
      {(item.kind === 'video' || item.kind === 'youtube') && show && (
        <PlayCircle className="absolute size-10 text-white drop-shadow" />
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: LibraryItemRow['status'] }) {
  return (
    <Badge
      variant={
        status === 'approved' ? 'success' : status === 'rejected' ? 'destructive' : 'warning'
      }
    >
      {t.status[status]}
    </Badge>
  )
}

export function ItemCard({ item, onOpen }: { item: LibraryItemRow; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <ItemThumb item={item} className="aspect-[4/3]" />
      <div className="grid gap-1 p-2">
        <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <Badge variant="outline">{vi.libraryKinds[item.kind]}</Badge>
          {item.shared_drive === 'sales_private' && <Badge variant="secondary">Sales</Badge>}
          {item.status !== 'approved' && <StatusBadge status={item.status} />}
        </div>
      </div>
    </button>
  )
}

export function ChannelPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const channels = useSetting<string[]>('library_channels') ?? []
  return (
    <div className="flex flex-wrap gap-2">
      {channels.map((c) => {
        const on = value.includes(c)
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
            className={cn(
              'min-h-9 rounded-full border px-3 text-sm',
              on ? 'border-primary bg-primary/10 text-primary' : 'border-border',
            )}
          >
            {c}
          </button>
        )
      })}
    </div>
  )
}

export function ProductSelect({
  products,
  value,
  onChange,
  id,
  allowAll,
}: {
  products: ProductRow[]
  value: string
  onChange: (v: string) => void
  id?: string
  allowAll?: boolean
}) {
  const byLine = new Map<string, ProductRow[]>()
  for (const p of products.filter((p) => p.is_active)) {
    const key = p.line ?? vi.productCategories[p.category]
    byLine.set(key, [...(byLine.get(key) ?? []), p])
  }
  return (
    <Select id={id} value={value} aria-label={t.product} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allowAll ? t.allProducts : t.pickProduct}</option>
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
  )
}

function EditMeta({
  item,
  products,
  onDone,
}: {
  item: LibraryItemRow
  products: ProductRow[]
  onDone: () => void
}) {
  const update = useUpdateItem()
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [product, setProduct] = useState(item.product_id ?? 'none')
  const [channels, setChannels] = useState(item.channels)
  const [tags, setTags] = useState(item.tags.join(', '))
  return (
    <div className="grid gap-3 rounded-lg border border-border p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="edit-title">{t.titleField}</Label>
        <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-product">{t.product}</Label>
        <ProductSelect
          id="edit-product"
          products={products}
          value={product}
          onChange={setProduct}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.channels}</Label>
        <ChannelPicker value={channels} onChange={setChannels} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-tags">{t.tags}</Label>
        <Input id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-desc">{t.description}</Label>
        <Textarea
          id="edit-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <FieldError>{update.error?.message}</FieldError>
      <Button
        size="sm"
        className="justify-self-start"
        disabled={update.isPending || !title.trim()}
        onClick={() =>
          update.mutate(
            {
              id: item.id,
              patch: {
                title: title.trim(),
                description: description.trim() || null,
                product_id: product && product !== 'none' ? product : null,
                channels,
                tags: parseTags(tags),
              },
            },
            { onSuccess: onDone },
          )
        }
      >
        {vi.common.save}
      </Button>
    </div>
  )
}

/** Xem trước + thao tác (mở Drive, tải xuống, sửa thông tin) */
export function ItemSheet({
  item,
  products,
  onClose,
}: {
  item: LibraryItemRow | null
  products: ProductRow[]
  onClose: () => void
}) {
  const me = useMe()
  const users = useUsers()
  const canApprove = useCanApprove()
  const remove = useDeleteItem()
  const [editing, setEditing] = useState(false)
  if (!item)
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    )

  const product = products.find((p) => p.id === item.product_id)
  const uploader = users.data?.find((u) => u.id === item.uploaded_by)
  const approver = canApprove.data?.[item.shared_drive] ?? false
  const canEdit = approver || (item.uploaded_by === me.id && item.status === 'pending')
  const canDelete =
    me.role === 'admin' || (item.uploaded_by === me.id && item.status !== 'approved')
  const yt = item.youtube_url ? youtubeId(item.youtube_url) : null

  return (
    <Sheet
      open
      onClose={() => {
        setEditing(false)
        onClose()
      }}
      title={item.title}
    >
      <div className="grid gap-4">
        {yt ? (
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${yt}`}
              title={item.title}
              allow="accelerometer; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <ItemThumb
            item={item}
            size={1600}
            className="max-h-[50vh] min-h-48 rounded-lg [&_img]:object-contain"
          />
        )}
        <div className="flex flex-wrap gap-2">
          {item.web_view_link && (
            <a href={item.web_view_link} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <ExternalLink /> {t.openDrive}
              </Button>
            </a>
          )}
          {item.drive_file_id && (
            <a href={driveDownloadUrl(item.drive_file_id)} target="_blank" rel="noreferrer">
              <Button>
                <Download /> {t.download}
              </Button>
            </a>
          )}
          {item.youtube_url && (
            <a href={item.youtube_url} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <PlayCircle /> {t.openYoutube}
              </Button>
            </a>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t.kind}</dt>
            <dd>
              {vi.libraryKinds[item.kind]} {formatBytes(item.size_bytes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.product}</dt>
            <dd>{product?.name ?? t.general}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.drive}</dt>
            <dd>{t.drives[item.shared_drive]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{vi.sales.fields.status}</dt>
            <dd>
              <StatusBadge status={item.status} />
            </dd>
          </div>
          {item.folder_path && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{t.target}</dt>
              <dd className="font-mono text-xs">{item.folder_path}</dd>
            </div>
          )}
          {item.channels.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-1">
              {item.channels.map((c) => (
                <Badge key={c} variant="secondary">
                  {c}
                </Badge>
              ))}
              {item.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
          {item.description && (
            <dd className="col-span-2 whitespace-pre-line">{item.description}</dd>
          )}
          {item.reject_reason && (
            <dd className="col-span-2 text-destructive">{t.rejectedReason(item.reject_reason)}</dd>
          )}
          <dd className="col-span-2 text-xs text-muted-foreground">
            {t.uploadedBy(
              uploader?.full_name ?? uploader?.email ?? '',
              formatDateVN(item.created_at),
            )}
          </dd>
        </dl>
        {canEdit && !editing && (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => setEditing(true)}
          >
            {vi.common.edit}
          </Button>
        )}
        {editing && <EditMeta item={item} products={products} onDone={() => setEditing(false)} />}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start text-destructive"
            onClick={async () => {
              if (!window.confirm(t.confirmDelete)) return
              await remove.mutateAsync(item.id)
              onClose()
            }}
          >
            {t.delete}
          </Button>
        )}
        <FieldError>{remove.error?.message}</FieldError>
      </div>
    </Sheet>
  )
}
