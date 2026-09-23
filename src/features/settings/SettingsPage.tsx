import { useSearchParams } from 'react-router-dom'
import { Tabs } from '@/components/ui/tabs'
import { vi } from '@/i18n/vi'
import { CalendarSettings } from './CalendarSettings'
import { GeneralSettings } from './GeneralSettings'
import { UsersAdmin } from './UsersAdmin'

type Tab = 'users' | 'calendar' | 'general'

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = raw === 'general' || raw === 'calendar' ? raw : 'users'

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{vi.settings.title}</h1>
      <Tabs
        value={tab}
        onChange={(next) => setParams(next === 'users' ? {} : { tab: next }, { replace: true })}
        items={[
          { value: 'users', label: vi.settings.tabs.users },
          { value: 'calendar', label: vi.settings.tabs.calendar },
          { value: 'general', label: vi.settings.tabs.general },
        ]}
      />
      {tab === 'users' && <UsersAdmin />}
      {tab === 'calendar' && <CalendarSettings />}
      {tab === 'general' && <GeneralSettings />}
    </div>
  )
}
