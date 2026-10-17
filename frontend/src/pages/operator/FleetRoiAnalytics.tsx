import { useState, useEffect } from 'react'
import {
  TrendingUp, Clock, IndianRupee, Shield, Zap, Truck,
  CheckCircle, AlertCircle, RefreshCw, Loader2, Wrench, BarChart2
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/ui/StatsCard'
import api from '@/services/api'
import type { RoiSummary } from '@/types'

interface FleetVehicle {
  id: string
  registration_number: string
  vehicle_name?: string
  category: string
  status: string
  callsign?: string
  cost_per_km?: number
  km_run?: number
  trips?: number
  next_service?: string
  driver_name?: string
  driver_phone?: string
  capabilities?: string[]
}

export default function FleetRoiAnalytics() {
  const [roi, setRoi] = useState<RoiSummary | null>(null)
  const [fleet, setFleet] = useState<FleetVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [roiRes, fleetRes] = await Promise.all([
        api.get<RoiSummary>('/api/roi'),
        api.get<FleetVehicle[]>('/api/fleet'),
      ])
      setRoi(roiRes.data)
      setFleet(fleetRes.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch Fleet & ROI metrics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleUpdateStatus = async (aid: string, newStatus: string) => {
    setUpdatingId(aid)
    try {
      await api.post(`/api/ambulances/${aid}/status`, { status: newStatus })
      showToast(`Ambulance status changed to ${newStatus}`)
      fetchData()
    } catch (err: any) {
      showToast('Failed to update status: ' + (err.response?.data?.detail || err.message))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Fleet Management & Emergency ROI"
        subtitle="Real-time cost savings, minutes saved via AI traffic routing, and vehicle operational metrics"
        action={
          <button onClick={fetchData} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary-700 animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* ROI KPI Grid */}
          {roi && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                Emergency ROI & Algorithmic Impact
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="Minutes Saved vs Baseline"
                  value={`${roi.total_minutes_saved} min`}
                  subtitle="Through green corridors & adaptive routing"
                  icon={Clock}
                />
                <StatsCard
                  title="Estimated Savings"
                  value={`₹${roi.estimated_costs_saved_inr.toLocaleString()}`}
                  subtitle="Fuel, delay, & fleet utilization savings"
                  icon={IndianRupee}
                />
                <StatsCard
                  title="Green Corridors Active"
                  value={roi.active_green_corridors}
                  subtitle="Synchronized with Kerala Traffic Police"
                  icon={Shield}
                />
                <StatsCard
                  title="Response Acceleration"
                  value={`${roi.avg_response_speedup_pct}%`}
                  subtitle="Average transit speedup across scenarios"
                  icon={Zap}
                />
              </div>

              {/* Traffic Scenarios Analyzed */}
              {roi.scenario_distribution && (
                <div className="card p-4 mt-4 bg-gray-50/70 border border-gray-200">
                  <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                    Traffic Simulation Scenario Distribution
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(roi.scenario_distribution).map(([sc, count]) => (
                      <div key={sc} className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                        <span className="text-xs uppercase font-extrabold text-primary-700">{sc}</span>
                        <p className="text-lg font-black text-gray-900 mt-0.5">{count} runs</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fleet Vehicles Status and Cost Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Fleet Operational Matrix ({fleet.length} Ambulances)
                </h3>
                <p className="text-xs text-gray-500">Live service, kilometer tracking, and operational cost breakdown</p>
              </div>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase">
                  <tr>
                    <th className="py-3 px-4">Vehicle / Reg Number</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4">Trips Completed</th>
                    <th className="py-3 px-4">Total Run (km)</th>
                    <th className="py-3 px-4">Cost / km</th>
                    <th className="py-3 px-4">Next Service</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fleet.map((veh) => (
                    <tr key={veh.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {veh.registration_number}
                        {veh.callsign && (
                          <span className="block text-xs font-mono text-gray-500">Callsign: {veh.callsign}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-gray-100 text-gray-700">
                          {veh.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-700">
                        {veh.driver_name || 'Unassigned'}
                        {veh.driver_phone && <span className="block text-gray-400">{veh.driver_phone}</span>}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{veh.trips ?? 0}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{(veh.km_run ?? 0).toFixed(1)} km</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">₹{veh.cost_per_km ?? 25}</td>
                      <td className="py-3 px-4 text-xs text-gray-600">{veh.next_service || '2025-06-30'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                          veh.status === 'available' ? 'bg-green-100 text-green-800' :
                          veh.status === 'busy' ? 'bg-amber-100 text-amber-800' :
                          veh.status === 'maintenance' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {veh.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select
                          value={veh.status}
                          disabled={updatingId === veh.id}
                          onChange={(e) => handleUpdateStatus(veh.id, e.target.value)}
                          className="text-xs bg-white border border-gray-200 rounded-lg p-1.5 font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="available">Set Available</option>
                          <option value="busy">Set Busy</option>
                          <option value="maintenance">Set Maintenance</option>
                          <option value="offline">Set Offline</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
