import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LibraryItemRow, LibraryKind, ProductRow, SharedDriveKind } from '@/lib/database.types'
import { env } from '@/lib/env'
import { throwIfError, UserFacingError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Section } from './library-rules'

export const libraryKeys = {
  all: ['library'] as const,
  items: ['library', 'items'] as const,
  item: (id: string) => ['library', 'item', id] as const,
  canApprove: ['library', 'can-approve'] as const,
  thumb: (id: string, size: number) => ['library', 'thumb', id, size] as const,
  products: ['products'] as const,
}

/** Mọi tư liệu người dùng xem được (RLS: đã duyệt theo kho + của mình + chờ duyệt nếu là người duyệt) */
export function useLibraryItems() {
  return useQuery({
    queryKey: libraryKeys.items,
    queryFn: async (): Promise<LibraryItemRow[]> => {
      const { data, error } = await supabase
        .from('library_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000)
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useCanApprove() {
  return useQuery({
    queryKey: libraryKeys.canApprove,
    queryFn: async () => {
      const [lib, sales] = await Promise.all([
        supabase.rpc('fn_can_approve_library', { p_drive: 'library' }),
        supabase.rpc('fn_can_approve_library', { p_drive: 'sales_private' }),
      ])
      return { library: Boolean(lib.data), sales_private: Boolean(sales.data) }
    },
    staleTime: 5 * 60_000,
  })
}

export function useProducts() {
  return useQuery({
    queryKey: libraryKeys.products,
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('category')
        .order('position')
        .order('name')
      throwIfError(error)
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })
}

/** Gọi Edge Function, trả lỗi tiếng Việt từ function nếu có */
export async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body: body as Record<string, unknown>,
  })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const payload = ctx ? await ctx.json().catch(() => null) : null
    throw new UserFacingError(payload?.error ?? error.message)
  }
  return data as T
}

// --- Upload resumable -----------------------------------------------------------

export interface UploadMeta {
  title: string
  description: string
  kind: Exclude<LibraryKind, 'youtube'>
  shared_drive: SharedDriveKind
  product_id: string | null
  tags: string[]
  channels: string[]
}

/** PUT file lên phiên upload của Google, có tiến độ + hủy; tự thử tiếp từ chỗ dừng khi rớt mạng */
export function putResumable(
  uploadUrl: string,
  file: File,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<{ id: string }> {
  const send = (start: number): Promise<{ id?: string; next?: number }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl)
      if (start > 0)
        xhr.setRequestHeader('Content-Range', `bytes ${start}-${file.size - 1}/${file.size}`)
      xhr.upload.onprogress = (e) => onProgress(start + e.loaded)
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            resolve({ id: JSON.parse(xhr.responseText).id })
          } catch {
            reject(new Error('Phản hồi Google Drive không hợp lệ'))
          }
        } else if (xhr.status === 308) {
          const range = xhr.getResponseHeader('Range')
          resolve({ next: range ? Number(range.split('-')[1]) + 1 : 0 })
        } else {
          reject(new Error(`Tải lên thất bại (${xhr.status})`))
        }
      }
      xhr.onerror = () => resolve({ next: -1 }) // rớt mạng → hỏi Google đã nhận tới đâu
      xhr.onabort = () => reject(new DOMException('Đã hủy', 'AbortError'))
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
      xhr.send(start > 0 ? file.slice(start) : file)
    })

  const status = (): Promise<number> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Range', `bytes */${file.size}`)
      xhr.onload = () => {
        const range = xhr.getResponseHeader('Range')
        resolve(xhr.status === 308 && range ? Number(range.split('-')[1]) + 1 : 0)
      }
      xhr.onerror = () => resolve(0)
      xhr.send()
    })

  return (async () => {
    let start = 0
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await send(start)
      if (res.id) return { id: res.id }
      if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError')
      start = res.next === -1 ? await status() : (res.next ?? 0)
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
    throw new Error('Mạng không ổn định, tải lên chưa xong. Thử lại sau.')
  })()
}

export async function uploadLibraryFile(
  file: File,
  meta: UploadMeta,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const { uploadUrl } = await invokeFunction<{ uploadUrl: string }>('drive-upload-init', {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    shared_drive: meta.shared_drive,
  })
  const { id: fileId } = await putResumable(uploadUrl, file, onProgress, signal)
  const { id } = await invokeFunction<{ id: string }>('drive-upload-complete', { fileId, ...meta })
  return id
}

export function useInvalidateLibrary() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: libraryKeys.all })
}

export function useAddYoutube() {
  const invalidate = useInvalidateLibrary()
  return useMutation({
    mutationFn: async (input: Omit<UploadMeta, 'kind'> & { youtube_url: string }) => {
      const { error } = await supabase.from('library_items').insert({
        title: input.title.trim(),
        description: input.description.trim() || null,
        kind: 'youtube',
        youtube_url: input.youtube_url.trim(),
        shared_drive: input.shared_drive,
        product_id: input.product_id,
        tags: input.tags,
        channels: input.channels,
      })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useReviewItem() {
  const invalidate = useInvalidateLibrary()
  return useMutation({
    mutationFn: (input: {
      itemId: string
      action: 'approve' | 'reject'
      section?: Section
      eventName?: string
      reason?: string
    }) => invokeFunction<{ ok: boolean; folderPath?: string }>('drive-move', input),
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useInvalidateLibrary()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<
        Pick<LibraryItemRow, 'title' | 'description' | 'tags' | 'channels' | 'product_id'>
      >
    }) => {
      const { error } = await supabase.from('library_items').update(patch).eq('id', id)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteItem() {
  const invalidate = useInvalidateLibrary()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('library_items').delete().eq('id', id)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

// --- Ảnh thu nhỏ (qua drive-thumb, có kiểm tra quyền) ---------------------------------
export function useDriveThumb(fileId: string | null | undefined, size = 400) {
  return useQuery({
    queryKey: libraryKeys.thumb(fileId ?? '', size),
    enabled: Boolean(fileId),
    staleTime: 24 * 3600_000,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: async (): Promise<string> => {
      const { data } = await supabase.auth.getSession()
      const res = await fetch(
        `${env.supabaseUrl}/functions/v1/drive-thumb?id=${encodeURIComponent(fileId!)}&size=${size}`,
        {
          headers: {
            Authorization: `Bearer ${data.session?.access_token ?? ''}`,
            apikey: env.supabaseAnonKey,
          },
        },
      )
      if (!res.ok) throw new Error(`thumb ${res.status}`)
      return URL.createObjectURL(await res.blob())
    },
  })
}

/** Link tải xuống trực tiếp của file Drive (người dùng cần quyền xem Shared Drive) */
export function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
}
