'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import NotificationBell from '@/components/NotificationBell'
import { APP_NAME } from '@/lib/constants'
import type { Profile } from '@/types'

interface NavbarProps { profile: Profile }

const ROLE_LABEL: Record<string, string> = {
  student: 'Student', ta: 'Teaching Assistant', instructor: 'Instructor',
  coordinator: 'Coordinator', hod: 'Head of Department', superadmin: 'Super Admin',
}
const ROLE_COLOR: Record<string, string> = {
  student: 'bg-blue-50 text-blue-700 border-blue-200',
  ta: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  instructor: 'bg-violet-50 text-violet-700 border-violet-200',
  coordinator: 'bg-amber-50 text-amber-700 border-amber-200',
  hod: 'bg-green-50 text-green-700 border-green-200',
  superadmin: 'bg-red-50 text-red-700 border-red-200',
}

const NAV_LINKS: Record<string, { href: string; label: string }[]> = {
  student:     [{ href: '/submit',               label: 'Submit Query' }, { href: '/my-queries', label: 'My Queries' }],
  ta:          [{ href: '/instructor/dashboard',  label: 'Dashboard' }],
  instructor:  [{ href: '/instructor/dashboard',  label: 'Dashboard' }],
  coordinator: [{ href: '/instructor/dashboard',  label: 'Dashboard' }],
  hod:         [{ href: '/hod/dashboard',         label: 'Dashboard' }],
  superadmin:  [{ href: '/hod/dashboard',         label: 'Dashboard' }],
}

export default function Navbar({ profile }: NavbarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = (profile.full_name ?? profile.email)
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const links = NAV_LINKS[profile.role] ?? []

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xs">QD</span>
          </div>
          <span className="font-bold text-base text-foreground hidden sm:block">{APP_NAME}</span>
        </Link>

        {/* Divider */}
        <div className="h-5 w-px bg-border hidden sm:block" />

        {/* Nav links */}
        <nav className="flex items-center gap-0.5">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Role badge */}
          <span className={`hidden md:inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full border ${ROLE_COLOR[profile.role] ?? ''}`}>
            {ROLE_LABEL[profile.role] ?? profile.role}
          </span>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal pb-2">
                <p className="text-sm font-semibold truncate">{profile.full_name ?? 'No name set'}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                {profile.roll_number && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{profile.roll_number}</p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Edit Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/guide">Help & Guide</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

