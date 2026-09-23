import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { libraryKeys } from '@/features/library/api'
import type { ProductPriceHistoryRow, ProductRow } from '@/lib/database.types'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export { useProducts } from '@/features/library/api'

export function usePriceHistory(productId: string | null) {
  return useQuery({
    queryKey: ['products', 'history', productId],
    enabled: Boolean(productId),
    queryFn: async (): Promise<ProductPriceHistoryRow[]> => {
      const { data, error } = await supabase
        .from('product_price_history')
        .select('*')
        .eq('product_id', productId!)
        .order('changed_at', { ascending: false })
        .limit(50)
      throwIfError(error)
      return data ?? []
    },
  })
}

export type PriceChange = Pick<ProductRow, 'id' | 'retail_price_vnd' | 'wholesale_price_vnd'>

/** Lưu nhiều thay đổi giá cùng lúc (mỗi thay đổi tạo 1 bản ghi lịch sử) */
export function useSavePrices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (changes: PriceChange[]) => {
      const results = await Promise.all(
        changes.map((c) =>
          supabase
            .from('products')
            .update({
              retail_price_vnd: c.retail_price_vnd,
              wholesale_price_vnd: c.wholesale_price_vnd,
            })
            .eq('id', c.id),
        ),
      )
      throwIfError(results.find((r) => r.error)?.error)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: libraryKeys.products }),
  })
}

export type ProductInput = Partial<
  Pick<
    ProductRow,
    | 'sku'
    | 'name'
    | 'line'
    | 'category'
    | 'origin'
    | 'flavor_notes'
    | 'pack_size_g'
    | 'description'
    | 'is_active'
  >
>

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ProductInput }) => {
      const { error } = id
        ? await supabase.from('products').update(input).eq('id', id)
        : await supabase.from('products').insert({
            sku: input.sku ?? '',
            name: input.name ?? '',
            category: input.category ?? 'coffee',
            ...input,
          })
      throwIfError(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: libraryKeys.products }),
  })
}
