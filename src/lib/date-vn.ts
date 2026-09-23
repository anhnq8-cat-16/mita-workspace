import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export const VN_TZ = 'Asia/Ho_Chi_Minh'

/** Ngày hôm nay theo giờ Việt Nam, dạng yyyy-MM-dd (khớp kiểu `date` của Postgres) */
export function todayVN(now: Date = new Date()): string {
  return formatInTimeZone(now, VN_TZ, 'yyyy-MM-dd')
}

/** dd/MM/yyyy theo giờ Việt Nam. Nhận Date, ISO timestamp hoặc chuỗi ngày yyyy-MM-dd. */
export function formatDateVN(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return formatInTimeZone(value, VN_TZ, 'dd/MM/yyyy')
}

/** HH:mm theo giờ Việt Nam */
export function formatTimeVN(value: Date | string | null | undefined): string {
  if (!value) return ''
  return formatInTimeZone(value, VN_TZ, 'HH:mm')
}

/** dd/MM/yyyy HH:mm theo giờ Việt Nam */
export function formatDateTimeVN(value: Date | string | null | undefined): string {
  if (!value) return ''
  return formatInTimeZone(value, VN_TZ, 'dd/MM/yyyy HH:mm')
}

/** Tên thứ trong tuần tiếng Việt */
export function weekdayVN(value: Date | string): string {
  const iso = Number(formatInTimeZone(value, VN_TZ, 'i')) // 1 = thứ Hai … 7 = Chủ nhật
  return iso === 7 ? 'Chủ nhật' : `Thứ ${['Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy'][iso - 1]}`
}

/** "09:00" → số phút từ 00:00 */
export function parseHHmm(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) throw new Error(`Giờ không hợp lệ: ${value}`)
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) throw new Error(`Giờ không hợp lệ: ${value}`)
  return h * 60 + m
}

/** Mốc thời gian tuyệt đối (UTC) của giờ `HH:mm` giờ Việt Nam trong ngày `yyyy-MM-dd` */
export function vnDateTime(date: string, hhmm: string): Date {
  const minutes = parseHHmm(hhmm)
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return fromZonedTime(`${date}T${h}:${m}:00`, VN_TZ)
}

/** `now` đã qua giờ `HH:mm` (giờ Việt Nam) của ngày hôm nay chưa */
export function isPastTimeVN(hhmm: string, now: Date = new Date()): boolean {
  return now.getTime() > vnDateTime(todayVN(now), hhmm).getTime()
}

/** Thứ trong tuần ISO (1 = thứ Hai … 7 = Chủ nhật) của ngày yyyy-MM-dd */
export function isoWeekday(date: string): number {
  return Number(formatInTimeZone(fromZonedTime(`${date}T12:00:00`, VN_TZ), VN_TZ, 'i'))
}

/** ISO → giá trị cho <input type="datetime-local"> theo giờ Việt Nam */
export function toVNInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return formatInTimeZone(iso, VN_TZ, "yyyy-MM-dd'T'HH:mm")
}

/** Giá trị <input type="datetime-local"> (giờ Việt Nam) → ISO */
export function fromVNInputValue(value: string): string | null {
  if (!value) return null
  const [date, time] = value.split('T')
  if (!date || !time) return null
  return vnDateTime(date, time.slice(0, 5)).toISOString()
}
