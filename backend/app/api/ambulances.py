from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database.database import get_db
from app.schemas.schemas import (
    AmbulanceCreate, AmbulanceUpdate, AmbulanceOut, AmbulanceAvailabilityUpdate,
    AmbulanceLocationUpdate, DriverCreate, DriverOut, OperatorOut
)
from app.models.ambulance import Ambulance, Operator, Driver, VehicleLocationUpdate, AmbulanceStatus, VerificationStatus
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user, get_operator_user, get_admin_user
from app.models.scheduled_trip import AuditLog
import uuid

router = APIRouter(prefix="/api", tags=["Ambulances"])


@router.get("/ambulances", response_model=List[AmbulanceOut])
def list_ambulances(
    status: Optional[str] = None,
    category: Optional[str] = None,
    operator_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Ambulance).filter(Ambulance.is_active == True)

    # Operators can only see their own ambulances
    if current_user.role == UserRole.OPERATOR:
        op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
        if op:
            query = query.filter(Ambulance.operator_id == op.id)
    elif operator_id and current_user.role == UserRole.ADMIN:
        query = query.filter(Ambulance.operator_id == operator_id)

    if status:
        query = query.filter(Ambulance.status == status)
    if category:
        query = query.filter(Ambulance.category == category)

    total = query.count()
    ambulances = query.offset((page - 1) * page_size).limit(page_size).all()
    return [AmbulanceOut.model_validate(a) for a in ambulances]


@router.post("/ambulances", response_model=AmbulanceOut, status_code=201)
def create_ambulance(
    request: AmbulanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    # Get operator
    op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
    if not op and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=404, detail="Operator profile not found")

    # Check duplicate registration
    existing = db.query(Ambulance).filter(
        Ambulance.registration_number == request.registration_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Registration number already exists")

    amb = Ambulance(
        id=str(uuid.uuid4()),
        operator_id=op.id if op else request.dict().get("operator_id"),
        registration_number=request.registration_number,
        vehicle_name=request.vehicle_name,
        category=request.category,
        capabilities=request.capabilities,
        equipment_notes=request.equipment_notes,
        capacity=request.capacity,
        driver_id=request.driver_id,
        verification_status=VerificationStatus.PENDING,
        is_active=True,
    )
    db.add(amb)

    # Audit
    audit = AuditLog(id=str(uuid.uuid4()), user_id=current_user.id,
                     action="ambulance_created", resource_type="ambulance", resource_id=amb.id,
                     detail=f"Created ambulance {amb.registration_number}")
    db.add(audit)
    db.commit()
    db.refresh(amb)
    return AmbulanceOut.model_validate(amb)


@router.get("/ambulances/{ambulance_id}", response_model=AmbulanceOut)
def get_ambulance(
    ambulance_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    amb = db.query(Ambulance).filter(Ambulance.id == ambulance_id, Ambulance.is_active == True).first()
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")
    return AmbulanceOut.model_validate(amb)


@router.patch("/ambulances/{ambulance_id}", response_model=AmbulanceOut)
def update_ambulance(
    ambulance_id: str,
    request: AmbulanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    amb = db.query(Ambulance).filter(Ambulance.id == ambulance_id, Ambulance.is_active == True).first()
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")

    # Verify ownership
    if current_user.role != UserRole.ADMIN:
        op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
        if not op or amb.operator_id != op.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this ambulance")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(amb, field, value)
    amb.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(amb)
    return AmbulanceOut.model_validate(amb)


@router.patch("/ambulances/{ambulance_id}/availability", response_model=AmbulanceOut)
def update_availability(
    ambulance_id: str,
    request: AmbulanceAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    amb = db.query(Ambulance).filter(Ambulance.id == ambulance_id, Ambulance.is_active == True).first()
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")

    if current_user.role != UserRole.ADMIN:
        op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
        if not op or amb.operator_id != op.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    # Prevent setting to available if it's currently assigned to an active booking
    from app.models.booking import Booking, BookingStatus
    active_booking = db.query(Booking).filter(
        Booking.assigned_ambulance_id == ambulance_id,
        Booking.status.in_([BookingStatus.ACCEPTED, BookingStatus.EN_ROUTE_PICKUP,
                              BookingStatus.ARRIVED_PICKUP, BookingStatus.PATIENT_ONBOARD,
                              BookingStatus.EN_ROUTE_DESTINATION])
    ).first()
    if active_booking and request.status == "available":
        raise HTTPException(status_code=400, detail="Cannot set to available: ambulance has an active booking")

    amb.status = request.status
    amb.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(amb)
    return AmbulanceOut.model_validate(amb)


@router.post("/ambulances/{ambulance_id}/location", status_code=204)
def update_location(
    ambulance_id: str,
    request: AmbulanceLocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    amb = db.query(Ambulance).filter(Ambulance.id == ambulance_id, Ambulance.is_active == True).first()
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")

    if current_user.role != UserRole.ADMIN:
        op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
        if not op or amb.operator_id != op.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    # Update ambulance last known location
    now = datetime.now(timezone.utc)
    amb.last_latitude = request.latitude
    amb.last_longitude = request.longitude
    amb.last_location_update = now

    # Record location update history
    loc = VehicleLocationUpdate(
        id=str(uuid.uuid4()),
        ambulance_id=ambulance_id,
        latitude=request.latitude,
        longitude=request.longitude,
        accuracy_meters=request.accuracy_meters,
        speed_kmh=request.speed_kmh,
        heading_degrees=request.heading_degrees,
        recorded_at=now,
        source="gps",
    )
    db.add(loc)
    db.commit()


@router.get("/operators/me/dashboard")
def operator_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operator profile not found")

    from app.models.booking import Booking, BookingStatus
    from datetime import date

    ambulances = db.query(Ambulance).filter(Ambulance.operator_id == op.id, Ambulance.is_active == True).all()
    available = sum(1 for a in ambulances if a.status == AmbulanceStatus.AVAILABLE)
    busy = sum(1 for a in ambulances if a.status == AmbulanceStatus.BUSY)
    offline = sum(1 for a in ambulances if a.status in [AmbulanceStatus.OFFLINE, AmbulanceStatus.MAINTENANCE])

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    all_bookings = db.query(Booking).filter(Booking.assigned_operator_id == op.id).all()
    completed = sum(1 for b in all_bookings if b.status == BookingStatus.COMPLETED)
    cancelled = sum(1 for b in all_bookings if b.status == BookingStatus.CANCELLED)
    active = sum(1 for b in all_bookings if b.status in [
        BookingStatus.ACCEPTED, BookingStatus.EN_ROUTE_PICKUP,
        BookingStatus.ARRIVED_PICKUP, BookingStatus.PATIENT_ONBOARD,
        BookingStatus.EN_ROUTE_DESTINATION
    ])
    today_completed = sum(1 for b in all_bookings if b.status == BookingStatus.COMPLETED
                          and b.completed_at and b.completed_at >= today_start)
    total_revenue = sum(b.recorded_fare_inr or b.estimated_fare_inr or 0 for b in all_bookings if b.status == BookingStatus.COMPLETED)

    pending_requests = db.query(Booking).filter(
        Booking.assigned_operator_id == op.id,
        Booking.status == BookingStatus.SEARCHING
    ).all()

    return {
        "operator": OperatorOut.model_validate(op),
        "ambulances": {"total": len(ambulances), "available": available, "busy": busy, "offline": offline},
        "bookings": {"total": len(all_bookings), "completed": completed, "cancelled": cancelled, "active": active, "today": today_completed},
        "pending_requests": len(pending_requests),
        "total_revenue_inr": total_revenue,
    }


# ---- Drivers ----

@router.get("/operators/me/drivers", response_model=List[DriverOut])
def list_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    drivers = db.query(Driver).filter(Driver.operator_id == op.id, Driver.is_active == True).all()
    return [DriverOut.model_validate(d) for d in drivers]


@router.post("/operators/me/drivers", response_model=DriverOut, status_code=201)
def create_driver(
    request: DriverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    driver = Driver(
        id=str(uuid.uuid4()),
        operator_id=op.id,
        full_name=request.full_name,
        phone=request.phone,
        license_number=request.license_number,
        license_expiry=request.license_expiry,
        is_active=True,
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return DriverOut.model_validate(driver)
