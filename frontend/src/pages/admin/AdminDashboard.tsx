import { useState, useEffect } from 'react'
import {
  Users, Truck, Hospital, ClipboardList, CheckCircle, XCircle,
  AlertTriangle, TrendingUp, Activity, Loader2, RefreshCw, BarChart3
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/ui/StatsCard'
import { Link } from 'react-router-dom'
import api from '@/services/api'
import type { AdminAnalytics } from '@/types'
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6']

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = async () => {
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

  if (loading) return <DashboardLayout><div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary-700 animate-spin" /></div></DashboardLayout>

  const completionRate = stats && stats.total_bookings > 0
    ? (stats.completed_bookings / stats.total_bookings * 100)
    : 0

  return (
    <DashboardLayout>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform-wide overview and analytics"
        action={<button onClick={fetchStats} className="btn-ghost gap-2"><RefreshCw className="w-4 h-4" /> Refresh</button>}
      />

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertTriangle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {stats && (
        <>
          {/* Platform stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Operators" value={stats.total_operators} icon={Users} color="blue" />
            <StatsCard title="Verified Vehicles" value={stats.verified_ambulances} icon={Truck} color="blue" />
            <StatsCard title="Hospitals" value={stats.total_hospitals} icon={Hospital} iconColor="text-green-600" iconBg="bg-green-50" />
            <StatsCard title="Total Bookings" value={stats.total_bookings} icon={ClipboardList} color="blue" />
          </div>

          {/* Booking stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Completed" value={stats.completed_bookings} icon={CheckCircle} iconColor="text-green-600" iconBg="bg-green-50" subtitle={`${completionRate.toFixed(1)}% rate`} />
            <StatsCard title="Cancelled" value={stats.cancelled_bookings} icon={XCircle} iconColor="text-red-500" iconBg="bg-red-50" subtitle={`${stats.cancellation_rate_pct.toFixed(1)}% rate`} />
            <StatsCard title="No Match" value={stats.no_match_bookings} icon={AlertTriangle} iconColor="text-amber-500" iconBg="bg-amber-50" subtitle="No ambulance found" />
            <StatsCard title="Scheduled Trips" value={stats.scheduled_bookings} icon={Activity} color="blue" />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Booking distribution */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Booking Distribution</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Completed', value: stats.completed_bookings },
                      { name: 'Cancelled', value: stats.cancelled_bookings },
                      { name: 'No Match', value: stats.no_match_bookings },
                      { name: 'Other', value: Math.max(0, stats.total_bookings - stats.completed_bookings - stats.cancelled_bookings - stats.no_match_bookings) },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => <Cell key={index} fill={color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Revenue Overview</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <div>
                    <p className="text-xs text-green-600 font-medium">Estimated Revenue</p>
                    <p className="text-xl font-bold text-green-700">₹{stats.total_estimated_revenue_inr.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-green-600 mt-0.5">From {stats.completed_bookings} completed trips</p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                  <div>
                    <p className="text-xs text-primary-600 font-medium">Bookings Today</p>
                    <p className="text-xl font-bold text-primary-700">{stats.bookings_today}</p>
                  </div>
                  <BarChart3 className="w-6 h-6 text-primary-500" />
                </div>
                <p className="text-xs text-amber-600 font-medium">⚠ Estimated revenue — not actual payments</p>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { to: '/admin/users', label: 'Manage Users', icon: Users },
              { to: '/admin/operators', label: 'Operators', icon: Truck },
              { to: '/admin/bookings', label: 'All Bookings', icon: ClipboardList },
              { to: '/admin/audit-logs', label: 'Audit Logs', icon: Activity },
            ].map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="card p-4 hover:shadow-md transition-shadow text-center group">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Icon className="w-5 h-5 text-primary-700" />
                </div>
                <p className="text-xs font-semibold text-gray-900">{label}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
