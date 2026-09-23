import { useSearchParams } from 'react-router-dom'
import { Tabs } from '@/components/ui/tabs'
import { vi } from '@/i18n/vi'
import { GeneralSettings } from './GeneralSettings'
import { UsersAdmin } from './UsersAdmin'

type Tab = 'users' | 'general'

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'general' ? 'general' : 'users'

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{vi.settings.title}</h1>
      <Tabs
        value={tab}
        onChange={(next) => setParams(next === 'users' ? {} : { tab: next }, { replace: true })}
        items={[
          { value: 'users', label: vi.settings.tabs.users },
          { value: 'general', label: vi.settings.tabs.general },
        ]}
      />
      {tab === 'users' ? <UsersAdmin /> : <GeneralSettings />}
    </div>
  )
}
