import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Ambulance, Clock, MapPin, RefreshCw, ChevronRight, AlertCircle, Calendar, Loader2 } from 'lucide-react'
import { PublicNavbar } from '@/components/layout/Navbar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/services/api'
import type { Booking } from '@/types'

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const fetchBookings = async () => {
    try {
      const res = await api.get<Booking[]>('/bookings?page_size=50')
      setBookings(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load bookings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings()
  }, [])

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Bookings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage your ambulance bookings</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchBookings} className="btn-ghost p-2">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link to="/book" className="btn-primary gap-2">
              <Ambulance className="w-4 h-4" /> New Booking
            </Link>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {['all', 'pending', 'searching', 'accepted', 'completed', 'cancelled'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 text-primary-700 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? 'No bookings yet' : `No ${filter} bookings`}
            description={filter === 'all' ? 'Your ambulance bookings will appear here.' : 'Try a different filter.'}
            action={<Link to="/book" className="btn-primary gap-2"><Ambulance className="w-4 h-4" /> Book Ambulance</Link>}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(booking => (
              <Link
                key={booking.id}
                to={`/track/${booking.id}`}
                className="card-hover p-4 flex items-start gap-4 block"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  booking.status === 'completed' ? 'bg-green-100' :
                  booking.status === 'cancelled' ? 'bg-gray-100' :
                  booking.status === 'no_match' ? 'bg-amber-100' :
                  'bg-primary-100'
                }`}>
                  <Ambulance className={`w-5 h-5 ${
                    booking.status === 'completed' ? 'text-green-600' :
                    booking.status === 'cancelled' ? 'text-gray-500' :
                    booking.status === 'no_match' ? 'text-amber-600' :
                    'text-primary-700'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-900 font-mono">{booking.reference_number}</span>
                    <StatusBadge status={booking.status} />
                    {booking.is_demo && <span className="demo-banner">DEMO</span>}
                  </div>
                  <p className="text-xs text-gray-600 truncate mb-1">
                    <MapPin className="inline w-3 h-3 mr-0.5" /> {booking.pickup_address}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(booking.created_at).toLocaleDateString()}
                    </span>
                    <span className="capitalize">{(booking.requested_category || '').replace(/_/g, ' ')}</span>
                    {booking.estimated_arrival_minutes && (
                      <span className="flex items-center gap-1 text-green-600">
                        <Clock className="w-3 h-3" /> ~{Math.round(booking.estimated_arrival_minutes)} min ETA
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-2" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
