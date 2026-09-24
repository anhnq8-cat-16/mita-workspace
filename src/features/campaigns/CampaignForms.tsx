import { useState } from 'react'
import { LinksEditor } from '@/components/LinksEditor'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { useTaskContext } from '@/features/tasks/use-task-context'
import { vi } from '@/i18n/vi'
import type {
  CampaignListRow,
  CampaignStatus,
  LinkItem,
  MilestoneProgressRow,
} from '@/lib/database.types'
import { weekStart } from '@/lib/week'
import { useSaveCampaign, useSaveMilestones, type MilestoneInput } from './api'
import {
  campaignWeeks,
  cleanLinks,
  defaultDue,
  endOfWeeks,
  parseMilestoneLines,
} from './campaign-rules'

const t = vi.campaigns
const STATUSES: CampaignStatus[] = ['planning', 'active', 'done', 'cancelled']

/** Tạo / sửa chiến dịch: mục tiêu, mô tả sơ bộ, thời gian (tuần), tài liệu */
export function CampaignForm({
  campaign,
  onDone,
}: {
  campaign?: CampaignListRow
  onDone: (id: string) => void
}) {
  const { me, actor, people } = useTaskContext()
  const save = useSaveCampaign()
  const teamOptions =
    me.role === 'lead' ? actor.ledTeams : ['marketing', 'sales_domestic', 'export']
  const weeksOf = (c: CampaignListRow) => campaignWeeks(c.start_date, c.end_date).length
  const [form, setForm] = useState({
    team_id: campaign?.team_id ?? teamOptions[0] ?? '',
    title: campaign?.title ?? '',
    goal: campaign?.goal ?? '',
    description: campaign?.description ?? '',
    start: campaign?.start_date ?? weekStart(),
    weeks: campaign ? weeksOf(campaign) : 4,
    status: campaign?.status ?? ('active' as CampaignStatus),
    owner_id: campaign?.owner_id ?? me.id,
    links: campaign?.links ?? ([] as LinkItem[]),
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))
  const owners = people.filter(
    (u) =>
      u.teams.some((m) => m.team_id === form.team_id) || u.role === 'manager' || u.role === 'admin',
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const start = weekStart(form.start)
    const id = await save.mutateAsync({
      id: campaign?.id,
      input: {
        team_id: form.team_id,
        title: form.title.trim(),
        goal: form.goal.trim() || null,
        description: form.description.trim() || null,
        start_date: start,
        end_date: endOfWeeks(start, form.weeks),
        status: form.status,
        owner_id: form.owner_id || null,
        links: cleanLinks(form.links),
      },
    })
    onDone(id)
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div className="grid gap-1.5">
        <Label htmlFor="cp-title">{t.fields.title}</Label>
        <Input
          id="cp-title"
          value={form.title}
          autoFocus
          placeholder="Set quà cà phê 20/10"
          onChange={(e) => set('title', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cp-team">{t.fields.team}</Label>
          <Select
            id="cp-team"
            value={form.team_id}
            disabled={Boolean(campaign)}
            onChange={(e) => set('team_id', e.target.value)}
          >
            {teamOptions.map((id) => (
              <option key={id} value={id}>
                {vi.teams[id] ?? id}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cp-owner">{t.fields.owner}</Label>
          <Select
            id="cp-owner"
            value={form.owner_id}
            onChange={(e) => set('owner_id', e.target.value)}
          >
            <option value="">—</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cp-start">{t.fields.start}</Label>
          <Input
            id="cp-start"
            type="date"
            value={form.start}
            onChange={(e) => e.target.value && set('start', weekStart(e.target.value))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cp-weeks">{t.fields.weeks}</Label>
          <Select
            id="cp-weeks"
            value={form.weeks}
            onChange={(e) => set('weeks', Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {t.weeksN(n)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cp-goal">{t.fields.goal}</Label>
        <Input
          id="cp-goal"
          value={form.goal}
          placeholder={t.fields.goalPlaceholder}
          onChange={(e) => set('goal', e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cp-desc">{t.fields.description}</Label>
        <Textarea
          id="cp-desc"
          rows={4}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.fields.links}</Label>
        <LinksEditor idPrefix="cp-link" value={form.links} onChange={(v) => set('links', v)} />
      </div>
      {campaign && (
        <div className="grid gap-1.5">
          <Label htmlFor="cp-status">{t.fields.status}</Label>
          <Select
            id="cp-status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as CampaignStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </Select>
        </div>
      )}
      <FieldError>{save.error?.message}</FieldError>
      <Button type="submit" disabled={save.isPending || !form.title.trim() || !form.team_id}>
        {save.isPending ? vi.common.saving : vi.common.save}
      </Button>
    </form>
  )
}

/** Thêm 1 hoặc nhiều mốc vào 1 tuần, hoặc sửa 1 mốc */
export function MilestoneForm({
  campaign,
  week,
  milestone,
  nextPosition,
  onDone,
}: {
  campaign: CampaignListRow
  week?: string
  milestone?: MilestoneProgressRow
  nextPosition: number
  onDone: () => void
}) {
  const { people } = useTaskContext()
  const save = useSaveMilestones()
  const weeks = campaignWeeks(
    milestone && milestone.week_start < campaign.start_date
      ? milestone.week_start
      : campaign.start_date,
    campaign.end_date,
  )
  const initialWeek = milestone?.week_start ?? week ?? weeks[0]?.week_start ?? weekStart()
  const [form, setForm] = useState({
    lines: '',
    title: milestone?.title ?? '',
    week_start: initialWeek,
    due_date: milestone?.due_date ?? defaultDue(initialWeek),
    owner_id: milestone?.owner_id ?? '',
    description: milestone?.description ?? '',
    links: milestone?.links ?? ([] as LinkItem[]),
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))
  const members = people.filter((u) => u.teams.some((m) => m.team_id === campaign.team_id))
  const titles = milestone ? [form.title.trim()].filter(Boolean) : parseMilestoneLines(form.lines)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titles.length) return
    const rows: MilestoneInput[] = titles.map((title, i) => ({
      campaign_id: campaign.id,
      title,
      description: form.description.trim() || null,
      week_start: form.week_start,
      due_date: form.due_date,
      owner_id: form.owner_id || null,
      links: cleanLinks(form.links),
      position: milestone?.position ?? nextPosition + i,
    }))
    await save.mutateAsync({ id: milestone?.id, rows })
    onDone()
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      {milestone ? (
        <div className="grid gap-1.5">
          <Label htmlFor="ms-title">{t.milestone.title}</Label>
          <Input id="ms-title" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="ms-lines">
            {t.milestone.title} · {t.milestone.lines}
          </Label>
          <Textarea
            id="ms-lines"
            rows={4}
            autoFocus
            placeholder={t.milestone.linesPlaceholder}
            value={form.lines}
            onChange={(e) => set('lines', e.target.value)}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ms-week">{t.milestone.week}</Label>
          <Select
            id="ms-week"
            value={form.week_start}
            onChange={(e) => {
              set('week_start', e.target.value)
              set('due_date', defaultDue(e.target.value))
            }}
          >
            {weeks.map((w) => (
              <option key={w.week_start} value={w.week_start}>
                {w.label} · {w.range}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ms-due">{t.milestone.due}</Label>
          <Input
            id="ms-due"
            type="date"
            min={form.week_start}
            value={form.due_date}
            onChange={(e) => set('due_date', e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ms-owner">{t.milestone.owner}</Label>
        <Select
          id="ms-owner"
          value={form.owner_id}
          onChange={(e) => set('owner_id', e.target.value)}
        >
          <option value="">—</option>
          {members.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name ?? u.email}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ms-desc">{t.milestone.description}</Label>
        <Textarea
          id="ms-desc"
          rows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>{t.milestone.links}</Label>
        <LinksEditor idPrefix="ms-link" value={form.links} onChange={(v) => set('links', v)} />
      </div>
      <FieldError>{save.error?.message}</FieldError>
      <Button type="submit" disabled={save.isPending || titles.length === 0}>
        {save.isPending
          ? vi.common.saving
          : milestone
            ? vi.common.save
            : `${t.addMilestone}${titles.length > 1 ? ` (${titles.length})` : ''}`}
      </Button>
    </form>
  )
}
