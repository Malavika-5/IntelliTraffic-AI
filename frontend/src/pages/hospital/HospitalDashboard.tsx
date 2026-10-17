import { useState, useEffect, useCallback } from 'react'
import {
  Hospital, Activity, CheckCircle, Clock, AlertCircle, Loader2,
  RefreshCw, Bell, FileText, XCircle, ArrowRight
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/ui/StatsCard'
import { Link } from 'react-router-dom'
import api from '@/services/api'
import type { HospitalArrivalNotification } from '@/types'

interface NotificationFull {
  id: string
  booking_id: string
  hospital_id: string
  status: 'sent' | 'acknowledged' | 'unable_to_acknowledge' | 'handoff_recorded'
  estimated_arrival_at?: string
  patient_info_notes?: string
  sent_at: string
  acknowledged_at?: string
  acknowledgement_note?: string
  booking?: {
    reference_number: string
    patient_name?: string
    pickup_address?: string
  }
}

export default function HospitalDashboard() {
  const [notifications, setNotifications] = useState<NotificationFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<NotificationFull[]>('/hospital-notifications')
      setNotifications(res.data)
    } catch (err: any) {
      // Hospital user with no profile yet gets 404 — treat as empty
      if (err.response?.status === 404) {
        setNotifications([])
      } else {
        setError(err.response?.data?.detail || 'Failed to load data.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const pending = notifications.filter(n => n.status === 'sent')
  const acknowledged = notifications.filter(n => n.status === 'acknowledged')
  const today = new Date().toDateString()
  const todayHandoffs = notifications.filter(n =>
    n.status === 'handoff_recorded' && n.sent_at && new Date(n.sent_at).toDateString() === today
  )

  return (
    <DashboardLayout>
      <PageHeader
        title="Hospital Dashboard"
        subtitle="Arrival coordination and patient transport overview"
        action={
          <button onClick={fetchData} disabled={loading} className="btn-ghost gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
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
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Pending Arrivals"
              value={pending.length}
              icon={<Clock className="w-5 h-5 text-amber-600" />}
              color="amber"
              subtitle={pending.length > 0 ? 'Need acknowledgement' : 'All clear'}
            />
            <StatsCard
              title="Acknowledged"
              value={acknowledged.length}
              icon={<CheckCircle className="w-5 h-5 text-green-600" />}
              color="green"
            />
            <StatsCard
              title="Total Notifications"
              value={notifications.length}
              icon={<Bell className="w-5 h-5 text-primary-600" />}
              color="blue"
            />
            <StatsCard
              title="Handoffs Today"
              value={todayHandoffs.length}
              icon={<Hospital className="w-5 h-5 text-primary-600" />}
              color="blue"
            />
          </div>

          {/* Pending notifications alert */}
          {pending.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  {pending.length} arrival notification{pending.length > 1 ? 's' : ''} awaiting acknowledgement
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Please review and acknowledge incoming patient notifications.
                </p>
              </div>
              <Link to="/hospital/arrivals" className="btn-secondary text-xs py-1.5 px-3 gap-1 flex-shrink-0">
                Review <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Quick links */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <Link to="/hospital/arrivals" className="card p-5 hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
                <Activity className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Arrival Notifications</p>
              <p className="text-xs text-gray-500 mt-0.5">Review and acknowledge incoming patients</p>
              {pending.length > 0 && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                  {pending.length} pending
                </span>
              )}
            </Link>

            <Link to="/hospital/history" className="card p-5 hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Coordination History</p>
              <p className="text-xs text-gray-500 mt-0.5">Past notifications and handoff records</p>
              {notifications.length > 0 && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                  {notifications.length} total records
                </span>
              )}
            </Link>

            <Link to="/hospital/profile" className="card p-5 hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary-200 transition-colors">
                <Hospital className="w-5 h-5 text-primary-700" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Hospital Profile</p>
              <p className="text-xs text-gray-500 mt-0.5">Update services and contact information</p>
            </Link>

            <div className="card p-5 bg-green-50 border border-green-200">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Status</p>
              <p className="text-xs text-green-600 mt-0.5 font-medium">Portal Active</p>
              <p className="text-xs text-gray-500 mt-1">Receiving notifications normally</p>
            </div>
          </div>

          {/* Recent notifications preview */}
          {notifications.length > 0 && (
            <div className="card overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Recent Notifications</h2>
                <Link to="/hospital/arrivals" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  View all →
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {notifications.slice(0, 5).map(notif => (
                  <div key={notif.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {notif.booking?.reference_number || notif.booking_id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(notif.sent_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <StatusChip status={notif.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Important notice */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold mb-1">Coordination Notice</p>
              <p className="text-xs">
                This portal coordinates pre-arrival notifications only. Acknowledging a notification confirms receipt,
                not bed availability or clinical readiness. Always follow your hospital's internal admission procedures.
              </p>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: 'bg-amber-100 text-amber-700',
    acknowledged: 'bg-green-100 text-green-700',
    unable_to_acknowledge: 'bg-red-100 text-red-700',
    handoff_recorded: 'bg-blue-100 text-blue-700',
  }
  const labels: Record<string, string> = {
    sent: 'Awaiting Ack',
    acknowledged: 'Acknowledged',
    unable_to_acknowledge: 'Unable',
    handoff_recorded: 'Handoff',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  )
}
