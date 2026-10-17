import React, { useState } from 'react'
import {
  AlertCircle, CheckCircle, MapPin, Camera, Navigation,
  Loader2, X, Phone, ShieldAlert
} from 'lucide-react'
import api from '@/services/api'
import OpenStreetMap from '@/components/map/OpenStreetMap'

interface IncidentReportModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (inc: any) => void
}

const CONDITIONS = [
  'general', 'cardiac', 'stroke', 'trauma', 'burns',
  'pregnancy', 'pediatric', 'respiratory'
]

export default function IncidentReportModal({ isOpen, onClose, onCreated }: IncidentReportModalProps) {
  const [form, setForm] = useState({
    address: '',
    description: '',
    condition: 'general',
    severity: 'moderate',
    lat: 8.5241,
    lng: 76.9366,
    photo: null as string | null,
    reporter: 'citizen',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [showMap, setShowMap] = useState(true)

  if (!isOpen) return null

  const handleLoc = () => {
    if (!navigator.geolocation) {
      setErr('Geolocation is not supported by your browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({
          ...prev,
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          address: prev.address || `Pinned at ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        }))
      },
      () => setErr('Location access blocked. Pick on map or enter manually.')
    )
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setErr('Photo too large. Maximum size is 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setForm(prev => ({ ...prev, photo: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim()) {
      setErr('Please enter what happened.')
      return
    }
    setLoading(true)
    setErr('')
    setMsg('')
    try {
      const res = await api.post('/incidents', {
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng),
      })
      setMsg(`${res.data.message} Reference #${res.data.id}.`)
      onCreated?.(res.data)
      setForm({
        address: '',
        description: '',
        condition: 'general',
        severity: 'moderate',
        lat: 8.5241,
        lng: 76.9366,
        photo: null,
        reporter: 'citizen',
      })
    } catch (e: any) {
      setErr(e.response?.data?.detail || e.message || 'Failed to submit report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="bg-red-600 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Report an Emergency Incident</h2>
              <p className="text-xs text-red-100 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" /> Life-threatening emergency? Call <strong>112</strong> immediately
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {msg ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-gray-900 text-base">Report Submitted Successfully</h3>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">{msg}</p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-primary text-sm px-6"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {err && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{err}</span>
                </div>
              )}

              {/* Location */}
              <div>
                <label className="label">Location / Landmark Description</label>
                <input
                  className="input-field"
                  placeholder="e.g. Near Pattom Junction, MG Road, Landmark..."
                  value={form.address}
                  onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>

              {/* Coordinates & OpenStreetMap Pin */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-600" /> Pin Accident Location (OpenStreetMap)
                  </label>
                  <button
                    type="button"
                    onClick={handleLoc}
                    className="text-xs text-primary-700 hover:text-primary-800 font-medium flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3" /> Use My GPS
                  </button>
                </div>

                <div className="mb-2">
                  <OpenStreetMap
                    height="200px"
                    center={[form.lat, form.lng]}
                    markers={[{
                      id: 'incident-pin',
                      lat: form.lat,
                      lng: form.lng,
                      type: 'incident',
                      title: 'Accident Scene',
                      badge: 'Scene',
                    }]}
                    onLocationSelect={(coords) => {
                      setForm(f => ({
                        ...f,
                        lat: coords.lat,
                        lng: coords.lng,
                        address: f.address || `Pinned at ${coords.lat}, ${coords.lng}`,
                      }))
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Latitude:</span>
                    <input
                      type="number"
                      step="any"
                      className="input-field text-xs py-1.5"
                      value={form.lat}
                      onChange={(e) => setForm(f => ({ ...f, lat: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <span className="text-gray-500">Longitude:</span>
                    <input
                      type="number"
                      step="any"
                      className="input-field text-xs py-1.5"
                      value={form.lng}
                      onChange={(e) => setForm(f => ({ ...f, lng: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              {/* Patient Condition & Severity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Patient Condition</label>
                  <select
                    className="input-field capitalize text-xs"
                    value={form.condition}
                    onChange={(e) => setForm(f => ({ ...f, condition: e.target.value }))}
                  >
                    {CONDITIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Severity Level</label>
                  <select
                    className="input-field capitalize text-xs"
                    value={form.severity}
                    onChange={(e) => setForm(f => ({ ...f, severity: e.target.value }))}
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="critical">Critical (High Urgency)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">What Happened? <span className="text-red-500">*</span></label>
                <textarea
                  className="input-field text-xs"
                  rows={3}
                  placeholder="Describe patient status, injuries, or accident scene..."
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="label">Scene Photo <span className="text-gray-400 font-normal">(optional, max 2MB)</span></label>
                <div className="flex items-center gap-3">
                  <label className="btn-secondary text-xs py-2 px-3 cursor-pointer gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Attach Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhoto}
                    />
                  </label>
                  {form.photo && (
                    <div className="flex items-center gap-2">
                      <img src={form.photo} alt="Preview" className="w-10 h-10 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, photo: null }))}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost flex-1 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !form.description.trim()}
                  className="btn-danger flex-1 text-xs py-2.5 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  Submit Emergency Alert
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

export { IncidentReportModal }

