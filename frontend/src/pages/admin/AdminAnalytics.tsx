import { useState, useEffect } from 'react'
import {
  Users, Truck, Hospital, ClipboardList, CheckCircle, XCircle,
  AlertTriangle, TrendingUp, BarChart3, Loader2, AlertCircle, RefreshCw
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/ui/StatsCard'
import api from '@/services/api'
import type { AdminAnalytics } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#3b82f6']

export default function AdminAnalytics() {
  const [stats, setStats] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<AdminAnalytics>('/analytics/admin')
      setStats(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const bookingBreakdownData = stats
    ? [
        { name: 'Completed', value: stats.completed_bookings },
        { name: 'Cancelled', value: stats.cancelled_bookings },
        { name: 'No Match', value: stats.no_match_bookings },
        {
          name: 'Other',
          value: Math.max(
            0,
            stats.total_bookings - stats.completed_bookings - stats.cancelled_bookings - stats.no_match_bookings
          ),
        },
      ]
    : []

  const completionRate = stats && stats.total_bookings > 0
    ? (stats.completed_bookings / stats.total_bookings * 100)
    : 0

  return (
    <DashboardLayout>
      <PageHeader
        title="Platform Analytics"
        subtitle="Aggregated metrics across all operators, hospitals, and bookings"
        action={
          <button onClick={fetchStats} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
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
      ) : stats ? (
        <>
          {/* Platform overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Operators" value={stats.total_operators} icon={Users} />
            <StatsCard title="Verified Vehicles" value={stats.verified_ambulances} icon={Truck} />
            <StatsCard title="Hospitals" value={stats.total_hospitals} icon={Hospital} iconColor="text-green-600" iconBg="bg-green-50" />
            <StatsCard title="Total Bookings" value={stats.total_bookings} icon={ClipboardList} />
          </div>

          {/* Booking outcomes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Completed"
              value={stats.completed_bookings}
              icon={CheckCircle}
              iconColor="text-green-600"
              iconBg="bg-green-50"
              subtitle={`${completionRate.toFixed(1)}% rate`}
            />
            <StatsCard
              title="Cancelled"
              value={stats.cancelled_bookings}
              icon={XCircle}
              iconColor="text-red-500"
              iconBg="bg-red-50"
              subtitle={`${stats.cancellation_rate_pct.toFixed(1)}% rate`}
            />
            <StatsCard
              title="No Match"
              value={stats.no_match_bookings}
              icon={AlertTriangle}
              iconColor="text-amber-500"
              iconBg="bg-amber-50"
              subtitle="No ambulance found"
            />
            <StatsCard
              title="Scheduled Trips"
              value={stats.scheduled_bookings}
              icon={BarChart3}
            />
          </div>

          {/* Charts + Revenue */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Booking breakdown bar chart */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Booking Breakdown</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bookingBreakdownData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {bookingBreakdownData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue overview */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Revenue Overview</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                  <div>
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Estimated Revenue</p>
                    <p className="text-2xl font-bold text-green-700 mt-0.5">
                      ₹{stats.total_estimated_revenue_inr.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-green-600 mt-1">From {stats.completed_bookings} completed trips</p>
                  </div>
                  <TrendingUp className="w-7 h-7 text-green-400" />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Today's Bookings</p>
                    <p className="text-2xl font-bold text-gray-800 mt-0.5">
                      {stats.bookings_today}
                    </p>
                  </div>
                  <BarChart3 className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-xs text-amber-600 font-medium">
                  ⚠ Estimated revenue — not actual payment records
                </p>
              </div>
            </div>
          </div>

          {/* Key rates */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Key Rates</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-3xl font-bold text-green-700">{completionRate.toFixed(1)}%</p>
                <p className="text-xs text-green-600 font-medium mt-1">Completion Rate</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <p className="text-3xl font-bold text-red-600">{stats.cancellation_rate_pct.toFixed(1)}%</p>
                <p className="text-xs text-red-500 font-medium mt-1">Cancellation Rate</p>
              </div>
              {stats.avg_response_time_minutes != null && (
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <p className="text-3xl font-bold text-blue-700">{stats.avg_response_time_minutes.toFixed(1)} min</p>
                  <p className="text-xs text-blue-500 font-medium mt-1">Avg. Response Time</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </DashboardLayout>
  )
}
