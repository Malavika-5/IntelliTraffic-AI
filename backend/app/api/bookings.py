import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timezone

from app.database.database import get_db
from app.schemas.schemas import (
    BookingCreate, BookingOut, BookingStatusUpdate, BookingCancelRequest,
    BookingStatusEventOut, MatchResultOut, MatchCandidateOut
)
from app.models.booking import Booking, BookingStatusEvent, BookingStatus, BookingType, RouteEstimate
from app.models.ambulance import Ambulance, Operator, AmbulanceStatus
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user
from app.services.matching_engine import find_eligible_ambulances
from app.services.notification_service import send_notification, NotificationEvent, send_emergency_contact_sms
from app.services.websocket_manager import ws_manager
from app.models.scheduled_trip import AuditLog

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


def utcnow():
    return datetime.now(timezone.utc)


def generate_ref():
    return "IT" + str(uuid.uuid4())[:8].upper()


def _serialize_booking(b: Booking) -> BookingOut:
    return BookingOut.model_validate(b)


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(
    request: BookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.PATIENT, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only patients can create bookings")

    booking_id = str(uuid.uuid4())
    ref_num = generate_ref()

    # Determine emergency contact to inform
    emergency_phone = (
        request.emergency_contact_phone
        or current_user.emergency_contact_phone
        or current_user.phone
    )
    emergency_name = (
        request.emergency_contact_name
        or current_user.emergency_contact_name
        or "Family Emergency Contact"
    )

    emergency_msg = None
    notified = False
    notified_at = None

    if emergency_phone:
        notified = True
        notified_at = utcnow()
        patient_display = request.patient_name or current_user.full_name or "Patient"
        loc_display = request.pickup_address or f"{request.pickup_latitude:.4f}, {request.pickup_longitude:.4f}"
        emergency_msg = (
            f"🚨 EMERGENCY ALERT: Ambulance requested for {patient_display} (Ref #{ref_num}). "
            f"Pickup: {loc_display}. Live Tracking: http://localhost:5173/track/{booking_id}"
        )

    booking = Booking(
        id=booking_id,
        reference_number=ref_num,
        patient_user_id=current_user.id,
        booking_type=BookingType(request.booking_type),
        requested_category=request.requested_category,
        status=BookingStatus.PENDING,
        pickup_latitude=request.pickup_latitude,
        pickup_longitude=request.pickup_longitude,
        pickup_address=request.pickup_address,
        pickup_landmark=request.pickup_landmark,
        destination_latitude=request.destination_latitude,
        destination_longitude=request.destination_longitude,
        destination_address=request.destination_address,
        destination_hospital_id=request.destination_hospital_id,
        patient_name=request.patient_name or current_user.full_name,
        patient_age=request.patient_age,
        patient_notes=request.patient_notes,
        contact_phone=request.contact_phone or current_user.phone,
        emergency_contact_phone=emergency_phone,
        emergency_contact_name=emergency_name,
        emergency_contact_notified=notified,
        emergency_contact_notified_at=notified_at,
        emergency_contact_message=emergency_msg,
        scheduled_at=request.scheduled_at,
        is_demo=False,
    )
    db.add(booking)

    event = BookingStatusEvent(
        id=str(uuid.uuid4()),
        booking_id=booking.id,
        from_status=None,
        to_status=BookingStatus.PENDING,
        note="Booking created",
        triggered_by_user_id=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(booking)

    # Background: notify patient + WS
    background_tasks.add_task(
        send_notification, db, current_user.id,
        "Booking Created",
        f"Your booking {booking.reference_number} has been submitted. Searching for an ambulance.",
        NotificationEvent.BOOKING_CREATED, booking.id
    )
    background_tasks.add_task(
        ws_manager.send_to_user, current_user.id,
        {"type": "booking_created", "booking_id": booking.id, "reference": booking.reference_number}
    )

    # Background: Dispatch SMS alert to emergency contact given during login/registration/booking
    if emergency_phone and emergency_msg:
        background_tasks.add_task(
            send_emergency_contact_sms,
            emergency_phone,
            emergency_msg,
            emergency_name,
            booking.id,
        )
        background_tasks.add_task(
            send_notification, db, current_user.id,
            "Emergency Contact Informed",
            f"SMS emergency dispatch sent to {emergency_phone} ({emergency_name}) with live GPS tracking link.",
            NotificationEvent.EMERGENCY_CONTACT_ALERTED, booking.id
        )
        background_tasks.add_task(
            ws_manager.send_to_user, current_user.id,
            {
                "type": "emergency_contact_alerted",
                "booking_id": booking.id,
                "phone": emergency_phone,
                "name": emergency_name,
                "message": emergency_msg,
            }
        )

    return _serialize_booking(booking)


@router.get("", response_model=List[BookingOut])
def list_bookings(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Booking)

    if current_user.role == UserRole.PATIENT:
        query = query.filter(Booking.patient_user_id == current_user.id)
    elif current_user.role == UserRole.OPERATOR:
        op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
        if op:
            query = query.filter(Booking.assigned_operator_id == op.id)
    # Admin sees all

    if status:
        query = query.filter(Booking.status == status)

    bookings = query.order_by(Booking.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [_serialize_booking(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Access control
    if current_user.role == UserRole.PATIENT and booking.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == UserRole.OPERATOR:
        op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
        if op and booking.assigned_operator_id != op.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    return _serialize_booking(booking)


@router.post("/{booking_id}/match", response_model=MatchResultOut)
async def match_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run matching engine to find eligible ambulances."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.role == UserRole.PATIENT and booking.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if booking.status not in (BookingStatus.PENDING, BookingStatus.SEARCHING, BookingStatus.REJECTED):
        raise HTTPException(status_code=400, detail=f"Cannot match booking in status: {booking.status}")

    # Update status to searching
    booking.status = BookingStatus.SEARCHING
    event = BookingStatusEvent(
        id=str(uuid.uuid4()),
        booking_id=booking.id,
        from_status=BookingStatus.PENDING,
        to_status=BookingStatus.SEARCHING,
        note="Matching engine initiated",
        triggered_by_user_id=current_user.id,
    )
    db.add(event)
    db.commit()

    # Run matching
    match_result = await find_eligible_ambulances(
        db=db,
        requested_category=booking.requested_category,
        pickup_lat=booking.pickup_latitude,
        pickup_lon=booking.pickup_longitude,
    )

    if match_result.best_match:
        # Update ETA on booking
        booking.estimated_arrival_minutes = match_result.best_match.estimated_eta_minutes
        booking.eta_last_updated_at = utcnow()
        db.commit()

    if not match_result.candidates:
        booking.status = BookingStatus.NO_MATCH
        event2 = BookingStatusEvent(
            id=str(uuid.uuid4()), booking_id=booking.id,
            from_status=BookingStatus.SEARCHING, to_status=BookingStatus.NO_MATCH,
            note=match_result.matching_notes,
        )
        db.add(event2)
        db.commit()

    return MatchResultOut(
        candidates=[MatchCandidateOut.from_result(c, is_eligible=True) for c in match_result.candidates],
        excluded=[MatchCandidateOut.from_result(c, is_eligible=False) for c in match_result.excluded],
        best_match=MatchCandidateOut.from_result(match_result.best_match, is_eligible=True) if match_result.best_match else None,
        routing_provider=match_result.routing_provider,
        matching_notes=match_result.matching_notes,
    )


@router.post("/{booking_id}/accept", response_model=BookingOut)
async def accept_booking(
    booking_id: str,
    background_tasks: BackgroundTasks,
    ambulance_id: str = Query(..., description="ID of the ambulance to assign"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Operator accepts a booking and assigns a specific ambulance."""
    if current_user.role not in (UserRole.OPERATOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Operator access required")

    # Use a transaction-safe approach
    booking = db.query(Booking).filter(Booking.id == booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in (BookingStatus.SEARCHING, BookingStatus.PENDING):
        raise HTTPException(status_code=400, detail=f"Booking is not in a searchable state: {booking.status}")
    if booking.assigned_ambulance_id and booking.status == BookingStatus.ACCEPTED:
        raise HTTPException(status_code=409, detail="Booking already accepted by another operator")

    # Verify ambulance is available and operator owns it
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).with_for_update().first()
    if not ambulance:
        raise HTTPException(status_code=404, detail="Ambulance not found")
    if ambulance.status != AmbulanceStatus.AVAILABLE:
        raise HTTPException(status_code=409, detail=f"Ambulance is not available: {ambulance.status}")

    op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
    if current_user.role != UserRole.ADMIN and (not op or ambulance.operator_id != op.id):
        raise HTTPException(status_code=403, detail="Not authorized to use this ambulance")

    now = utcnow()
    booking.status = BookingStatus.ACCEPTED
    booking.assigned_ambulance_id = ambulance_id
    booking.assigned_operator_id = op.id if op else ambulance.operator_id
    booking.accepted_at = now

    # Lock ambulance to busy
    ambulance.status = AmbulanceStatus.BUSY

    event = BookingStatusEvent(
        id=str(uuid.uuid4()),
        booking_id=booking.id,
        from_status=BookingStatus.SEARCHING,
        to_status=BookingStatus.ACCEPTED,
        note=f"Accepted by operator. Ambulance {ambulance.registration_number} assigned.",
        triggered_by_user_id=current_user.id,
    )
    db.add(event)

    audit = AuditLog(id=str(uuid.uuid4()), user_id=current_user.id,
                     action="booking_accepted", resource_type="booking", resource_id=booking.id,
                     detail=f"Ambulance {ambulance.registration_number} assigned to booking {booking.reference_number}")
    db.add(audit)
    db.commit()
    db.refresh(booking)

    # Notify patient
    background_tasks.add_task(
        send_notification, db, booking.patient_user_id,
        "Ambulance Accepted",
        f"Ambulance {ambulance.registration_number} is on the way. ETA: ~{booking.estimated_arrival_minutes:.0f} min.",
        NotificationEvent.OPERATOR_ACCEPTED, booking.id
    )
    background_tasks.add_task(
        ws_manager.send_to_user, booking.patient_user_id,
        {"type": "booking_accepted", "booking_id": booking.id,
         "ambulance": ambulance.registration_number,
         "eta_minutes": booking.estimated_arrival_minutes}
    )

    return _serialize_booking(booking)


@router.post("/{booking_id}/reject", response_model=BookingOut)
async def reject_booking(
    booking_id: str,
    background_tasks: BackgroundTasks,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.OPERATOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Operator access required")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in (BookingStatus.SEARCHING, BookingStatus.PENDING):
        raise HTTPException(status_code=400, detail="Booking is not in a searchable state")

    booking.status = BookingStatus.REJECTED
    event = BookingStatusEvent(
        id=str(uuid.uuid4()),
        booking_id=booking.id,
        from_status=BookingStatus.SEARCHING,
        to_status=BookingStatus.REJECTED,
        note=reason or "Operator rejected request",
        triggered_by_user_id=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(booking)

    background_tasks.add_task(
        send_notification, db, booking.patient_user_id,
        "Booking Update",
        "The operator could not accept your request. Please try again or contact emergency services.",
        NotificationEvent.OPERATOR_REJECTED, booking.id
    )

    return _serialize_booking(booking)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
async def cancel_booking(
    booking_id: str,
    request: BookingCancelRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only patient, operator, or admin can cancel
    if current_user.role == UserRole.PATIENT and booking.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if booking.status in (BookingStatus.COMPLETED, BookingStatus.CANCELLED):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {booking.status} booking")

    prev_status = booking.status
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = utcnow()
    booking.cancellation_reason = request.reason or "User cancelled"

    # Release ambulance if assigned
    if booking.assigned_ambulance_id:
        amb = db.query(Ambulance).filter(Ambulance.id == booking.assigned_ambulance_id).first()
        if amb and amb.status == AmbulanceStatus.BUSY:
            amb.status = AmbulanceStatus.AVAILABLE

    event = BookingStatusEvent(
        id=str(uuid.uuid4()),
        booking_id=booking.id,
        from_status=prev_status,
        to_status=BookingStatus.CANCELLED,
        note=booking.cancellation_reason,
        triggered_by_user_id=current_user.id,
    )
    db.add(event)

    audit = AuditLog(id=str(uuid.uuid4()), user_id=current_user.id,
                     action="booking_cancelled", resource_type="booking", resource_id=booking.id)
    db.add(audit)
    db.commit()
    db.refresh(booking)

    background_tasks.add_task(
        ws_manager.send_to_user, booking.patient_user_id,
        {"type": "booking_cancelled", "booking_id": booking.id}
    )

    return _serialize_booking(booking)


@router.post("/{booking_id}/status", response_model=BookingOut)
async def update_booking_status(
    booking_id: str,
    request: BookingStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Operator updates trip status."""
    if current_user.role not in (UserRole.OPERATOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Operator access required")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.role == UserRole.OPERATOR:
        op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
        if not op or booking.assigned_operator_id != op.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    prev_status = booking.status
    new_status = BookingStatus(request.status)
    booking.status = new_status

    if new_status == BookingStatus.COMPLETED:
        booking.completed_at = utcnow()
        # Release ambulance
        if booking.assigned_ambulance_id:
            amb = db.query(Ambulance).filter(Ambulance.id == booking.assigned_ambulance_id).first()
            if amb:
                amb.status = AmbulanceStatus.AVAILABLE

    event = BookingStatusEvent(
        id=str(uuid.uuid4()),
        booking_id=booking.id,
        from_status=prev_status,
        to_status=new_status,
        note=request.note,
        triggered_by_user_id=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(booking)

    background_tasks.add_task(
        ws_manager.send_to_user, booking.patient_user_id,
        {"type": "status_update", "booking_id": booking.id, "status": new_status.value}
    )

    return _serialize_booking(booking)


@router.get("/{booking_id}/events", response_model=List[BookingStatusEventOut])
def get_booking_events(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.role == UserRole.PATIENT and booking.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    events = db.query(BookingStatusEvent).filter(
        BookingStatusEvent.booking_id == booking_id
    ).order_by(BookingStatusEvent.created_at).all()
    return [BookingStatusEventOut.model_validate(e) for e in events]


@router.post("/{booking_id}/resend-emergency-alert", response_model=BookingOut)
async def resend_emergency_alert(
    booking_id: str,
    background_tasks: BackgroundTasks,
    custom_phone: Optional[str] = Query(None),
    custom_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.role == UserRole.PATIENT and booking.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    phone = (
        custom_phone
        or booking.emergency_contact_phone
        or current_user.emergency_contact_phone
        or current_user.phone
    )
    if not phone:
        raise HTTPException(status_code=400, detail="No emergency contact number available to alert")

    name = custom_name or booking.emergency_contact_name or current_user.emergency_contact_name or "Emergency Contact"
    patient_display = booking.patient_name or current_user.full_name or "Patient"
    loc_display = booking.pickup_address or f"{booking.pickup_latitude:.4f}, {booking.pickup_longitude:.4f}"
    emergency_msg = (
        f"🚨 EMERGENCY ALERT: Ambulance requested for {patient_display} (Ref #{booking.reference_number}). "
        f"Pickup: {loc_display}. Live Tracking: http://localhost:5173/track/{booking.id}"
    )

    booking.emergency_contact_phone = phone
    booking.emergency_contact_name = name
    booking.emergency_contact_notified = True
    booking.emergency_contact_notified_at = utcnow()
    booking.emergency_contact_message = emergency_msg
    db.commit()
    db.refresh(booking)

    background_tasks.add_task(
        send_emergency_contact_sms,
        phone,
        emergency_msg,
        name,
        booking.id,
    )
    background_tasks.add_task(
        send_notification, db, current_user.id,
        "Emergency Alert Dispatched",
        f"SMS alert successfully dispatched to {phone} ({name}).",
        NotificationEvent.EMERGENCY_CONTACT_ALERTED, booking.id
    )

    return _serialize_booking(booking)
