import { AuthProvider } from '@/hooks/useAuth'
import Protected from './protected'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Protected>{children}</Protected>
    </AuthProvider>
  )
}

