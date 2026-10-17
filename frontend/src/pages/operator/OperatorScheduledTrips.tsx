import { useState, useEffect } from 'react'
import {
  Calendar, Clock, MapPin, RefreshCw, AlertCircle, Loader2, CheckCircle
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/services/api'
import type { ScheduledTrip } from '@/types'

export default function OperatorScheduledTrips() {
  const [trips, setTrips] = useState<ScheduledTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchTrips = async () => {
    try {
      const res = await api.get<ScheduledTrip[]>('/scheduled-trips?page_size=50')
      setTrips(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load scheduled trips.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTrips() }, [])

  const handleConfirm = async (id: string) => {
    try {
      await api.patch(`/scheduled-trips/${id}?status=confirmed`)
      showToast('Trip confirmed!')
      fetchTrips()
    } catch (err: any) {
      showToast('Failed to confirm: ' + (err.response?.data?.detail || ''))
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.patch(`/scheduled-trips/${id}?status=cancelled`)
      showToast('Trip cancelled.')
      fetchTrips()
    } catch (err: any) {
      showToast('Failed to cancel.')
    }
  }

  const upcoming = trips.filter(t => t.status === 'scheduled' || t.status === 'confirmed')
  const past = trips.filter(t => ['completed', 'cancelled', 'no_show'].includes(t.status))

  return (
    <DashboardLayout>
      <PageHeader
        title="Scheduled Trips"
        subtitle="Manage planned medical transport"
        action={<button onClick={fetchTrips} className="btn-ghost gap-2"><RefreshCw className="w-4 h-4" /> Refresh</button>}
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary-700 animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Upcoming ({upcoming.length})</h2>
            {upcoming.length === 0 ? (
              <EmptyState title="No upcoming scheduled trips" description="Scheduled transport requests will appear here." />
            ) : (
              <div className="space-y-3">
                {upcoming.map(trip => (
                  <div key={trip.id} className="card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-gray-900">{trip.title || trip.trip_purpose || 'Medical Transport'}</p>
                          <StatusBadge status={trip.status} />
                        </div>
                        <p className="text-xs text-gray-500 capitalize">{trip.requested_category.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p className="font-medium text-primary-700">
                          {new Date(trip.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                        <p>{new Date(trip.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      <p className="text-xs text-gray-600 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-primary-500" /> {trip.pickup_address}
                      </p>
                      {trip.destination_address && (
                        <p className="text-xs text-gray-600 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-red-400" /> {trip.destination_address}
                        </p>
                      )}
                    </div>

                    {trip.recurrence_type !== 'none' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full mb-3">
                        Recurring: {trip.recurrence_type}
                      </span>
                    )}

                    {trip.status === 'scheduled' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleConfirm(trip.id)} className="btn-primary text-xs py-1.5 px-3 gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Confirm
                        </button>
                        <button onClick={() => handleCancel(trip.id)} className="btn-secondary text-xs py-1.5 px-3">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-900 mb-3">Past Trips ({past.length})</h2>
              <div className="space-y-2">
                {past.map(trip => (
                  <div key={trip.id} className="card p-4 opacity-70">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{trip.title || trip.trip_purpose || 'Medical Transport'}</p>
                        <p className="text-xs text-gray-400">{new Date(trip.scheduled_at).toLocaleString()}</p>
                      </div>
                      <StatusBadge status={trip.status} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
