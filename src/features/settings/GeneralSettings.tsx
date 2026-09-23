import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Textarea } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { vi } from '@/i18n/vi'
import type { Json, SettingRow } from '@/lib/database.types'
import { formatDateTimeVN } from '@/lib/date-vn'
import { useSettings, useUpdateSetting } from './api'

const t = vi.settings.general

function SettingEditor({ setting }: { setting: SettingRow }) {
  const initial = JSON.stringify(setting.value, null, 2)
  const [text, setText] = useState(initial)
  const [parseError, setParseError] = useState<string | null>(null)
  const update = useUpdateSetting()
  const dirty = text !== initial

  function save() {
    let value: Json
    try {
      value = JSON.parse(text) as Json
    } catch {
      setParseError(t.invalidJson)
      return
    }
    setParseError(null)
    update.mutate({ key: setting.key, value })
  }

  return (
    <li className="grid gap-2 border-b border-border p-4 last:border-b-0">
      <div>
        <p className="font-mono text-sm font-medium">{setting.key}</p>
        {setting.description && (
          <p className="text-sm text-muted-foreground">{setting.description}</p>
        )}
      </div>
      <Textarea
        className="font-mono text-xs"
        rows={Math.min(12, Math.max(1, text.split('\n').length))}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!dirty || update.isPending} onClick={save}>
          {update.isPending ? vi.common.saving : vi.common.save}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t.lastUpdated(formatDateTimeVN(setting.updated_at))}
        </span>
      </div>
      <FieldError>{parseError ?? update.error?.message}</FieldError>
    </li>
  )
}

export function GeneralSettings() {
  const settings = useSettings()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.hint}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {settings.isPending && (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        )}
        {settings.error && (
          <div className="p-4">
            <ErrorBox error={settings.error} onRetry={() => settings.refetch()} />
          </div>
        )}
        <ul>
          {settings.data?.map((s) => (
            <SettingEditor key={`${s.key}:${s.updated_at}`} setting={s} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
