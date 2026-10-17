"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field, field_validator
from pydantic.functional_validators import AfterValidator
from typing import Optional, List, Any, Annotated
from datetime import datetime
from enum import Enum
import re


def _validate_email_loose(v: str) -> str:
    """Loose email validation that accepts .local and .test domains for demo use."""
    if not v or not isinstance(v, str):
        raise ValueError("Invalid email")
    # Simple regex to allow .local, .test, etc.
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z.]{2,}$'
    if not re.match(pattern, v.strip()):
        raise ValueError("Invalid email address format")
    return v.strip().lower()


LooseEmail = Annotated[str, AfterValidator(_validate_email_loose)]


# ---- Auth ----

class RegisterRequest(BaseModel):
    email: LooseEmail
    password: str = Field(min_length=8, max_length=100)
    full_name: str = Field(min_length=2, max_length=255)
    phone: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    role: str = "patient"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        allowed = ["patient", "operator", "hospital", "admin"]
        if v not in allowed:
            raise ValueError(f"Role must be one of: {allowed}")
        return v


class LoginRequest(BaseModel):
    email: LooseEmail
    password: str
    emergency_contact_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    preferred_language: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str]
    emergency_contact_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    preferred_language: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Operators ----

class OperatorCreate(BaseModel):
    organization_name: str = Field(min_length=2, max_length=255)
    registration_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Kerala"
    contact_phone: Optional[str] = None
    contact_email: Optional[LooseEmail] = None


class OperatorOut(BaseModel):
    id: str
    organization_name: str
    registration_number: Optional[str]
    address: Optional[str]
    city: Optional[str]
    verification_status: str
    subscription_plan: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Ambulances ----

class AmbulanceCreate(BaseModel):
    registration_number: str = Field(min_length=3, max_length=50)
    vehicle_name: Optional[str] = None
    category: str = "basic"
    capabilities: List[str] = []
    equipment_notes: Optional[str] = None
    capacity: int = 1
    driver_id: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        allowed = ["basic", "als", "icu", "neonatal", "wheelchair", "non_emergency"]
        if v not in allowed:
            raise ValueError(f"Category must be one of: {allowed}")
        return v


class AmbulanceUpdate(BaseModel):
    vehicle_name: Optional[str] = None
    category: Optional[str] = None
    capabilities: Optional[List[str]] = None
    equipment_notes: Optional[str] = None
    capacity: Optional[int] = None
    driver_id: Optional[str] = None
    insurance_expiry: Optional[datetime] = None
    permit_expiry: Optional[datetime] = None
    fitness_expiry: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None


class AmbulanceAvailabilityUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        allowed = ["available", "busy", "offline", "maintenance"]
        if v not in allowed:
            raise ValueError(f"Status must be one of: {allowed}")
        return v


class AmbulanceLocationUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_meters: Optional[float] = None
    speed_kmh: Optional[float] = None
    heading_degrees: Optional[float] = None


class DriverCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: str
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None


class DriverOut(BaseModel):
    id: str
    full_name: str
    phone: str
    license_number: Optional[str]
    license_expiry: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True


class AmbulanceOut(BaseModel):
    id: str
    registration_number: str
    vehicle_name: Optional[str]
    category: str
    status: str
    verification_status: str
    capabilities: List[str]
    equipment_notes: Optional[str]
    capacity: int
    last_latitude: Optional[float]
    last_longitude: Optional[float]
    last_location_update: Optional[datetime]
    insurance_expiry: Optional[datetime]
    permit_expiry: Optional[datetime]
    fitness_expiry: Optional[datetime]
    next_maintenance_date: Optional[datetime]
    operator_id: str
    driver: Optional[DriverOut]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Bookings ----

class BookingCreate(BaseModel):
    booking_type: str = "emergency"
    requested_category: str
    pickup_latitude: float = Field(ge=-90, le=90)
    pickup_longitude: float = Field(ge=-180, le=180)
    pickup_address: Optional[str] = None
    pickup_landmark: Optional[str] = None
    destination_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    destination_longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    destination_address: Optional[str] = None
    destination_hospital_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[str] = None
    patient_notes: Optional[str] = None
    contact_phone: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class BookingStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        allowed = [
            "pending", "searching", "accepted", "en_route_pickup",
            "arrived_pickup", "patient_onboard", "en_route_destination",
            "handoff_recorded", "completed", "cancelled", "no_match", "rejected"
        ]
        if v not in allowed:
            raise ValueError(f"Invalid status: {v}")
        return v


class BookingCancelRequest(BaseModel):
    reason: Optional[str] = None


class BookingStatusEventOut(BaseModel):
    id: str
    from_status: Optional[str]
    to_status: str
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class BookingOut(BaseModel):
    id: str
    reference_number: str
    booking_type: str
    status: str
    requested_category: str
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: Optional[str]
    pickup_landmark: Optional[str]
    destination_latitude: Optional[float]
    destination_longitude: Optional[float]
    destination_address: Optional[str]
    patient_name: Optional[str]
    patient_age: Optional[str]
    patient_notes: Optional[str]
    contact_phone: Optional[str]
    emergency_contact_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_notified: Optional[bool] = False
    emergency_contact_notified_at: Optional[datetime] = None
    emergency_contact_message: Optional[str] = None
    scheduled_at: Optional[datetime]
    assigned_ambulance_id: Optional[str]
    assigned_operator_id: Optional[str]
    estimated_arrival_minutes: Optional[float]
    eta_last_updated_at: Optional[datetime]
    estimated_fare_inr: Optional[float]
    recorded_fare_inr: Optional[float]
    destination_hospital_id: Optional[str]
    accepted_at: Optional[datetime]
    completed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    cancellation_reason: Optional[str]
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---- Matching ----

class MatchCandidateOut(BaseModel):
    ambulance_id: str
    registration_number: str
    operator_id: str
    operator_name: str
    category: str
    status: str
    straight_line_km: float
    distance_km: Optional[float] = None  # alias for straight_line_km, for frontend compatibility
    estimated_eta_minutes: Optional[float]
    location_age_minutes: Optional[float]
    is_location_stale: bool
    score: float
    is_eligible: bool = True  # True for candidates, False for excluded
    is_demo_route: bool
    inclusion_reason: str
    exclusion_reason: Optional[str]

    @classmethod
    def from_result(cls, c, is_eligible: bool = True) -> "MatchCandidateOut":
        return cls(
            ambulance_id=c.ambulance_id,
            registration_number=c.registration_number,
            operator_id=c.operator_id,
            operator_name=c.operator_name,
            category=c.category,
            status=c.status,
            straight_line_km=c.straight_line_km,
            distance_km=c.straight_line_km,  # mirror for frontend
            estimated_eta_minutes=c.estimated_eta_minutes,
            location_age_minutes=c.location_age_minutes,
            is_location_stale=c.is_location_stale,
            score=c.score,
            is_eligible=is_eligible,
            is_demo_route=c.is_demo_route,
            inclusion_reason=c.inclusion_reason,
            exclusion_reason=c.exclusion_reason,
        )


class MatchResultOut(BaseModel):
    candidates: List[MatchCandidateOut]
    excluded: List[MatchCandidateOut]
    best_match: Optional[MatchCandidateOut]
    routing_provider: str
    matching_notes: str


# ---- Hospitals ----

class HospitalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[LooseEmail] = None
    emergency_phone: Optional[str] = None
    website: Optional[str] = None
    services: List[str] = []


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[LooseEmail] = None
    emergency_phone: Optional[str] = None
    website: Optional[str] = None
    services: Optional[List[str]] = None


class HospitalOut(BaseModel):
    id: str
    name: str
    address: Optional[str]
    city: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    contact_phone: Optional[str]
    contact_email: Optional[str]
    emergency_phone: Optional[str]
    website: Optional[str]
    services: List[str]
    verification_status: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class HospitalNotificationCreate(BaseModel):
    patient_info_notes: Optional[str] = None
    estimated_arrival_at: Optional[datetime] = None


class HospitalNotificationOut(BaseModel):
    id: str
    booking_id: str
    hospital_id: str
    status: str
    estimated_arrival_at: Optional[datetime]
    patient_info_notes: Optional[str]
    sent_at: datetime
    acknowledged_at: Optional[datetime]
    acknowledgement_note: Optional[str]
    handoff_recorded_at: Optional[datetime]
    handoff_note: Optional[str]

    class Config:
        from_attributes = True


class AcknowledgeNotification(BaseModel):
    note: Optional[str] = None
    unable: bool = False


# ---- Scheduled Trips ----

class ScheduledTripCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    trip_purpose: Optional[str] = None
    requested_category: str = "non_emergency"
    pickup_address: str
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    destination_address: str
    destination_latitude: Optional[float] = None
    destination_longitude: Optional[float] = None
    destination_hospital_id: Optional[str] = None
    scheduled_at: datetime
    recurrence_type: str = "none"
    recurrence_days: Optional[str] = None
    recurrence_end_date: Optional[datetime] = None
    contact_phone: Optional[str] = None
    patient_notes: Optional[str] = None


class ScheduledTripOut(BaseModel):
    id: str
    title: str
    trip_purpose: Optional[str]
    requested_category: str
    pickup_address: str
    destination_address: str
    scheduled_at: datetime
    recurrence_type: str
    status: str
    assigned_ambulance_id: Optional[str]
    contact_phone: Optional[str]
    patient_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Analytics ----

class OperatorAnalyticsOut(BaseModel):
    total_ambulances: int
    available_ambulances: int
    busy_ambulances: int
    offline_ambulances: int
    total_bookings: int
    completed_bookings: int
    cancelled_bookings: int
    pending_bookings: int
    avg_response_time_minutes: Optional[float]
    total_estimated_revenue_inr: float
    bookings_today: int
    trips_per_ambulance: List[dict]


class AdminAnalyticsOut(BaseModel):
    total_operators: int
    verified_operators: int
    total_ambulances: int
    verified_ambulances: int
    total_hospitals: int
    total_bookings: int
    completed_bookings: int
    cancelled_bookings: int
    no_match_bookings: int
    cancellation_rate_pct: float
    avg_response_time_minutes: Optional[float]
    total_estimated_revenue_inr: float
    bookings_today: int
    scheduled_bookings: int


# ---- Pagination ----

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int


# ---- Notifications ----

class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    type: Optional[str]
    related_booking_id: Optional[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Route ----

class RouteEstimateRequest(BaseModel):
    origin_lat: float = Field(ge=-90, le=90)
    origin_lon: float = Field(ge=-180, le=180)
    dest_lat: float = Field(ge=-90, le=90)
    dest_lon: float = Field(ge=-180, le=180)


class RouteEstimateOut(BaseModel):
    distance_meters: float
    distance_km: float
    duration_seconds: float
    duration_in_traffic_seconds: float
    duration_minutes: float
    provider: str
    is_demo: bool


# ---- Audit Log ----

class AuditLogOut(BaseModel):
    id: str
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    detail: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


TokenResponse.model_rebuild()
