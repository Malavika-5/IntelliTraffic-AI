from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database.database import get_db
from app.schemas.schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut, UserUpdateRequest
from app.models.user import User, UserRole
from app.models.ambulance import Operator
from app.models.hospital import Hospital
from app.core.security import hash_password, verify_password, create_access_token
from app.core.dependencies import get_current_user
import uuid

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate email
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        phone=request.phone,
        emergency_contact_phone=request.emergency_contact_phone,
        emergency_contact_name=request.emergency_contact_name,
        role=UserRole(request.role),
        is_active=True,
        is_verified=False,
    )
    db.add(user)

    # Auto-create operator or hospital profile placeholder
    if user.role == UserRole.OPERATOR:
        op = Operator(
            id=str(uuid.uuid4()),
            user_id=user.id,
            organization_name=f"{request.full_name}'s Ambulance Service",
        )
        db.add(op)

    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "role": user.role.value})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email, User.is_active == True).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login_at = datetime.now(timezone.utc)
    # If the user supplied or updated their emergency contact during login, store it
    if request.emergency_contact_phone:
        user.emergency_contact_phone = request.emergency_contact_phone
    if request.emergency_contact_name:
        user.emergency_contact_name = request.emergency_contact_name
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "role": user.role.value})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
def update_me(
    request: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if request.full_name is not None:
        current_user.full_name = request.full_name
    if request.phone is not None:
        current_user.phone = request.phone
    if request.emergency_contact_phone is not None:
        current_user.emergency_contact_phone = request.emergency_contact_phone
    if request.emergency_contact_name is not None:
        current_user.emergency_contact_name = request.emergency_contact_name
    if request.preferred_language is not None:
        current_user.preferred_language = request.preferred_language
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)
