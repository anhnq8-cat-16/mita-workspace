import { Hammer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { vi } from '@/i18n/vi'
import type { NavKey } from '@/lib/nav'

export function ComingSoon({ navKey, milestone }: { navKey: NavKey; milestone: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{vi.nav[navKey]}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
          <Hammer className="size-8 text-muted-foreground" />
          <p className="font-medium">{vi.common.comingSoon}</p>
          <p className="text-sm text-muted-foreground">
            {vi.common.comingSoonMilestone(milestone)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
