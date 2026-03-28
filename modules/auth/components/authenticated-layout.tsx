import { redirect } from 'next/navigation'
import { getUser } from '@/modules/auth/lib/server'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const user = await getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  return <>{children}</>
}
