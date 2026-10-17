import { useState, useEffect, useCallback } from 'react'
import {
  Users, User, Phone, Shield, CheckCircle, Clock, Loader2,
  AlertCircle, RefreshCw, Car, Calendar, Info
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatsCard } from '@/components/ui/StatsCard'
import api from '@/services/api'
import type { Driver } from '@/types'

interface DriverWithAmbulance extends Driver {
  license_expiry?: string
  license_number?: string
  ambulance_name?: string
  ambulance_registration?: string
  ambulance_status?: string
}

export default function OperatorDrivers() {
  const [ambulances, setAmbulances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<any[]>('/ambulances?page_size=100')
      setAmbulances(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load fleet data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Extract unique drivers from ambulances
  const driversMap = new Map<string, DriverWithAmbulance>()
  ambulances.forEach(amb => {
    if (amb.driver) {
      driversMap.set(amb.driver.id, {
        ...amb.driver,
        ambulance_name: amb.vehicle_name || amb.registration_number,
        ambulance_registration: amb.registration_number,
        ambulance_status: amb.status,
      })
    }
  })
  const drivers = Array.from(driversMap.values())
  const unassigned = ambulances.filter(a => !a.driver)
  const activeDrivers = drivers.filter(d => d.is_active)

  const isExpiringSoon = (dateStr?: string) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const diff = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff < 60
  }

  const isExpired = (dateStr?: string) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  const ambStatusColors: Record<string, string> = {
    available: 'text-green-600 bg-green-50',
    busy: 'text-blue-600 bg-blue-50',
    maintenance: 'text-amber-600 bg-amber-50',
    offline: 'text-gray-500 bg-gray-50',
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Driver Management"
        subtitle="Drivers assigned to your fleet vehicles"
        action={
          <button onClick={fetchData} disabled={loading} className="btn-ghost gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
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
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Assigned Drivers" value={activeDrivers.length} icon={<Users className="w-5 h-5 text-primary-600" />} color="blue" />
            <StatsCard title="On Duty" value={drivers.filter(d => d.ambulance_status === 'busy').length} icon={<Car className="w-5 h-5 text-green-600" />} color="green" />
            <StatsCard title="Unassigned Vehicles" value={unassigned.length} icon={<AlertCircle className="w-5 h-5 text-amber-600" />} color="amber" />
            <StatsCard
              title="License Alerts"
              value={drivers.filter(d => isExpiringSoon(d.license_expiry)).length}
              icon={<Shield className="w-5 h-5 text-red-500" />}
              color="red"
              subtitle="Expiring in 60 days"
            />
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold mb-0.5">Driver Management</p>
              <p className="text-xs">
                Driver details are managed through vehicle assignments. Each vehicle can have one assigned driver.
                To update driver information, edit the vehicle record from the Fleet Management page.
                Full standalone driver profile management will be available in a future release.
              </p>
            </div>
          </div>

          {drivers.length === 0 && unassigned.length === 0 ? (
            <EmptyState
              title="No vehicles in fleet"
              description="Add vehicles from the Fleet Management page to see driver information here."
              icon={<Users className="w-10 h-10 text-gray-300" />}
            />
          ) : drivers.length === 0 ? (
            <EmptyState
              title="No drivers assigned"
              description="Assign drivers to your vehicles from the Fleet Management page."
              icon={<User className="w-10 h-10 text-gray-300" />}
            />
          ) : (
            <>
              <div className="card overflow-hidden mb-6">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-600" /> Assigned Drivers
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {drivers.map(driver => {
                    const licenseExpiring = isExpiringSoon(driver.license_expiry)
                    const licenseExpired = isExpired(driver.license_expiry)
                    return (
                      <div key={driver.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-primary-700" />
                          </div>

                          {/* Driver info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">{driver.full_name}</p>
                              {driver.is_active ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                  <CheckCircle className="w-3 h-3" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                  Inactive
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                              {driver.phone && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Phone className="w-3 h-3" /> {driver.phone}
                                </span>
                              )}
                              {driver.license_number && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Shield className="w-3 h-3" /> {driver.license_number}
                                </span>
                              )}
                            </div>

                            {/* License expiry */}
                            {driver.license_expiry && (
                              <div className="mt-1.5">
                                {licenseExpired ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                                    <AlertCircle className="w-3 h-3" /> License EXPIRED — {formatDate(driver.license_expiry)}
                                  </span>
                                ) : licenseExpiring ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                    <Clock className="w-3 h-3" /> License expiring — {formatDate(driver.license_expiry)}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Calendar className="w-3 h-3" /> License valid until {formatDate(driver.license_expiry)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Assigned vehicle */}
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center gap-2 justify-end">
                              <Car className="w-3.5 h-3.5 text-gray-400" />
                              <p className="text-xs font-medium text-gray-700">{driver.ambulance_registration}</p>
                            </div>
                            {driver.ambulance_name && driver.ambulance_name !== driver.ambulance_registration && (
                              <p className="text-xs text-gray-400 mt-0.5">{driver.ambulance_name}</p>
                            )}
                            {driver.ambulance_status && (
                              <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ambStatusColors[driver.ambulance_status] || 'text-gray-500 bg-gray-50'}`}>
                                {driver.ambulance_status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Unassigned vehicles */}
              {unassigned.length > 0 && (
                <div className="card p-5">
                  <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Vehicles Without Assigned Driver
                  </h2>
                  <div className="space-y-2">
                    {unassigned.map(amb => (
                      <div key={amb.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Car className="w-4 h-4 text-amber-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{amb.registration_number}</p>
                            {amb.vehicle_name && <p className="text-xs text-gray-500">{amb.vehicle_name}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-amber-700 font-medium bg-amber-100 px-2 py-0.5 rounded-full">
                          No driver assigned
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Assign drivers via Fleet Management → Edit Vehicle.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
