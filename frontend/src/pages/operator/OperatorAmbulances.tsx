import { useState, useEffect } from 'react'
import {
  Truck, Plus, Edit, CheckCircle, XCircle, AlertCircle,
  Loader2, RefreshCw, Wrench, Wifi, WifiOff
} from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import api from '@/services/api'
import type { Ambulance } from '@/types'

const CATEGORIES = ['basic', 'als', 'icu', 'neonatal', 'wheelchair', 'non_emergency']
const STATUSES = ['available', 'busy', 'maintenance', 'offline'] as const

const defaultForm = {
  registration_number: '',
  vehicle_name: '',
  category: 'basic',
  status: 'available' as string,
  equipment_notes: '',
  capacity: '',
}

export default function OperatorAmbulances() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Ambulance | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchAmbulances = async () => {
    try {
      const res = await api.get<Ambulance[]>('/ambulances?page_size=100')
      setAmbulances(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load ambulances.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAmbulances() }, [])

  const openAdd = () => {
    setEditTarget(null)
    setForm(defaultForm)
    setSaveError('')
    setShowModal(true)
  }

  const openEdit = (amb: Ambulance) => {
    setEditTarget(amb)
    setForm({
      registration_number: amb.registration_number,
      vehicle_name: amb.vehicle_name || '',
      category: amb.category,
      status: amb.status,
      equipment_notes: amb.equipment_notes || '',
      capacity: amb.capacity?.toString() || '',
    })
    setSaveError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.registration_number.trim()) {
      setSaveError('Registration number is required.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        ...form,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        // Demo coordinates (Kochi area)
        last_latitude: 9.9312 + Math.random() * 0.1,
        last_longitude: 76.2673 + Math.random() * 0.1,
      }
      if (editTarget) {
        await api.patch(`/ambulances/${editTarget.id}`, payload)
        showToast('Ambulance updated successfully.')
      } else {
        await api.post('/ambulances', payload)
        showToast('Ambulance added successfully.')
      }
      setShowModal(false)
      fetchAmbulances()
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleAvailability = async (id: string, status: string) => {
    try {
      await api.patch(`/ambulances/${id}/availability`, { status })
      showToast(`Status updated to ${status}.`)
      fetchAmbulances()
    } catch (err: any) {
      showToast('Failed to update status: ' + (err.response?.data?.detail || ''))
    }
  }

  const statusIcon = (status: string) => {
    if (status === 'available') return <Wifi className="w-3.5 h-3.5 text-green-600" />
    if (status === 'busy') return <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
    if (status === 'maintenance') return <Wrench className="w-3.5 h-3.5 text-amber-600" />
    return <WifiOff className="w-3.5 h-3.5 text-gray-400" />
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Fleet Management"
        subtitle={`${ambulances.length} vehicles registered`}
        action={
          <div className="flex gap-2">
            <button onClick={fetchAmbulances} className="btn-ghost gap-2"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={openAdd} className="btn-primary gap-2"><Plus className="w-4 h-4" /> Add Vehicle</button>
          </div>
        }
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-primary-700 animate-spin" /></div>
      ) : ambulances.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          description="Add your first ambulance to start accepting bookings."
          action={<button onClick={openAdd} className="btn-primary gap-2"><Plus className="w-4 h-4" /> Add Vehicle</button>}
        />
      ) : (
        <div className="grid gap-4">
          {ambulances.map(amb => (
            <div key={amb.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcon(amb.status)}
                    <span className="text-sm font-bold text-gray-900">{amb.registration_number}</span>
                    {amb.vehicle_name && <span className="text-sm text-gray-500">· {amb.vehicle_name}</span>}
                    <StatusBadge status={amb.status} />
                    <StatusBadge status={amb.verification_status} />
                  </div>
                  <p className="text-xs text-gray-500 capitalize ml-5">
                    {amb.category.replace(/_/g, ' ')}
                    {amb.capacity && ` · Capacity: ${amb.capacity}`}
                  </p>
                </div>
                <button onClick={() => openEdit(amb)} className="btn-ghost gap-1.5 text-xs py-1.5 px-3">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
              </div>

              {amb.equipment_notes && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mb-3">{amb.equipment_notes}</p>
              )}

              {amb.last_location_update && (
                <p className="text-xs text-gray-400 mb-3">
                  Location updated: {new Date(amb.last_location_update).toLocaleString()}
                </p>
              )}

              {/* Status change buttons */}
              <div className="flex gap-2 flex-wrap">
                {STATUSES.filter(s => s !== amb.status).map(s => (
                  <button
                    key={s}
                    onClick={() => handleAvailability(amb.id, s)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 capitalize transition-colors"
                  >
                    Set {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? 'Edit Vehicle' : 'Add Vehicle'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Registration Number <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" placeholder="e.g. KL-07-AB-1234"
              value={form.registration_number}
              onChange={(e) => setForm({ ...form, registration_number: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label">Vehicle Name</label>
            <input type="text" className="input-field" placeholder="e.g. Maruti Eeco ALS"
              value={form.vehicle_name} onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input-field" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Equipment Notes</label>
            <textarea className="input-field resize-none" rows={2}
              placeholder="Ventilator, defibrillator, oxygen concentrator..."
              value={form.equipment_notes} onChange={(e) => setForm({ ...form, equipment_notes: e.target.value })} />
          </div>

          {saveError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{saveError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {editTarget ? 'Update' : 'Add Vehicle'}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
