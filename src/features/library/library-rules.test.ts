import type { LibraryItemRow } from '@/lib/database.types'
import {
  filterLibrary,
  formatBytes,
  kindFromMime,
  parseTags,
  previewPath,
  suggestSection,
  youtubeId,
} from './library-rules'

describe('thư viện', () => {
  it('gợi ý thư mục + xem trước đường dẫn', () => {
    expect(suggestSection('library', 'image', true)).toBe('products')
    expect(suggestSection('library', 'design', false)).toBe('brand')
    expect(suggestSection('sales_private', 'image', true)).toBe('sales_docs')
    expect(previewPath('products', 'video', 'Arabica Natural', '', '2026-10')).toBe(
      '01_San-pham/Arabica Natural/Video',
    )
    expect(previewPath('events', 'image', null, 'Coffee Expo', '2026-10')).toBe(
      '04_Su-kien/2026-10 Coffee Expo',
    )
  })

  it('nhận loại file', () => {
    expect(kindFromMime('image/png')).toBe('image')
    expect(kindFromMime('video/quicktime')).toBe('video')
    expect(kindFromMime('application/octet-stream', 'logo.ai')).toBe('design')
    expect(kindFromMime('image/vnd.adobe.photoshop', 'x.psd')).toBe('design')
    expect(kindFromMime('application/pdf')).toBe('document')
  })

  it('tag, YouTube, dung lượng', () => {
    expect(parseTags('Hội chợ, #tet, tet')).toEqual(['hội chợ', 'tet'])
    expect(youtubeId('https://youtu.be/abcDEF123')).toBe('abcDEF123')
    expect(youtubeId('https://www.youtube.com/watch?v=abcDEF123&t=3')).toBe('abcDEF123')
    expect(youtubeId('https://www.youtube.com/shorts/abcDEF123')).toBe('abcDEF123')
    expect(youtubeId('https://vimeo.com/1')).toBeNull()
    expect(formatBytes(200 * 1024 * 1024)).toBe('200,0 MB')
  })

  it('lọc', () => {
    const base = {
      product_id: null,
      kind: 'image',
      channels: [],
      tags: [],
      description: null,
    } as unknown as LibraryItemRow
    const items = [
      { ...base, id: 'a', title: 'Ảnh Honey', product_id: 'p1', tags: ['tet'] },
      { ...base, id: 'b', title: 'Logo', kind: 'design', channels: ['Website'] },
    ] as LibraryItemRow[]
    const f = { q: '', product: '', kind: '', channel: '', tag: '' }
    expect(filterLibrary(items, { ...f, q: 'tet' }).map((i) => i.id)).toEqual(['a'])
    expect(filterLibrary(items, { ...f, product: 'none' }).map((i) => i.id)).toEqual(['b'])
    expect(filterLibrary(items, { ...f, channel: 'Website' }).map((i) => i.id)).toEqual(['b'])
  })
})
