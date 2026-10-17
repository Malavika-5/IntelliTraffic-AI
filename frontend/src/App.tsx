import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Suspense, lazy } from 'react'

// Public pages
const LandingPage = lazy(() => import('@/pages/public/LandingPage'))
const LoginPage = lazy(() => import('@/pages/public/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage'))
const BookingPage = lazy(() => import('@/pages/public/BookingPage'))
const SchedulePage = lazy(() => import('@/pages/public/SchedulePage'))
const TrackingPage = lazy(() => import('@/pages/public/TrackingPage'))
const MyBookingsPage = lazy(() => import('@/pages/public/MyBookingsPage'))

const OperatorDashboard = lazy(() => import('@/pages/operator/OperatorDashboard'))
const OperatorDispatch = lazy(() => import('@/pages/operator/OperatorDispatch'))
const PoliceSafetyLog = lazy(() => import('@/pages/operator/PoliceSafetyLog'))
const FleetRoiAnalytics = lazy(() => import('@/pages/operator/FleetRoiAnalytics'))
const OperatorAmbulances = lazy(() => import('@/pages/operator/OperatorAmbulances'))
const OperatorDrivers = lazy(() => import('@/pages/operator/OperatorDrivers'))
const OperatorScheduledTrips = lazy(() => import('@/pages/operator/OperatorScheduledTrips'))
const OperatorAnalytics = lazy(() => import('@/pages/operator/OperatorAnalytics'))
const OperatorSettings = lazy(() => import('@/pages/operator/OperatorSettings'))

// Hospital pages
const HospitalDashboard = lazy(() => import('@/pages/hospital/HospitalDashboard'))
const HospitalArrivals = lazy(() => import('@/pages/hospital/HospitalArrivals'))
const HospitalHistory = lazy(() => import('@/pages/hospital/HospitalHistory'))
const HospitalProfile = lazy(() => import('@/pages/hospital/HospitalProfile'))

// Admin pages
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminOperators = lazy(() => import('@/pages/admin/AdminOperators'))
const AdminHospitals = lazy(() => import('@/pages/admin/AdminHospitals'))
const AdminBookings = lazy(() => import('@/pages/admin/AdminBookings'))
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'))
const AdminAuditLogs = lazy(() => import('@/pages/admin/AdminAuditLogs'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected public (patient) routes */}
            <Route path="/book" element={
              <ProtectedRoute allowedRoles={['patient', 'admin']}>
                <BookingPage />
              </ProtectedRoute>
            } />
            <Route path="/schedule" element={
              <ProtectedRoute allowedRoles={['patient', 'admin']}>
                <SchedulePage />
              </ProtectedRoute>
            } />
            <Route path="/track/:bookingId" element={
              <ProtectedRoute>
                <TrackingPage />
              </ProtectedRoute>
            } />
            <Route path="/my-bookings" element={
              <ProtectedRoute allowedRoles={['patient', 'admin']}>
                <MyBookingsPage />
              </ProtectedRoute>
            } />

            {/* Operator routes */}
            <Route path="/operator/dashboard" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/operator/dispatch" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorDispatch />
              </ProtectedRoute>
            } />
            <Route path="/operator/police-log" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <PoliceSafetyLog />
              </ProtectedRoute>
            } />
            <Route path="/operator/fleet-roi" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <FleetRoiAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/operator/ambulances" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorAmbulances />
              </ProtectedRoute>
            } />
            <Route path="/operator/drivers" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorDrivers />
              </ProtectedRoute>
            } />
            <Route path="/operator/scheduled-trips" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorScheduledTrips />
              </ProtectedRoute>
            } />
            <Route path="/operator/analytics" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/operator/settings" element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorSettings />
              </ProtectedRoute>
            } />

            {/* Hospital routes */}
            <Route path="/hospital/dashboard" element={
              <ProtectedRoute allowedRoles={['hospital']}>
                <HospitalDashboard />
              </ProtectedRoute>
            } />
            <Route path="/hospital/arrivals" element={
              <ProtectedRoute allowedRoles={['hospital']}>
                <HospitalArrivals />
              </ProtectedRoute>
            } />
            <Route path="/hospital/history" element={
              <ProtectedRoute allowedRoles={['hospital']}>
                <HospitalHistory />
              </ProtectedRoute>
            } />
            <Route path="/hospital/profile" element={
              <ProtectedRoute allowedRoles={['hospital']}>
                <HospitalProfile />
              </ProtectedRoute>
            } />

            {/* Admin routes */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/police-log" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PoliceSafetyLog />
              </ProtectedRoute>
            } />
            <Route path="/admin/fleet-roi" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <FleetRoiAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            } />
            <Route path="/admin/operators" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminOperators />
              </ProtectedRoute>
            } />
            <Route path="/admin/hospitals" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminHospitals />
              </ProtectedRoute>
            } />
            <Route path="/admin/bookings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminBookings />
              </ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/admin/audit-logs" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAuditLogs />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSettings />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
  )
}

export default App
