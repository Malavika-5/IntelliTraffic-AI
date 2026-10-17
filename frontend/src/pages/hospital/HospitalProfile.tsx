import { useState } from 'react'
import { Hospital, Phone, Mail, MapPin, CheckCircle, Info, Globe } from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'

export default function HospitalProfile() {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: 'Demo General Hospital',
    address: 'MG Road, Ernakulam, Kochi, Kerala 682011',
    city: 'Kochi',
    contact_phone: '+91 484 2345 678',
    contact_email: 'coordinator@demohospital.in',
    emergency_phone: '+91 484 2345 999',
    website: '',
  })

  return (
    <DashboardLayout>
      <PageHeader title="Hospital Profile" subtitle="Manage your hospital's information on the platform" />

      <div className="max-w-2xl space-y-6">
        <div className="card p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Hospital className="w-4 h-4 text-primary-700" /> Basic Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Hospital Name</label>
              <input type="text" className="input-field" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea className="input-field pl-10 resize-none" rows={2}
                  value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">City</label>
              <input type="text" className="input-field" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary-700" /> Contact Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Coordination Contact Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="tel" className="input-field pl-10" value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Emergency Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 text-red-400" />
                <input type="tel" className="input-field pl-10 border-red-200 focus:ring-red-300" value={form.emergency_phone}
                  onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" className="input-field pl-10" value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="url" className="input-field pl-10" placeholder="https://hospital.in"
                  value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        {/* Verification status */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Verification Status</p>
              <p className="text-xs text-gray-500 mt-0.5">Platform verification confirms your hospital's participation</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
              Pending Verification
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            This profile is used to display your hospital in the platform directory and for coordination workflows.
            Clinical capabilities, bed availability, and readiness information are <strong>not</strong> inferred from this profile.
          </p>
        </div>

        <button
          onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}
          className="btn-primary gap-2"
        >
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save Profile'}
        </button>
      </div>
    </DashboardLayout>
  )
}
