import { useState, useEffect } from 'react'
import { Shield, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/services/api'

interface AuditLog {
  id: string
  action: string
  resource_type: string
  resource_id?: string
  detail?: string
  user_id?: string
  created_at: string
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<AuditLog[]>('/admin/audit-logs')
      setLogs(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [])

  // Colour-code actions
  const actionBadgeClass = (action: string) => {
    const a = action.toLowerCase()
    if (a.includes('delete') || a.includes('remove')) return 'bg-red-100 text-red-700'
    if (a.includes('create') || a.includes('register') || a.includes('add')) return 'bg-green-100 text-green-700'
    if (a.includes('update') || a.includes('edit') || a.includes('change')) return 'bg-blue-100 text-blue-700'
    if (a.includes('login') || a.includes('auth')) return 'bg-purple-100 text-purple-700'
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Audit Logs"
        subtitle={`${logs.length} log entries`}
        action={
          <button onClick={fetchLogs} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-primary-700 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No audit logs"
          description="No audit log entries have been recorded yet."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Action', 'Resource', 'Resource ID', 'Detail', 'User', 'Timestamp'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${actionBadgeClass(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700">
                    {log.resource_type}
                  </td>
                  <td className="px-4 py-3">
                    {log.resource_id ? (
                      <span className="font-mono text-xs text-gray-500">{log.resource_id}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                    <p className="truncate">{log.detail || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    {log.user_id ? (
                      <span className="font-mono text-xs text-gray-500 truncate block max-w-[100px]">{log.user_id}</span>
                    ) : (
                      <span className="text-xs text-gray-300">system</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString()}{' '}
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  )
}
