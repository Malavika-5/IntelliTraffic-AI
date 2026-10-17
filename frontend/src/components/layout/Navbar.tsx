import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Ambulance, LogOut, User, Bell, Menu, X, LayoutDashboard, Map, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { IncidentReportModal } from '@/components/forms/IncidentReportModal'

export function PublicNavbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-primary-700 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-primary-800 transition-colors">
                <Ambulance className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-base font-bold text-primary-800">IntelliTraffic</span>
                <span className="text-base font-bold text-primary-600"> AI</span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                Report Accident
              </button>
              <Link to="/book" className="text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors">
                Book Ambulance
              </Link>
              <Link to="/schedule" className="text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors">
                Schedule Transport
              </Link>
              {user ? (
                <div className="flex items-center gap-3">
                  <Link to="/my-bookings" className="text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors">
                    My Bookings
                  </Link>
                  <button onClick={handleLogout} className="btn-secondary text-xs py-2 px-3 gap-1.5">
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="btn-secondary text-sm py-2">Sign In</Link>
                  <Link to="/register" className="btn-primary text-sm py-2">Get Started</Link>
                </div>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="md:hidden border-t border-gray-100 py-3 space-y-1 animate-slide-in">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  setReportModalOpen(true)
                }}
                className="w-full text-left px-3 py-2 text-sm font-bold text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Report Accident
              </button>
              <Link to="/book" className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                Book Ambulance
              </Link>
              <Link to="/schedule" className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                Schedule Transport
              </Link>
              {user ? (
                <>
                  <Link to="/my-bookings" className="block px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                    My Bookings
                  </Link>
                  <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50">
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-3 pt-2">
                  <Link to="/login" className="btn-secondary flex-1 text-center text-sm" onClick={() => setMobileOpen(false)}>Sign In</Link>
                  <Link to="/register" className="btn-primary flex-1 text-center text-sm" onClick={() => setMobileOpen(false)}>Register</Link>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Incident Report Modal */}
      <IncidentReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onCreated={(inc: any) => {
          setReportModalOpen(false)
          alert(`Emergency Incident #${inc.id} reported successfully! Emergency response dispatchers have been alerted.`)
        }}
      />
    </>
  )
}
