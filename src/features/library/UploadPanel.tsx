import { UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { useMe } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import type { ProductRow, SharedDriveKind } from '@/lib/database.types'
import { cn } from '@/lib/utils'
import { uploadLibraryFile, useAddYoutube, useInvalidateLibrary } from './api'
import { ChannelPicker, ProductSelect } from './LibraryParts'
import { FILE_KINDS, formatBytes, kindFromMime, parseTags, youtubeId } from './library-rules'

const t = vi.library

type RowState = 'queued' | 'uploading' | 'done' | 'failed' | 'cancelled'

interface Row {
  key: string
  file: File
  title: string
  kind: (typeof FILE_KINDS)[number]
  loaded: number
  state: RowState
  error?: string
  controller?: AbortController
}

function useCommonMeta() {
  const me = useMe()
  const canSales =
    me.role === 'manager' ||
    me.role === 'admin' ||
    me.teams.some((m) => m.team_id === 'sales_domestic')
  const [product, setProduct] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [tags, setTags] = useState('')
  const [drive, setDrive] = useState<SharedDriveKind>('library')
  const problem = !product ? t.productRequired : channels.length === 0 ? t.channelsRequired : null
  return {
    canSales,
    product,
    setProduct,
    channels,
    setChannels,
    tags,
    setTags,
    drive,
    setDrive,
    problem,
  }
}

function CommonFields({
  meta,
  products,
  prefix,
}: {
  meta: ReturnType<typeof useCommonMeta>
  products: ProductRow[]
  prefix: string
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-product`}>{t.product} *</Label>
        <ProductSelect
          id={`${prefix}-product`}
          products={products}
          value={meta.product}
          onChange={meta.setProduct}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.channels} *</Label>
        <ChannelPicker value={meta.channels} onChange={meta.setChannels} />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-tags`}>{t.tags}</Label>
          <Input
            id={`${prefix}-tags`}
            value={meta.tags}
            onChange={(e) => meta.setTags(e.target.value)}
          />
        </div>
        {meta.canSales && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefix}-drive`}>{t.drive}</Label>
            <Select
              id={`${prefix}-drive`}
              value={meta.drive}
              onChange={(e) => meta.setDrive(e.target.value as SharedDriveKind)}
            >
              <option value="library">{t.drives.library}</option>
              <option value="sales_private">{t.drives.sales_private}</option>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}

export function UploadPanel({ products }: { products: ProductRow[] }) {
  const meta = useCommonMeta()
  const invalidate = useInvalidateLibrary()
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (key: string, p: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)))

  function addFiles(files: FileList | File[]) {
    const next = [...files].map<Row>((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      title: file.name.replace(/\.[^.]+$/, ''),
      kind: kindFromMime(file.type, file.name),
      loaded: 0,
      state: 'queued',
    }))
    setRows((prev) => [...prev, ...next])
  }

  async function start() {
    setError(meta.problem)
    if (meta.problem) return
    setRunning(true)
    for (const row of rows.filter((r) => r.state === 'queued' || r.state === 'failed')) {
      const controller = new AbortController()
      patch(row.key, { state: 'uploading', loaded: 0, error: undefined, controller })
      try {
        await uploadLibraryFile(
          row.file,
          {
            title: row.title.trim() || row.file.name,
            description: '',
            kind: row.kind,
            shared_drive: meta.drive,
            product_id: meta.product === 'none' ? null : meta.product,
            tags: parseTags(meta.tags),
            channels: meta.channels,
          },
          (loaded) => patch(row.key, { loaded }),
          controller.signal,
        )
        patch(row.key, { state: 'done', loaded: row.file.size })
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError'
        patch(row.key, {
          state: aborted ? 'cancelled' : 'failed',
          error: aborted ? undefined : (e as Error).message,
        })
      }
    }
    setRunning(false)
    void invalidate()
  }

  const pending = rows.filter((r) => r.state === 'queued' || r.state === 'failed').length

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4 p-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              addFiles(e.dataTransfer.files)
            }}
            className={cn(
              'flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground',
              dragOver ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            <UploadCloud className="size-8" />
            {t.dropHint}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />

          {rows.length > 0 && (
            <ul className="grid gap-2">
              {rows.map((r) => {
                const pct = Math.round((r.loaded / r.file.size) * 100)
                return (
                  <li key={r.key} className="grid gap-2 rounded-lg border border-border p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={r.title}
                        aria-label={t.titleField}
                        disabled={r.state !== 'queued' && r.state !== 'failed'}
                        onChange={(e) => patch(r.key, { title: e.target.value })}
                      />
                      <Select
                        className="w-28"
                        aria-label={t.kind}
                        value={r.kind}
                        disabled={r.state !== 'queued' && r.state !== 'failed'}
                        onChange={(e) => patch(r.key, { kind: e.target.value as Row['kind'] })}
                      >
                        {FILE_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {vi.libraryKinds[k]}
                          </option>
                        ))}
                      </Select>
                      {r.state === 'uploading' ? (
                        <Button variant="ghost" size="sm" onClick={() => r.controller?.abort()}>
                          {t.cancel}
                        </Button>
                      ) : r.state !== 'done' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t.remove}
                          onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                        >
                          <X />
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-20 shrink-0">{formatBytes(r.file.size)}</span>
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width]',
                            r.state === 'failed'
                              ? 'bg-destructive'
                              : r.state === 'done'
                                ? 'bg-success'
                                : 'bg-primary',
                          )}
                          style={{ width: `${r.state === 'queued' ? 0 : pct}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right">
                        {r.state === 'uploading' && `${pct}%`}
                        {r.state === 'done' && t.uploaded}
                        {r.state === 'failed' && t.failed}
                        {r.state === 'cancelled' && t.cancelled}
                      </span>
                    </div>
                    {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                  </li>
                )
              })}
            </ul>
          )}

          <CommonFields meta={meta} products={products} prefix="up" />
          <p className="text-xs text-muted-foreground">{t.uploadHint}</p>
          <FieldError>{error}</FieldError>
          <Button size="lg" onClick={start} disabled={running || pending === 0}>
            {running ? t.uploading : t.startUpload(pending)}
          </Button>
        </CardContent>
      </Card>
      <YoutubeForm products={products} />
    </div>
  )
}

function YoutubeForm({ products }: { products: ProductRow[] }) {
  const meta = useCommonMeta()
  const add = useAddYoutube()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.youtubeTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setDone(false)
            const problem = !youtubeId(url) ? t.youtubeInvalid : meta.problem
            setError(problem)
            if (problem) return
            await add.mutateAsync({
              youtube_url: url,
              title: title || url,
              description: '',
              shared_drive: meta.drive,
              product_id: meta.product === 'none' ? null : meta.product,
              tags: parseTags(meta.tags),
              channels: meta.channels,
            })
            setUrl('')
            setTitle('')
            setDone(true)
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="yt-url">{t.youtubeUrl}</Label>
            <Input
              id="yt-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="yt-title">{t.titleField}</Label>
            <Input id="yt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <CommonFields meta={meta} products={products} prefix="yt" />
          <FieldError>{error ?? add.error?.message}</FieldError>
          {done && <p className="text-sm text-success">{t.uploaded}</p>}
          <Button type="submit" variant="secondary" disabled={add.isPending}>
            {t.add}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
