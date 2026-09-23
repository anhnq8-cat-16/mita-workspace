import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { vi } from '@/i18n/vi'
import { useLeads, useLeadsRealtime, useSalesActor, useSubmittedLeads } from './api'
import { CustomerDrawer, CustomersView } from './CustomersView'
import { LeadDrawer } from './LeadDrawer'
import { LeadForm } from './LeadForm'
import { ErrorFlash, LeadList, LeadPipeline, LeadQueue, SubmittedLeads } from './LeadViews'
import { OrdersView } from './OrdersView'
import { canReadAllSales, inSales, isSalesAdmin } from './sales-rules'

const t = vi.sales
type Tab = 'pipeline' | 'leads' | 'queue' | 'customers' | 'orders' | 'submitted'

export function SalesPage() {
  const actor = useSalesActor()
  const [params, setParams] = useSearchParams()
  const salesUser = inSales(actor) || canReadAllSales(actor)
  const mkt = actor.teams.includes('marketing')
  const canCreate = inSales(actor) || mkt || isSalesAdmin(actor)
  const leads = useLeads(salesUser)
  const submitted = useSubmittedLeads(mkt)
  useLeadsRealtime(salesUser)
  const [creating, setCreating] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const tabs: Tab[] = [
    ...(salesUser ? (['pipeline', 'leads'] as Tab[]) : []),
    ...(isSalesAdmin(actor) ? (['queue'] as Tab[]) : []),
    ...(salesUser ? (['customers', 'orders'] as Tab[]) : []),
    ...(mkt ? (['submitted'] as Tab[]) : []),
  ]
  const raw = params.get('tab') as Tab | null
  const tab: Tab = raw && tabs.includes(raw) ? raw : (tabs[0] ?? 'submitted')
  const leadId = params.get('lead')
  const customerId = params.get('customer')

  const setParam = useCallback(
    (key: string, value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace: key === 'tab' },
      ),
    [setParams],
  )
  const openLead = (id: string) => setParam('lead', id)
  const openCustomer = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('lead')
      next.set('customer', id)
      return next
    })

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t.newLead}
          </Button>
        )}
      </div>
      <Tabs
        value={tab}
        onChange={(v) => setParam('tab', v === tabs[0] ? null : v)}
        items={tabs.map((v) => ({ value: v, label: t.tabs[v] }))}
      />
      <ErrorFlash message={flash} onClose={() => setFlash(null)} />

      {(tab === 'pipeline' || tab === 'leads' || tab === 'queue') && (
        <>
          {leads.isPending && <Spinner />}
          {leads.error && <ErrorBox error={leads.error} onRetry={() => leads.refetch()} />}
          {leads.data && tab === 'pipeline' && (
            <LeadPipeline leads={leads.data} onOpen={openLead} onError={setFlash} />
          )}
          {leads.data && tab === 'leads' && <LeadList leads={leads.data} onOpen={openLead} />}
          {leads.data && tab === 'queue' && <LeadQueue leads={leads.data} onOpen={openLead} />}
        </>
      )}
      {tab === 'customers' && <CustomersView onOpen={openCustomer} />}
      {tab === 'orders' && <OrdersView />}
      {tab === 'submitted' &&
        (submitted.data ? <SubmittedLeads rows={submitted.data} /> : <Spinner />)}

      <LeadDrawer
        leadId={leadId}
        onClose={() => setParam('lead', null)}
        onOpenCustomer={openCustomer}
      />
      <CustomerDrawer customerId={customerId} onClose={() => setParam('customer', null)} />
      <Sheet open={creating} onClose={() => setCreating(false)} title={t.newLead}>
        {creating && (
          <LeadForm
            onDone={(id) => {
              setCreating(false)
              if (salesUser) openLead(id)
              else setFlash(t.created)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
