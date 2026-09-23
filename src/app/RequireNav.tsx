import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { teamIds, useMe } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import { canAccess, type NavKey } from '@/lib/nav'

/** Ẩn trang không thuộc vai trò/team (chỉ là giao diện – RLS mới là lớp bảo vệ) */
export function RequireNav({ navKey, children }: { navKey: NavKey; children: ReactNode }) {
  const me = useMe()
  if (!canAccess(navKey, { role: me.role, teams: teamIds(me) })) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p>{vi.common.noPermission}</p>
          <Link to="/" className="mt-3 inline-block text-sm font-medium text-primary underline">
            {vi.common.backHome}
          </Link>
        </CardContent>
      </Card>
    )
  }
  return <>{children}</>
}
