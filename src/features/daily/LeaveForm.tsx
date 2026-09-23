import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { useMe } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import type { LeaveType } from '@/lib/database.types'
import { todayVN } from '@/lib/date-vn'
import { useDeclareLeave } from './api'

const TYPES: LeaveType[] = ['nghi_phep', 'cong_tac', 'om', 'khac']

/** Khai báo nghỉ. fixedDate: chỉ cho ngày hôm nay (dùng ở cổng kế hoạch) */
export function LeaveForm({ fixedDate, onDone }: { fixedDate?: string; onDone?: () => void }) {
  const me = useMe()
  const declare = useDeclareLeave()
  const [date, setDate] = useState(fixedDate ?? todayVN())
  const [type, setType] = useState<LeaveType>('nghi_phep')
  const [note, setNote] = useState('')

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        await declare.mutateAsync({ userId: me.id, date, type, note })
        setNote('')
        onDone?.()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {!fixedDate && (
          <div className="grid gap-1.5">
            <Label htmlFor="leave-date">{vi.reports.date}</Label>
            <Input
              id="leave-date"
              type="date"
              value={date}
              min={todayVN()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="leave-type">{vi.daily.leaveType}</Label>
          <Select
            id="leave-type"
            value={type}
            onChange={(e) => setType(e.target.value as LeaveType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {vi.leaveTypes[t]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="leave-note">{vi.daily.leaveNote}</Label>
        <Input id="leave-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <FieldError>{declare.error?.message}</FieldError>
      <Button type="submit" variant="secondary" disabled={declare.isPending}>
        {vi.daily.leaveSubmit}
      </Button>
    </form>
  )
}
