// ============================================================
// IntelliTraffic AI — TypeScript Types
// ============================================================

export type UserRole = 'patient' | 'operator' | 'hospital' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  emergency_contact_phone?: string
  emergency_contact_name?: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

// ---- Ambulance / Operator ----

export type AmbulanceStatus = 'available' | 'busy' | 'maintenance' | 'offline'
export type AmbulanceCategory = 'basic' | 'als' | 'icu' | 'neonatal' | 'wheelchair' | 'non_emergency'
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended'

export interface Operator {
  id: string
  organization_name: string
  city?: string
  verification_status: VerificationStatus
  subscription_plan?: string
}

export interface Driver {
  id: string
  operator_id: string
  full_name: string
  phone: string
  license_number?: string
  is_active: boolean
}

export interface Ambulance {
  id: string
  operator_id: string
  registration_number: string
  vehicle_name?: string
  category: AmbulanceCategory
  status: AmbulanceStatus
  verification_status: VerificationStatus
  capabilities: string[]
  last_latitude?: number
  last_longitude?: number
  last_location_update?: string
  equipment_notes?: string
  capacity?: number
  insurance_expiry?: string
  permit_expiry?: string
  fitness_expiry?: string
  is_active: boolean
  created_at: string
  driver?: Driver
  operator?: Operator
}

// ---- Booking ----

export type BookingStatus =
  | 'pending'
  | 'searching'
  | 'accepted'
  | 'en_route_pickup'
  | 'arrived_pickup'
  | 'patient_onboard'
  | 'en_route_destination'
  | 'handoff_recorded'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'no_match'

export type BookingType = 'emergency' | 'scheduled'

export interface Booking {
  id: string
  reference_number: string
  patient_user_id: string
  booking_type: BookingType
  requested_category: string
  status: BookingStatus
  pickup_latitude: number
  pickup_longitude: number
  pickup_address: string
  pickup_landmark?: string
  destination_latitude?: number
  destination_longitude?: number
  destination_address?: string
  destination_hospital_id?: string
  patient_name?: string
  patient_age?: string
  patient_notes?: string
  contact_phone?: string
  emergency_contact_phone?: string
  emergency_contact_name?: string
  emergency_contact_notified?: boolean
  emergency_contact_notified_at?: string
  emergency_contact_message?: string
  assigned_ambulance_id?: string
  assigned_operator_id?: string
  scheduled_at?: string
  accepted_at?: string
  completed_at?: string
  cancelled_at?: string
  cancellation_reason?: string
  estimated_arrival_minutes?: number
  eta_minutes?: number
  eta_last_updated_at?: string
  estimated_fare_inr?: number
  recorded_fare_inr?: number
  is_demo: boolean
  created_at: string
  updated_at?: string
}

export interface BookingStatusEvent {
  id: string
  booking_id: string
  from_status?: string
  to_status: string
  note?: string
  triggered_by_user_id?: string
  created_at: string
}

// ---- Matching ----

export interface MatchCandidate {
  ambulance_id: string
  registration_number: string
  vehicle_name?: string
  category: string
  operator_name: string
  status: string
  distance_km?: number
  estimated_eta_minutes?: number
  location_age_minutes?: number
  score: number
  is_eligible: boolean
  exclusion_reason?: string
  last_latitude?: number
  last_longitude?: number
}

export interface MatchResult {
  candidates: MatchCandidate[]
  excluded: MatchCandidate[]
  best_match?: MatchCandidate
  routing_provider: string
  matching_notes: string
}

// ---- Hospital ----

export type HospitalVerificationStatus = 'pending' | 'verified' | 'rejected'
export type ArrivalNotificationStatus = 'not_notified' | 'sent' | 'acknowledged' | 'unable_to_acknowledge' | 'handoff_recorded'

export interface Hospital {
  id: string
  name: string
  address: string
  city?: string
  latitude?: number
  longitude?: number
  contact_phone?: string
  contact_email?: string
  emergency_phone?: string
  website?: string
  services: string[]
  verification_status: HospitalVerificationStatus
  is_active: boolean
}

export interface HospitalArrivalNotification {
  id: string
  booking_id: string
  hospital_id: string
  status: ArrivalNotificationStatus
  sent_at?: string
  acknowledged_at?: string
  estimated_arrival_at?: string
  patient_info_notes?: string
  acknowledgement_note?: string
  handoff_recorded_at?: string
  handoff_note?: string
}

// ---- Scheduled Trip ----

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'
export type ScheduledTripStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export interface ScheduledTrip {
  id: string
  patient_user_id: string
  title?: string
  trip_purpose?: string
  requested_category: string
  pickup_address: string
  pickup_latitude?: number
  pickup_longitude?: number
  destination_address?: string
  destination_latitude?: number
  destination_longitude?: number
  destination_hospital_id?: string
  scheduled_at: string
  recurrence_type: RecurrenceType
  recurrence_days?: string
  contact_phone?: string
  patient_notes?: string
  status: ScheduledTripStatus
  created_at: string
}

// ---- Analytics ----

export interface OperatorDashboard {
  total_ambulances: number
  available_ambulances: number
  busy_ambulances: number
  offline_ambulances: number
  pending_bookings: number
  active_trips?: number
  bookings_today: number
  completed_bookings: number
  total_bookings: number
  cancelled_bookings: number
  total_estimated_revenue_inr: number
  avg_response_time_minutes?: number
  trips_per_ambulance: { ambulance: string; trips: number; category: string }[]
}

export interface AdminAnalytics {
  total_operators: number
  verified_operators: number
  total_ambulances: number
  verified_ambulances: number
  total_hospitals: number
  total_bookings: number
  completed_bookings: number
  cancelled_bookings: number
  no_match_bookings: number
  cancellation_rate_pct: number
  avg_response_time_minutes?: number
  total_estimated_revenue_inr: number
  bookings_today: number
  scheduled_bookings: number
}

// ---- Notification ----

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  event_type: string
  booking_id?: string
  is_read: boolean
  created_at: string
}

// ---- Incidents & Simulation (Ported from IntelliTraffic AI) ----

export type IncidentSeverity = 'critical' | 'high' | 'moderate' | 'minor'
export type IncidentStatus = 'reported' | 'verified' | 'dispatched' | 'at_hospital' | 'closed' | 'cancelled'
export type TrafficScenario = 'live' | 'moderate' | 'heavy' | 'gridlock'

export interface Incident {
  id: string
  description: string
  location_name: string
  latitude: number
  longitude: number
  severity: IncidentSeverity
  status: IncidentStatus
  assigned_ambulance_id?: string | null
  hospital_id?: string | null
  reporter_phone?: string | null
  scenario: TrafficScenario
  created_at: string
  assigned_at?: string | null
  closed_at?: string | null
}

export interface CandidateAmbulanceOption {
  ambulance_id: string
  vehicle_name: string
  registration_number: string
  category: string
  status: string
  distance_km: number
  eta_minutes: number
  baseline_eta: number
  minutes_saved: number
  driver_name: string
  driver_phone: string
  cost_per_km: number
  estimated_trip_cost: number
}

export interface CandidateHospitalOption {
  hospital_id: string
  name: string
  distance_km: number
  eta_minutes: number
  er_beds: number
  clinical_capabilities: string[]
  clinical_score: number
  is_data_fresh: boolean
  freshness_warning: string | null
}

export interface IncidentOptions {
  incident: Incident
  scenario: TrafficScenario
  ambulances: CandidateAmbulanceOption[]
  hospitals: CandidateHospitalOption[]
}

export interface PoliceNotification {
  id: string
  station_id: string
  station_name: string
  incident_id: string
  message: string
  level: string
  created_at: string
}

export interface PoliceStation {
  id: string
  name: string
  latitude: number
  longitude: number
  phone: string
}

export interface HandoverRecord {
  id: string
  incident_id: string
  hospital_id: string
  ambulance_id: string
  receiving_doctor: string
  triage_notes?: string
  vitals?: string
  bed_number?: string
  created_at: string
}

export interface RoiSummary {
  total_incidents_analyzed: number
  total_minutes_saved: number
  estimated_costs_saved_inr: number
  active_green_corridors: number
  avg_response_speedup_pct: number
  scenario_distribution: Record<string, number>
}

// ---- API Helpers ----

export interface ApiError {
  detail: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

