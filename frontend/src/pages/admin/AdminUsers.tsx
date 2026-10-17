import { useState, useEffect } from 'react'
import { Users, Loader2, AlertCircle, RefreshCw, Shield, CheckCircle, XCircle } from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/services/api'
import type { User } from '@/types'

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchUsers = async () => {
    try {
      const res = await api.get<User[]>('/admin/users?page_size=100')
      setUsers(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = filter === 'all' ? users : users.filter(u => u.role === filter)

  const roleColors: Record<string, string> = {
    patient: 'bg-blue-100 text-blue-700',
    operator: 'bg-purple-100 text-purple-700',
    hospital: 'bg-green-100 text-green-700',
    admin: 'bg-red-100 text-red-700',
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="User Management"
        subtitle={`${users.length} registered users`}
        action={<button onClick={fetchUsers} className="btn-ghost gap-2"><RefreshCw className="w-4 h-4" /></button>}
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">{toast}</div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'patient', 'operator', 'hospital', 'admin'].map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === f ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'all' ? `(${users.length})` : `(${users.filter(u => u.role === f).length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary-700 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No users found" description="No users match the current filter." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name / Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                    {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {user.is_active ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-gray-400" />}
                      <span className="text-xs text-gray-600">{user.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    {user.is_verified && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Shield className="w-3 h-3 text-primary-500" />
                        <span className="text-xs text-primary-600">Verified</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-primary-600 hover:text-primary-800 font-medium">View</button>
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
