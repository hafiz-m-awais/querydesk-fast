import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginButton from '@/components/LoginButton'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  return (
    <div className="min-h-screen flex bg-[#f4f6f9]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1a4731] flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-bold text-lg">Q</div>
          <span className="font-bold text-xl tracking-tight">QueryDesk</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-bold leading-snug">
            Streamline Your<br />Academic Queries
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            A dedicated platform for FAST-NUCES students to raise, track, and resolve academic queries — attendance, marks, assignments, and more.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[['Submit Queries', 'Attendance, marks & more'], ['Track Progress', 'Real-time status updates'], ['SLA Enforced', 'Guaranteed response time']].map(([title, desc]) => (
            <div key={title} className="bg-white/10 rounded-lg p-3">
              <p className="font-semibold">{title}</p>
              <p className="text-white/60 text-xs mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center font-bold text-white">Q</div>
            <span className="font-bold text-xl text-primary">QueryDesk</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
              <p className="text-sm text-muted-foreground mt-1">Sign in with your FAST-NUCES Google account</p>
            </div>

            <LoginButton />

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Supported domains</span>
              </div>
            </div>

            <div className="flex gap-2 justify-center flex-wrap">
              {['@nu.edu.pk', '@isb.nu.edu.pk'].map(d => (
                <span key={d} className="text-xs bg-muted text-muted-foreground rounded-full px-3 py-1 font-mono">{d}</span>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            FAST National University of Computer and Emerging Sciences
          </p>
        </div>
      </div>
    </div>
  )
}



