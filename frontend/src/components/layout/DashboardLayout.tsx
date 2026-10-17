import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Ambulance, LayoutDashboard, Truck, Users, Calendar, BarChart3,
  Settings, LogOut, ChevronRight, Hospital, ClipboardList, Activity,
  Shield, FileText, AlertCircle, Menu, X, TrendingUp, Radio
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const operatorNav: NavItem[] = [
  { label: 'Dashboard', href: '/operator/dashboard', icon: LayoutDashboard },
  { label: 'Dispatch Centre', href: '/operator/dispatch', icon: Activity },
  { label: 'Police Safety Log', href: '/operator/police-log', icon: Radio },
  { label: 'Fleet & ROI', href: '/operator/fleet-roi', icon: TrendingUp },
  { label: 'Ambulances', href: '/operator/ambulances', icon: Truck },
  { label: 'Drivers', href: '/operator/drivers', icon: Users },
  { label: 'Scheduled Trips', href: '/operator/scheduled-trips', icon: Calendar },
  { label: 'Analytics', href: '/operator/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/operator/settings', icon: Settings },
]

const hospitalNav: NavItem[] = [
  { label: 'Dashboard', href: '/hospital/dashboard', icon: LayoutDashboard },
  { label: 'Arrivals & Triage', href: '/hospital/arrivals', icon: Activity },
  { label: 'History', href: '/hospital/history', icon: FileText },
  { label: 'Profile', href: '/hospital/profile', icon: Hospital },
]

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Police Safety Log', href: '/admin/police-log', icon: Radio },
  { label: 'Fleet & ROI', href: '/admin/fleet-roi', icon: TrendingUp },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Operators', href: '/admin/operators', icon: Truck },
  { label: 'Hospitals', href: '/admin/hospitals', icon: Hospital },
  { label: 'Bookings', href: '/admin/bookings', icon: ClipboardList },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

const navByRole: Record<string, NavItem[]> = {
  patient: [],
  operator: operatorNav,
  dispatcher: operatorNav,
  fleet_admin: operatorNav,
  hospital: hospitalNav,
  admin: adminNav,
}

const roleTitles: Record<string, string> = {
  patient: 'Patient',
  operator: 'Operator Portal',
  dispatcher: 'Dispatcher Console',
  fleet_admin: 'Fleet Admin',
  hospital: 'Hospital Portal',
  admin: 'Admin Console',
}

export function DashboardSidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!user) return null

  const nav = (user?.role && navByRole[user.role]) ? navByRole[user.role] : []
  const roleTitle = (user?.role && roleTitles[user.role]) ? roleTitles[user.role] : 'Portal'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center">
            <Ambulance className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary-800 leading-tight">IntelliTraffic AI</p>
            <p className="text-xs text-gray-500">{roleTitle}</p>
          </div>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={isActive ? 'sidebar-link-active' : 'sidebar-link'}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary-500" />}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-primary-700">
              {user.full_name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{user.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col w-56 xl:w-60 bg-white border-r border-gray-200 flex-shrink-0">
        <SidebarContent />
      </div>
    </>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
