/**
 * Màu nhận diện team (dải màu trên thẻ việc, chip team). Đã kiểm tra độ phân biệt kể cả
 * mù màu; luôn đi kèm tên team, không dùng màu một mình.
 */
export const TEAM_COLORS: Record<string, string> = {
  sales_domestic: '#2a78d6',
  marketing: '#eb6834',
  export: '#1baf7a',
}
export const teamColor = (team: string | null | undefined) =>
  (team && TEAM_COLORS[team]) || '#94a3b8'
