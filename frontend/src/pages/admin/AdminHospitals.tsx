import { useState, useEffect } from 'react'
import { Hospital, Loader2, AlertCircle, RefreshCw, Phone, MapPin, Stethoscope } from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { VerificationBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/services/api'
import type { Hospital as HospitalType, HospitalVerificationStatus } from '@/types'

export default function AdminHospitals() {
  const [hospitals, setHospitals] = useState<HospitalType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | HospitalVerificationStatus>('all')
  const [selected, setSelected] = useState<HospitalType | null>(null)

  const fetchHospitals = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<HospitalType[]>('/hospitals')
      setHospitals(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load hospitals.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHospitals() }, [])

  const filterOptions: Array<'all' | HospitalVerificationStatus> = ['all', 'verified', 'pending', 'rejected']

  const filtered = filter === 'all' ? hospitals : hospitals.filter(h => h.verification_status === filter)

  return (
    <DashboardLayout>
      <PageHeader
        title="Hospitals"
        subtitle={`${hospitals.length} registered hospitals`}
        action={
          <button onClick={fetchHospitals} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                {selected.city && <p className="text-sm text-gray-500">{selected.city}</p>}
              </div>
              <VerificationBadge status={selected.verification_status} />
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{selected.address}</span>
              </div>
              {selected.contact_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">{selected.contact_phone}</span>
                </div>
              )}
              {selected.emergency_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-gray-700">Emergency: {selected.emergency_phone}</span>
                </div>
              )}
              {selected.contact_email && (
                <p className="text-gray-500 pl-6">{selected.contact_email}</p>
              )}
              {selected.services.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5" /> Services
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.services.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${selected.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {selected.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <button
              className="mt-5 w-full py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {filterOptions.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-primary-700 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}{' '}
            {f === 'all'
              ? `(${hospitals.length})`
              : `(${hospitals.filter(h => h.verification_status === f).length})`}
          </button>
        ))}
      </div>

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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Hospital}
          title="No hospitals found"
          description="No hospitals match the current filter."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Hospital', 'City', 'Services', 'Contact', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(hospital => (
                <tr key={hospital.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{hospital.name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-xs">{hospital.address}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{hospital.city || '—'}</td>
                  <td className="px-4 py-3">
                    {hospital.services.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {hospital.services.slice(0, 2).map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">{s}</span>
                        ))}
                        {hospital.services.length > 2 && (
                          <span className="text-xs text-gray-400">+{hospital.services.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{hospital.contact_phone || '—'}</td>
                  <td className="px-4 py-3">
                    <VerificationBadge status={hospital.verification_status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(hospital)}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                    >
                      View
                    </button>
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
