import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database.database import get_db
from app.schemas.schemas import (
    HospitalCreate, HospitalUpdate, HospitalOut,
    HospitalNotificationCreate, HospitalNotificationOut, AcknowledgeNotification
)
from app.models.hospital import Hospital, HospitalArrivalNotification, NotificationStatus, HospitalVerificationStatus
from app.models.booking import Booking, BookingStatus
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user, get_hospital_user, get_admin_user
from app.services.notification_service import send_notification, NotificationEvent
from app.models.scheduled_trip import AuditLog

router = APIRouter(prefix="/api/hospitals", tags=["Hospitals"])


def utcnow():
    return datetime.now(timezone.utc)


@router.get("", response_model=List[HospitalOut])
def list_hospitals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    hospitals = db.query(Hospital).filter(Hospital.is_active == True).all()
    return [HospitalOut.model_validate(h) for h in hospitals]


@router.post("", response_model=HospitalOut, status_code=201)
def create_hospital(
    request: HospitalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.HOSPITAL, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Hospital or admin access required")

    existing = db.query(Hospital).filter(Hospital.user_id == current_user.id).first()
    if existing and current_user.role == UserRole.HOSPITAL:
        raise HTTPException(status_code=400, detail="Hospital profile already exists")

    hospital = Hospital(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=request.name,
        address=request.address,
        city=request.city,
        latitude=request.latitude,
        longitude=request.longitude,
        contact_phone=request.contact_phone,
        contact_email=request.contact_email,
        emergency_phone=request.emergency_phone,
        website=request.website,
        services=request.services,
        verification_status=HospitalVerificationStatus.PENDING,
        is_active=True,
    )
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return HospitalOut.model_validate(hospital)


@router.get("/{hospital_id}", response_model=HospitalOut)
def get_hospital(
    hospital_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    h = db.query(Hospital).filter(Hospital.id == hospital_id, Hospital.is_active == True).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return HospitalOut.model_validate(h)


@router.patch("/{hospital_id}", response_model=HospitalOut)
def update_hospital(
    hospital_id: str,
    request: HospitalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    h = db.query(Hospital).filter(Hospital.id == hospital_id, Hospital.is_active == True).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")

    if current_user.role == UserRole.HOSPITAL and h.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(h, field, value)
    h.updated_at = utcnow()
    db.commit()
    db.refresh(h)
    return HospitalOut.model_validate(h)


@router.get("/me/profile", response_model=HospitalOut)
def get_my_hospital(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_hospital_user),
):
    h = db.query(Hospital).filter(Hospital.user_id == current_user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital profile not found. Please create one.")
    return HospitalOut.model_validate(h)


# ---- Arrival Notifications ----

notif_router = APIRouter(prefix="/api", tags=["Hospital Notifications"])


@notif_router.post("/bookings/{booking_id}/hospital-notification", response_model=HospitalNotificationOut, status_code=201)
async def send_hospital_notification(
    booking_id: str,
    request: HospitalNotificationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send arrival notification to a hospital for an active booking."""
    if current_user.role not in (UserRole.OPERATOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Operator access required to send hospital notifications")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not booking.destination_hospital_id:
        raise HTTPException(status_code=400, detail="Booking has no destination hospital")
    if booking.status not in (BookingStatus.ACCEPTED, BookingStatus.EN_ROUTE_PICKUP,
                               BookingStatus.ARRIVED_PICKUP, BookingStatus.PATIENT_ONBOARD,
                               BookingStatus.EN_ROUTE_DESTINATION):
        raise HTTPException(status_code=400, detail="Cannot send notification for booking in current status")

    # Check not already sent
    existing = db.query(HospitalArrivalNotification).filter(
        HospitalArrivalNotification.booking_id == booking_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Notification already sent for this booking")

    notification = HospitalArrivalNotification(
        id=str(uuid.uuid4()),
        booking_id=booking_id,
        hospital_id=booking.destination_hospital_id,
        sent_by_user_id=current_user.id,
        status=NotificationStatus.SENT,
        estimated_arrival_at=request.estimated_arrival_at,
        patient_info_notes=request.patient_info_notes,
    )
    db.add(notification)

    audit = AuditLog(
        id=str(uuid.uuid4()), user_id=current_user.id,
        action="hospital_notification_sent", resource_type="booking", resource_id=booking_id,
        detail=f"Hospital arrival notification sent for booking {booking.reference_number}"
    )
    db.add(audit)
    db.commit()
    db.refresh(notification)

    # Notify hospital coordinator
    hospital = db.query(Hospital).filter(Hospital.id == booking.destination_hospital_id).first()
    if hospital:
        background_tasks.add_task(
            send_notification, db, hospital.user_id,
            "Incoming Patient Alert",
            f"Ambulance arriving with patient for booking {booking.reference_number}. "
            f"ETA: {request.estimated_arrival_at.strftime('%H:%M') if request.estimated_arrival_at else 'TBD'}",
            NotificationEvent.HOSPITAL_NOTIFIED, booking_id
        )

    return HospitalNotificationOut.model_validate(notification)


@notif_router.post("/hospital-notifications/{notification_id}/acknowledge", response_model=HospitalNotificationOut)
async def acknowledge_notification(
    notification_id: str,
    request: AcknowledgeNotification,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_hospital_user),
):
    """Hospital coordinator acknowledges an arrival notification."""
    notif = db.query(HospitalArrivalNotification).filter(
        HospitalArrivalNotification.id == notification_id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Verify coordinator belongs to this hospital
    hospital = db.query(Hospital).filter(
        Hospital.id == notif.hospital_id, Hospital.user_id == current_user.id
    ).first()
    if not hospital and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to acknowledge for this hospital")

    notif.acknowledged_at = utcnow()
    notif.acknowledged_by_user_id = current_user.id
    notif.acknowledgement_note = request.note

    if request.unable:
        notif.status = NotificationStatus.UNABLE_TO_ACKNOWLEDGE
    else:
        notif.status = NotificationStatus.ACKNOWLEDGED

    audit = AuditLog(
        id=str(uuid.uuid4()), user_id=current_user.id,
        action="hospital_notification_acknowledged", resource_type="hospital_notification",
        resource_id=notification_id,
        detail=f"Notification {'unable to acknowledge' if request.unable else 'acknowledged'} by hospital coordinator"
    )
    db.add(audit)
    db.commit()
    db.refresh(notif)

    # Notify booking patient/operator
    booking = db.query(Booking).filter(Booking.id == notif.booking_id).first()
    if booking:
        background_tasks.add_task(
            send_notification, db, booking.patient_user_id,
            "Hospital Notified",
            f"Hospital has {'acknowledged' if not request.unable else 'noted'} your arrival.",
            NotificationEvent.HOSPITAL_ACKNOWLEDGED, booking.id
        )

    return HospitalNotificationOut.model_validate(notif)


@notif_router.get("/hospital-notifications", response_model=List[HospitalNotificationOut])
def list_hospital_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_hospital_user),
):
    """Hospital coordinator views incoming notifications."""
    hospital = db.query(Hospital).filter(Hospital.user_id == current_user.id).first()
    if not hospital and current_user.role != UserRole.ADMIN:
        # Return empty list when hospital profile hasn't been set up yet
        return []

    query = db.query(HospitalArrivalNotification)
    if hospital and current_user.role != UserRole.ADMIN:
        query = query.filter(HospitalArrivalNotification.hospital_id == hospital.id)

    notifications = query.order_by(HospitalArrivalNotification.sent_at.desc()).all()
    return [HospitalNotificationOut.model_validate(n) for n in notifications]
