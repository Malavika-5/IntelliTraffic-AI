"""
Ambulance Matching Engine.

Rule-based transparent matching algorithm. 
Does NOT use machine learning. Does NOT diagnose patients.
Does NOT guarantee any clinical suitability.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.ambulance import Ambulance, AmbulanceStatus, VerificationStatus
from app.services.routing_service import estimate_route, haversine_distance

logger = logging.getLogger(__name__)

# Ambulances with location data older than this are deprioritized
STALE_LOCATION_THRESHOLD_MINUTES = 30

# Category hierarchy for eligibility
# Higher-capability vehicles can serve lower-capability requests when needed
CATEGORY_ELIGIBILITY = {
    "basic": ["basic", "als", "icu", "neonatal", "wheelchair", "non_emergency"],
    "als": ["als", "icu"],
    "icu": ["icu"],
    "neonatal": ["neonatal"],
    "wheelchair": ["wheelchair", "non_emergency"],
    "non_emergency": ["non_emergency", "basic", "als", "icu", "wheelchair"],
}


def utcnow():
    return datetime.now(timezone.utc)


def _to_naive(dt):
    """Strip timezone info for SQLite-safe datetime comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


@dataclass
class CandidateResult:
    ambulance_id: str
    registration_number: str
    operator_id: str
    operator_name: str
    category: str
    status: str
    straight_line_km: float
    estimated_eta_minutes: Optional[float]
    location_age_minutes: Optional[float]
    is_location_stale: bool
    score: float
    is_demo_route: bool
    inclusion_reason: str
    exclusion_reason: Optional[str] = None


@dataclass
class MatchResult:
    candidates: List[CandidateResult] = field(default_factory=list)
    excluded: List[CandidateResult] = field(default_factory=list)
    best_match: Optional[CandidateResult] = None
    routing_provider: str = "demo"
    matching_notes: str = ""


async def find_eligible_ambulances(
    db: Session,
    requested_category: str,
    pickup_lat: float,
    pickup_lon: float,
    exclude_ambulance_ids: Optional[List[str]] = None,
    operator_id: Optional[str] = None,
) -> MatchResult:
    """
    Main matching function.
    
    Steps:
    1. Query active, available, verified ambulances.
    2. Filter by service category eligibility.
    3. Calculate road ETA via routing service.
    4. Score and rank candidates.
    5. Return ranked candidates with reasons.
    """
    result = MatchResult()
    exclude_ids = exclude_ambulance_ids or []

    # Step 1: Base query — only available and verified
    query = db.query(Ambulance).filter(
        Ambulance.status == AmbulanceStatus.AVAILABLE,
        Ambulance.verification_status == VerificationStatus.VERIFIED,
        Ambulance.is_active == True,
    )
    if operator_id:
        query = query.filter(Ambulance.operator_id == operator_id)
    if exclude_ids:
        query = query.filter(Ambulance.id.notin_(exclude_ids))

    all_ambulances = query.all()

    if not all_ambulances:
        result.matching_notes = "No available, verified ambulances found in the system."
        return result

    # Step 2: Category eligibility filter
    eligible_categories = CATEGORY_ELIGIBILITY.get(requested_category, [requested_category])

    for amb in all_ambulances:
        location_age = None
        is_stale = True
        straight_km = 0.0

        # Calculate location freshness
        if amb.last_location_update and amb.last_latitude and amb.last_longitude:
            loc_update = _to_naive(amb.last_location_update)
            now_naive = datetime.utcnow()
            age = (now_naive - loc_update).total_seconds() / 60
            location_age = age
            is_stale = age > STALE_LOCATION_THRESHOLD_MINUTES
            straight_km = haversine_distance(pickup_lat, pickup_lon, amb.last_latitude, amb.last_longitude) / 1000
        else:
            # No location data — exclude
            candidate = CandidateResult(
                ambulance_id=amb.id,
                registration_number=amb.registration_number,
                operator_id=amb.operator_id,
                operator_name=amb.operator.organization_name if amb.operator else "Unknown",
                category=amb.category.value,
                status=amb.status.value,
                straight_line_km=0.0,
                estimated_eta_minutes=None,
                location_age_minutes=None,
                is_location_stale=True,
                score=0.0,
                is_demo_route=True,
                inclusion_reason="",
                exclusion_reason="No location data available",
            )
            result.excluded.append(candidate)
            continue

        # Category check
        if amb.category.value not in eligible_categories:
            candidate = CandidateResult(
                ambulance_id=amb.id,
                registration_number=amb.registration_number,
                operator_id=amb.operator_id,
                operator_name=amb.operator.organization_name if amb.operator else "Unknown",
                category=amb.category.value,
                status=amb.status.value,
                straight_line_km=straight_km,
                estimated_eta_minutes=None,
                location_age_minutes=location_age,
                is_location_stale=is_stale,
                score=0.0,
                is_demo_route=True,
                inclusion_reason="",
                exclusion_reason=f"Category '{amb.category.value}' does not match requested '{requested_category}'",
            )
            result.excluded.append(candidate)
            continue

        # Step 3: Get ETA
        route = await estimate_route(
            amb.last_latitude, amb.last_longitude,
            pickup_lat, pickup_lon,
        )
        eta_minutes = route.duration_in_traffic_seconds / 60

        # Step 4: Score
        # Lower ETA = higher score
        # Fresher location = bonus
        # Closer category match = bonus
        score = 100.0 - min(eta_minutes, 60.0)  # base: 100 minus ETA (cap at 60 min)
        if is_stale:
            score -= 15  # penalty for stale location
        if amb.category.value == requested_category:
            score += 10  # exact category match bonus
        score = max(0.0, score)

        candidate = CandidateResult(
            ambulance_id=amb.id,
            registration_number=amb.registration_number,
            operator_id=amb.operator_id,
            operator_name=amb.operator.organization_name if amb.operator else "Unknown",
            category=amb.category.value,
            status=amb.status.value,
            straight_line_km=round(straight_km, 2),
            estimated_eta_minutes=round(eta_minutes, 1),
            location_age_minutes=round(location_age, 1) if location_age else None,
            is_location_stale=is_stale,
            score=round(score, 2),
            is_demo_route=route.is_demo,
            inclusion_reason=f"Eligible {amb.category.value} ambulance, est. {eta_minutes:.0f} min ETA",
        )
        result.candidates.append(candidate)
        if route.is_demo:
            result.routing_provider = "demo"
        else:
            result.routing_provider = "google"

    # Sort by score descending
    result.candidates.sort(key=lambda c: c.score, reverse=True)
    if result.candidates:
        result.best_match = result.candidates[0]
        result.matching_notes = (
            f"Found {len(result.candidates)} eligible ambulance(s). "
            f"Best match: {result.best_match.registration_number} "
            f"(ETA ~{result.best_match.estimated_eta_minutes} min)"
        )
    else:
        result.matching_notes = (
            f"No eligible ambulances found for category '{requested_category}'. "
            f"{len(result.excluded)} ambulance(s) excluded. "
            "Reasons: " + "; ".join(set(c.exclusion_reason for c in result.excluded if c.exclusion_reason))
        )

    return result
