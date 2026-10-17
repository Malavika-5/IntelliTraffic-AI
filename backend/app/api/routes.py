from fastapi import APIRouter, Depends
from app.services.routing_service import estimate_route, RouteResult
from app.schemas.schemas import RouteEstimateRequest, RouteEstimateOut
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/routes", tags=["Routing"])


@router.post("/estimate", response_model=RouteEstimateOut)
async def estimate_route_endpoint(
    request: RouteEstimateRequest,
    current_user: User = Depends(get_current_user),
):
    result = await estimate_route(
        request.origin_lat, request.origin_lon,
        request.dest_lat, request.dest_lon,
    )
    return RouteEstimateOut(
        distance_meters=result.distance_meters,
        distance_km=round(result.distance_km, 2),
        duration_seconds=result.duration_seconds,
        duration_in_traffic_seconds=result.duration_in_traffic_seconds,
        duration_minutes=round(result.duration_minutes, 1),
        provider=result.provider,
        is_demo=result.is_demo,
    )
