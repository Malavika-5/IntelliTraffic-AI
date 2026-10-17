"""
Routing Service — abstraction layer over different routing providers.
Supports demo (deterministic simulated) and Google Routes API providers.
"""
import math
import logging
from typing import Optional, Tuple
from dataclasses import dataclass
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RouteResult:
    distance_meters: float
    duration_seconds: float
    duration_in_traffic_seconds: float
    provider: str
    is_demo: bool
    polyline: Optional[str] = None

    @property
    def distance_km(self) -> float:
        return self.distance_meters / 1000

    @property
    def duration_minutes(self) -> float:
        return self.duration_in_traffic_seconds / 60


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def demo_route_estimate(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> RouteResult:
    """
    Deterministic demo routing estimate using straight-line distance.
    Applies a road-distance multiplier and typical urban speed.
    
    IMPORTANT: This is a simulated estimate, NOT real road distance or traffic.
    """
    straight_line_m = haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
    # Road distance is typically 1.3x straight-line in urban areas
    road_distance_m = straight_line_m * 1.35
    # Average urban speed: 25 km/h = 6.94 m/s
    avg_speed_ms = 25 * 1000 / 3600
    duration_seconds = road_distance_m / avg_speed_ms
    # Add 20% for traffic (demo)
    duration_in_traffic = duration_seconds * 1.2
    return RouteResult(
        distance_meters=road_distance_m,
        duration_seconds=duration_seconds,
        duration_in_traffic_seconds=duration_in_traffic,
        provider="demo",
        is_demo=True,
    )


async def google_route_estimate(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> Optional[RouteResult]:
    """
    Call Google Routes API (Compute Routes).
    Returns None if the call fails; caller falls back to demo.
    """
    api_key = settings.GOOGLE_ROUTES_API_KEY
    if not api_key:
        return None

    url = "https://routes.googleapis.com/directions/v2:computeRoutes"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    }
    payload = {
        "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lon}}},
        "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lon}}},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "computeAlternativeRoutes": False,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            routes = data.get("routes", [])
            if not routes:
                logger.warning("Google Routes API returned no routes")
                return None
            route = routes[0]
            # Duration comes as "300s" string
            duration_str = route.get("duration", "0s")
            duration_secs = float(duration_str.replace("s", ""))
            distance_m = float(route.get("distanceMeters", 0))
            polyline = route.get("polyline", {}).get("encodedPolyline")
            return RouteResult(
                distance_meters=distance_m,
                duration_seconds=duration_secs,
                duration_in_traffic_seconds=duration_secs,  # already traffic-aware
                provider="google",
                is_demo=False,
                polyline=polyline,
            )
    except Exception as e:
        logger.error(f"Google Routes API error: {e}")
        return None


async def estimate_route(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> RouteResult:
    """
    Main entry point. Uses Google Routes if configured, falls back to demo.
    """
    if settings.google_routes_configured:
        result = await google_route_estimate(origin_lat, origin_lon, dest_lat, dest_lon)
        if result:
            return result
        logger.warning("Google Routes failed, falling back to demo routing")

    return demo_route_estimate(origin_lat, origin_lon, dest_lat, dest_lon)
