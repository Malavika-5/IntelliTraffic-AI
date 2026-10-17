import { useState, useEffect } from 'react'
import {
  Settings, Loader2, AlertCircle, RefreshCw, CheckCircle,
  XCircle, Database, Server, MapPin, Key, User
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import api from '@/services/api'

interface HealthStatus {
  status: string
  version?: string
  environment?: string
  demo_mode?: boolean
  routing_provider?: string
  database?: string
  [key: string]: unknown
}

interface SettingItem {
  label: string
  value: string | boolean | number | undefined | null
  icon: React.ComponentType<{ className?: string }>
  type?: 'boolean' | 'text' | 'code'
  description?: string
}

export default function AdminSettings() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchHealth = async () => {
    setLoading(true)
    setError('')
    try {
      // /ready is on the API root (proxied)
      const res = await api.get<HealthStatus>('/ready')
      setHealth(res.data)
    } catch (err: any) {
      // Even a non-200 response gives us info; try /health as fallback
      try {
        const res2 = await api.get<HealthStatus>('/health')
        setHealth(res2.data)
      } catch {
        setError(err.response?.data?.detail || 'Could not reach the backend health endpoint.')
        // Still show static config even without health data
        setHealth(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHealth() }, [])

  const isHealthy = health?.status === 'ok' || health?.status === 'ready' || health?.status === 'healthy'

  const settingsItems: SettingItem[] = [
    {
      label: 'System Status',
      value: health ? (isHealthy ? 'Operational' : health.status ?? 'Unknown') : 'Unreachable',
      icon: Server,
      type: 'boolean',
      description: 'Backend API reachability',
    },
    {
      label: 'Demo Mode',
      value: health?.demo_mode ?? true,
      icon: Settings,
      type: 'boolean',
      description: 'Seeded demo data is loaded on startup',
    },
    {
      label: 'Routing Provider',
      value: health?.routing_provider ?? 'Straight-line (demo)',
      icon: MapPin,
      description: 'Engine used for distance/ETA estimation',
    },
    {
      label: 'Database',
      value: health?.database ?? 'SQLite (file-based)',
      icon: Database,
      description: 'Persistent storage backend',
    },
    {
      label: 'Environment',
      value: health?.environment ?? 'development',
      icon: Server,
      description: 'Runtime environment',
    },
    {
      label: 'API Version',
      value: health?.version ?? 'v1',
      icon: Settings,
      description: 'Backend API version',
    },
  ]

  const demoAccounts = [
    { role: 'Admin', email: 'admin@intellitraffic.ai', password: 'admin123', color: 'red' },
    { role: 'Operator', email: 'operator@demo.com', password: 'operator123', color: 'purple' },
    { role: 'Hospital', email: 'hospital@demo.com', password: 'hospital123', color: 'green' },
    { role: 'Patient', email: 'patient@demo.com', password: 'patient123', color: 'blue' },
  ]

  const colorMap: Record<string, string> = {
    red: 'bg-red-50 border-red-100',
    purple: 'bg-purple-50 border-purple-100',
    green: 'bg-green-50 border-green-100',
    blue: 'bg-blue-50 border-blue-100',
  }

  const labelColorMap: Record<string, string> = {
    red: 'text-red-700',
    purple: 'text-purple-700',
    green: 'text-green-700',
    blue: 'text-blue-700',
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Platform Settings"
        subtitle="System configuration and environment information"
        action={
          <button onClick={fetchHealth} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* System Configuration */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Server className="w-4 h-4 text-primary-600" />
            <h2 className="text-sm font-bold text-gray-900">System Configuration</h2>
            {loading && <Loader2 className="w-4 h-4 text-primary-500 animate-spin ml-auto" />}
          </div>

          <div className="divide-y divide-gray-100">
            {settingsItems.map(item => {
              const Icon = item.icon
              const isBoolean = item.type === 'boolean'
              const boolVal = Boolean(item.value)

              return (
                <div key={item.label} className="flex items-center gap-3 py-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {isBoolean ? (
                      <div className="flex items-center gap-1.5">
                        {boolVal
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <XCircle className="w-4 h-4 text-gray-400" />}
                        <span className={`text-sm font-medium ${boolVal ? 'text-green-600' : 'text-gray-500'}`}>
                          {item.label === 'Demo Mode'
                            ? (boolVal ? 'Enabled' : 'Disabled')
                            : String(item.value)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 font-mono">
                        {item.value != null ? String(item.value) : '—'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Key className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-900">Demo Account Credentials</h2>
            <span className="ml-auto text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              Local development only
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            These accounts are seeded automatically when demo mode is active. Do not use in production.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {demoAccounts.map(acc => (
              <div
                key={acc.role}
                className={`flex items-start gap-3 p-3 rounded-xl border ${colorMap[acc.color]}`}
              >
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User className={`w-4 h-4 ${labelColorMap[acc.color]}`} />
                </div>
                <div>
                  <p className={`text-xs font-bold ${labelColorMap[acc.color]}`}>{acc.role}</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">{acc.email}</p>
                  <p className="text-xs text-gray-500 font-mono">{acc.password}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">About IntelliTraffic AI</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            IntelliTraffic AI is an intelligent ambulance dispatch and traffic management platform.
            It leverages real-time location tracking, AI-based matching, and multi-role workflows
            to connect patients with the right ambulance rapidly and transparently.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['React + Vite', 'FastAPI', 'SQLite / PostgreSQL', 'TailwindCSS', 'Recharts'].map(tag => (
              <span key={tag} className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
