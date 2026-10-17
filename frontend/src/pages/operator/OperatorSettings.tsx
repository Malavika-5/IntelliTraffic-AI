import { useState } from 'react'
import { Settings, Info, CheckCircle, Building, Phone, Mail } from 'lucide-react'
import { DashboardLayout, PageHeader } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'

export default function OperatorSettings() {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)

  return (
    <DashboardLayout>
      <PageHeader title="Operator Settings" subtitle="Manage your organization and account" />

      <div className="space-y-6 max-w-2xl">
        {/* Organization */}
        <div className="card p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building className="w-4 h-4 text-primary-700" /> Organization Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Organization Name</label>
              <input type="text" className="input-field" defaultValue={user?.full_name + "'s Ambulance Service"} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">City</label>
                <input type="text" className="input-field" defaultValue="Kochi" />
              </div>
              <div>
                <label className="label">State</label>
                <input type="text" className="input-field" defaultValue="Kerala" />
              </div>
            </div>
            <div>
              <label className="label">Contact Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="tel" className="input-field pl-10" defaultValue={user?.phone || ''} />
              </div>
            </div>
            <div>
              <label className="label">Contact Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" className="input-field pl-10" defaultValue={user?.email || ''} />
              </div>
            </div>
            <button
              onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}
              className="btn-primary gap-2"
            >
              {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Subscription */}
        <div className="card p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Subscription Plan</h2>
          <div className="flex items-center justify-between py-3 border border-primary-200 rounded-xl px-4 bg-primary-50">
            <div>
              <p className="text-sm font-bold text-primary-700">Starter Plan</p>
              <p className="text-xs text-primary-600">Up to 5 vehicles · Basic analytics</p>
            </div>
            <span className="text-xs font-semibold text-primary-700 bg-primary-100 px-3 py-1 rounded-full">Active (Demo)</span>
          </div>
          <p className="text-xs text-gray-400 mt-3">Contact support to upgrade your plan. Pricing is configured by the platform administrator.</p>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Verification of your ambulance service requires documents to be reviewed by the platform team. 
            Please contact support at support@intellitraffic.ai for verification.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
