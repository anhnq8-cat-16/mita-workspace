import { Navigate } from 'react-router-dom'
import { teamIds, useMe } from '@/features/auth/auth-context'
import { useDailyEnabled } from '@/features/daily/daily-flag'
import { HomePage } from '@/features/home/HomePage'
import { homePath } from '@/lib/nav'

/** "/": trang Hôm nay; khi tính năng đang tạm ẩn → chuyển sang tab chính đầu tiên */
export function HomeRoute() {
  const me = useMe()
  const daily = useDailyEnabled()
  if (daily === false) {
    return <Navigate to={homePath({ role: me.role, teams: teamIds(me), daily })} replace />
  }
  return <HomePage />
}
