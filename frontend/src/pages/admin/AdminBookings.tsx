import { useState, useEffect } from 'react'
import { ClipboardList, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { BookingStatusBadge, CategoryBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/services/api'
import type { Booking, BookingStatus } from '@/types'

const STATUS_FILTERS: Array<'all' | BookingStatus> = [
  'all', 'pending', 'searching', 'accepted', 'en_route_pickup',
  'patient_onboard', 'en_route_destination', 'completed', 'cancelled', 'no_match',
]

const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  pending: 'Pending',
  searching: 'Searching',
  accepted: 'Accepted',
  en_route_pickup: 'En Route',
  patient_onboard: 'Onboard',
  en_route_destination: 'To Hospital',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_match: 'No Match',
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all')

  const fetchBookings = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<Booking[]>('/bookings?page_size=50')
      setBookings(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBookings() }, [])

  const filtered =
    statusFilter === 'all'
      ? bookings
      : bookings.filter(b => b.status === statusFilter)

  return (
    <DashboardLayout>
      <PageHeader
        title="All Bookings"
        subtitle={`${bookings.length} total bookings`}
        action={
          <button onClick={fetchBookings} className="btn-ghost gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {/* Status filter chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(s => {
          const count = s === 'all' ? bookings.length : bookings.filter(b => b.status === s).length
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s
                  ? 'bg-primary-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {STATUS_LABELS[s]} ({count})
            </button>
          )
        })}
      </div>

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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No bookings found"
          description="No bookings match the current filter."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Reference', 'Type', 'Category', 'Pickup Address', 'Status', 'Fare (₹)', 'Created'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(booking => (
                <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                      {booking.reference_number}
                    </span>
                    {booking.is_demo && (
                      <span className="ml-1 text-xs text-amber-600 font-medium">DEMO</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      booking.booking_type === 'emergency'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {booking.booking_type === 'emergency' ? '🚨 Emergency' : '📅 Scheduled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={booking.requested_category} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                    <p className="truncate">{booking.pickup_address}</p>
                  </td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge status={booking.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                    {booking.estimated_fare_inr != null
                      ? `₹${booking.estimated_fare_inr.toLocaleString('en-IN')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(booking.created_at).toLocaleDateString()}{' '}
                    <span className="text-gray-300">
                      {new Date(booking.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  )
}
