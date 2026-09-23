import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { teamIds, useAuth, useMe } from '@/features/auth/auth-context'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { vi } from '@/i18n/vi'
import { bottomTabs, visibleNav, type NavItem } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { NAV_ICONS } from './nav-icons'

function SideLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const Icon = NAV_ICONS[item.key]
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted',
          isActive && 'bg-primary/10 text-primary',
        )
      }
    >
      <Icon className="size-5" />
      {vi.nav[item.key]}
    </NavLink>
  )
}

function UserBox() {
  const me = useMe()
  const { signOut } = useAuth()
  return (
    <div className="flex items-center gap-3 border-t border-border p-3">
      <Avatar name={me.full_name ?? me.email} src={me.avatar_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{me.full_name ?? me.email}</p>
        <p className="truncate text-xs text-muted-foreground">{vi.roles[me.role]}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={signOut} aria-label={vi.auth.logout}>
        <LogOut />
      </Button>
    </div>
  )
}

export function AppLayout() {
  const me = useMe()
  const navUser = { role: me.role, teams: teamIds(me) }
  const items = visibleNav(navUser)
  const tabs = bottomTabs(navUser)
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="font-semibold">{vi.appName}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
          {items.map((item) => (
            <SideLink key={item.key} item={item} />
          ))}
        </nav>
        <UserBox />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2 md:hidden">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="font-semibold">{vi.appName}</span>
          </div>
          <div className="hidden md:block" />
          <NotificationBell />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Thanh tab dưới trên mobile */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card md:hidden">
        <div className="grid grid-cols-5">
          {tabs.map((item) => {
            const Icon = NAV_ICONS[item.key]
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground',
                    isActive && 'text-primary',
                  )
                }
              >
                <Icon className="size-5" />
                {vi.navShort[item.key]}
              </NavLink>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground"
          >
            <Menu className="size-5" />
            {vi.common.more}
          </button>
        </div>
      </nav>

      {/* Menu "Thêm" trên mobile */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={vi.common.close}
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-2xl bg-card">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="font-semibold">{vi.common.more}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={vi.common.close}
                onClick={() => setMoreOpen(false)}
              >
                <X />
              </Button>
            </div>
            <nav className="grid gap-1 px-2 pb-2">
              {items.map((item) => (
                <SideLink key={item.key} item={item} onClick={() => setMoreOpen(false)} />
              ))}
            </nav>
            <UserBox />
          </div>
        </div>
      )}
    </div>
  )
}
