import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base


def utcnow_str():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created = Column(String(50), default=utcnow_str)
    reporter = Column(String(100), default="citizen")
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(Text, nullable=True, default="")
    description = Column(Text, nullable=False)
    condition = Column(String(50), default="general")
    severity = Column(String(50), default="moderate")
    photo = Column(Text, nullable=True)  # base64 data URI
    status = Column(String(50), default="reported")  # reported, verified, dispatched, closed, cancelled
    verified_by = Column(String(100), nullable=True)
    ambulance_id = Column(Integer, nullable=True)
    hospital_id = Column(Integer, nullable=True)
    eta_min = Column(Float, nullable=True)
    pickup_km = Column(Float, nullable=True)
    baseline_eta_min = Column(Float, nullable=True)
    baseline_km = Column(Float, nullable=True)
    hosp_km = Column(Float, nullable=True)
    source = Column(String(50), default="estimate")
    simulated = Column(Integer, default=1)
    closed_at = Column(String(50), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    assigned_at = Column(String(50), nullable=True)


class PoliceStation(Base):
    __tablename__ = "police_stations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)


class PoliceNotification(Base):
    __tablename__ = "police_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ts = Column(String(50), default=utcnow_str)
    incident_id = Column(Integer, nullable=True)
    station_name = Column(String(255), nullable=False)
    station_lat = Column(Float, nullable=False)
    station_lng = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False)
    ambulance_callsign = Column(String(100), nullable=False)
    driver_message = Column(Text, nullable=True)
    delivery_status = Column(String(100), default="DEMO LOGGED ONLY - NOT SENT TO POLICE")


class Handover(Base):
    __tablename__ = "handovers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(Integer, nullable=False)
    hospital_id = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False)  # confirmed, pending, unavailable, unknown
    acknowledged_by = Column(String(255), default="")
    note = Column(Text, default="")
    updated = Column(String(50), default=utcnow_str)
