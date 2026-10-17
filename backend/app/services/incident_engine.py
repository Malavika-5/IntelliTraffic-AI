"""
Routing + transparent rule-based recommendation engine for emergency incidents.
Ported and enhanced from IntelliTraffic AI 3hr Prototype.
"""
import os
import json
import math
import time
import urllib.request
from datetime import datetime, timezone
from app.core.config import settings

KEY = settings.GOOGLE_ROUTES_API_KEY or os.environ.get("GOOGLE_MAPS_API_KEY", "")
SCENARIOS = {"live": 1.0, "moderate": 1.3, "heavy": 1.7, "gridlock": 2.2}  # multipliers for simulated traffic
NEEDS = {
    "cardiac": "cardiology",
    "stroke": "neurology",
    "trauma": "trauma",
    "burns": "burns",
    "pregnancy": "obstetrics",
    "pediatric": "pediatrics",
    "respiratory": "pulmonology",
    "general": "emergency",
}
HANDOVER_ADJ = {"confirmed": -8, "pending": 0, "unknown": 3, "unavailable": 1000}
_cache = {}
state = {"routing_error": None}


def hav(a, b):
    """Haversine distance in kilometers."""
    p = math.pi / 180
    h = (
        math.sin((b[0] - a[0]) * p / 2) ** 2
        + math.cos(a[0] * p) * math.cos(b[0] * p) * math.sin((b[1] - a[1]) * p / 2) ** 2
    )
    return 12742 * math.asin(math.sqrt(max(0.0, min(1.0, h))))


def _google(o, d):
    """Call Google Compute Routes API."""
    body = {
        "origin": {"location": {"latLng": {"latitude": o[0], "longitude": o[1]}}},
        "destination": {"location": {"latLng": {"latitude": d[0], "longitude": d[1]}}},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
    }
    req = urllib.request.Request(
        "https://routes.googleapis.com/routes/v1/directions/v2:computeRoutes",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": KEY,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
    )
    r = json.load(urllib.request.urlopen(req, timeout=6))["routes"][0]
    return {
        "minutes": int(r["duration"].rstrip("s")) / 60,
        "km": r["distanceMeters"] / 1000,
        "source": "google",
    }


def _route(o, d):
    if KEY:
        try:
            state["routing_error"] = None
            return _google(o, d)
        except Exception as e:
            state["routing_error"] = (
                f"Google Routes unavailable ({e.__class__.__name__}); using road-distance estimates."
            )
    km = hav(o, d) * 1.35
    return {"minutes": km / 32 * 60 + 1, "km": km, "source": "estimate"}


def travel(o, d, scenario="live"):
    k = (round(o[0], 4), round(o[1], 4), round(d[0], 4), round(d[1], 4))
    b = _cache.get(k)
    if not b or time.time() - b["t"] > 300:
        b = _route(o, d)
        b["t"] = time.time()
        _cache[k] = b
    return {
        "minutes": round(b["minutes"] * SCENARIOS.get(scenario, 1.0), 1),
        "km": round(b["km"], 2),
        "source": b["source"],
        "simulated": b["source"] != "google" or scenario != "live",
    }


def rank_ambulances(inc, ambs, scenario="live"):
    out = []
    for a in ambs:
        st = a.get("status", "available")
        if hasattr(st, "value"):
            st = st.value
        if st != "available":
            continue
        lat = a.get("lat") if "lat" in a else a.get("last_latitude", 8.5241)
        lng = a.get("lng") if "lng" in a else a.get("last_longitude", 76.9366)
        inc_lat = inc.get("lat") if "lat" in inc else inc.get("pickup_latitude", 8.5241)
        inc_lng = inc.get("lng") if "lng" in inc else inc.get("pickup_longitude", 76.9366)

        t = travel((lat, lng), (inc_lat, inc_lng), scenario)
        a_type = a.get("type") or a.get("category", "BLS")
        if hasattr(a_type, "value"):
            a_type = a_type.value
        a_type = str(a_type).upper()

        bonus = 3 if inc.get("severity") == "critical" and "ALS" in a_type else 0
        callsign = a.get("callsign") or a.get("registration_number") or f"AMB-{a.get('id')}"

        out.append({
            **a,
            "callsign": callsign,
            "type": a_type,
            "lat": lat,
            "lng": lng,
            "eta_min": t["minutes"],
            "km": t["km"],
            "source": t["source"],
            "simulated": t["simulated"],
            "rank_score": t["minutes"] - bonus,
        })
    return sorted(out, key=lambda a: a["rank_score"])


def rank_hospitals(inc, hospitals, handovers, scenario="live"):
    need = NEEDS.get(inc.get("condition", "general"), "emergency")
    hmap = {h["hospital_id"]: h for h in handovers}
    out = []
    inc_lat = inc.get("lat") if "lat" in inc else inc.get("pickup_latitude", 8.5241)
    inc_lng = inc.get("lng") if "lng" in inc else inc.get("pickup_longitude", 76.9366)

    for h in hospitals:
        lat = h.get("lat") if "lat" in h else h.get("latitude", 8.5241)
        lng = h.get("lng") if "lng" in h else h.get("longitude", 76.9366)
        t = travel((inc_lat, inc_lng), (lat, lng), scenario)

        caps_raw = h.get("capabilities") or ""
        if isinstance(caps_raw, list):
            caps = [c.lower() for c in caps_raw]
        else:
            caps = [c.strip().lower() for c in str(caps_raw).split(",") if c.strip()]

        services = h.get("services") or []
        for s in services:
            caps.append(str(s).lower())

        hid = h.get("id")
        ho = hmap.get(hid, {}).get("status", "unknown")
        er_beds = h.get("er_beds", 5)

        score, why, warn = t["minutes"], [f"{t['minutes']} min drive ({t['km']} km)"], []
        if need in caps:
            why.append(f"has {need}")
        else:
            score += 30 if need != "emergency" else 10
            warn.append(f"no listed {need} capability")

        if er_beds <= 0:
            score += 20
            warn.append("no ER beds reported")
        elif er_beds <= 2:
            score += 5
            why.append(f"{er_beds} ER beds (tight)")
        else:
            why.append(f"{er_beds} ER beds")

        score += HANDOVER_ADJ.get(ho, 3)
        if ho == "confirmed":
            why.append("readiness confirmed")
        if ho == "unavailable":
            warn.append("hospital cannot receive patient")

        info_updated = h.get("info_updated")
        if info_updated:
            try:
                if isinstance(info_updated, str):
                    upd_dt = datetime.fromisoformat(info_updated.replace("Z", "+00:00"))
                else:
                    upd_dt = info_updated
                if upd_dt.tzinfo is None:
                    upd_dt = upd_dt.replace(tzinfo=timezone.utc)
                age_h = (datetime.now(timezone.utc) - upd_dt).total_seconds() / 3600
                if age_h > 24:
                    warn.append(f"hospital data is {int(age_h/24)} day(s) old - verify by phone")
            except Exception:
                pass

        out.append({
            **h,
            "lat": lat,
            "lng": lng,
            "eta_min": t["minutes"],
            "km": t["km"],
            "source": t["source"],
            "simulated": t["simulated"],
            "handover": ho,
            "score": round(score, 1),
            "reasons": why,
            "warnings": warn,
        })
    return sorted(out, key=lambda h: h["score"])
