/** % hoàn thành mục tiêu (làm tròn, không âm). Chỉ tiêu 0 → 100% nếu đã có số liệu. */
export function goalPercent(actual: number | null, target: number): number {
  if (actual === null) return 0
  if (target <= 0) return 100
  return Math.max(0, Math.round((actual / target) * 100))
}
