import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useMe } from '@/features/auth/auth-context'
import type {
  CheckInRow,
  CustomerDirectoryRow,
  CustomerRow,
  Json,
  LeadActivityRow,
  LeadDuplicateRow,
  LeadRow,
  OrderRow,
  SubmittedLeadRow,
} from '@/lib/database.types'
import { throwIfError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { SalesActor } from './sales-rules'

export const salesKeys = {
  all: ['sales'] as const,
  leads: ['sales', 'leads'] as const,
  lead: (id: string) => ['sales', 'lead', id] as const,
  activities: (id: string) => ['sales', 'activities', id] as const,
  submitted: ['sales', 'submitted'] as const,
  customers: ['sales', 'customers'] as const,
  customer: (id: string) => ['sales', 'customer', id] as const,
  directory: (q: string) => ['sales', 'directory', q] as const,
  orders: (from: string, to: string) => ['sales', 'orders', from, to] as const,
  customerOrders: (id: string) => ['sales', 'customer-orders', id] as const,
  customerCheckIns: (id: string) => ['sales', 'customer-checkins', id] as const,
}

export function useSalesActor(): SalesActor {
  const me = useMe()
  return useMemo(
    () => ({
      id: me.id,
      role: me.role,
      teams: me.teams.map((t) => t.team_id),
      ledTeams: me.teams.filter((t) => t.is_lead).map((t) => t.team_id),
    }),
    [me],
  )
}

function useInvalidateSales() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: salesKeys.all }),
      qc.invalidateQueries({ queryKey: ['goals'] }),
    ])
}

// --- Lead -----------------------------------------------------------------------
export function useLeads(enabled = true) {
  return useQuery({
    queryKey: salesKeys.leads,
    enabled,
    queryFn: async (): Promise<LeadRow[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useLeadsRealtime(enabled: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () =>
        qc.invalidateQueries({ queryKey: salesKeys.all }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, qc])
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: salesKeys.lead(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<LeadRow | null> => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id!).maybeSingle()
      throwIfError(error)
      return data
    },
  })
}

export function useLeadActivities(leadId: string) {
  return useQuery({
    queryKey: salesKeys.activities(leadId),
    queryFn: async (): Promise<LeadActivityRow[]> => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('happened_at', { ascending: false })
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useSubmittedLeads(enabled: boolean) {
  return useQuery({
    queryKey: salesKeys.submitted,
    enabled,
    queryFn: async (): Promise<SubmittedLeadRow[]> => {
      const { data, error } = await supabase.rpc('fn_my_submitted_leads')
      throwIfError(error)
      return data ?? []
    },
  })
}

export type CreateLeadResult = { id: string } | { duplicates: LeadDuplicateRow[] }

export function useCreateLead() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: async ({ lead, force }: { lead: Record<string, unknown>; force: boolean }) => {
      const { data, error } = await supabase.rpc('fn_create_lead', {
        p: lead as Json,
        p_force: force,
      })
      throwIfError(error)
      return data as unknown as CreateLeadResult
    },
    onSuccess: (res) => {
      if ('id' in res) void invalidate()
    },
  })
}

export type LeadPatch = Partial<
  Pick<
    LeadRow,
    | 'name'
    | 'company'
    | 'contact_name'
    | 'phone'
    | 'email'
    | 'zalo'
    | 'address'
    | 'district'
    | 'source'
    | 'segment'
    | 'stage'
    | 'lost_reason'
    | 'next_follow_up_at'
    | 'est_value_vnd'
    | 'notes'
    | 'product_interest'
  >
>

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: LeadPatch }) => {
      const { error } = await supabase.from('leads').update(patch).eq('id', id)
      throwIfError(error)
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: salesKeys.leads })
      const previous = qc.getQueryData<LeadRow[]>(salesKeys.leads)
      qc.setQueryData<LeadRow[]>(salesKeys.leads, (old) =>
        old?.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(salesKeys.leads, ctx.previous)
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: salesKeys.all }),
        qc.invalidateQueries({ queryKey: ['goals'] }),
      ]),
  })
}

export function useAssignLead() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: async ({ leadId, userId }: { leadId: string; userId: string }) => {
      const { error } = await supabase.rpc('fn_assign_lead', { p_lead: leadId, p_user: userId })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useMarkWon() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: async (input: {
      leadId: string
      customerId: string | null
      customer: Record<string, unknown> | null
      orderValue: number | null
      items: string | null
    }) => {
      const { data, error } = await supabase.rpc('fn_mark_lead_won', {
        p_lead: input.leadId,
        p_customer_id: input.customerId,
        p_customer: input.customer as Json,
        p_order_value: input.orderValue,
        p_items: input.items,
      })
      throwIfError(error)
      return data as unknown as { customer_id: string; order_id: string }
    },
    onSuccess: invalidate,
  })
}

export function useMergeLeads() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: async ({ keep, remove }: { keep: string; remove: string }) => {
      const { error } = await supabase.rpc('fn_merge_leads', { p_keep: keep, p_remove: remove })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useMergeCustomers() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: async ({ keep, remove }: { keep: string; remove: string }) => {
      const { error } = await supabase.rpc('fn_merge_customers', { p_keep: keep, p_remove: remove })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

export function useAddActivity(leadId: string) {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: async (input: { type: LeadActivityRow['type']; content: string }) => {
      const { error } = await supabase
        .from('lead_activities')
        .insert({ lead_id: leadId, type: input.type, content: input.content.trim() || null })
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}

// --- Khách hàng -----------------------------------------------------------------
export function useCustomers(enabled = true) {
  return useQuery({
    queryKey: salesKeys.customers,
    enabled,
    queryFn: async (): Promise<CustomerRow[]> => {
      const { data, error } = await supabase.from('customers').select('*').order('name').limit(2000)
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: salesKeys.customer(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<CustomerRow | null> => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      throwIfError(error)
      return data
    },
  })
}

export function useCustomerDirectory(q: string, enabled = true) {
  return useQuery({
    queryKey: salesKeys.directory(q),
    enabled,
    queryFn: async (): Promise<CustomerDirectoryRow[]> => {
      const { data, error } = await supabase.rpc('fn_customer_directory', { p_q: q })
      throwIfError(error)
      return data ?? []
    },
  })
}

export type CustomerInput = Partial<
  Pick<
    CustomerRow,
    | 'name'
    | 'type'
    | 'contact_name'
    | 'phone'
    | 'email'
    | 'address'
    | 'district'
    | 'status'
    | 'notes'
    | 'owner_id'
    | 'lat'
    | 'lng'
  >
>

export function useSaveCustomer() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: CustomerInput }) => {
      if (id) {
        const { error } = await supabase.from('customers').update(input).eq('id', id)
        throwIfError(error)
        return id
      }
      const { data, error } = await supabase
        .from('customers')
        .insert({ name: input.name ?? '', ...input })
        .select('id')
        .single()
      throwIfError(error)
      return data!.id
    },
    onSuccess: invalidate,
  })
}

// --- Đơn hàng -------------------------------------------------------------------
export function useOrders(from: string, to: string) {
  return useQuery({
    queryKey: salesKeys.orders(from, to),
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('order_date', from)
        .lte('order_date', to)
        .order('order_date', { ascending: false })
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useCustomerOrders(customerId: string) {
  return useQuery({
    queryKey: salesKeys.customerOrders(customerId),
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('order_date', { ascending: false })
      throwIfError(error)
      return data ?? []
    },
  })
}

export function useCustomerCheckIns(customerId: string) {
  return useQuery({
    queryKey: salesKeys.customerCheckIns(customerId),
    queryFn: async (): Promise<CheckInRow[]> => {
      const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .eq('customer_id', customerId)
        .order('checked_in_at', { ascending: false })
        .limit(50)
      throwIfError(error)
      return data ?? []
    },
  })
}

export type OrderInput = Pick<
  OrderRow,
  'customer_id' | 'order_date' | 'total_value_vnd' | 'status'
> &
  Partial<Pick<OrderRow, 'items_summary' | 'note'>>

export function useSaveOrder() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: OrderInput }) => {
      const { error } = id
        ? await supabase.from('orders').update(input).eq('id', id)
        : await supabase.from('orders').insert(input)
      throwIfError(error)
    },
    onSuccess: invalidate,
  })
}
