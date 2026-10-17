import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Ambulance, Eye, EyeOff, AlertCircle, Phone, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import type { UserRole } from '@/types'

const roleHomeMap: Record<string, string> = {
  patient: '/my-bookings',
  operator: '/operator/dashboard',
  dispatcher: '/operator/dashboard',
  fleet_admin: '/operator/dashboard',
  hospital: '/hospital/dashboard',
  admin: '/admin/dashboard',
}

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  emergency_contact_phone: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || null

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const { user: loggedInUser } = await login(
        data.email,
        data.password,
        data.emergency_contact_phone
      )
      toast.success('Welcome back!')
      // Redirect to previous page if it makes sense, otherwise go to role dashboard
      const destination = from && from !== '/login' && from !== '/register'
        ? from
        : (roleHomeMap[loggedInUser.role] || '/operator/dashboard')
      navigate(destination, { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid email or password'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const demoAccounts = [
    { label: 'Patient', email: 'patient@demo.local', emergency: '+91 98401 23456', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Operator', email: 'operator@demo.local', emergency: '', color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Hospital', email: 'hospital@demo.local', emergency: '', color: 'bg-purple-50 border-purple-200 text-purple-700' },
    { label: 'Admin', email: 'admin@demo.local', emergency: '', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  ]

  const fillDemo = (acc: typeof demoAccounts[0]) => {
    setValue('email', acc.email)
    setValue('password', 'Demo@1234')
    if (acc.emergency) {
      setValue('emergency_contact_phone', acc.emergency)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary-700 rounded-xl flex items-center justify-center">
              <Ambulance className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-primary-800">IntelliTraffic AI</span>
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign in to your account</h1>
          <p className="text-sm text-gray-500 mb-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-700 font-medium hover:underline">Create one free</Link>
          </p>

          {/* Demo accounts */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-amber-800 mb-2.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Demo accounts (local development only) — Password: Demo@1234
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80 ${acc.color}`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                {...register('email')}
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            {/* Optional Emergency Contact Number given during login */}
            <div className="p-3 bg-red-50/60 border border-red-200/70 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="emergency_contact_phone" className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  Emergency Contact Phone <span className="text-gray-400 font-normal">(optional)</span>
                </label>
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  id="emergency_contact_phone"
                  type="tel"
                  {...register('emergency_contact_phone')}
                  placeholder="+91 98401 23456"
                  className="input-field pl-9 text-xs bg-white py-2"
                />
              </div>
              <p className="text-[11px] text-red-600/90 leading-tight">
                This number receives instant SMS alerts with live tracking when booking an ambulance.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 mt-2"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2">
            <Phone className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">
              For emergencies, call <a href="tel:112" className="font-bold underline">112</a> immediately. Don't wait for app login.
            </p>
          </div>
        </div>
      </div>

      {/* Right: Brand panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-navy via-primary-800 to-primary-700 items-center justify-center px-12">
        <div className="max-w-md text-white">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 border border-white/20">
            <Ambulance className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Smarter dispatch.<br />Faster healthcare.</h2>
          <p className="text-white/70 leading-relaxed mb-8">
            IntelliTraffic AI connects patients with verified ambulances, coordinates hospital arrivals,
            and helps operators manage their fleet — all in one platform.
          </p>
          <div className="space-y-3">
            {[
              'Verified ambulance operators across Kerala',
              'Real-time GPS tracking and status updates',
              'Hospital coordination and arrival notifications',
              'Scheduled and recurring medical transport',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-white/80">
                <div className="w-5 h-5 bg-green-400/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
