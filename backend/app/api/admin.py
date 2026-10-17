from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database.database import get_db
from app.schemas.schemas import UserOut, AuditLogOut
from app.models.user import User, UserRole
from app.models.ambulance import Operator, Ambulance, VerificationStatus
from app.models.hospital import Hospital
from app.models.scheduled_trip import AuditLog
from app.core.dependencies import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["Administration"])


@router.get("/users", response_model=List[UserOut])
def list_users(
    role: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    return [UserOut.model_validate(u) for u in users]


@router.patch("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    
    audit = AuditLog(
        user_id=current_user.id,
        action="user_toggle_active",
        resource_type="user",
        resource_id=user_id,
        detail=f"User {'activated' if user.is_active else 'deactivated'}: {user.email}"
    )
    import uuid
    audit.id = str(uuid.uuid4())
    db.add(audit)
    db.commit()
    return {"user_id": user_id, "is_active": user.is_active}


@router.patch("/operators/{operator_id}/verify")
def verify_operator(
    operator_id: str,
    status: str = Query(..., description="verified | pending | rejected | suspended"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    op = db.query(Operator).filter(Operator.id == operator_id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operator not found")
    try:
        op.verification_status = VerificationStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    db.commit()
    return {"operator_id": operator_id, "verification_status": status}


@router.patch("/ambulances/{ambulance_id}/verify")
def verify_ambulance(
    ambulance_id: str,
    status: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    amb = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")
    try:
        amb.verification_status = VerificationStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    db.commit()
    return {"ambulance_id": ambulance_id, "verification_status": status}


@router.get("/audit-logs", response_model=List[AuditLogOut])
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return [AuditLogOut.model_validate(l) for l in logs]


@router.get("/revenue")
def get_revenue(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    from app.models.booking import Booking, BookingStatus
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(days=days)
    completed = db.query(Booking).filter(
        Booking.status == BookingStatus.COMPLETED,
        Booking.created_at >= since,
    ).all()
    total_estimated = sum(b.estimated_fare_inr or 0 for b in completed)
    total_recorded = sum(b.recorded_fare_inr or 0 for b in completed)
    return {
        "period_days": days,
        "completed_trips": len(completed),
        "total_estimated_fare_inr": round(total_estimated, 2),
        "total_recorded_fare_inr": round(total_recorded, 2),
        "note": "Estimated revenue from completed trips. Actual payment gateway not configured in MVP.",
    }
