import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/auth-context'
import { vi } from '@/i18n/vi'
import { formatDateTimeVN } from '@/lib/date-vn'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const me = useMe()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const queryKey = ['notifications', me.id]

  const { data = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', me.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
  })

  // Realtime: có thông báo mới thì tải lại
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${me.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['notifications', me.id] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [me.id, queryClient])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', me.id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const unread = data.filter((n) => !n.read_at).length

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={vi.notifications.title}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="font-semibold">{vi.notifications.title}</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() => markAllRead.mutate()}
              >
                {vi.notifications.markAllRead}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data.length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">
                {vi.notifications.empty}
              </li>
            )}
            {data.map((n) => {
              const content = (
                <>
                  <p className={cn('text-sm', !n.read_at && 'font-semibold')}>{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTimeVN(n.created_at)}
                  </p>
                </>
              )
              return (
                <li
                  key={n.id}
                  className={cn('border-b border-border', !n.read_at && 'bg-primary/5')}
                >
                  {n.link ? (
                    <Link to={n.link} className="block px-4 py-3" onClick={() => setOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    <div className="px-4 py-3">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
