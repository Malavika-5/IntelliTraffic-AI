import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-700 rounded-full animate-spin" 
               style={{ borderWidth: '3px' }} />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Map legacy roles to standard roles
  const roleStr = user.role as string
  const effectiveRole = (roleStr === 'dispatcher' || roleStr === 'fleet_admin') ? 'operator' : user.role

  if (allowedRoles && !allowedRoles.includes(user.role as any) && !allowedRoles.includes(effectiveRole as any)) {
    // Redirect to appropriate dashboard
    const roleDefaults: Record<string, string> = {
      patient: '/my-bookings',
      operator: '/operator/dashboard',
      dispatcher: '/operator/dashboard',
      fleet_admin: '/operator/dashboard',
      hospital: '/hospital/dashboard',
      admin: '/admin/dashboard',
    }
    const target = roleDefaults[user.role] || roleDefaults[effectiveRole] || '/operator/dashboard'
    return <Navigate to={target} replace />
  }

  return <>{children}</>
}
