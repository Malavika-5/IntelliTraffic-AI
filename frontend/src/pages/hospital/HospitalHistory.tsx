import { useState, useEffect, useMemo, Fragment } from 'react'
import {
  FileText, Clock, CheckCircle, XCircle, Activity,
  Loader2, RefreshCw, AlertCircle, CalendarDays,
  User, MapPin, MessageSquare, ChevronDown
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/ui/StatsCard'
import { EmptyState } from '@/components/ui/EmptyState'
import api from '@/services/api'
import type { Booking } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type NotificationStatus = 'sent' | 'acknowledged' | 'unable_to_acknowledge' | 'handoff_recorded'

interface HospitalNotification {
  id: string
  booking_id: string
  hospital_id: string
  status: NotificationStatus
  estimated_arrival_at?: string
  patient_info_notes?: string
  sent_at?: string
  acknowledged_at?: string
  acknowledgement_note?: string
  sent_by_user_id?: string
  booking?: {
    reference_number: string
    patient_name?: string
    patient_age?: string
    pickup_address: string
    destination_address?: string
    status: string
  }
}

// ── Date range options ────────────────────────────────────────────────────────

type DateRange = '7' | '30' | '90'

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
]

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  badgeClass: string
  icon: React.ComponentType<{ className?: string }>
  borderClass: string
}

const STATUS_CONFIG: Record<NotificationStatus, StatusConfig> = {
  sent: {
    label: 'Sent',
    badgeClass: 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700',
    icon: Clock,
    borderClass: 'border-l-amber-400',
  },
  acknowledged: {
    label: 'Acknowledged',
    badgeClass: 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700',
    icon: CheckCircle,
    borderClass: 'border-l-green-500',
  },
  unable_to_acknowledge: {
    label: 'Unable to Ack.',
    badgeClass: 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700',
    icon: XCircle,
    borderClass: 'border-l-red-500',
  },
  handoff_recorded: {
    label: 'Handoff Recorded',
    badgeClass: 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700',
    icon: Activity,
    borderClass: 'border-l-blue-500',
  },
}

function NotificationStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as NotificationStatus]
  if (!cfg) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
        {status}
      </span>
    )
  }
  return <span className={cfg.badgeClass}>{cfg.label}</span>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatTimeAgo(iso?: string) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HospitalHistory() {
  const [notifications, setNotifications] = useState<HospitalNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('30')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<HospitalNotification[]>('/hospital-notifications')
      setNotifications(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load notification history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Filter by selected date range
  const filtered = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(dateRange, 10))
    return notifications.filter(n => {
      const sentAt = n.sent_at ? new Date(n.sent_at) : null
      return sentAt && sentAt >= cutoff
    })
  }, [notifications, dateRange])

  // Stats
  const total = filtered.length
  const countByStatus = useMemo(() => ({
    sent: filtered.filter(n => n.status === 'sent').length,
    acknowledged: filtered.filter(n => n.status === 'acknowledged').length,
    unable_to_acknowledge: filtered.filter(n => n.status === 'unable_to_acknowledge').length,
    handoff_recorded: filtered.filter(n => n.status === 'handoff_recorded').length,
  }), [filtered])

  return (
    <DashboardLayout>
      <PageHeader
        title="Coordination History"
        subtitle="Past arrival notifications and handoff records for your hospital"
        action={
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-ghost gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchData}
            className="ml-auto text-xs font-medium text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-primary-700 animate-spin" />
          <p className="text-sm text-gray-500">Loading history…</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Total Notifications"
              value={total}
              icon={FileText}
              iconColor="text-primary-700"
              iconBg="bg-primary-50"
              subtitle={`Last ${dateRange} days`}
            />
            <StatsCard
              title="Acknowledged"
              value={countByStatus.acknowledged}
              icon={CheckCircle}
              iconColor="text-green-600"
              iconBg="bg-green-50"
              subtitle="Receipt confirmed"
            />
            <StatsCard
              title="Handoffs Recorded"
              value={countByStatus.handoff_recorded}
              icon={Activity}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
              subtitle="Patient transferred"
            />
            <StatsCard
              title="Unable to Ack."
              value={countByStatus.unable_to_acknowledge}
              icon={XCircle}
              iconColor="text-red-600"
              iconBg="bg-red-50"
              subtitle="Could not respond"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-600">Date range:</span>
            </div>
            <div className="flex gap-1.5">
              {DATE_RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDateRange(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    dateRange === opt.value
                      ? 'bg-primary-700 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {total > 0 && (
              <span className="ml-auto text-xs text-gray-400">
                {total} record{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Content */}
          {filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={FileText}
                title="No records found"
                description={`No arrival notifications were sent to your hospital in the last ${dateRange} days. Records appear here once notifications are dispatched.`}
              />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="card overflow-hidden hidden md:block">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        'Booking Ref.',
                        'Patient',
                        'Status',
                        'Sent At',
                        'Acknowledged At',
                        'Note',
                        '',
                      ].map(h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(notif => {
                      const isExpanded = expandedId === notif.id
                      const cfg = STATUS_CONFIG[notif.status]
                      return (
                        <Fragment key={notif.id}>
                          <tr
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : notif.id)}
                          >
                            {/* Booking Ref */}
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-1 rounded-md">
                                {notif.booking?.reference_number ?? notif.booking_id.slice(0, 8).toUpperCase()}
                              </span>
                            </td>

                            {/* Patient */}
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {notif.booking?.patient_name ?? 'Unknown patient'}
                                </p>
                                {notif.booking?.patient_age && (
                                  <p className="text-xs text-gray-400">Age {notif.booking.patient_age}</p>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              <NotificationStatusBadge status={notif.status} />
                            </td>

                            {/* Sent At */}
                            <td className="px-4 py-3">
                              <p className="text-xs text-gray-700">{formatDateTime(notif.sent_at)}</p>
                              <p className="text-xs text-gray-400">{formatTimeAgo(notif.sent_at)}</p>
                            </td>

                            {/* Acknowledged At */}
                            <td className="px-4 py-3">
                              {notif.acknowledged_at ? (
                                <>
                                  <p className="text-xs text-gray-700">{formatDateTime(notif.acknowledged_at)}</p>
                                  <p className="text-xs text-gray-400">{formatTimeAgo(notif.acknowledged_at)}</p>
                                </>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>

                            {/* Note */}
                            <td className="px-4 py-3 max-w-[180px]">
                              {notif.acknowledgement_note ? (
                                <p className="text-xs text-gray-600 truncate" title={notif.acknowledgement_note}>
                                  {notif.acknowledgement_note}
                                </p>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>

                            {/* Expand toggle */}
                            <td className="px-4 py-3">
                              <ChevronDown
                                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <tr className="bg-gray-50">
                              <td colSpan={7} className="px-6 py-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                  {/* Pickup */}
                                  {notif.booking?.pickup_address && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Pickup</p>
                                        <p className="text-gray-700">{notif.booking.pickup_address}</p>
                                      </div>
                                    </div>
                                  )}
                                  {/* Destination */}
                                  {notif.booking?.destination_address && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="w-3.5 h-3.5 text-primary-500 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Destination</p>
                                        <p className="text-gray-700">{notif.booking.destination_address}</p>
                                      </div>
                                    </div>
                                  )}
                                  {/* Patient notes */}
                                  {notif.patient_info_notes && (
                                    <div className="flex items-start gap-2">
                                      <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Patient Info</p>
                                        <p className="text-gray-700">{notif.patient_info_notes}</p>
                                      </div>
                                    </div>
                                  )}
                                  {/* ETA */}
                                  {notif.estimated_arrival_at && (
                                    <div className="flex items-start gap-2">
                                      <Clock className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Est. Arrival</p>
                                        <p className="text-gray-700">{formatDateTime(notif.estimated_arrival_at)}</p>
                                      </div>
                                    </div>
                                  )}
                                  {/* Ack note */}
                                  {notif.acknowledgement_note && (
                                    <div className="flex items-start gap-2 sm:col-span-2">
                                      <MessageSquare className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Acknowledgement Note</p>
                                        <p className="text-gray-700">{notif.acknowledgement_note}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map(notif => {
                  const cfg = STATUS_CONFIG[notif.status]
                  const BorderIcon = cfg?.icon ?? Clock
                  return (
                    <div
                      key={notif.id}
                      className={`card p-4 border-l-4 ${cfg?.borderClass ?? 'border-l-gray-300'}`}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-1 rounded-md">
                            {notif.booking?.reference_number ?? notif.booking_id.slice(0, 8).toUpperCase()}
                          </span>
                          <div className="flex items-center gap-1 mt-2">
                            <User className="w-3 h-3 text-gray-400" />
                            <p className="text-sm font-semibold text-gray-800">
                              {notif.booking?.patient_name ?? 'Unknown patient'}
                            </p>
                            {notif.booking?.patient_age && (
                              <span className="text-xs text-gray-400 ml-1">· Age {notif.booking.patient_age}</span>
                            )}
                          </div>
                        </div>
                        <NotificationStatusBadge status={notif.status} />
                      </div>

                      {/* Times */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Sent</p>
                          <p className="text-xs text-gray-700">{formatDateTime(notif.sent_at)}</p>
                        </div>
                        {notif.acknowledged_at && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Acknowledged</p>
                            <p className="text-xs text-gray-700">{formatDateTime(notif.acknowledged_at)}</p>
                          </div>
                        )}
                      </div>

                      {/* Addresses */}
                      {notif.booking?.pickup_address && (
                        <div className="flex items-start gap-1.5 mb-1">
                          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-600 truncate">{notif.booking.pickup_address}</p>
                        </div>
                      )}
                      {notif.booking?.destination_address && (
                        <div className="flex items-start gap-1.5 mb-1">
                          <MapPin className="w-3 h-3 text-primary-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-600 truncate">{notif.booking.destination_address}</p>
                        </div>
                      )}

                      {/* Notes */}
                      {notif.acknowledgement_note && (
                        <div className="mt-2 flex items-start gap-1.5 bg-green-50 p-2 rounded-lg">
                          <MessageSquare className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-green-700">{notif.acknowledgement_note}</p>
                        </div>
                      )}
                      {notif.patient_info_notes && (
                        <div className="mt-2 flex items-start gap-1.5 bg-gray-50 p-2 rounded-lg">
                          <MessageSquare className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-600">{notif.patient_info_notes}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Footer note */}
              <p className="text-xs text-gray-400 text-center mt-6">
                Records are retained for coordination and audit purposes only. Acknowledgement confirms
                receipt — not clinical acceptance or bed availability.
              </p>
            </>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
