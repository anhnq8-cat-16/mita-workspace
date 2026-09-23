import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input } from '@/components/ui/input'
import { vi } from '@/i18n/vi'
import { formatDateVN, weekdayVN } from '@/lib/date-vn'
import {
  useDeleteCalendarDay,
  useExtraWorkdays,
  useHolidays,
  useSaveCalendarDay,
  useTeams,
} from './api'
import { TeamPicker } from './InviteForm'

const t = vi.calendar

function DayLabel({ date }: { date: string }) {
  return (
    <span className="font-medium">
      {weekdayVN(`${date}T05:00:00Z`)}, {formatDateVN(date)}
    </span>
  )
}

function AddDayForm({ kind }: { kind: 'holiday' | 'extra' }) {
  const save = useSaveCalendarDay()
  const { data: teams = [] } = useTeams()
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [teamIds, setTeamIds] = useState<string[]>([])

  return (
    <form
      className="grid gap-2 border-t border-border pt-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!date || !name.trim()) return
        await save.mutateAsync(
          kind === 'holiday' ? { kind, date, name } : { kind, date, name, team_ids: teamIds },
        )
        setDate('')
        setName('')
        setTeamIds([])
      }}
    >
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Input
          type="date"
          className="w-auto"
          value={date}
          aria-label={t.date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          value={name}
          placeholder={t.name}
          aria-label={t.name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      {kind === 'extra' && (
        <>
          <TeamPicker
            teams={teams}
            value={teamIds}
            leadValue={[]}
            withLead={false}
            onChange={(next) => setTeamIds(next)}
          />
          <p className="text-xs text-muted-foreground">
            {teamIds.length === 0 ? t.allTeams : teamIds.map((id) => vi.teams[id] ?? id).join(', ')}
          </p>
        </>
      )}
      <FieldError>{save.error?.message}</FieldError>
      <Button type="submit" size="sm" className="justify-self-start" disabled={save.isPending}>
        {t.add}
      </Button>
    </form>
  )
}

export function CalendarSettings() {
  const holidays = useHolidays()
  const extra = useExtraWorkdays()
  const remove = useDeleteCalendarDay()

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t.workdaysHint}</p>
      <Card>
        <CardHeader>
          <CardTitle>{t.holidays}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {holidays.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          )}
          <ul className="divide-y divide-border">
            {holidays.data?.map((h) => (
              <li key={h.date} className="flex items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <DayLabel date={h.date} /> · {h.name}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={vi.common.delete}
                  onClick={() => remove.mutate({ kind: 'holiday', date: h.date })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <AddDayForm kind="holiday" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.extraWorkdays}</CardTitle>
          <CardDescription>
            Ngày đó người thuộc team được chọn phải nộp kế hoạch/báo cáo như ngày làm việc.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {extra.data?.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
          <ul className="divide-y divide-border">
            {extra.data?.map((d) => (
              <li key={d.date} className="flex items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <DayLabel date={d.date} /> · {d.name}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.team_ids.length === 0 ? (
                      <Badge variant="secondary">{t.allTeams}</Badge>
                    ) : (
                      d.team_ids.map((id) => (
                        <Badge key={id} variant="secondary">
                          {vi.teams[id] ?? id}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={vi.common.delete}
                  onClick={() => remove.mutate({ kind: 'extra', date: d.date })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <AddDayForm kind="extra" />
        </CardContent>
      </Card>
      <FieldError>{remove.error?.message}</FieldError>
    </div>
  )
}
