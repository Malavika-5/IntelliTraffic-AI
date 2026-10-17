import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Clock, CheckCircle, Truck, Loader2, AlertCircle } from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/ui/StatsCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '@/services/api'
import type { OperatorDashboard } from '@/types'

export default function OperatorAnalytics() {
  const [stats, setStats] = useState<OperatorDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<OperatorDashboard>('/analytics/operator')
      .then(res => setStats(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardLayout><div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary-700 animate-spin" /></div></DashboardLayout>
  if (error) return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-800 mb-1">Unable to Load Analytics</p>
          <p className="text-sm text-gray-500 max-w-sm">{error}</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-primary text-sm px-5 py-2">
          Retry
        </button>
      </div>
    </DashboardLayout>
  )

  const chartData = stats ? [
    { name: 'Completed', value: stats.completed_bookings, color: '#10b981' },
    { name: 'Cancelled', value: stats.cancelled_bookings, color: '#ef4444' },
    { name: 'Available', value: stats.available_ambulances, color: '#3b82f6' },
    { name: 'Busy', value: stats.busy_ambulances, color: '#f59e0b' },
  ] : []

  return (
    <DashboardLayout>
      <PageHeader title="Analytics" subtitle="Fleet and trip performance metrics" />

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Total Completed" value={stats.completed_bookings} icon={CheckCircle} iconColor="text-green-600" iconBg="bg-green-50" />
            <StatsCard title="Today's Bookings" value={stats.bookings_today} icon={CheckCircle} color="blue" />
            <StatsCard title="Total Fleet" value={stats.total_ambulances} icon={Truck} color="blue" />
            {stats.avg_response_time_minutes != null && (
              <StatsCard title="Avg Response" value={`${stats.avg_response_time_minutes.toFixed(1)}m`} icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50" subtitle="Minutes to accept" />
            )}
          </div>

          {/* Chart */}
          <div className="card p-5 mb-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-700" /> Fleet Overview
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Trips per ambulance */}
          {stats.trips_per_ambulance && stats.trips_per_ambulance.length > 0 && (
            <div className="card p-5 mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Trips per Vehicle</h2>
              <div className="space-y-2">
                {stats.trips_per_ambulance.map((item) => (
                  <div key={item.ambulance} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.ambulance}</p>
                      <p className="text-xs text-gray-500 capitalize">{item.category}</p>
                    </div>
                    <span className="text-sm font-bold text-primary-700">{item.trips} trips</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Revenue Summary</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">₹{stats.total_estimated_revenue_inr.toLocaleString('en-IN')}</p>
                <p className="text-xs text-gray-400 mt-1">Estimated revenue from {stats.completed_bookings} completed trips</p>
                <p className="text-xs text-amber-600 mt-1 font-medium">⚠ Estimated only — not actual payments received</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-300" />
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
