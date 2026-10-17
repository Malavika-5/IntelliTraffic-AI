import { useState, useEffect } from 'react'
import { Truck, Loader2, AlertCircle, RefreshCw, CheckCircle, XCircle, MapPin } from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/services/api'
import type { Ambulance } from '@/types'

export default function AdminOperators() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Ambulance[]>('/ambulances?page_size=100')
      .then(res => setAmbulances(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load.'))
      .finally(() => setLoading(false))
  }, [])

  const statusColors: Record<string, string> = {
    available: 'text-green-600',
    busy: 'text-blue-600',
    maintenance: 'text-amber-600',
    offline: 'text-gray-400',
  }

  return (
    <DashboardLayout>
      <PageHeader title="Operators & Fleet" subtitle={`${ambulances.length} vehicles on platform`}
        action={<button onClick={() => { setLoading(true); api.get<Ambulance[]>('/ambulances').then(r => setAmbulances(r.data)).finally(() => setLoading(false)) }} className="btn-ghost gap-2"><RefreshCw className="w-4 h-4" /></button>}
      />

      {error && <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-700">{error}</p></div>}

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary-700 animate-spin" /></div>
      : ambulances.length === 0 ? <EmptyState title="No vehicles registered" description="Operator vehicles will appear here." />
      : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Registration', 'Category', 'Status', 'Verification', 'Location', 'Operator'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ambulances.map(amb => (
                <tr key={amb.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-gray-900">{amb.registration_number}</p>
                    {amb.vehicle_name && <p className="text-xs text-gray-500">{amb.vehicle_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{amb.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold capitalize ${statusColors[amb.status] || 'text-gray-600'}`}>
                      {amb.status}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={amb.verification_status} /></td>
                  <td className="px-4 py-3">
                    {amb.last_location_update ? (
                      <span className="text-xs text-gray-500">
                        {new Date(amb.last_location_update).toLocaleTimeString()}
                      </span>
                    ) : <span className="text-xs text-gray-300">No data</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {amb.operator?.organization_name || 'Unknown'}
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
