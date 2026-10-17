import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, Enum as SAEnum, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from app.database.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class RecurrenceType(str, enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class ScheduledTripStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ScheduledTrip(Base):
    __tablename__ = "scheduled_trips"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    booking_id = Column(String(36), ForeignKey("bookings.id"), nullable=True)

    title = Column(String(255), nullable=False)
    trip_purpose = Column(String(100), nullable=True)  # dialysis, rehab, discharge, etc.
    requested_category = Column(String(50), nullable=False, default="non_emergency")

    pickup_address = Column(Text, nullable=False)
    pickup_latitude = Column(Float, nullable=True)
    pickup_longitude = Column(Float, nullable=True)
    destination_address = Column(Text, nullable=False)
    destination_latitude = Column(Float, nullable=True)
    destination_longitude = Column(Float, nullable=True)
    destination_hospital_id = Column(String(36), ForeignKey("hospitals.id"), nullable=True)

    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    recurrence_type = Column(SAEnum(RecurrenceType), default=RecurrenceType.NONE)
    recurrence_days = Column(String(50), nullable=True)  # comma separated weekdays
    recurrence_end_date = Column(DateTime(timezone=True), nullable=True)
    recurrence_count = Column(Integer, nullable=True)

    contact_phone = Column(String(20), nullable=True)
    patient_notes = Column(Text, nullable=True)
    status = Column(SAEnum(ScheduledTripStatus), default=ScheduledTripStatus.SCHEDULED)

    assigned_ambulance_id = Column(String(36), ForeignKey("ambulances.id"), nullable=True)
    assigned_operator_id = Column(String(36), ForeignKey("operators.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    patient = relationship("User", foreign_keys=[patient_user_id])
    booking = relationship("Booking", foreign_keys=[booking_id])
    destination_hospital = relationship("Hospital", foreign_keys=[destination_hospital_id])
    assigned_ambulance = relationship("Ambulance", foreign_keys=[assigned_ambulance_id])
    assigned_operator = relationship("Operator", foreign_keys=[assigned_operator_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(36), nullable=True)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    type = Column(String(50), nullable=True)
    related_booking_id = Column(String(36), nullable=True)
    is_read = Column(Boolean, default=False)
    delivered_via = Column(String(50), default="in_app")  # in_app | fcm | sms
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", foreign_keys=[user_id])
