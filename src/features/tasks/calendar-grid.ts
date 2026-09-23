/** Các ô ngày (yyyy-MM-dd) của lưới tháng, bắt đầu từ thứ Hai */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7 // thứ Hai = 0
  const start = new Date(first.getTime() - offset * 86_400_000)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7
  return Array.from({ length: cells }, (_, i) =>
    new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  )
}
