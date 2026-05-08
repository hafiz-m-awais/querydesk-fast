import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginButton from '@/components/LoginButton'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-fast-light">
      <div className="bg-white rounded-xl shadow-lg p-10 w-full max-w-sm text-center space-y-6">
        {/* FAST-NUCES logo placeholder */}
        <div className="w-16 h-16 bg-fast-green rounded-full flex items-center justify-center mx-auto">
          <span className="text-white font-bold text-xl">QD</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-fast-dark">QueryDesk</h1>
          <p className="text-sm text-muted-foreground mt-1">FAST-NUCES Student Query System</p>
        </div>

        <LoginButton />

        <p className="text-xs text-muted-foreground">
          Use your <strong>@nu.edu.pk</strong> Google account to sign in.
        </p>
      </div>
    </div>
  )
}


