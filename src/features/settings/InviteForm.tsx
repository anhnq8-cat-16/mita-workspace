import { zodResolver } from '@hookform/resolvers/zod'
import { Star, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { vi } from '@/i18n/vi'
import type { Role } from '@/lib/database.types'
import { cn } from '@/lib/utils'
import { useInviteUser, useSetting, useTeams } from './api'

const ROLES: Role[] = ['staff', 'lead', 'manager', 'admin']
const t = vi.settings.users

function buildSchema(domains: string[]) {
  return z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email(t.emailInvalid)
      .refine(
        (v) => domains.length === 0 || domains.includes(v.split('@')[1] ?? ''),
        t.emailWrongDomain(domains.join(', @')),
      ),
    full_name: z.string().trim(),
    title: z.string().trim(),
    role: z.enum(['admin', 'manager', 'lead', 'staff']),
    teams: z.array(z.string()).min(1, t.teamsRequired),
    lead_teams: z.array(z.string()),
  })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

export function TeamPicker({
  teams,
  value,
  leadValue,
  onChange,
  withLead = true,
}: {
  teams: { id: string; name: string }[]
  value: string[]
  leadValue: string[]
  onChange: (teams: string[], leadTeams: string[]) => void
  /** hiện nút ★ trưởng nhóm */
  withLead?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((team) => {
        const member = value.includes(team.id)
        const lead = leadValue.includes(team.id)
        return (
          <div
            key={team.id}
            className={cn(
              'flex items-center overflow-hidden rounded-full border text-sm',
              member ? 'border-primary bg-primary/10 text-primary' : 'border-border',
            )}
          >
            <button
              type="button"
              className="min-h-9 px-3"
              aria-pressed={member}
              onClick={() =>
                member
                  ? onChange(
                      value.filter((v) => v !== team.id),
                      leadValue.filter((v) => v !== team.id),
                    )
                  : onChange([...value, team.id], leadValue)
              }
            >
              {vi.teams[team.id] ?? team.name}
            </button>
            {member && withLead && (
              <button
                type="button"
                title={t.leadOf}
                aria-label={`${t.leadOf} ${team.name}`}
                aria-pressed={lead}
                className="min-h-9 border-l border-primary/30 px-2"
                onClick={() =>
                  onChange(
                    value,
                    lead ? leadValue.filter((v) => v !== team.id) : [...leadValue, team.id],
                  )
                }
              >
                <Star className={cn('size-4', lead && 'fill-current')} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function InviteForm() {
  const domains = useSetting<string[]>('allowed_email_domains') ?? []
  const { data: teams = [] } = useTeams()
  const invite = useInviteUser()
  const [done, setDone] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(domains)),
    defaultValues: {
      email: '',
      full_name: '',
      title: '',
      role: 'staff',
      teams: [],
      lead_teams: [],
    },
  })
  const { errors } = form.formState
  const leadTeams = useWatch({ control: form.control, name: 'lead_teams' })

  const onSubmit = form.handleSubmit(async (values) => {
    setDone(null)
    await invite.mutateAsync(values)
    setDone(values.email)
    form.reset()
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-5" /> {t.invite}
        </CardTitle>
        <CardDescription>{t.inviteHint}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">{t.email}</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder={domains[0] ? `ten@${domains[0]}` : 'ten@congty.vn'}
              {...form.register('email')}
            />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-name">{t.fullName}</Label>
            <Input id="invite-name" {...form.register('full_name')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-role">{t.role}</Label>
            <Select id="invite-role" {...form.register('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {vi.roles[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-title">{t.titleField}</Label>
            <Input id="invite-title" {...form.register('title')} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>{t.teams}</Label>
            <Controller
              control={form.control}
              name="teams"
              render={({ field }) => (
                <TeamPicker
                  teams={teams}
                  value={field.value}
                  leadValue={leadTeams}
                  onChange={(next, nextLead) => {
                    field.onChange(next)
                    form.setValue('lead_teams', nextLead)
                  }}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">{t.leadToggleHint}</p>
            <FieldError>{errors.teams?.message}</FieldError>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? vi.common.saving : t.invite}
            </Button>
            {invite.error && <FieldError>{invite.error.message}</FieldError>}
            {done && (
              <p className="text-sm text-success">
                {t.invited}: {done}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
