import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, Enum as SAEnum, ForeignKey, Text, JSON, Integer
from sqlalchemy.orm import relationship
from app.database.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class HospitalVerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    SUSPENDED = "suspended"


class NotificationStatus(str, enum.Enum):
    NOT_NOTIFIED = "not_notified"
    SENT = "sent"
    ACKNOWLEDGED = "acknowledged"
    UNABLE_TO_ACKNOWLEDGE = "unable_to_acknowledge"
    HANDOFF_RECORDED = "handoff_recorded"


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, unique=True)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True, default="Kerala")
    state = Column(String(100), nullable=True, default="Kerala")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(255), nullable=True)
    emergency_phone = Column(String(20), nullable=True)
    website = Column(String(255), nullable=True)
    services = Column(JSON, default=list)  # verified service categories
    capabilities = Column(Text, nullable=True, default="emergency,trauma,cardiology")
    er_beds = Column(Integer, default=5)
    info_updated = Column(DateTime(timezone=True), default=utcnow)
    verification_status = Column(SAEnum(HospitalVerificationStatus), default=HospitalVerificationStatus.PENDING)
    is_active = Column(Boolean, default=True)
    google_place_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", foreign_keys=[user_id])
    arrival_notifications = relationship("HospitalArrivalNotification", back_populates="hospital")


class HospitalArrivalNotification(Base):
    __tablename__ = "hospital_arrival_notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    booking_id = Column(String(36), ForeignKey("bookings.id"), nullable=False, unique=True)
    hospital_id = Column(String(36), ForeignKey("hospitals.id"), nullable=False)
    sent_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(NotificationStatus), default=NotificationStatus.SENT)
    estimated_arrival_at = Column(DateTime(timezone=True), nullable=True)
    patient_info_notes = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), default=utcnow)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    acknowledgement_note = Column(Text, nullable=True)
    handoff_recorded_at = Column(DateTime(timezone=True), nullable=True)
    handoff_note = Column(Text, nullable=True)

    booking = relationship("Booking", back_populates="hospital_notification")
    hospital = relationship("Hospital", back_populates="arrival_notifications")
    sent_by = relationship("User", foreign_keys=[sent_by_user_id])
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_user_id])
