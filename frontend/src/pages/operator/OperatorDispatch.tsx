import { useState, useEffect, useCallback } from 'react'
import {
  Clock, MapPin, CheckCircle, XCircle, AlertCircle,
  Loader2, RefreshCw, ChevronDown, ChevronUp, Truck, Activity,
  AlertTriangle, Shield, Hospital as HospitalIcon, Radio, Compass, Filter
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { OpenStreetMap } from '@/components/map/OpenStreetMap'
import api from '@/services/api'
import type {
  Booking, MatchResult, Ambulance, Incident,
  IncidentOptions, TrafficScenario, CandidateAmbulanceOption, CandidateHospitalOption
} from '@/types'

interface BookingWithMatch extends Booking {
  matchResult?: MatchResult
  expanded?: boolean
}

const ACTIVE_STATUSES = ['pending', 'searching']
const TRIP_STATUSES = ['en_route_pickup', 'arrived_pickup', 'patient_onboard', 'en_route_destination', 'handoff_recorded']

const SCENARIOS: { id: TrafficScenario; label: string; desc: string }[] = [
  { id: 'live', label: 'Live Traffic API', desc: 'Real-time normal traffic factor (1.0x)' },
  { id: 'moderate', label: 'Moderate Traffic', desc: 'Peak congestion (+30% delay, 1.3x)' },
  { id: 'heavy', label: 'Heavy / Monsoon Rain', desc: 'Severe slowdown (+70% delay, 1.7x)' },
  { id: 'gridlock', label: 'Gridlock / Flash Flood', desc: 'Emergency gridlock (+120% delay, 2.2x)' },
]

export default function OperatorDispatch() {
  const [activeTab, setActiveTab] = useState<'incidents' | 'bookings' | 'trips'>('incidents')
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<TrafficScenario>('live')
  const [incidentOptions, setIncidentOptions] = useState<IncidentOptions | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)

  const [requests, setRequests] = useState<BookingWithMatch[]>([])
  const [activeTrips, setActiveTrips] = useState<Booking[]>([])
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const fetchData = useCallback(async () => {
    try {
      const [bookingsRes, ambsRes, incsRes] = await Promise.all([
        api.get<Booking[]>('/bookings?page_size=50'),
        api.get<Ambulance[]>('/ambulances?page_size=50'),
        api.get<Incident[]>('/api/incidents'),
      ])
      const bookingsData = Array.isArray(bookingsRes.data) ? bookingsRes.data : []
      const ambsData = Array.isArray(ambsRes.data) ? ambsRes.data : []
      const incsData = Array.isArray(incsRes.data) ? incsRes.data : []

      const pending = bookingsData.filter(b => ACTIVE_STATUSES.includes(b.status))
      const active = bookingsData.filter(b => TRIP_STATUSES.includes(b.status))
      setRequests(pending)
      setActiveTrips(active)
      setAmbulances(ambsData)
      setIncidents(incsData)

      // If an incident was selected, refresh its data
      if (selectedIncident) {
        const updated = incsData.find(i => i.id === selectedIncident.id)
        if (updated) setSelectedIncident(updated)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dispatch data.')
    } finally {
      setLoading(false)
    }
  }, [selectedIncident])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 20000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Fetch ranked options for an incident
  const loadOptionsForIncident = async (inc: Incident, scenario: TrafficScenario) => {
    setSelectedIncident(inc)
    setSelectedScenario(scenario)
    setLoadingOptions(true)
    try {
      const res = await api.get<IncidentOptions>(`/api/incidents/${inc.id}/options?scenario=${scenario}`)
      setIncidentOptions(res.data)
    } catch (err: any) {
      showToast('Failed to load routing options: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoadingOptions(false)
    }
  }

  const handleVerifyIncident = async (id: string) => {
    setActionLoading(id + '_verify')
    try {
      await api.post(`/api/incidents/${id}/verify`)
      showToast('✓ Incident verified and confirmed active.')
      fetchData()
    } catch (err: any) {
      showToast('Failed to verify incident: ' + (err.response?.data?.detail || err.message))
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssignIncidentAmbulance = async (incidentId: string, ambulanceId: string) => {
    setActionLoading(incidentId + '_assign')
    try {
      const res = await api.post(`/api/incidents/${incidentId}/assign`, {
        ambulance_id: ambulanceId,
        commit_message: `Dispatched ambulance under ${selectedScenario.toUpperCase()} scenario`,
      })
      showToast(`✓ Ambulance dispatched! ${res.data.police_alerted ? '🚨 Police Corridor Notified!' : ''}`)
      fetchData()
      if (selectedIncident?.id === incidentId) {
        loadOptionsForIncident({ ...selectedIncident, assigned_ambulance_id: ambulanceId, status: 'dispatched' }, selectedScenario)
      }
    } catch (err: any) {
      showToast('Failed to assign ambulance: ' + (err.response?.data?.detail || err.message))
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssignIncidentHospital = async (incidentId: string, hospitalId: string) => {
    setActionLoading(incidentId + '_hosp')
    try {
      await api.post(`/api/incidents/${incidentId}/hospital`, { hospital_id: hospitalId })
      showToast('✓ Receiving hospital assigned and pre-notified!')
      fetchData()
      if (selectedIncident?.id === incidentId) {
        loadOptionsForIncident({ ...selectedIncident, hospital_id: hospitalId }, selectedScenario)
      }
    } catch (err: any) {
      showToast('Failed to assign hospital: ' + (err.response?.data?.detail || err.message))
    } finally {
      setActionLoading(null)
    }
  }

  const handleCloseIncident = async (incidentId: string) => {
    setActionLoading(incidentId + '_close')
    try {
      await api.post(`/api/incidents/${incidentId}/close`)
      showToast('✓ Incident closed and logged to audit trail.')
      fetchData()
      setSelectedIncident(null)
      setIncidentOptions(null)
    } catch (err: any) {
      showToast('Failed to close incident: ' + (err.response?.data?.detail || err.message))
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelIncident = async (incidentId: string) => {
    setActionLoading(incidentId + '_cancel')
    try {
      await api.post(`/api/incidents/${incidentId}/cancel`)
      showToast('Incident marked as cancelled.')
      fetchData()
      setSelectedIncident(null)
      setIncidentOptions(null)
    } catch (err: any) {
      showToast('Failed to cancel incident: ' + (err.response?.data?.detail || err.message))
    } finally {
      setActionLoading(null)
    }
  }

  // Booking handlers
  const handleMatchBooking = async (bookingId: string) => {
    setActionLoading(bookingId + '_match')
    try {
      const res = await api.post<MatchResult>(`/bookings/${bookingId}/match`)
      setRequests(prev => prev.map(b =>
        b.id === bookingId ? { ...b, matchResult: res.data, expanded: true } : b
      ))
    } catch (err: any) {
      showToast('Matching failed: ' + (err.response?.data?.detail || 'Unknown error'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcceptBooking = async (bookingId: string, ambulanceId: string) => {
    setActionLoading(bookingId + '_accept')
    try {
      await api.post(`/bookings/${bookingId}/accept?ambulance_id=${ambulanceId}`)
      showToast('✓ Booking accepted and ambulance dispatched!')
      fetchData()
    } catch (err: any) {
      showToast('Failed to accept: ' + (err.response?.data?.detail || 'Unknown error'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectBooking = async (bookingId: string) => {
    setActionLoading(bookingId + '_reject')
    try {
      await api.post(`/bookings/${bookingId}/reject?reason=Operator%20rejected`)
      showToast('Booking rejected.')
      fetchData()
    } catch (err: any) {
      showToast('Failed to reject: ' + (err.response?.data?.detail || 'Unknown error'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleBookingStatusUpdate = async (bookingId: string, status: string) => {
    setActionLoading(bookingId + '_status')
    try {
      await api.post(`/bookings/${bookingId}/status`, { status, note: `Status updated to ${status}` })
      showToast(`Status updated to ${status.replace(/_/g, ' ')}`)
      fetchData()
    } catch (err: any) {
      showToast('Failed to update status: ' + (err.response?.data?.detail || 'Unknown error'))
    } finally {
      setActionLoading(null)
    }
  }

  const STATUS_FLOW: Record<string, string> = {
    accepted: 'en_route_pickup',
    en_route_pickup: 'arrived_pickup',
    arrived_pickup: 'patient_onboard',
    patient_onboard: 'en_route_destination',
    en_route_destination: 'handoff_recorded',
    handoff_recorded: 'completed',
  }

  // Build map markers for OpenStreetMap
  const mapMarkers = [
    // Incidents
    ...incidents.filter(i => !['closed', 'cancelled'].includes(i.status)).map(i => ({
      lat: i.latitude,
      lng: i.longitude,
      type: 'pickup' as const,
      title: `[Incident #${i.id}] ${i.severity.toUpperCase()}`,
      description: `${i.description} (${i.status}) - ${i.location_name}`,
    })),
    // Ambulances
    ...ambulances.filter(a => a.last_latitude && a.last_longitude).map(a => ({
      lat: a.last_latitude!,
      lng: a.last_longitude!,
      type: 'ambulance' as const,
      title: a.registration_number,
      description: `${a.category.toUpperCase()} · Status: ${a.status} · ${a.driver?.full_name || 'Unassigned'}`,
    })),
    // Bookings
    ...requests.map(r => ({
      lat: r.pickup_latitude,
      lng: r.pickup_longitude,
      type: 'pickup' as const,
      title: `[Booking] ${r.reference_number}`,
      description: `${r.pickup_address} (${r.status})`,
    })),
  ]

  const activeIncidents = incidents.filter(i => !['closed', 'cancelled'].includes(i.status))

  return (
    <DashboardLayout>
      <PageHeader
        title="Emergency Dispatch Centre"
        subtitle="Live incident response, traffic simulation routing, and patient dispatches"
        action={
          <button onClick={fetchData} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {/* Floating Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium border border-gray-700 animate-slide-in">
          {toast}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Live OpenStreetMap Console Overview */}
      <div className="mb-6 card overflow-hidden border-2 border-primary-200 shadow-md">
        <div className="p-3 bg-gradient-to-r from-navy via-primary-900 to-primary-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-green-400 animate-pulse" />
            <h3 className="text-sm font-bold tracking-wide">Live Dispatch Map · OpenStreetMap Kerala</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/80">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
              {activeIncidents.length} Incidents
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
              {ambulances.filter(a => a.status === 'available').length} Ambulances Ready
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              {requests.length} Pending Bookings
            </span>
          </div>
        </div>
        <div className="h-72 w-full relative">
          <OpenStreetMap
            center={
              selectedIncident
                ? [selectedIncident.latitude, selectedIncident.longitude]
                : [10.02, 76.32] // Kochi / Kerala hub
            }
            zoom={selectedIncident ? 13 : 11}
            markers={mapMarkers}
            height="100%"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'incidents'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Road Accidents & Incidents
          {activeIncidents.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
              {activeIncidents.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'bookings'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          Patient Bookings
          {requests.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
              {requests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'trips'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          Active In-Transit Trips
          {activeTrips.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
              {activeTrips.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-primary-700 animate-spin" /></div>
      ) : (
        <>
          {/* TAB 1: ROAD ACCIDENTS & INCIDENTS (From IntelliTraffic AI) */}
          {activeTab === 'incidents' && (
            <div className="grid lg:grid-cols-12 gap-6">
              {/* Left Column: Incidents List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-900">Incident Queue</h3>
                  <span className="text-xs text-gray-500">{incidents.length} total</span>
                </div>

                {incidents.length === 0 ? (
                  <EmptyState title="No incidents recorded" description="Citizen emergency reports and automated crash alerts will appear here." />
                ) : (
                  incidents.map((inc) => {
                    const isSelected = selectedIncident?.id === inc.id
                    const isCritical = inc.severity === 'critical'
                    return (
                      <div
                        key={inc.id}
                        onClick={() => loadOptionsForIncident(inc, selectedScenario)}
                        className={`card p-4 cursor-pointer transition-all border-2 ${
                          isSelected
                            ? 'border-red-500 bg-red-50/20 shadow-md ring-1 ring-red-400'
                            : 'border-transparent hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gray-700">#{inc.id}</span>
                            <span className={`px-2 py-0.5 text-xs font-extrabold uppercase rounded-full ${
                              isCritical ? 'bg-red-600 text-white animate-pulse' :
                              inc.severity === 'high' ? 'bg-orange-500 text-white' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {inc.severity}
                            </span>
                            <StatusBadge status={inc.status} />
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">{inc.description}</p>
                        <p className="text-xs text-gray-600 flex items-center gap-1 mb-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{inc.location_name}</span>
                        </p>

                        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                          <span>Caller: {inc.reporter_phone || 'Emergency App'}</span>
                          <span className="font-semibold text-primary-700">
                            {inc.assigned_ambulance_id ? '✓ Ambulance Assigned' : 'Needs Dispatch'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Right Column: Routing & Dispatch Decision Engine */}
              <div className="lg:col-span-7">
                {selectedIncident ? (
                  <div className="card p-5 space-y-6">
                    {/* Header */}
                    <div className="border-b pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-gray-900">Incident #{selectedIncident.id}</h2>
                          <StatusBadge status={selectedIncident.status} />
                        </div>
                        <div className="flex gap-2">
                          {selectedIncident.status === 'reported' && (
                            <button
                              onClick={() => handleVerifyIncident(selectedIncident.id)}
                              disabled={!!actionLoading}
                              className="btn-primary text-xs py-1.5 px-3 gap-1.5 bg-blue-600 hover:bg-blue-700"
                            >
                              {actionLoading === selectedIncident.id + '_verify' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                              Verify Incident
                            </button>
                          )}
                          {!['closed', 'cancelled'].includes(selectedIncident.status) && (
                            <button
                              onClick={() => handleCloseIncident(selectedIncident.id)}
                              disabled={!!actionLoading}
                              className="btn-secondary text-xs py-1.5 px-3 gap-1"
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-700">{selectedIncident.description}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-primary-600" />
                        {selectedIncident.location_name} ({selectedIncident.latitude.toFixed(4)}, {selectedIncident.longitude.toFixed(4)})
                      </p>
                    </div>

                    {/* Traffic Simulation Selector */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
                          <Compass className="w-4 h-4 text-primary-600" />
                          Traffic Simulation Scenario
                        </label>
                        <span className="text-xs text-primary-700 font-semibold">Dynamic Speed Factor Applied</span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {SCENARIOS.map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => loadOptionsForIncident(selectedIncident, sc.id)}
                            className={`p-2.5 rounded-lg text-left border transition-all ${
                              selectedScenario === sc.id
                                ? 'bg-primary-50 border-primary-600 ring-1 ring-primary-500'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <p className="text-xs font-bold text-gray-900">{sc.label}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{sc.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Routing Calculation Results */}
                    {loadingOptions ? (
                      <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        <span className="text-xs">Calculating distance, clinical scores, and traffic ETA...</span>
                      </div>
                    ) : incidentOptions ? (
                      <div className="space-y-6">
                        {/* Candidate Ambulances */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-green-600" />
                              Ranked Ambulances ({incidentOptions.ambulances.length})
                            </h4>
                            <span className="text-xs text-gray-500">Fastest arrival first</span>
                          </div>

                          <div className="space-y-2">
                            {incidentOptions.ambulances.map((amb, idx) => {
                              const isAssigned = selectedIncident.assigned_ambulance_id === amb.ambulance_id
                              return (
                                <div
                                  key={amb.ambulance_id}
                                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    isAssigned
                                      ? 'bg-green-50/50 border-green-500'
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      <p className="text-sm font-bold text-gray-900">{amb.registration_number}</p>
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 uppercase">
                                        {amb.category}
                                      </span>
                                      {isAssigned && (
                                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                          DISPATCHED
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">
                                      Driver: <strong>{amb.driver_name}</strong> ({amb.driver_phone}) · Distance: {amb.distance_km} km
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-xs">
                                      <span className="text-green-700 font-bold">
                                        ETA: ~{Math.round(amb.eta_minutes)} min
                                      </span>
                                      <span className="text-gray-400 line-through">
                                        Baseline: ~{Math.round(amb.baseline_eta)} min
                                      </span>
                                      {amb.minutes_saved > 0 && (
                                        <span className="text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                                          ⚡ Saves {Math.round(amb.minutes_saved)} min
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleAssignIncidentAmbulance(selectedIncident.id, amb.ambulance_id)}
                                      disabled={!!actionLoading || isAssigned}
                                      className={`text-xs py-2 px-3 rounded-lg font-bold transition-colors ${
                                        isAssigned
                                          ? 'bg-green-600 text-white cursor-default'
                                          : 'btn-primary bg-primary-700 hover:bg-primary-800'
                                      }`}
                                    >
                                      {actionLoading === selectedIncident.id + '_assign' ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : isAssigned ? (
                                        '✓ Dispatched'
                                      ) : (
                                        'Commit & Alert Police'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Candidate Receiving Hospitals */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                              <HospitalIcon className="w-4 h-4 text-blue-600" />
                              Ranked Destination Hospitals ({incidentOptions.hospitals.length})
                            </h4>
                            <span className="text-xs text-gray-500">Score based on ER beds & capabilities</span>
                          </div>

                          <div className="space-y-2">
                            {incidentOptions.hospitals.map((hosp, idx) => {
                              const isAssigned = selectedIncident.hospital_id === hosp.hospital_id
                              return (
                                <div
                                  key={hosp.hospital_id}
                                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    isAssigned
                                      ? 'bg-blue-50/50 border-blue-500'
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      <p className="text-sm font-bold text-gray-900">{hosp.name}</p>
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                        Score: {hosp.clinical_score.toFixed(1)}/10
                                      </span>
                                      {isAssigned && (
                                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                          ASSIGNED
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">
                                      Distance: {hosp.distance_km} km · ETA: ~{Math.round(hosp.eta_minutes)} min ·
                                      ER Beds: <strong className={hosp.er_beds < 5 ? 'text-amber-600' : 'text-green-600'}>{hosp.er_beds} available</strong>
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {hosp.clinical_capabilities.map((c) => (
                                        <span key={c} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                    {hosp.freshness_warning && (
                                      <p className="text-[11px] text-amber-600 mt-1">⚠️ {hosp.freshness_warning}</p>
                                    )}
                                  </div>

                                  <div>
                                    <button
                                      onClick={() => handleAssignIncidentHospital(selectedIncident.id, hosp.hospital_id)}
                                      disabled={!!actionLoading || isAssigned}
                                      className={`text-xs py-2 px-3 rounded-lg font-bold transition-colors ${
                                        isAssigned
                                          ? 'bg-blue-600 text-white cursor-default'
                                          : 'btn-secondary hover:bg-blue-50 hover:text-blue-700'
                                      }`}
                                    >
                                      {actionLoading === selectedIncident.id + '_hosp' ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : isAssigned ? (
                                        '✓ Assigned'
                                      ) : (
                                        'Select Hospital'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="card p-12 text-center text-gray-500">
                    <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-700">Select an incident from the queue</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose an incident to view live routing options, test traffic scenarios, and dispatch ambulances with police safety coordination.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PATIENT BOOKING REQUESTS */}
          {activeTab === 'bookings' && (
            <div>
              {requests.length === 0 ? (
                <EmptyState title="No pending booking requests" description="Incoming patient booking requests will appear here for ambulance assignment." />
              ) : (
                <div className="space-y-3">
                  {requests.map(req => (
                    <div key={req.id} className="card overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-bold text-primary-700">{req.reference_number}</span>
                              <StatusBadge status={req.status} />
                              {req.is_demo && <span className="demo-banner">DEMO</span>}
                            </div>
                            <p className="text-xs text-gray-500 capitalize">{(req.requested_category || '').replace(/_/g, ' ')} · {req.booking_type}</p>
                          </div>
                          <p className="text-xs text-gray-400">{new Date(req.created_at).toLocaleTimeString()}</p>
                        </div>

                        <div className="flex items-start gap-2 mb-3">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700">{req.pickup_address}</p>
                        </div>

                        {req.patient_name && (
                          <p className="text-xs text-gray-600 mb-3">
                            Patient: <strong>{req.patient_name}</strong>
                            {req.patient_age && ` · Age: ${req.patient_age}`}
                          </p>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMatchBooking(req.id)}
                            disabled={!!actionLoading}
                            className="btn-primary text-xs py-1.5 px-3 gap-1.5"
                          >
                            {actionLoading === req.id + '_match' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                            Find Ambulances
                          </button>
                          <button
                            onClick={() => handleRejectBooking(req.id)}
                            disabled={!!actionLoading}
                            className="btn-danger text-xs py-1.5 px-3 gap-1.5"
                          >
                            {actionLoading === req.id + '_reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                            Reject
                          </button>
                        </div>

                        {/* Match results */}
                        {req.matchResult && (
                          <div className="mt-4 border-t pt-4">
                            <p className="text-xs font-semibold text-gray-700 mb-2">
                              Available Matches ({req.matchResult.candidates.length})
                              <span className="ml-2 text-gray-400 font-normal">{req.matchResult.routing_provider}</span>
                            </p>
                            {req.matchResult.candidates.length === 0 ? (
                              <p className="text-xs text-red-600">{req.matchResult.matching_notes}</p>
                            ) : (
                              <div className="space-y-2">
                                {req.matchResult.candidates.map(c => (
                                  <div key={c.ambulance_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                      <p className="text-xs font-bold text-gray-900">{c.registration_number}</p>
                                      <p className="text-xs text-gray-500">
                                        {c.category} · {c.distance_km?.toFixed(1)} km
                                        {c.estimated_eta_minutes != null && ` · ~${Math.round(c.estimated_eta_minutes)} min`}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleAcceptBooking(req.id, c.ambulance_id)}
                                      disabled={!!actionLoading}
                                      className="btn-primary text-xs py-1 px-3 gap-1"
                                    >
                                      {actionLoading === req.id + '_accept' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                      Accept & Dispatch
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVE TRIPS */}
          {activeTab === 'trips' && (
            <div>
              {activeTrips.length === 0 ? (
                <EmptyState title="No active trips in transit" description="Trips will appear here once an ambulance is accepted and begins transit." />
              ) : (
                <div className="space-y-3">
                  {activeTrips.map(trip => {
                    const nextStatus = STATUS_FLOW[trip.status]
                    return (
                      <div key={trip.id} className="card p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-bold text-primary-700">{trip.reference_number}</span>
                              <StatusBadge status={trip.status} />
                            </div>
                            <p className="text-xs text-gray-500">{trip.patient_name || 'Patient'} · {trip.requested_category}</p>
                          </div>
                          {trip.eta_minutes != null && (
                            <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded-lg">
                              ETA ~{Math.round(trip.eta_minutes)}m
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-gray-400" /> Pickup: {trip.pickup_address}</p>
                          {trip.destination_address && (
                            <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-primary-600" /> Destination: {trip.destination_address}</p>
                          )}
                        </div>

                        {nextStatus && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleBookingStatusUpdate(trip.id, nextStatus)}
                              disabled={!!actionLoading}
                              className="btn-primary text-xs py-1.5 px-3 gap-1"
                            >
                              {actionLoading === trip.id + '_status' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                              Advance to: {nextStatus.replace(/_/g, ' ')}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
