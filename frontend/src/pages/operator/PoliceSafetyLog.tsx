import { useState, useEffect } from 'react'
import {
  Shield, Radio, AlertTriangle, Phone, MapPin, RefreshCw,
  Loader2, CheckCircle2, Clock, Car, ExternalLink
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { OpenStreetMap } from '@/components/map/OpenStreetMap'
import api from '@/services/api'
import type { PoliceNotification, PoliceStation } from '@/types'

export default function PoliceSafetyLog() {
  const [notifications, setNotifications] = useState<PoliceNotification[]>([])
  const [stations, setStations] = useState<PoliceStation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [notifsRes, stationsRes] = await Promise.all([
        api.get<PoliceNotification[]>('/api/police-notifications'),
        api.get<PoliceStation[]>('/api/police-stations'),
      ])
      setNotifications(notifsRes.data)
      setStations(stationsRes.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch police corridor notifications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Map markers for police stations and recent alerts
  const mapMarkers = [
    ...stations.map((ps) => ({
      lat: ps.latitude,
      lng: ps.longitude,
      type: 'police' as const,
      title: ps.name,
      description: `Emergency Control: ${ps.phone}`,
    })),
  ]

  return (
    <DashboardLayout>
      <PageHeader
        title="Police Safety & Green Corridor Log"
        subtitle="Automated high-priority corridor alerts dispatched to Kerala Traffic Police stations"
        action={
          <button onClick={fetchData} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Police Stations OpenStreetMap */}
      <div className="card overflow-hidden mb-6 border border-primary-200 shadow-sm">
        <div className="p-3 bg-gradient-to-r from-navy to-primary-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Kerala Traffic Police Stations Network</h3>
          </div>
          <span className="text-xs text-white/70">{stations.length} Active Stations Linked</span>
        </div>
        <div className="h-64 w-full">
          <OpenStreetMap
            center={[9.98, 76.30]}
            zoom={11}
            markers={mapMarkers}
            height="100%"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary-700 animate-spin" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Notification Stream */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-600 animate-pulse" />
                Live Corridor Broadcast Stream ({notifications.length})
              </h3>
              <span className="text-xs text-gray-500">Real-time police notification feed</span>
            </div>

            {notifications.length === 0 ? (
              <div className="card p-8 text-center text-gray-500">
                <p className="text-sm">No police alerts recorded yet.</p>
                <p className="text-xs mt-1 text-gray-400">When ambulances are dispatched to high-severity incidents, green-corridor notices are pushed automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="card p-4 border-l-4 border-l-red-600 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-gray-500">#{n.id}</span>
                          <span className="px-2 py-0.5 text-xs font-extrabold uppercase rounded bg-red-100 text-red-800">
                            {n.level}
                          </span>
                          <span className="text-xs font-semibold text-gray-700">
                            Target: {n.station_name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 font-medium mt-2 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded font-bold mt-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" /> Delivered
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registered Police Stations */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary-700" />
              Connected Police Control Rooms
            </h3>

            <div className="space-y-2">
              {stations.map((st) => (
                <div key={st.id} className="card p-3.5 bg-gray-50/70 border border-gray-200">
                  <p className="text-sm font-bold text-gray-900">{st.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    GPS: {st.latitude.toFixed(4)}, {st.longitude.toFixed(4)}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/60">
                    <a
                      href={`tel:${st.phone}`}
                      className="text-xs text-primary-700 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3 h-3" /> {st.phone}
                    </a>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Online
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
