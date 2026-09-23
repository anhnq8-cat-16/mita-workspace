import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { vi } from '@/i18n/vi'
import type { TaskRow } from '@/lib/database.types'
import { formatDateVN, todayVN } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import { monthGrid } from './calendar-grid'
import { TaskRows } from './TaskListView'
import { daysOverdue } from './task-rules'

export function TaskCalendar({
  tasks,
  onOpen,
}: {
  tasks: TaskRow[]
  onOpen: (id: string) => void
}) {
  const today = todayVN()
  const [ym, setYm] = useState(() => ({
    y: Number(today.slice(0, 4)),
    m: Number(today.slice(5, 7)),
  }))
  const [selected, setSelected] = useState(today)
  const cells = monthGrid(ym.y, ym.m)
  const byDay = new Map<string, TaskRow[]>()
  for (const t of tasks) {
    if (t.due_date) byDay.set(t.due_date, [...(byDay.get(t.due_date) ?? []), t])
  }
  const shift = (d: number) =>
    setYm(({ y, m }) => {
      const n = m + d
      return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n }
    })

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Tháng trước" onClick={() => shift(-1)}>
              <ChevronLeft />
            </Button>
            <span className="font-semibold">{vi.tasks.month(ym.m, ym.y)}</span>
            <Button variant="ghost" size="icon" aria-label="Tháng sau" onClick={() => shift(1)}>
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {vi.tasks.weekdaysShort.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day) => {
              const list = byDay.get(day) ?? []
              const inMonth = Number(day.slice(5, 7)) === ym.m
              const late = list.some((t) => daysOverdue(t, today) > 0)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  className={cn(
                    'flex min-h-12 flex-col items-center rounded-md p-1 text-xs md:min-h-20 md:items-stretch',
                    inMonth ? 'bg-card' : 'bg-transparent text-muted-foreground/60',
                    day === today && 'ring-2 ring-primary',
                    day === selected && 'bg-primary/10',
                  )}
                >
                  <span className="font-medium">{Number(day.slice(8))}</span>
                  {list.length > 0 && (
                    <>
                      <span
                        className={cn(
                          'mt-1 rounded-full px-1.5 text-[10px] font-semibold md:hidden',
                          late ? 'bg-destructive text-white' : 'bg-primary/15 text-primary',
                        )}
                      >
                        {list.length}
                      </span>
                      <span className="hidden flex-col gap-0.5 md:flex">
                        {list.slice(0, 3).map((t) => (
                          <span
                            key={t.id}
                            className={cn(
                              'truncate rounded px-1 text-left text-[11px]',
                              t.status === 'done'
                                ? 'bg-success/15 text-success line-through'
                                : daysOverdue(t, today)
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-primary/10 text-primary',
                            )}
                          >
                            {t.title}
                          </span>
                        ))}
                        {list.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{list.length - 3}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{vi.tasks.calendarNoDue}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <p className="border-b border-border px-4 py-2 text-sm font-medium">
            {formatDateVN(selected)}
          </p>
          <TaskRows tasks={byDay.get(selected) ?? []} onOpen={onOpen} />
        </CardContent>
      </Card>
    </div>
  )
}
