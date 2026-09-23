import type { LibraryItemRow, LibraryKind, ProductRow, SharedDriveKind } from '@/lib/database.types'

// Khớp supabase/functions/_shared/library-paths.ts
export type Section =
  'products' | 'sales' | 'brand' | 'events' | 'quotes' | 'contracts' | 'sales_docs'

export const SECTIONS_BY_DRIVE: Record<SharedDriveKind, Section[]> = {
  library: ['products', 'sales', 'brand', 'events'],
  sales_private: ['sales_docs', 'quotes', 'contracts'],
}

export const FILE_KINDS: Exclude<LibraryKind, 'youtube'>[] = [
  'image',
  'video',
  'document',
  'design',
]

export function suggestSection(
  drive: SharedDriveKind,
  kind: LibraryKind,
  hasProduct: boolean,
): Section {
  if (drive === 'sales_private') return 'sales_docs'
  if (hasProduct) return 'products'
  if (kind === 'design') return 'brand'
  return 'sales'
}

/** Xem trước đường dẫn thư mục đích (hiển thị cho người duyệt) */
export function previewPath(
  section: Section,
  kind: LibraryKind,
  productLine: string | null | undefined,
  eventName: string,
  month: string,
): string {
  switch (section) {
    case 'products':
      return `01_San-pham/${productLine || 'Khac'}/${kind === 'image' ? 'Anh' : kind === 'video' ? 'Video' : 'Mo-ta'}`
    case 'sales':
      return '02_Ban-hang'
    case 'brand':
      return '03_Thuong-hieu'
    case 'events':
      return `04_Su-kien/${month} ${eventName || '…'}`
    case 'quotes':
      return 'Bao-gia'
    case 'contracts':
      return 'Hop-dong'
    case 'sales_docs':
      return 'Tai-lieu-ban-hang'
  }
}

export function kindFromMime(mime: string, name = ''): Exclude<LibraryKind, 'youtube'> {
  if (mime.startsWith('image/') && !/photoshop/.test(mime)) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (
    /photoshop|illustrator|postscript|figma|indesign|sketch|coreldraw/.test(mime) ||
    /\.(psd|ai|eps|fig|indd|cdr|sketch)$/i.test(name)
  ) {
    return 'design'
  }
  return 'document'
}

export interface LibraryFilters {
  q: string
  product: string
  kind: string
  channel: string
  tag: string
}

export function filterLibrary(items: LibraryItemRow[], f: LibraryFilters): LibraryItemRow[] {
  const q = f.q.trim().toLowerCase()
  return items.filter(
    (i) =>
      (!q ||
        i.title.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        (i.description ?? '').toLowerCase().includes(q)) &&
      (!f.product || (f.product === 'none' ? !i.product_id : i.product_id === f.product)) &&
      (!f.kind || i.kind === f.kind) &&
      (!f.channel || i.channels.includes(f.channel)) &&
      (!f.tag || i.tags.includes(f.tag)),
  )
}

/** Nhóm sản phẩm theo dòng (dùng cho ô chọn sản phẩm) */
export function productLines(products: Pick<ProductRow, 'line'>[]): string[] {
  return [...new Set(products.map((p) => p.line).filter((l): l is string => Boolean(l)))]
}

export function parseTags(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,#\n]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 20)
}

export function youtubeId(url: string): string | null {
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{6,})/i.exec(
    url,
  )
  return m?.[1] ?? null
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB`
}
