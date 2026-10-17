"""
Models package - import all models here so Alembic can discover them.
"""
from app.models.user import User, UserRole
from app.models.ambulance import Ambulance, Operator, Driver, VehicleLocationUpdate, AmbulanceStatus, AmbulanceCategory, VerificationStatus
from app.models.booking import Booking, BookingStatusEvent, RouteEstimate, BookingStatus, BookingType
from app.models.hospital import Hospital, HospitalArrivalNotification, NotificationStatus, HospitalVerificationStatus
from app.models.scheduled_trip import ScheduledTrip, AuditLog, Notification, RecurrenceType, ScheduledTripStatus
from app.models.incident import Incident, PoliceStation, PoliceNotification, Handover

__all__ = [
    "User", "UserRole",
    "Ambulance", "Operator", "Driver", "VehicleLocationUpdate",
    "AmbulanceStatus", "AmbulanceCategory", "VerificationStatus",
    "Booking", "BookingStatusEvent", "RouteEstimate", "BookingStatus", "BookingType",
    "Hospital", "HospitalArrivalNotification", "NotificationStatus", "HospitalVerificationStatus",
    "ScheduledTrip", "AuditLog", "Notification", "RecurrenceType", "ScheduledTripStatus",
    "Incident", "PoliceStation", "PoliceNotification", "Handover",
]
