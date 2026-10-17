import { useState, useEffect } from 'react'
import {
  Activity, CheckCircle, XCircle, Clock, MapPin, AlertCircle,
  Loader2, RefreshCw, Info, ChevronRight, FileCheck, Stethoscope, Bed, HeartPulse
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { OpenStreetMap } from '@/components/map/OpenStreetMap'
import { Modal } from '@/components/ui/Modal'
import api from '@/services/api'
import type { HospitalArrivalNotification, Booking, HandoverRecord } from '@/types'

interface NotificationWithBooking extends HospitalArrivalNotification {
  booking?: Booking
}

export default function HospitalArrivals() {
  const [notifications, setNotifications] = useState<NotificationWithBooking[]>([])
  const [handovers, setHandovers] = useState<HandoverRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  // Handover Modal State
  const [handoverModalOpen, setHandoverModalOpen] = useState(false)
  const [selectedIncidentId, setSelectedIncidentId] = useState('')
  const [receivingDoctor, setReceivingDoctor] = useState('')
  const [bedNumber, setBedNumber] = useState('')
  const [vitals, setVitals] = useState('BP 120/80, Pulse 78 bpm, SpO2 98%')
  const [triageNotes, setTriageNotes] = useState('')
  const [savingHandover, setSavingHandover] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<NotificationWithBooking[]>('/hospital-notifications')
      setNotifications(res.data)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setNotifications([]) // No hospital profile yet
      } else {
        setError(err.response?.data?.detail || 'Failed to load arrivals.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAcknowledge = async (notifId: string) => {
    setActionLoading(notifId)
    try {
      await api.post(`/hospital-notifications/${notifId}/acknowledge`, {
        notes: 'Acknowledged by ER triage coordinator'
      })
      showToast('✓ Arrival acknowledged.')
      fetchData()
    } catch (err: any) {
      showToast('Failed to acknowledge: ' + (err.response?.data?.detail || ''))
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveHandover = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingHandover(true)
    try {
      await api.post('/api/handover', {
        incident_id: selectedIncidentId || 'INC-001',
        receiving_doctor: receivingDoctor,
        bed_number: bedNumber,
        vitals: vitals,
        triage_notes: triageNotes,
      })
      showToast('✓ Clinical handover registered successfully!')
      setHandoverModalOpen(false)
      setReceivingDoctor('')
      setBedNumber('')
      setTriageNotes('')
    } catch (err: any) {
      showToast('Handover recording failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSavingHandover(false)
    }
  }

  const pending = notifications.filter(n => n.status === 'sent')
  const others = notifications.filter(n => n.status !== 'sent')

  // Sample hospital map pins (Ernakulam Medical Trust / Kerala hub)
  const hospitalMarkers = [
    {
      lat: 9.9675,
      lng: 76.2945,
      type: 'hospital' as const,
      title: 'Ernakulam General Hospital',
      description: 'Emergency Department · Trauma Level II',
    },
    {
      lat: 9.9780,
      lng: 76.3010,
      type: 'ambulance' as const,
      title: 'Approaching Ambulance KL-07-CD-5678',
      description: 'ETA 6 mins · ALS Unit · Trauma Patient',
    },
  ]

  return (
    <DashboardLayout>
      <PageHeader
        title="Arrival Notifications & ER Triage"
        subtitle="Pre-arrival coordination, live incoming ambulance tracking, and clinical patient handovers"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setHandoverModalOpen(true)}
              className="btn-primary text-xs py-2 px-3 gap-1.5 bg-blue-700 hover:bg-blue-800"
            >
              <FileCheck className="w-4 h-4" /> Log Clinical Handover
            </button>
            <button onClick={fetchData} className="btn-ghost gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Live Map of Inbound Arrivals */}
      <div className="card overflow-hidden mb-6 border border-blue-200">
        <div className="p-3 bg-gradient-to-r from-blue-900 to-primary-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-300 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Hospital Approach Corridor · Live OpenStreetMap</h3>
          </div>
          <span className="text-xs text-blue-200">Live Traffic Corridor Active</span>
        </div>
        <div className="h-64 w-full">
          <OpenStreetMap
            center={[9.9675, 76.2945]}
            zoom={13}
            markers={hospitalMarkers}
            height="100%"
          />
        </div>
      </div>

      {/* Important note */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-800">Pre-Arrival Acknowledgement Notice</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Acknowledging an alert confirms receipt only. Follow clinical protocol upon physical arrival to record doctor assignment and bed triage.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary-700 animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {/* Pending */}
          <section>
            <h2 className="text-sm font-bold text-gray-900 mb-3">
              Awaiting Acknowledgement ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <EmptyState
                title="No pending arrival notifications"
                description="When an ambulance is en route to your hospital, arrival notifications will appear here for acknowledgement."
              />
            ) : (
              <div className="space-y-3">
                {pending.map(notif => (
                  <div key={notif.id} className="card p-4 border-l-4 border-l-amber-500">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Incoming Patient</p>
                        <p className="text-sm font-bold text-gray-900">Booking: {notif.booking_id.slice(0, 8)}...</p>
                        {notif.estimated_arrival_at && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <Clock className="w-3 h-3" />
                            Expected: {new Date(notif.estimated_arrival_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={notif.status} />
                    </div>

                    {notif.patient_info_notes && (
                      <p className="text-xs bg-gray-50 text-gray-700 p-2 rounded-lg mb-3">{notif.patient_info_notes}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcknowledge(notif.id)}
                        disabled={!!actionLoading}
                        className="btn-primary text-xs py-1.5 px-3 gap-1.5"
                      >
                        {actionLoading === notif.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Acknowledge Receipt
                      </button>
                      <button
                        onClick={() => {
                          setSelectedIncidentId(notif.booking_id)
                          setHandoverModalOpen(true)
                        }}
                        className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        Log Handover
                      </button>
                    </div>

                    <p className="text-xs text-gray-400 mt-2">
                      Sent: {new Date(notif.sent_at || '').toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent */}
          {others.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-900 mb-3">Recent Handled ({others.length})</h2>
              <div className="space-y-2">
                {others.map(notif => (
                  <div key={notif.id} className="card p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Booking: {notif.booking_id.slice(0, 8)}...</p>
                      <p className="text-xs text-gray-400">{new Date(notif.sent_at || '').toLocaleString()}</p>
                    </div>
                    <StatusBadge status={notif.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal for Logging Clinical Handover */}
      <Modal
        isOpen={handoverModalOpen}
        onClose={() => setHandoverModalOpen(false)}
        title="Record Clinical Patient Handover"
      >
        <form onSubmit={handleSaveHandover} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Incident or Booking Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              placeholder="e.g. INC-001 or Booking ID"
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Receiving Doctor / Nurse <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={receivingDoctor}
                onChange={(e) => setReceivingDoctor(e.target.value)}
                placeholder="Dr. Rajesh Nair"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Assigned ER Bed / Bay <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={bedNumber}
                onChange={(e) => setBedNumber(e.target.value)}
                placeholder="Bay 3 / Bed ER-04"
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Patient Vitals at Handoff
            </label>
            <input
              type="text"
              value={vitals}
              onChange={(e) => setVitals(e.target.value)}
              placeholder="BP, Pulse, SpO2, GCS"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Triage & Clinical Condition Notes
            </label>
            <textarea
              rows={3}
              value={triageNotes}
              onChange={(e) => setTriageNotes(e.target.value)}
              placeholder="Patient conscious, stabilized with IV fluids, referred for immediate CT scan..."
              className="input-field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setHandoverModalOpen(false)}
              className="btn-secondary text-sm py-2 px-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingHandover}
              className="btn-primary text-sm py-2 px-4 gap-1.5"
            >
              {savingHandover ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              Complete Handover
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
