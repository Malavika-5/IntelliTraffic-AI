import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, Enum as SAEnum, ForeignKey, JSON, Integer, Text
from sqlalchemy.orm import relationship
from app.database.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class AmbulanceStatus(str, enum.Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"


class AmbulanceCategory(str, enum.Enum):
    BASIC = "basic"
    ALS = "als"          # Advanced Life Support
    ICU = "icu"
    NEONATAL = "neonatal"
    WHEELCHAIR = "wheelchair"
    NON_EMERGENCY = "non_emergency"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class Operator(Base):
    __tablename__ = "operators"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)
    organization_name = Column(String(255), nullable=False)
    registration_number = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True, default="Kerala")
    state = Column(String(100), nullable=True, default="Kerala")
    country = Column(String(50), nullable=True, default="India")
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(255), nullable=True)
    verification_status = Column(SAEnum(VerificationStatus), default=VerificationStatus.PENDING)
    subscription_plan = Column(String(50), nullable=True, default="starter")
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    ambulances = relationship("Ambulance", back_populates="operator")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    operator_id = Column(String(36), ForeignKey("operators.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    license_number = Column(String(100), nullable=True)
    license_expiry = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    operator = relationship("Operator")


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    operator_id = Column(String(36), ForeignKey("operators.id"), nullable=False)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=True)
    registration_number = Column(String(50), unique=True, nullable=False)
    vehicle_name = Column(String(255), nullable=True)
    category = Column(SAEnum(AmbulanceCategory), nullable=False, default=AmbulanceCategory.BASIC)
    status = Column(SAEnum(AmbulanceStatus), nullable=False, default=AmbulanceStatus.OFFLINE)
    verification_status = Column(SAEnum(VerificationStatus), default=VerificationStatus.PENDING)

    # Capabilities stored as JSON list
    capabilities = Column(JSON, default=list)

    # Location
    last_latitude = Column(Float, nullable=True)
    last_longitude = Column(Float, nullable=True)
    last_location_update = Column(DateTime(timezone=True), nullable=True)

    # Equipment notes
    equipment_notes = Column(Text, nullable=True)
    capacity = Column(Integer, default=1)

    # Fleet & Cost Tracking
    callsign = Column(String(50), nullable=True)
    cost_per_km = Column(Float, default=12.0)
    km_run = Column(Float, default=0.0)
    trips = Column(Integer, default=0)
    next_service = Column(String(50), nullable=True)

    # Documents
    insurance_expiry = Column(DateTime(timezone=True), nullable=True)
    permit_expiry = Column(DateTime(timezone=True), nullable=True)
    fitness_expiry = Column(DateTime(timezone=True), nullable=True)
    next_maintenance_date = Column(DateTime(timezone=True), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    operator = relationship("Operator", back_populates="ambulances")
    driver = relationship("Driver", foreign_keys=[driver_id])
    location_updates = relationship("VehicleLocationUpdate", back_populates="ambulance", order_by="VehicleLocationUpdate.recorded_at.desc()")


class VehicleLocationUpdate(Base):
    __tablename__ = "vehicle_location_updates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ambulance_id = Column(String(36), ForeignKey("ambulances.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy_meters = Column(Float, nullable=True)
    speed_kmh = Column(Float, nullable=True)
    heading_degrees = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    source = Column(String(50), default="gps")  # gps | manual | demo

    ambulance = relationship("Ambulance", back_populates="location_updates")
