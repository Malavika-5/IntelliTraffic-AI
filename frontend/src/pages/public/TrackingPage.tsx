import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Ambulance, Clock, MapPin, CheckCircle, AlertCircle, Phone,
  RefreshCw, ChevronLeft, Navigation, Activity, Loader2, Info,
  ShieldAlert, Share2, Copy, Send, MessageSquare
} from 'lucide-react'
import { PublicNavbar } from '@/components/layout/Navbar'
import api from '@/services/api'
import type { Booking, BookingStatusEvent } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import OpenStreetMap, { MapMarker } from '@/components/map/OpenStreetMap'
import toast from 'react-hot-toast'

const STATUS_STEPS = [
  { key: 'pending', label: 'Request Submitted' },
  { key: 'searching', label: 'Searching for Ambulance' },
  { key: 'accepted', label: 'Ambulance Accepted' },
  { key: 'en_route_pickup', label: 'En Route to Pickup' },
  { key: 'arrived_pickup', label: 'Arrived at Pickup' },
  { key: 'patient_onboard', label: 'Patient Onboard' },
  { key: 'en_route_destination', label: 'En Route to Destination' },
  { key: 'handoff_recorded', label: 'Handoff Recorded' },
  { key: 'completed', label: 'Completed' },
]

const TERMINAL_STATUSES = ['completed', 'cancelled', 'rejected', 'no_match']

export default function TrackingPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [events, setEvents] = useState<BookingStatusEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [resendingAlert, setResendingAlert] = useState(false)
  const [customPhone, setCustomPhone] = useState('')
  const [showAddContact, setShowAddContact] = useState(false)

  const handleResendAlert = async (targetPhone?: string) => {
    if (!bookingId) return
    setResendingAlert(true)
    try {
      const url = targetPhone
        ? `/bookings/${bookingId}/resend-emergency-alert?custom_phone=${encodeURIComponent(targetPhone)}`
        : `/bookings/${bookingId}/resend-emergency-alert`
      const res = await api.post<Booking>(url)
      setBooking(res.data)
      toast.success(`Emergency alert SMS dispatched to ${targetPhone || res.data.emergency_contact_phone}!`)
      setShowAddContact(false)
      setCustomPhone('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to dispatch emergency SMS alert.')
    } finally {
      setResendingAlert(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Live tracking link copied to clipboard!')
  }

  const handleWhatsAppShare = () => {
    if (!booking) return
    const text = `🚨 EMERGENCY ALERT: Ambulance requested for ${booking.patient_name || 'Patient'} (Ref #${booking.reference_number}). Track live here: ${window.location.href}`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
  }

  const fetchBooking = async () => {
    if (!bookingId) return
    try {
      const [bRes, eRes] = await Promise.all([
        api.get<Booking>(`/bookings/${bookingId}`),
        api.get<BookingStatusEvent[]>(`/bookings/${bookingId}/events`),
      ])
      setBooking(bRes.data)
      setEvents(eRes.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load booking.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBooking()
    // Poll every 15s for updates
    const interval = setInterval(fetchBooking, 15000)
    return () => clearInterval(interval)
  }, [bookingId])

  const handleCancel = async () => {
    if (!bookingId) return
    setCancelling(true)
    try {
      await api.post(`/bookings/${bookingId}/cancel`, { reason: cancelReason || 'Cancelled by patient' })
      setShowCancel(false)
      fetchBooking()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not cancel booking.')
    } finally {
      setCancelling(false)
    }
  }

  const currentStepIndex = booking
    ? STATUS_STEPS.findIndex(s => s.key === booking.status)
    : -1

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicNavbar />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-700 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicNavbar />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold mb-2">Booking Not Found</p>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <Link to="/my-bookings" className="btn-primary">View My Bookings</Link>
        </div>
      </div>
    )
  }

  const isTerminal = TERMINAL_STATUSES.includes(booking.status)
  const canCancel = !isTerminal && ['pending', 'searching', 'accepted'].includes(booking.status)

  // Markers and route for OpenStreetMap
  const mapMarkers: MapMarker[] = []
  const mapRoute: [number, number][] = []

  if (booking.pickup_latitude && booking.pickup_longitude) {
    mapMarkers.push({
      id: 'pickup',
      lat: booking.pickup_latitude,
      lng: booking.pickup_longitude,
      type: 'pickup',
      title: 'Pickup Location',
      description: booking.pickup_address,
      badge: 'Pickup',
    })
    mapRoute.push([booking.pickup_latitude, booking.pickup_longitude])
  }

  if (booking.destination_latitude && booking.destination_longitude) {
    mapMarkers.push({
      id: 'destination',
      lat: booking.destination_latitude,
      lng: booking.destination_longitude,
      type: 'destination',
      title: 'Destination',
      description: booking.destination_address,
      badge: 'Hospital / Destination',
    })
    mapRoute.push([booking.destination_latitude, booking.destination_longitude])
  }

  const isEnRoute = ['accepted', 'en_route_pickup', 'arrived_pickup', 'patient_onboard', 'en_route_destination'].includes(booking.status)
  if (isEnRoute) {
    const ambLat = (booking.pickup_latitude || 8.5241) + 0.009
    const ambLng = (booking.pickup_longitude || 76.9366) + 0.012
    mapMarkers.unshift({
      id: 'ambulance',
      lat: ambLat,
      lng: ambLng,
      type: 'ambulance',
      title: 'Dispatched Ambulance',
      description: 'Responding to emergency',
      badge: 'Ambulance',
      eta_min: booking.estimated_arrival_minutes || 8,
    })
    mapRoute.unshift([ambLat, ambLng])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      {/* Emergency banner */}
      <div className="bg-red-600 text-white py-2 text-center text-xs font-semibold">
        <Phone className="inline w-3 h-3 mr-1" /> Life-threatening emergency? Call <strong>112</strong>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back */}
        <button onClick={() => navigate('/my-bookings')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4" /> My Bookings
        </button>

        {/* Header */}
        <div className="card p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500">Booking</span>
                <span className="font-mono text-sm font-bold text-primary-700">{booking.reference_number}</span>
                {booking.is_demo && <span className="demo-banner">DEMO DATA</span>}
              </div>
              <StatusBadge status={booking.status} />
            </div>
            <button onClick={fetchBooking} className="btn-ghost p-2">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* ETA */}
          {booking.estimated_arrival_minutes != null && !isTerminal && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">Estimated Arrival</p>
                <p className="text-xl font-bold text-green-700">~{Math.round(booking.estimated_arrival_minutes)} min</p>
                {booking.eta_last_updated_at && (
                  <p className="text-xs text-green-600 opacity-70">
                    Updated {new Date(booking.eta_last_updated_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <div className="ml-auto">
                <span className="demo-banner">DEMO ETA</span>
              </div>
            </div>
          )}

          {/* Locations */}
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Navigation className="w-3 h-3 text-primary-700" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Pickup</p>
                <p className="text-sm text-gray-900">{booking.pickup_address}</p>
                {booking.pickup_landmark && <p className="text-xs text-gray-500">Near: {booking.pickup_landmark}</p>}
              </div>
            </div>
            {booking.destination_address && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-3 h-3 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Destination</p>
                  <p className="text-sm text-gray-900">{booking.destination_address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Emergency Contact Status Card */}
        <div className="card p-5 mb-4 border-l-4 border-l-red-600 bg-gradient-to-r from-red-50/40 to-white shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  Emergency Contact Informed
                </h2>
                <p className="text-xs text-gray-500">
                  Automated SMS dispatch with real-time tracking link
                </p>
              </div>
            </div>
            {booking.emergency_contact_notified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-[11px] font-bold rounded-full border border-green-200">
                <CheckCircle className="w-3 h-3 text-green-600" /> Dispatched via SMS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full border border-amber-200">
                <AlertCircle className="w-3 h-3 text-amber-600" /> Pending Dispatch
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                <span className="text-gray-400 block font-medium">Informed Emergency Contact</span>
                <span className="font-bold text-gray-900 flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-gray-500" />
                  {booking.emergency_contact_phone || 'None provided'}
                </span>
                {booking.emergency_contact_name && (
                  <span className="text-[11px] text-gray-500 block mt-0.5">
                    {booking.emergency_contact_name}
                  </span>
                )}
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                <span className="text-gray-400 block font-medium">Alert Dispatched At</span>
                <span className="font-semibold text-gray-800 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  {booking.emergency_contact_notified_at
                    ? new Date(booking.emergency_contact_notified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Dispatched on ambulance request'}
                </span>
                <span className="text-[11px] text-emerald-600 font-medium block mt-0.5">
                  ✓ Carrier delivery confirmed
                </span>
              </div>
            </div>

            {/* SMS Message Preview */}
            {booking.emergency_contact_message && (
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-primary-700" /> Dispatched SMS Message Preview
                </p>
                <p className="text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded-lg border border-gray-100 select-all leading-relaxed">
                  "{booking.emergency_contact_message}"
                </p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleResendAlert()}
                disabled={resendingAlert}
                className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
              >
                {resendingAlert ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Resend SMS Alert
              </button>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" /> Share on WhatsApp
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn-ghost text-xs py-1.5 px-3 gap-1.5 border border-gray-200"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Tracking Link
              </button>
              <button
                type="button"
                onClick={() => setShowAddContact(!showAddContact)}
                className="text-xs text-primary-700 font-medium hover:underline ml-auto"
              >
                {showAddContact ? 'Cancel' : '+ Alert Another Number'}
              </button>
            </div>

            {/* Alert Another Number Input */}
            {showAddContact && (
              <div className="mt-2 p-3 bg-white rounded-xl border border-primary-200 flex flex-col sm:flex-row gap-2 items-center">
                <input
                  type="tel"
                  placeholder="Enter phone number (e.g. +91 98765 00000)"
                  className="input-field text-xs py-1.5 flex-1"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!customPhone.trim() || resendingAlert}
                  onClick={() => handleResendAlert(customPhone.trim())}
                  className="btn-primary text-xs py-2 px-4 whitespace-nowrap gap-1.5 w-full sm:w-auto"
                >
                  <Send className="w-3.5 h-3.5" /> Send Alert SMS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live OpenStreetMap */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-primary-700" /> Live Tracking Map
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 font-medium">OpenStreetMap</span>
              <a
                className="text-xs text-primary-700 underline hover:text-primary-900"
                target="_blank"
                rel="noreferrer"
                href={`https://www.openstreetmap.org/?mlat=${booking.pickup_latitude}&mlon=${booking.pickup_longitude}#map=15/${booking.pickup_latitude}/${booking.pickup_longitude}`}
              >
                View on OSM
              </a>
            </div>
          </div>
          <OpenStreetMap
            height="300px"
            center={[booking.pickup_latitude || 8.5241, booking.pickup_longitude || 76.9366]}
            markers={mapMarkers}
            route={mapRoute}
          />
        </div>

        {/* Status timeline */}
        <div className="card p-6 mb-4">
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary-700" /> Journey Status
          </h2>

          {booking.status === 'no_match' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
              <p className="text-sm font-semibold text-amber-800">No ambulance available</p>
              <p className="text-xs text-amber-700 mt-1">No eligible ambulances were found for your request. Please try again or call 112 for emergencies.</p>
            </div>
          )}

          {booking.status === 'cancelled' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
              <p className="text-sm font-semibold text-red-800">Booking Cancelled</p>
              {booking.cancellation_reason && (
                <p className="text-xs text-red-700 mt-1">{booking.cancellation_reason}</p>
              )}
            </div>
          )}

          <div className="space-y-0">
            {STATUS_STEPS.filter(s => !['rejected', 'no_match', 'cancelled'].includes(s.key)).map((step, i, arr) => {
              const stepIdx = STATUS_STEPS.findIndex(s => s.key === step.key)
              const isDone = stepIdx < currentStepIndex || (step.key === booking.status && isTerminal)
              const isCurrent = step.key === booking.status && !isTerminal
              const event = events.find(e => e.to_status === step.key)

              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDone || isCurrent ? (isCurrent ? 'bg-primary-700' : 'bg-green-500') : 'bg-gray-200'
                    }`}>
                      {isDone && !isCurrent ? (
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      ) : isCurrent ? (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      )}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`w-0.5 flex-1 my-1 min-h-[1.5rem] ${isDone ? 'bg-green-300' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className={`pb-4 ${i === arr.length - 1 ? 'pb-0' : ''}`}>
                    <p className={`text-sm font-medium ${
                      isCurrent ? 'text-primary-700' : isDone ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {step.label}
                      {isCurrent && <span className="ml-2 text-xs text-primary-500 animate-pulse">● Current</span>}
                    </p>
                    {event && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(event.created_at).toLocaleString()}
                        {event.note && ` · ${event.note}`}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Event log */}
        {events.length > 0 && (
          <div className="card p-6 mb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Event History</h2>
            <div className="space-y-2">
              {[...events].reverse().map((evt) => (
                <div key={evt.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-2 h-2 bg-primary-400 rounded-full flex-shrink-0 mt-1.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-800 capitalize">
                      {evt.to_status.replace(/_/g, ' ')}
                      {evt.from_status && <span className="text-gray-400 font-normal"> (from {evt.from_status.replace(/_/g, ' ')})</span>}
                    </p>
                    {evt.note && <p className="text-xs text-gray-500 mt-0.5">{evt.note}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(evt.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <a href="tel:112" className="btn-danger flex-1 gap-2">
            <Phone className="w-4 h-4" /> Emergency: 112
          </a>
          {canCancel && (
            <button onClick={() => setShowCancel(true)} className="btn-secondary">
              Cancel Booking
            </button>
          )}
        </div>

        {/* Cancel modal */}
        {showCancel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-base font-bold text-gray-900 mb-1">Cancel Booking?</h3>
              <p className="text-sm text-gray-500 mb-4">This will cancel booking {booking.reference_number}.</p>
              <label className="label">Reason (optional)</label>
              <input type="text" className="input-field mb-4" placeholder="e.g. No longer needed"
                value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={() => setShowCancel(false)} className="btn-ghost flex-1">Back</button>
                <button onClick={handleCancel} disabled={cancelling} className="btn-danger flex-1">
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
