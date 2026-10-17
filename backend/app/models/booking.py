import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, Enum as SAEnum, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.database.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    SEARCHING = "searching"
    ACCEPTED = "accepted"
    EN_ROUTE_PICKUP = "en_route_pickup"
    ARRIVED_PICKUP = "arrived_pickup"
    PATIENT_ONBOARD = "patient_onboard"
    EN_ROUTE_DESTINATION = "en_route_destination"
    HANDOFF_RECORDED = "handoff_recorded"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_MATCH = "no_match"
    REJECTED = "rejected"


class BookingType(str, enum.Enum):
    EMERGENCY = "emergency"
    SCHEDULED = "scheduled"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    reference_number = Column(String(20), unique=True, nullable=False)
    patient_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    booking_type = Column(SAEnum(BookingType), default=BookingType.EMERGENCY, nullable=False)
    requested_category = Column(String(50), nullable=False)
    status = Column(SAEnum(BookingStatus), default=BookingStatus.PENDING, nullable=False)

    # Pickup
    pickup_latitude = Column(Float, nullable=False)
    pickup_longitude = Column(Float, nullable=False)
    pickup_address = Column(Text, nullable=True)
    pickup_landmark = Column(String(255), nullable=True)

    # Destination
    destination_latitude = Column(Float, nullable=True)
    destination_longitude = Column(Float, nullable=True)
    destination_address = Column(Text, nullable=True)
    destination_hospital_id = Column(String(36), ForeignKey("hospitals.id"), nullable=True)

    # Patient info for this booking
    patient_name = Column(String(255), nullable=True)
    patient_age = Column(String(10), nullable=True)
    patient_notes = Column(Text, nullable=True)
    contact_phone = Column(String(20), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_notified = Column(Boolean, default=False, nullable=False)
    emergency_contact_notified_at = Column(DateTime(timezone=True), nullable=True)
    emergency_contact_message = Column(Text, nullable=True)

    # Scheduling
    scheduled_at = Column(DateTime(timezone=True), nullable=True)  # None = immediate

    # Assignment
    assigned_ambulance_id = Column(String(36), ForeignKey("ambulances.id"), nullable=True)
    assigned_operator_id = Column(String(36), ForeignKey("operators.id"), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    # ETA tracking
    estimated_arrival_minutes = Column(Float, nullable=True)
    eta_last_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Estimated fare
    estimated_fare_inr = Column(Float, nullable=True)
    recorded_fare_inr = Column(Float, nullable=True)

    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    patient = relationship("User", foreign_keys=[patient_user_id])
    assigned_ambulance = relationship("Ambulance", foreign_keys=[assigned_ambulance_id])
    assigned_operator = relationship("Operator", foreign_keys=[assigned_operator_id])
    destination_hospital = relationship("Hospital", foreign_keys=[destination_hospital_id])
    status_events = relationship("BookingStatusEvent", back_populates="booking", order_by="BookingStatusEvent.created_at")
    route_estimates = relationship("RouteEstimate", back_populates="booking")
    hospital_notification = relationship("HospitalArrivalNotification", back_populates="booking", uselist=False)


class BookingStatusEvent(Base):
    __tablename__ = "booking_status_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    booking_id = Column(String(36), ForeignKey("bookings.id"), nullable=False)
    from_status = Column(SAEnum(BookingStatus), nullable=True)
    to_status = Column(SAEnum(BookingStatus), nullable=False)
    note = Column(Text, nullable=True)
    triggered_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    booking = relationship("Booking", back_populates="status_events")
    triggered_by = relationship("User", foreign_keys=[triggered_by_user_id])


class RouteEstimate(Base):
    __tablename__ = "route_estimates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    booking_id = Column(String(36), ForeignKey("bookings.id"), nullable=False)
    ambulance_id = Column(String(36), ForeignKey("ambulances.id"), nullable=True)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    destination_lat = Column(Float, nullable=False)
    destination_lng = Column(Float, nullable=False)
    distance_meters = Column(Float, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    duration_in_traffic_seconds = Column(Float, nullable=True)
    provider = Column(String(50), default="demo")  # demo | google
    is_demo = Column(Boolean, default=True)
    polyline = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    booking = relationship("Booking", back_populates="route_estimates")
