import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Select } from '@/components/ui/input'
import { ErrorBox, Spinner } from '@/components/ui/spinner'
import { Tabs } from '@/components/ui/tabs'
import { useMe } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import type { Role } from '@/lib/database.types'
import { formatDateVN } from '@/lib/date-vn'
import {
  usePendingInvitations,
  useRevokeInvitation,
  useSetMembership,
  useTeams,
  useUpdateProfile,
  useUsers,
  type UserWithTeams,
} from './api'
import { InviteForm, TeamPicker } from './InviteForm'

const t = vi.settings.users
const ROLES: Role[] = ['staff', 'lead', 'manager', 'admin']
type Filter = 'all' | 'pending' | 'locked'

function statusOf(u: UserWithTeams): Filter | 'active' {
  if (u.is_active) return 'active'
  return u.activated_at ? 'locked' : 'pending'
}

function UserRow({ user }: { user: UserWithTeams }) {
  const me = useMe()
  const { data: teams = [] } = useTeams()
  const update = useUpdateProfile()
  const membership = useSetMembership()
  const status = statusOf(user)
  const error = update.error ?? membership.error

  const memberIds = user.teams.map((m) => m.team_id)
  const leadIds = user.teams.filter((m) => m.is_lead).map((m) => m.team_id)

  function onTeamsChange(next: string[], nextLead: string[]) {
    for (const team of teams) {
      const wasMember = memberIds.includes(team.id)
      const isMember = next.includes(team.id)
      const wasLead = leadIds.includes(team.id)
      const isLead = nextLead.includes(team.id)
      if (wasMember !== isMember || wasLead !== isLead) {
        membership.mutate({ userId: user.id, teamId: team.id, member: isMember, isLead })
      }
    }
  }

  return (
    <li className="flex flex-col gap-3 border-b border-border p-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <Avatar name={user.full_name ?? user.email} src={user.avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {user.full_name ?? user.email}{' '}
            {user.id === me.id && <span className="text-muted-foreground">{t.you}</span>}
          </p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          {user.title && <p className="text-xs text-muted-foreground">{user.title}</p>}
        </div>
        <Badge
          variant={
            status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'destructive'
          }
        >
          {status === 'active' ? t.active : status === 'pending' ? t.pending : t.locked}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-center">
        <Select
          aria-label={t.role}
          value={user.role}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ id: user.id, patch: { role: e.target.value as Role } })}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {vi.roles[r]}
            </option>
          ))}
        </Select>
        <TeamPicker teams={teams} value={memberIds} leadValue={leadIds} onChange={onTeamsChange} />
        {user.is_active ? (
          <Button
            variant="outline"
            size="sm"
            disabled={update.isPending}
            onClick={() => {
              if (window.confirm(t.confirmLock(user.full_name ?? user.email))) {
                update.mutate({ id: user.id, patch: { is_active: false } })
              }
            }}
          >
            {t.lock}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: user.id, patch: { is_active: true } })}
          >
            {status === 'locked' ? t.unlock : t.activate}
          </Button>
        )}
      </div>
      {error && <FieldError>{error.message}</FieldError>}
    </li>
  )
}

function PendingInvites() {
  const { data = [] } = usePendingInvitations()
  const revoke = useRevokeInvitation()
  if (data.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.pendingInvites}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {data.map((inv) => (
            <li key={inv.email} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{inv.full_name ?? inv.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {inv.email} · {vi.roles[inv.role]} ·{' '}
                  {inv.teams.map((id) => vi.teams[id] ?? id).join(', ')} ·{' '}
                  {formatDateVN(inv.created_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.revokeInvite}
                onClick={() => {
                  if (window.confirm(t.confirmRevoke(inv.email))) revoke.mutate(inv.email)
                }}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function UsersAdmin() {
  const users = useUsers()
  const [filter, setFilter] = useState<Filter>('all')
  const list = useMemo(
    () => (users.data ?? []).filter((u) => filter === 'all' || statusOf(u) === filter),
    [users.data, filter],
  )
  const pendingCount = (users.data ?? []).filter((u) => statusOf(u) === 'pending').length

  return (
    <div className="space-y-4">
      <InviteForm />
      <PendingInvites />
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t.title}</CardTitle>
          <Tabs
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: t.filterAll },
              { value: 'pending', label: `${t.pending} (${pendingCount})` },
              { value: 'locked', label: t.locked },
            ]}
          />
        </CardHeader>
        <CardContent className="p-0">
          {users.isPending && (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          )}
          {users.error && (
            <div className="p-4">
              <ErrorBox error={users.error} onRetry={() => users.refetch()} />
            </div>
          )}
          {users.data && list.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">{t.noUsers}</p>
          )}
          <ul>
            {list.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
