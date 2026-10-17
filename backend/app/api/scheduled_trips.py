import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from app.database.database import get_db
from app.schemas.schemas import ScheduledTripCreate, ScheduledTripOut
from app.models.scheduled_trip import ScheduledTrip, ScheduledTripStatus
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/scheduled-trips", tags=["Scheduled Trips"])


def utcnow():
    return datetime.now(timezone.utc)


@router.post("", response_model=ScheduledTripOut, status_code=201)
def create_scheduled_trip(
    request: ScheduledTripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.PATIENT, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Patient access required")

    trip = ScheduledTrip(
        id=str(uuid.uuid4()),
        patient_user_id=current_user.id,
        title=request.title,
        trip_purpose=request.trip_purpose,
        requested_category=request.requested_category,
        pickup_address=request.pickup_address,
        pickup_latitude=request.pickup_latitude,
        pickup_longitude=request.pickup_longitude,
        destination_address=request.destination_address,
        destination_latitude=request.destination_latitude,
        destination_longitude=request.destination_longitude,
        destination_hospital_id=request.destination_hospital_id,
        scheduled_at=request.scheduled_at,
        recurrence_type=request.recurrence_type,
        recurrence_days=request.recurrence_days,
        recurrence_end_date=request.recurrence_end_date,
        contact_phone=request.contact_phone,
        patient_notes=request.patient_notes,
        status=ScheduledTripStatus.SCHEDULED,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return ScheduledTripOut.model_validate(trip)


@router.get("", response_model=List[ScheduledTripOut])
def list_scheduled_trips(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ScheduledTrip)
    if current_user.role == UserRole.PATIENT:
        query = query.filter(ScheduledTrip.patient_user_id == current_user.id)

    trips = query.order_by(ScheduledTrip.scheduled_at).offset((page - 1) * page_size).limit(page_size).all()
    return [ScheduledTripOut.model_validate(t) for t in trips]


@router.get("/{trip_id}", response_model=ScheduledTripOut)
def get_scheduled_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(ScheduledTrip).filter(ScheduledTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Scheduled trip not found")
    if current_user.role == UserRole.PATIENT and trip.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return ScheduledTripOut.model_validate(trip)


@router.patch("/{trip_id}", response_model=ScheduledTripOut)
def update_scheduled_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: str = Query(None),
):
    trip = db.query(ScheduledTrip).filter(ScheduledTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Scheduled trip not found")
    if current_user.role == UserRole.PATIENT and trip.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if status:
        try:
            trip.status = ScheduledTripStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    trip.updated_at = utcnow()
    db.commit()
    db.refresh(trip)
    return ScheduledTripOut.model_validate(trip)
