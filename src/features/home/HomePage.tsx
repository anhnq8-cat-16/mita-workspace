import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMe } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import { formatDateVN, weekdayVN } from '@/lib/date-vn'

export function HomePage() {
  const me = useMe()
  const now = new Date()
  const firstName = (me.full_name ?? me.email).trim().split(/\s+/).pop() ?? ''

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{vi.home.greeting(firstName)}</h1>
        <p className="text-sm text-muted-foreground">
          {vi.home.todayIs(weekdayVN(now), formatDateVN(now))}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{vi.nav.today}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{vi.home.foundationReady}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{vi.home.yourRole}:</span>
            <Badge>{vi.roles[me.role]}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{vi.home.yourTeams}:</span>
            {me.teams.map((t) => (
              <Badge key={t.team_id} variant="secondary">
                {vi.teams[t.team_id] ?? t.team_id}
                {t.is_lead && ' ★'}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
