// Cấu trúc thư mục Shared Drive (SPEC 4.2) – dùng chung Edge Function & test
export type SharedDrive = 'library' | 'sales_private'
export type LibraryKind = 'image' | 'video' | 'document' | 'design' | 'youtube'
export type Section =
  'products' | 'sales' | 'brand' | 'events' | 'quotes' | 'contracts' | 'sales_docs'

export const PENDING_FOLDER = '00_Cho-duyet'

export const SECTIONS_BY_DRIVE: Record<SharedDrive, Section[]> = {
  library: ['products', 'sales', 'brand', 'events'],
  sales_private: ['sales_docs', 'quotes', 'contracts'],
}

/** Tên thư mục an toàn cho Drive */
function clean(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Khac'
  )
}

/** Đường dẫn thư mục đích (tính từ gốc Shared Drive) */
export function targetPath(opts: {
  drive: SharedDrive
  section: Section
  kind: LibraryKind
  productLine?: string | null
  eventName?: string | null
  eventMonth?: string | null // YYYY-MM
}): string[] {
  const { drive, section, kind } = opts
  if (!SECTIONS_BY_DRIVE[drive].includes(section)) {
    throw new Error('Thư mục đích không thuộc Shared Drive này')
  }
  switch (section) {
    case 'products': {
      const sub = kind === 'image' ? 'Anh' : kind === 'video' ? 'Video' : 'Mo-ta'
      return ['01_San-pham', clean(opts.productLine ?? 'Khac'), sub]
    }
    case 'sales':
      return ['02_Ban-hang']
    case 'brand':
      return ['03_Thuong-hieu']
    case 'events': {
      if (!opts.eventName?.trim()) throw new Error('Cần tên sự kiện')
      return ['04_Su-kien', clean(`${opts.eventMonth ?? ''} ${opts.eventName}`)]
    }
    case 'quotes':
      return ['Bao-gia']
    case 'contracts':
      return ['Hop-dong']
    case 'sales_docs':
      return ['Tai-lieu-ban-hang']
  }
}

/** Gợi ý thư mục đích theo sản phẩm / loại */
export function suggestSection(
  drive: SharedDrive,
  kind: LibraryKind,
  hasProduct: boolean,
): Section {
  if (drive === 'sales_private') return 'sales_docs'
  if (hasProduct) return 'products'
  if (kind === 'design') return 'brand'
  return 'sales'
}

export function kindFromMime(mime: string): LibraryKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (/photoshop|illustrator|postscript|figma|x-indesign|sketch|x-coreldraw/.test(mime))
    return 'design'
  return 'document'
}
