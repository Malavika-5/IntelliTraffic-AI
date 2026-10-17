import { useState, useEffect } from 'react'
import {
  Truck, Activity, Clock, CheckCircle, AlertCircle,
  TrendingUp, Users, Calendar, Loader2, RefreshCw, ChevronRight
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/ui/StatsCard'
import { Link } from 'react-router-dom'
import api from '@/services/api'
import type { OperatorDashboard } from '@/types'

export default function OperatorDashboardPage() {
  const [stats, setStats] = useState<OperatorDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = async () => {
    try {
      const res = await api.get<OperatorDashboard>('/analytics/operator')
      setStats(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  return (
    <DashboardLayout>
      <PageHeader
        title="Operator Dashboard"
        subtitle="Overview of your fleet and bookings"
        action={
          <button onClick={fetchStats} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 text-primary-700 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : stats ? (
        <>
          {/* Fleet status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Available"
              value={stats.available_ambulances}
              icon={<Truck className="w-5 h-5 text-green-600" />}
              color="green"
              subtitle="Ready for dispatch"
            />
            <StatsCard
              title="On Trip"
              value={stats.busy_ambulances}
              icon={<Activity className="w-5 h-5 text-blue-600" />}
              color="blue"
              subtitle="Currently active"
            />
            <StatsCard
              title="Offline"
              value={stats.offline_ambulances}
              icon={<Truck className="w-5 h-5 text-gray-500" />}
              color="gray"
              subtitle="Not available"
            />
            <StatsCard
              title="Total Fleet"
              value={stats.total_ambulances}
              icon={<Truck className="w-5 h-5 text-primary-700" />}
              color="blue"
              subtitle="Registered vehicles"
            />
          </div>

          {/* Booking stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Pending Requests"
              value={stats.pending_bookings}
              icon={<Clock className="w-5 h-5 text-amber-600" />}
              color="amber"
              subtitle="Awaiting action"
            />
            <StatsCard
              title="Active Trips"
              value={stats.active_trips ?? 0}
              icon={<Activity className="w-5 h-5 text-primary-600" />}
              color="blue"
              subtitle="In progress"
            />
            <StatsCard
              title="Completed Today"
              value={stats.bookings_today}
              icon={<CheckCircle className="w-5 h-5 text-green-600" />}
              color="green"
              subtitle="Today's completions"
            />
            <StatsCard
              title="Total Completed"
              value={stats.completed_bookings}
              icon={<TrendingUp className="w-5 h-5 text-primary-600" />}
              color="blue"
              subtitle="All time"
            />
          </div>

          {/* Quick actions */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Link to="/operator/dispatch" className="card p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-amber-600" />
                </div>
                {stats.pending_bookings > 0 && (
                  <span className="w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {stats.pending_bookings}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900">Dispatch Centre</p>
              <p className="text-xs text-gray-500 mt-0.5">Manage incoming requests</p>
              <div className="flex items-center gap-1 text-primary-600 text-xs font-medium mt-3 group-hover:gap-2 transition-all">
                Open dispatch <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            <Link to="/operator/ambulances" className="card p-5 hover:shadow-md transition-shadow group">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-3">
                <Truck className="w-5 h-5 text-primary-700" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Fleet Management</p>
              <p className="text-xs text-gray-500 mt-0.5">Vehicles, drivers, availability</p>
              <div className="flex items-center gap-1 text-primary-600 text-xs font-medium mt-3 group-hover:gap-2 transition-all">
                Manage fleet <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            <Link to="/operator/scheduled-trips" className="card p-5 hover:shadow-md transition-shadow group">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Scheduled Trips</p>
              <p className="text-xs text-gray-500 mt-0.5">Upcoming appointments</p>
              <div className="flex items-center gap-1 text-primary-600 text-xs font-medium mt-3 group-hover:gap-2 transition-all">
                View schedule <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>

          {/* Revenue summary */}
          {stats.total_estimated_revenue_inr > 0 && (
            <div className="card p-5 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Estimated Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ₹{stats.total_estimated_revenue_inr.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">From completed trips · Estimated only</p>
                </div>
                <Link to="/operator/analytics" className="btn-secondary gap-2">
                  <TrendingUp className="w-4 h-4" /> Analytics
                </Link>
              </div>
            </div>
          )}
        </>
      ) : null}
    </DashboardLayout>
  )
}
