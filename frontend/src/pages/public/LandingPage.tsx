import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Ambulance, Clock, MapPin, ShieldCheck, Smartphone, Activity,
  ChevronRight, Phone, Star, CheckCircle, AlertCircle, ArrowRight,
  Truck, Hospital, BarChart3, Zap, Calendar
} from 'lucide-react'
import { PublicNavbar } from '@/components/layout/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import { IncidentReportModal } from '@/components/forms/IncidentReportModal'
import type { UserRole } from '@/types'

const roleHomeMap: Record<string, string> = {
  patient: '/my-bookings',
  operator: '/operator/dashboard',
  dispatcher: '/operator/dashboard',
  fleet_admin: '/operator/dashboard',
  hospital: '/hospital/dashboard',
  admin: '/admin/dashboard',
}

export default function LandingPage() {
  const { user, isLoading } = useAuth()
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // Redirect logged-in users to their role dashboard
  if (!isLoading && user) {
    const dest = roleHomeMap[user.role] || '/operator/dashboard'
    return <Navigate to={dest} replace />
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      {/* Emergency Alert Banner */}
      <div className="bg-red-50 border-b border-red-100 py-2.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-xs font-medium text-red-700">
              Immediate medical or road emergency? Report directly or call <strong>112</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 shadow-sm transition-colors"
            >
              🚨 Report Road Accident
            </button>
            <a href="tel:112" className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors">
              <Phone className="w-3 h-3" /> Call 112
            </a>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy via-primary-800 to-primary-700 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 left-20 w-48 h-48 rounded-full bg-brand-light blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6 border border-white/20">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-white/90">Kerala Pilot Program · Active</span>
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-6">
                Smarter Ambulance Dispatch.
                <span className="text-brand-light block mt-1">Faster Healthcare.</span>
              </h1>
              <p className="text-base lg:text-lg text-white/80 leading-relaxed mb-8 max-w-lg">
                IntelliTraffic AI connects patients with verified ambulances, coordinates with hospitals,
                and provides real-time journey tracking — all through one unified platform.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 font-bold rounded-xl hover:bg-primary-50 transition-colors shadow-lg">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/book" className="emergency-button">
                  <Ambulance className="w-5 h-5" />
                  Book Ambulance
                </Link>
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg transition-colors text-sm"
                >
                  <AlertCircle className="w-5 h-5" />
                  Report Accident Pin
                </button>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                {[
                  { icon: CheckCircle, text: 'Verified operators' },
                  { icon: CheckCircle, text: 'Real-time tracking' },
                  { icon: CheckCircle, text: 'Hospital coordination' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-1.5 text-white/70">
                    <item.icon className="w-4 h-4 text-green-400" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live stats card */}
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm font-semibold text-white/90">Platform Overview</p>
                  <span className="demo-banner !text-white !bg-white/20 !border-white/30">DEMO DATA</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {[
                    { label: 'Ambulances Ready', value: '8', color: 'text-green-300' },
                    { label: 'Active Trips', value: '3', color: 'text-blue-300' },
                    { label: 'Hospitals Linked', value: '5', color: 'text-purple-300' },
                    { label: 'Trips Today', value: '24', color: 'text-amber-300' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white/10 rounded-xl p-3">
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-white/60 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { ref: 'ITB4F2E1A', status: 'En Route', color: 'text-blue-300', bg: 'bg-blue-500/20' },
                    { ref: 'ITA8C3D2B', status: 'Completed', color: 'text-green-300', bg: 'bg-green-500/20' },
                    { ref: 'ITC5F1E3D', status: 'Pending', color: 'text-amber-300', bg: 'bg-amber-500/20' },
                  ].map((booking) => (
                    <div key={booking.ref} className="flex items-center justify-between bg-white/5 rounded-lg p-2.5">
                      <span className="text-xs font-mono text-white/70">{booking.ref}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${booking.bg} ${booking.color}`}>
                        {booking.status}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/40 mt-4 text-center">Demo data — not live platform activity</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-2">How it works</p>
            <h2 className="text-3xl font-bold text-gray-900">From request to hospital in minutes</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                icon: MapPin,
                title: 'Share Location',
                desc: 'Use GPS or enter your address manually. Works without internet for location entry.',
              },
              {
                step: '02',
                icon: Zap,
                title: 'Smart Matching',
                desc: 'Our engine finds verified ambulances by capability, distance, and estimated arrival time.',
              },
              {
                step: '03',
                icon: Activity,
                title: 'Live Tracking',
                desc: 'Track your ambulance in real-time. Get status updates at every step of the journey.',
              },
              {
                step: '04',
                icon: Hospital,
                title: 'Hospital Ready',
                desc: 'Participating hospitals are notified ahead of arrival for faster patient handoff.',
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="card p-6 hover:shadow-md transition-shadow">
                  <div className="text-xs font-black text-primary-200 mb-3">{item.step}</div>
                  <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-primary-700" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-2">Services</p>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Complete healthcare transport coverage</h2>
              <div className="space-y-4">
                {[
                  { icon: Ambulance, title: 'Emergency Ambulance', desc: 'ALS, ICU, and Basic Life Support vehicles for emergencies.' },
                  { icon: Calendar, title: 'Scheduled Transport', desc: 'Dialysis, rehabilitation, follow-ups, and elderly transport.' },
                  { icon: Truck, title: 'Neonatal & Specialist', desc: 'Specialized neonatal transport and wheelchair-accessible vehicles.' },
                  { icon: Hospital, title: 'Hospital Coordination', desc: 'Real-time coordination with participating hospitals for smoother handoffs.' },
                ].map((svc) => (
                  <div key={svc.title} className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svc.icon className="w-5 h-5 text-primary-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{svc.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{svc.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="card p-6 border-l-4 border-l-primary-700">
                <p className="text-sm font-semibold text-gray-900 mb-1">For Ambulance Operators</p>
                <p className="text-sm text-gray-500 mb-4">Manage your fleet, accept bookings, track revenue, and coordinate scheduled trips from one dashboard.</p>
                <Link to="/login" className="btn-secondary text-xs py-1.5 px-3 gap-1.5">
                  Operator Login <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="card p-6 border-l-4 border-l-green-500">
                <p className="text-sm font-semibold text-gray-900 mb-1">For Hospitals</p>
                <p className="text-sm text-gray-500 mb-4">Receive pre-arrival notifications, coordinate handoffs, and maintain patient transfer records.</p>
                <Link to="/login" className="btn-secondary text-xs py-1.5 px-3 gap-1.5">
                  Hospital Portal <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="card p-6 bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Safety Notice</p>
                    <p className="text-xs text-amber-700 mt-1">
                      IntelliTraffic AI does not provide medical advice. Transport categories are operator-declared and not clinically validated.
                      For immediate emergencies, call <strong>112</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-navy to-primary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to improve healthcare transport in Kerala?</h2>
          <p className="text-white/70 mb-8">Join the platform connecting patients, ambulances, and hospitals across Kerala.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary-700 font-bold rounded-xl hover:bg-primary-50 transition-colors shadow-lg">
              Create Patient Account
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/10 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/20 transition-colors">
              Operator / Hospital Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                <Ambulance className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold">IntelliTraffic AI</span>
            </div>
            <p className="text-xs text-white/40 text-center">
              © 2024 IntelliTraffic AI · MVP Demonstration · Kerala, India ·
              Not a substitute for official emergency services · Call 112 in emergencies
            </p>
            <div className="flex gap-4">
              <a href="tel:112" className="text-xs text-white/60 hover:text-white transition-colors">Emergency: 112</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Accident reporting modal */}
      <IncidentReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onCreated={(inc: any) => {
          setReportModalOpen(false)
          alert(`Emergency Incident #${inc.id} reported successfully! Emergency response dispatchers have been alerted.`)
        }}
      />
    </div>
  )
}

