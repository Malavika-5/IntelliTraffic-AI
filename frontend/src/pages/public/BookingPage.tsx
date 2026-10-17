import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Ambulance, Clock, AlertCircle, CheckCircle, ArrowRight,
  Navigation, Phone, ChevronRight, Loader2, Info, RefreshCw, ShieldAlert
} from 'lucide-react'
import { PublicNavbar } from '@/components/layout/Navbar'
import api from '@/services/api'
import type { MatchResult, MatchCandidate, Booking } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import OpenStreetMap, { MapMarker } from '@/components/map/OpenStreetMap'

const CATEGORIES = [
  { value: 'basic', label: 'Basic Life Support', desc: 'Standard patient transport', icon: '🚑' },
  { value: 'als', label: 'Advanced Life Support', desc: 'ALS equipped with trained paramedic', icon: '⚡' },
  { value: 'icu', label: 'ICU Ambulance', desc: 'Full mobile ICU for critical patients', icon: '🏥' },
  { value: 'neonatal', label: 'Neonatal Transport', desc: 'Specialist neonatal incubator unit', icon: '👶' },
  { value: 'wheelchair', label: 'Wheelchair Accessible', desc: 'Accessible vehicle for mobility needs', icon: '♿' },
  { value: 'non_emergency', label: 'Non-Emergency Transport', desc: 'Dialysis, appointments, discharge', icon: '🏨' },
]

type Step = 'location' | 'category' | 'matching' | 'confirm'

export default function BookingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('location')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)

  // Location step
  const [pickup, setPickup] = useState({ lat: 0, lon: 0, address: '', landmark: '' })
  const [dest, setDest] = useState({ address: '' })
  const [hasGps, setHasGps] = useState(false)

  // Category step
  const [category, setCategory] = useState('')
  const [patientName, setPatientName] = useState(user?.full_name || '')
  const [patientAge, setPatientAge] = useState('')
  const [patientNotes, setPatientNotes] = useState('')
  const [contactPhone, setContactPhone] = useState(user?.phone || '')
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergency_contact_phone || user?.phone || '')
  const [emergencyName, setEmergencyName] = useState(user?.emergency_contact_name || '')

  useEffect(() => {
    if (user) {
      if (!patientName && user.full_name) setPatientName(user.full_name)
      if (!contactPhone && user.phone) setContactPhone(user.phone)
      if (!emergencyPhone && (user.emergency_contact_phone || user.phone)) {
        setEmergencyPhone(user.emergency_contact_phone || user.phone || '')
      }
      if (!emergencyName && user.emergency_contact_name) {
        setEmergencyName(user.emergency_contact_name)
      }
    }
  }, [user])

  // Match step
  const [booking, setBooking] = useState<Booking | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidate | null>(null)

  const getGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Please enter address manually.')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup(p => ({
          ...p,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          address: p.address || `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        }))
        setHasGps(true)
        setGpsLoading(false)
      },
      (err) => {
        setError('Could not get GPS location: ' + err.message + '. Please enter address manually.')
        setGpsLoading(false)
      },
      { timeout: 10000 }
    )
  }

  const handleLocationNext = () => {
    if (!pickup.address.trim()) {
      setError('Please enter a pickup address or use GPS.')
      return
    }
    if (!hasGps) {
      // Use approximate Kochi coords for demo
      setPickup(p => ({ ...p, lat: 9.9312 + Math.random() * 0.05, lon: 76.2673 + Math.random() * 0.05 }))
    }
    setError('')
    setStep('category')
  }

  const handleCategoryNext = async () => {
    if (!category) {
      setError('Please select a transport category.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.post<Booking>('/bookings', {
        booking_type: 'emergency',
        requested_category: category,
        pickup_latitude: pickup.lat,
        pickup_longitude: pickup.lon,
        pickup_address: pickup.address,
        pickup_landmark: pickup.landmark || undefined,
        destination_address: dest.address || undefined,
        patient_name: patientName || undefined,
        patient_age: patientAge || undefined,
        patient_notes: patientNotes || undefined,
        contact_phone: contactPhone || undefined,
        emergency_contact_phone: emergencyPhone || undefined,
        emergency_contact_name: emergencyName || undefined,
      })
      setBooking(res.data)
      setStep('matching')
      await runMatching(res.data.id)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create booking.')
    } finally {
      setLoading(false)
    }
  }

  const runMatching = async (bookingId: string) => {
    setLoading(true)
    try {
      const res = await api.post<MatchResult>(`/bookings/${bookingId}/match`)
      setMatchResult(res.data)
      if (res.data.best_match) {
        setSelectedCandidate(res.data.best_match)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Matching failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!booking || !selectedCandidate) return
    setLoading(true)
    setError('')
    try {
      await api.post(`/bookings/${booking.id}/accept?ambulance_id=${selectedCandidate.ambulance_id}`)
      navigate(`/track/${booking.id}`)
    } catch (err: any) {
      // If patient can't accept, just track
      navigate(`/track/${booking.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      {/* Emergency banner */}
      <div className="bg-red-600 text-white py-2 text-center text-xs font-semibold">
        <Phone className="inline w-3 h-3 mr-1" /> Life-threatening emergency? Call <strong>112</strong> immediately — do not wait for this app.
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {(['location', 'category', 'matching', 'confirm'] as Step[]).map((s, i) => {
            const stepIdx = ['location', 'category', 'matching', 'confirm'].indexOf(step)
            const idx = i
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  idx < stepIdx ? 'bg-green-500 text-white' :
                  idx === stepIdx ? 'bg-primary-700 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {idx < stepIdx ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < 3 && <div className={`flex-1 h-0.5 ${idx < stepIdx ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>

        {/* STEP 1: Location */}
        {step === 'location' && (
          <div className="card p-6">
            <h1 className="text-lg font-bold text-gray-900 mb-1">Pickup Location</h1>
            <p className="text-sm text-gray-500 mb-6">Where should the ambulance come to?</p>

            <div className="space-y-4">
              <div>
                <label className="label">Pickup Address <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter street address, locality..."
                  value={pickup.address}
                  onChange={(e) => setPickup(p => ({ ...p, address: e.target.value }))}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={getGps}
                  disabled={gpsLoading}
                  className="btn-secondary flex-1 gap-2"
                >
                  {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  {gpsLoading ? 'Getting location...' : 'Use GPS'}
                </button>
                {hasGps && (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">GPS active</span>
                  </div>
                )}
              </div>

              {/* Interactive OpenStreetMap Location Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary-700" /> Pin on OpenStreetMap
                  </label>
                  {pickup.lat && pickup.lon && (
                    <span className="text-[11px] font-mono text-gray-500">
                      {pickup.lat.toFixed(4)}, {pickup.lon.toFixed(4)}
                    </span>
                  )}
                </div>
                <OpenStreetMap
                  height="220px"
                  center={[pickup.lat || 8.5241, pickup.lon || 76.9366]}
                  markers={pickup.lat && pickup.lon ? [{
                    id: 'pickup',
                    lat: pickup.lat,
                    lng: pickup.lon,
                    type: 'pickup',
                    title: 'Pickup Location',
                    badge: 'Pickup',
                  }] : []}
                  onLocationSelect={(coords) => {
                    setPickup(p => ({
                      ...p,
                      lat: coords.lat,
                      lon: coords.lng,
                      address: p.address || `Pinned at ${coords.lat}, ${coords.lng}`,
                    }))
                    setHasGps(true)
                  }}
                />
              </div>

              <div>
                <label className="label">Landmark <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Near hospital, landmark, junction..."
                  value={pickup.landmark}
                  onChange={(e) => setPickup(p => ({ ...p, landmark: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Destination <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Hospital or destination address"
                  value={dest.address}
                  onChange={(e) => setDest({ address: e.target.value })}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button onClick={handleLocationNext} className="btn-primary w-full">
                Next: Select Category <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Category */}
        {step === 'category' && (
          <div className="card p-6">
            <h1 className="text-lg font-bold text-gray-900 mb-1">Transport Category</h1>
            <p className="text-sm text-gray-500 mb-2">Select the type of ambulance needed.</p>
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                If unsure of the required category, please call <strong>112</strong> or consult a healthcare professional.
                Categories are operator-declared and not clinically validated.
              </p>
            </div>

            <div className="grid gap-3 mb-6">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    category === cat.value
                      ? 'border-primary-700 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${category === cat.value ? 'text-primary-700' : 'text-gray-900'}`}>
                        {cat.label}
                      </p>
                      <p className="text-xs text-gray-500">{cat.desc}</p>
                    </div>
                    {category === cat.value && <CheckCircle className="w-5 h-5 text-primary-700 ml-auto" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Patient Name</label>
                  <input type="text" className="input-field" value={patientName}
                    onChange={(e) => setPatientName(e.target.value)} placeholder="Patient's full name" />
                </div>
                <div>
                  <label className="label">Age</label>
                  <input type="text" className="input-field" value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)} placeholder="e.g. 45" />
                </div>
              </div>
              <div>
                <label className="label">Contact Phone</label>
                <input type="tel" className="input-field" value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>

              {/* Emergency Contact To Alert Automatically */}
              <div className="bg-red-50/80 border border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-bold text-red-900 uppercase tracking-wider">
                      Emergency Contact Notification (SMS)
                    </span>
                  </div>
                  <span className="text-[10px] bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded-full border border-red-200">
                    Auto-Dispatched on Booking
                  </span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  Your emergency contact saved during login or registration will be informed automatically via instant SMS with your live ambulance tracking link.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Emergency Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      className="input-field bg-white"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="+91 98401 23456"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Contact Name / Relation <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      className="input-field bg-white"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="e.g. Spouse / Parent / Friend"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Notes for Crew</label>
                <textarea className="input-field resize-none" rows={2} value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  placeholder="Any medical conditions, access notes..." />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setError(''); setStep('location') }} className="btn-ghost">Back</button>
              <button onClick={handleCategoryNext} disabled={loading} className="btn-primary flex-1">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating booking...</> : <>Find Ambulances <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Matching */}
        {step === 'matching' && (
          <div className="card p-6">
            <h1 className="text-lg font-bold text-gray-900 mb-1">Available Ambulances</h1>
            {booking && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500">Booking ref:</span>
                <span className="text-xs font-mono font-bold text-primary-700">{booking.reference_number}</span>
                <span className="demo-banner">DEMO DATA</span>
              </div>
            )}

            {booking && booking.emergency_contact_notified && (
              <div className="flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl mb-4 text-left">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-900">
                    Emergency Contact Informed via SMS
                  </p>
                  <p className="text-emerald-700 mt-0.5">
                    Live GPS tracking alert was dispatched to <strong>{booking.emergency_contact_phone}</strong> {booking.emergency_contact_name ? `(${booking.emergency_contact_name})` : ''}.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center py-12 gap-4">
                <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-primary-700 animate-spin" />
                </div>
                <p className="text-sm font-medium text-gray-700">Searching for eligible ambulances...</p>
                <p className="text-xs text-gray-500">Checking availability and estimating travel times</p>
              </div>
            )}

            {!loading && matchResult && (
              <>
                {matchResult.candidates.length === 0 ? (
                  <div className="py-10 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-800">No eligible ambulances found</p>
                    <p className="text-xs text-gray-500 mt-1 mb-4">{matchResult.matching_notes}</p>
                    <p className="text-xs text-red-600 font-medium">If this is an emergency, call <strong>112</strong> immediately.</p>
                    <button onClick={() => booking && runMatching(booking.id)} className="btn-secondary mt-4 gap-2">
                      <RefreshCw className="w-4 h-4" /> Try Again
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    <p className="text-xs text-gray-500">{matchResult.matching_notes}</p>

                    {/* Candidate Map */}
                    <OpenStreetMap
                      height="220px"
                      center={[pickup.lat || 8.5241, pickup.lon || 76.9366]}
                      markers={[
                        {
                          id: 'pickup',
                          lat: pickup.lat || 8.5241,
                          lng: pickup.lon || 76.9366,
                          type: 'pickup',
                          title: 'Your Location',
                          badge: 'Pickup',
                        },
                        ...matchResult.candidates.map((c, i) => ({
                          id: c.ambulance_id,
                          lat: (pickup.lat || 8.5241) + ((i % 2 === 0 ? 1 : -1) * (0.008 + i * 0.005)),
                          lng: (pickup.lon || 76.9366) + ((i % 3 === 0 ? 1 : -1) * (0.009 + i * 0.004)),
                          type: 'ambulance' as const,
                          title: c.registration_number,
                          description: `${c.category} · ~${Math.round(c.estimated_eta_minutes || 0)} min away`,
                          badge: c.registration_number,
                          eta_min: c.estimated_eta_minutes,
                          km: c.distance_km,
                        })),
                      ]}
                    />
                    {matchResult.candidates.map((c) => (
                      <div
                        key={c.ambulance_id}
                        onClick={() => setSelectedCandidate(c)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedCandidate?.ambulance_id === c.ambulance_id
                            ? 'border-primary-700 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{c.registration_number}</p>
                            {c.vehicle_name && <p className="text-xs text-gray-500">{c.vehicle_name}</p>}
                          </div>
                          <div className="text-right">
                            {c.estimated_eta_minutes != null && (
                              <div className="flex items-center gap-1 text-green-700 font-bold text-sm">
                                <Clock className="w-3.5 h-3.5" />
                                ~{Math.round(c.estimated_eta_minutes)} min
                              </div>
                            )}
                            {c.distance_km != null && (
                              <p className="text-xs text-gray-500">{c.distance_km.toFixed(1)} km away</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                            {c.category}
                          </span>
                          <span className="text-xs text-gray-600">{c.operator_name}</span>
                          {c.location_age_minutes != null && c.location_age_minutes > 10 && (
                            <span className="text-xs text-amber-600">Location: {Math.round(c.location_age_minutes)}m old</span>
                          )}
                        </div>
                        {selectedCandidate?.ambulance_id === c.ambulance_id && (
                          <div className="flex items-center gap-1 mt-2 text-primary-700">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-semibold">Selected</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {matchResult.candidates.length > 0 && (
                  <div className="flex gap-3">
                    <button onClick={() => navigate('/my-bookings')} className="btn-ghost">View Bookings</button>
                    <button
                      onClick={handleAccept}
                      disabled={!selectedCandidate || loading}
                      className="btn-primary flex-1"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirm & Track <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mt-4">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
