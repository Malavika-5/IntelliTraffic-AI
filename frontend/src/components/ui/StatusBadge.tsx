import type { BookingStatus, AmbulanceStatus } from '@/types'

const bookingStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'badge-pending' },
  searching: { label: 'Searching', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700' },
  en_route_pickup: { label: 'En Route', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700' },
  arrived_pickup: { label: 'Arrived', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700' },
  patient_onboard: { label: 'Onboard', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700' },
  en_route_destination: { label: 'To Hospital', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700' },
  handoff_recorded: { label: 'Handoff Done', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700' },
  completed: { label: 'Completed', className: 'badge-completed' },
  cancelled: { label: 'Cancelled', className: 'badge-cancelled' },
  rejected: { label: 'Rejected', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700' },
  no_match: { label: 'No Match', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600' },
}

const ambulanceStatusConfig: Record<string, { label: string; className: string }> = {
  available: { label: 'Available', className: 'badge-available' },
  busy: { label: 'Busy', className: 'badge-busy' },
  maintenance: { label: 'Maintenance', className: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700' },
  offline: { label: 'Offline', className: 'badge-offline' },
}

export function BookingStatusBadge({ status }: { status: string }) {
  const config = bookingStatusConfig[status] || { label: status, className: 'badge-offline' }
  return <span className={config.className}>{config.label}</span>
}

export function AmbulanceStatusBadge({ status }: { status: string }) {
  const config = ambulanceStatusConfig[status] || { label: status, className: 'badge-offline' }
  return <span className={config.className}>{config.label}</span>
}

export function CategoryBadge({ category }: { category: string }) {
  const labels: Record<string, string> = {
    basic: 'Basic Transport',
    als: 'Advanced Life Support',
    icu: 'ICU Ambulance',
    neonatal: 'Neonatal Transport',
    wheelchair: 'Wheelchair Accessible',
    non_emergency: 'Non-Emergency Transport',
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
      {labels[category] || category}
    </span>
  )
}

export function VerificationBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    verified: { label: '✓ Verified', className: 'badge-completed' },
    pending: { label: 'Pending', className: 'badge-pending' },
    rejected: { label: 'Rejected', className: 'badge-cancelled' },
    suspended: { label: 'Suspended', className: 'badge-offline' },
  }
  const c = config[status] || { label: status, className: 'badge-offline' }
  return <span className={c.className}>{c.label}</span>
}

// Generic StatusBadge - maps to appropriate component based on status string
export function StatusBadge({ status }: { status: string }) {
  // Try booking status first
  const bookingConfig = bookingStatusConfig[status]
  if (bookingConfig) return <span className={bookingConfig.className}>{bookingConfig.label}</span>
  // Try ambulance status
  const ambulanceConfig = ambulanceStatusConfig[status]
  if (ambulanceConfig) return <span className={ambulanceConfig.className}>{ambulanceConfig.label}</span>
  // Fall back to verification badge
  return <VerificationBadge status={status} />
}

export function DemoBanner() {
  return (
    <span className="demo-banner">
      DEMO DATA
    </span>
  )
}
