from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timezone, timedelta

from app.database.database import get_db
from app.schemas.schemas import OperatorAnalyticsOut, AdminAnalyticsOut
from app.models.booking import Booking, BookingStatus
from app.models.ambulance import Ambulance, Operator, AmbulanceStatus, VerificationStatus
from app.models.hospital import Hospital
from app.models.user import User, UserRole
from app.core.dependencies import get_current_user, get_operator_user, get_admin_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def utcnow():
    return datetime.now(timezone.utc)


def _to_naive(dt):
    """Strip timezone info for SQLite-safe comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def _naive_utcnow():
    return datetime.utcnow()


@router.get("/operator", response_model=OperatorAnalyticsOut)
def operator_analytics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_operator_user),
):
    op = db.query(Operator).filter(Operator.user_id == current_user.id).first()
    if not op:
        # Return zeroed analytics when operator profile hasn't been set up yet
        return OperatorAnalyticsOut(
            total_ambulances=0,
            available_ambulances=0,
            busy_ambulances=0,
            offline_ambulances=0,
            total_bookings=0,
            completed_bookings=0,
            cancelled_bookings=0,
            pending_bookings=0,
            avg_response_time_minutes=None,
            total_estimated_revenue_inr=0.0,
            bookings_today=0,
            trips_per_ambulance=[],
        )

    since = _naive_utcnow() - timedelta(days=days)
    today_start = _naive_utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    ambulances = db.query(Ambulance).filter(Ambulance.operator_id == op.id, Ambulance.is_active == True).all()
    available = sum(1 for a in ambulances if a.status == AmbulanceStatus.AVAILABLE)
    busy = sum(1 for a in ambulances if a.status == AmbulanceStatus.BUSY)
    offline = sum(1 for a in ambulances if a.status in [AmbulanceStatus.OFFLINE, AmbulanceStatus.MAINTENANCE])

    all_bookings = db.query(Booking).filter(
        Booking.assigned_operator_id == op.id,
        Booking.created_at >= since
    ).all()
    completed = [b for b in all_bookings if b.status == BookingStatus.COMPLETED]
    cancelled = [b for b in all_bookings if b.status == BookingStatus.CANCELLED]
    pending = [b for b in all_bookings if b.status in (BookingStatus.PENDING, BookingStatus.SEARCHING)]
    today = [b for b in all_bookings if _to_naive(b.created_at) >= today_start]

    # Average response time: accepted_at - created_at
    resp_times = []
    for b in completed:
        if b.accepted_at:
            acc = _to_naive(b.accepted_at)
            cre = _to_naive(b.created_at)
            resp_times.append((acc - cre).total_seconds() / 60)
    avg_resp = round(sum(resp_times) / len(resp_times), 1) if resp_times else None

    total_revenue = sum(b.recorded_fare_inr or b.estimated_fare_inr or 0 for b in completed)

    # Trips per ambulance
    trips_per_amb = []
    for amb in ambulances:
        count = sum(1 for b in all_bookings if b.assigned_ambulance_id == amb.id)
        trips_per_amb.append({"ambulance": amb.registration_number, "trips": count, "category": amb.category.value})

    return OperatorAnalyticsOut(
        total_ambulances=len(ambulances),
        available_ambulances=available,
        busy_ambulances=busy,
        offline_ambulances=offline,
        total_bookings=len(all_bookings),
        completed_bookings=len(completed),
        cancelled_bookings=len(cancelled),
        pending_bookings=len(pending),
        avg_response_time_minutes=avg_resp,
        total_estimated_revenue_inr=round(total_revenue, 2),
        bookings_today=len(today),
        trips_per_ambulance=trips_per_amb,
    )


@router.get("/admin", response_model=AdminAnalyticsOut)
def admin_analytics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    since = _naive_utcnow() - timedelta(days=days)
    today_start = _naive_utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    all_ops = db.query(Operator).filter(Operator.is_active == True).all()
    verified_ops = [o for o in all_ops if o.verification_status == VerificationStatus.VERIFIED]
    all_ambs = db.query(Ambulance).filter(Ambulance.is_active == True).all()
    verified_ambs = [a for a in all_ambs if a.verification_status == VerificationStatus.VERIFIED]
    hospitals = db.query(Hospital).filter(Hospital.is_active == True).count()

    all_bookings = db.query(Booking).filter(Booking.created_at >= since).all()
    completed = [b for b in all_bookings if b.status == BookingStatus.COMPLETED]
    cancelled = [b for b in all_bookings if b.status == BookingStatus.CANCELLED]
    no_match = [b for b in all_bookings if b.status == BookingStatus.NO_MATCH]
    today = [b for b in all_bookings if _to_naive(b.created_at) >= today_start]
    scheduled = [b for b in all_bookings if b.booking_type and b.booking_type.value == "scheduled"]

    cancel_rate = round(len(cancelled) / len(all_bookings) * 100, 1) if all_bookings else 0.0

    resp_times = []
    for b in completed:
        if b.accepted_at:
            acc = _to_naive(b.accepted_at)
            cre = _to_naive(b.created_at)
            resp_times.append((acc - cre).total_seconds() / 60)
    avg_resp = round(sum(resp_times) / len(resp_times), 1) if resp_times else None

    total_revenue = sum(b.recorded_fare_inr or b.estimated_fare_inr or 0 for b in completed)

    return AdminAnalyticsOut(
        total_operators=len(all_ops),
        verified_operators=len(verified_ops),
        total_ambulances=len(all_ambs),
        verified_ambulances=len(verified_ambs),
        total_hospitals=hospitals,
        total_bookings=len(all_bookings),
        completed_bookings=len(completed),
        cancelled_bookings=len(cancelled),
        no_match_bookings=len(no_match),
        cancellation_rate_pct=cancel_rate,
        avg_response_time_minutes=avg_resp,
        total_estimated_revenue_inr=round(total_revenue, 2),
        bookings_today=len(today),
        scheduled_bookings=len(scheduled),
    )
