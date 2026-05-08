'use client'

import React, { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Notification } from '@/types'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  // Stable ref — createClient() must not be called on every render
  const supabaseRef = React.useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    let mounted = true

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (mounted) setNotifications(data ?? [])
    }

    load()
    return () => { mounted = false }
    // supabase ref is stable — no dependency needed
  }, [])

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-md p-2 hover:bg-accent focus:outline-none" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications</p>
        ) : (
          notifications.slice(0, 8).map(n => (
            <DropdownMenuItem
              key={n.id}
              className={`flex flex-col items-start gap-0.5 cursor-pointer ${!n.is_read ? 'font-medium' : ''}`}
              onClick={() => markRead(n.id)}
            >
              <span className="text-sm">{n.title}</span>
              <span className="text-xs text-muted-foreground line-clamp-1">{n.message}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
