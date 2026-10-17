import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ambulance, User, Mail, Phone, Lock, AlertCircle, Eye, EyeOff, ChevronRight, ShieldAlert, Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/services/api'
import type { AuthResponse } from '@/types'
import { getToken, setToken, setStoredUser } from '@/services/auth'

const roles = [
  { value: 'patient', label: 'Patient / Family', desc: 'Book ambulances and track journeys' },
  { value: 'operator', label: 'Ambulance Operator', desc: 'Manage fleet and accept bookings' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [role, setRole] = useState<string>('patient')
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    emergency_contact_phone: '',
    emergency_contact_name: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/auth/register', { ...form, role })
      setToken(res.data.access_token)
      setStoredUser(res.data.user)
      await refreshUser()
      if (role === 'operator') navigate('/operator/dashboard')
      else navigate('/book')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-primary-800 to-primary-700 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 text-white">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Ambulance className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">IntelliTraffic AI</span>
          </Link>
          <p className="text-white/60 text-sm mt-2">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Role selection */}
          <div className="mb-6">
            <label className="label">I am a</label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    role === r.value
                      ? 'border-primary-700 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-semibold ${role === r.value ? 'text-primary-700' : 'text-gray-900'}`}>
                    {r.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  className="input-field pl-10"
                  placeholder="Your full name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  className="input-field pl-10"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="label">Phone Number <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  className="input-field pl-10"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-red-50/70 border border-red-200/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-red-900 uppercase tracking-wider">
                  Emergency Contact Alerts
                </span>
              </div>
              <p className="text-xs text-red-700 leading-relaxed">
                When you book an emergency ambulance, this contact is automatically sent an instant SMS with your live tracking link.
              </p>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Emergency Contact Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    className="input-field pl-10 bg-white"
                    placeholder="+91 98401 23456"
                    value={form.emergency_contact_phone}
                    onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Contact Name / Relationship <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="input-field pl-10 bg-white"
                    placeholder="e.g. Kavitha (Spouse) or Parent"
                    value={form.emergency_contact_name}
                    onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  className="input-field pl-10 pr-10"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? 'Creating account...' : (
                <>Create Account <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-700 font-semibold hover:underline">Sign in</Link>
          </p>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500">
                For emergencies, call <strong>112</strong> directly. Registration is not required for emergency services.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
