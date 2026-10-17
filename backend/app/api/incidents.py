import os
from typing import Optional, List
from datetime import date, timedelta, datetime, timezone
from fastapi import APIRouter, HTTPException, Header, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.database import get_db
from app.models.incident import Incident, PoliceStation, PoliceNotification, Handover
from app.models.ambulance import Ambulance, AmbulanceStatus
from app.models.hospital import Hospital
from app.models.scheduled_trip import AuditLog
from app.core.security import decode_access_token
from app.services import incident_engine as engine

router = APIRouter(tags=["Incidents & Fleet Operations"])

TOKENS = {
    "dispatcher": os.environ.get("DISPATCH_TOKEN", "disp-demo"),
    "fleet_admin": os.environ.get("FLEET_TOKEN", "fleet-demo"),
}
PIN = os.environ.get("DEMO_PIN", "1234")


def get_current_role(
    x_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    # 1. Check legacy X-Token
    if x_token:
        for r, t in TOKENS.items():
            if t == x_token:
                return r

    # 2. Check JWT Bearer token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            user_role = payload.get("role")
            if user_role in ("admin", "operator"):
                return "dispatcher"
            elif user_role == "patient":
                return "citizen"
            return user_role

    return None


def need_role(*roles):
    def dep(r: Optional[str] = Depends(get_current_role)):
        if r is None:
            # Allow fallback for demo ease if neither header passed
            return "dispatcher"
        if r not in roles and "admin" not in roles:
            raise HTTPException(403, "Not permitted for your role")
        return r
    return dep


class Login(BaseModel):
    role: str
    pin: str


class Report(BaseModel):
    lat: float
    lng: float
    address: str = ""
    description: str
    condition: str = "general"
    severity: str = "moderate"
    photo: Optional[str] = None
    reporter: str = "citizen"


class Assign(BaseModel):
    ambulance_id: int
    manual: bool = False
    commit_message: str = "Driver accepted dispatch"


class Pick(BaseModel):
    hospital_id: int
    manual: bool = False


class HandoverModel(BaseModel):
    incident_id: int
    hospital_id: int
    status: str
    acknowledged_by: str = ""
    note: str = ""


class Reason(BaseModel):
    reason: str = ""


def inc_or_404(db: Session, iid: int) -> Incident:
    inc = db.query(Incident).filter(Incident.id == iid).first()
    if not inc:
        raise HTTPException(404, "Incident not found")
    return inc


def record_audit(db: Session, iid: Optional[int], actor: str, action: str, detail: str = ""):
    log = AuditLog(
        action=action,
        user_id=None,
        resource_type="incident" if iid else "system",
        resource_id=str(iid) if iid else None,
        detail=f"[{actor}] {detail}",
    )
    db.add(log)
    db.commit()


# ---- Compatibility & Health ----

@router.get("/api/health")
def api_health():
    return {
        "ok": True,
        "routing": "google" if engine.KEY else "estimate",
        "routing_error": engine.state["routing_error"],
    }


@router.post("/api/login")
def demo_login(b: Login):
    if b.role not in TOKENS or b.pin != PIN:
        raise HTTPException(401, "Invalid role or PIN")
    return {"token": TOKENS[b.role], "role": b.role}


# ---- Incidents ----

@router.post("/api/incidents")
def report_incident(b: Report, db: Session = Depends(get_db)):
    if b.condition not in engine.NEEDS:
        raise HTTPException(422, f"Unknown condition: {b.condition}")
    if b.photo and len(b.photo) > 2_000_000:
        raise HTTPException(413, "Photo too large (max ~1.5 MB)")

    inc = Incident(
        created=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        reporter=b.reporter,
        lat=b.lat,
        lng=b.lng,
        address=b.address,
        description=b.description,
        condition=b.condition,
        severity=b.severity,
        photo=b.photo,
        status="reported",
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)

    record_audit(db, inc.id, b.reporter, "reported", f"{b.condition}/{b.severity}")
    return {"id": inc.id, "message": "Report received. A dispatcher will verify it."}


@router.get("/api/incidents")
def list_incidents(
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "fleet_admin", "admin")),
):
    rows = db.query(Incident).order_by(Incident.id.desc()).all()
    results = []
    for inc in rows:
        d = {
            "id": inc.id,
            "created": inc.created,
            "reporter": inc.reporter,
            "lat": inc.lat,
            "lng": inc.lng,
            "address": inc.address,
            "description": inc.description,
            "condition": inc.condition,
            "severity": inc.severity,
            "photo": inc.photo,
            "status": inc.status,
            "verified_by": inc.verified_by,
            "ambulance_id": inc.ambulance_id,
            "hospital_id": inc.hospital_id,
            "eta_min": inc.eta_min,
            "pickup_km": inc.pickup_km,
            "baseline_eta_min": inc.baseline_eta_min,
            "baseline_km": inc.baseline_km,
            "hosp_km": inc.hosp_km,
            "source": inc.source,
            "simulated": inc.simulated,
            "closed_at": inc.closed_at,
            "cancel_reason": inc.cancel_reason,
            "assigned_at": inc.assigned_at,
        }
        if r not in ("dispatcher", "admin"):
            d.pop("photo", None)
            d.pop("description", None)
            d.pop("address", None)
        results.append(d)
    return results


@router.get("/api/incidents/{iid}/options")
def incident_options(
    iid: int,
    scenario: str = "live",
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "admin")),
):
    inc = inc_or_404(db, iid)
    inc_dict = {
        "id": inc.id,
        "lat": inc.lat,
        "lng": inc.lng,
        "condition": inc.condition,
        "severity": inc.severity,
        "status": inc.status,
    }

    # Fetch handovers for this incident
    handovers = db.query(Handover).filter(Handover.incident_id == iid).order_by(Handover.id).all()
    ho_list = [
        {"id": h.id, "incident_id": h.incident_id, "hospital_id": h.hospital_id, "status": h.status}
        for h in handovers
    ]

    # Fetch ambulances
    amb_rows = db.query(Ambulance).all()
    amb_list = []
    for idx, a in enumerate(amb_rows):
        amb_list.append({
            "id": idx + 1,
            "db_id": a.id,
            "callsign": a.callsign or a.registration_number,
            "type": a.category.value.upper() if hasattr(a.category, "value") else str(a.category).upper(),
            "lat": a.last_latitude or 8.5100,
            "lng": a.last_longitude or 76.9500,
            "status": a.status.value if hasattr(a.status, "value") else str(a.status),
            "cost_per_km": a.cost_per_km or 12.0,
            "km_run": a.km_run or 0.0,
            "trips": a.trips or 0,
            "next_service": a.next_service or "",
        })

    # Fetch hospitals
    hosp_rows = db.query(Hospital).all()
    hosp_list = []
    for idx, h in enumerate(hosp_rows):
        hosp_list.append({
            "id": idx + 1,
            "db_id": h.id,
            "name": h.name,
            "lat": h.latitude or 8.5241,
            "lng": h.longitude or 76.9264,
            "capabilities": h.capabilities or "emergency,trauma,cardiology",
            "er_beds": h.er_beds if h.er_beds is not None else 5,
            "info_updated": h.info_updated.isoformat() if h.info_updated else datetime.now(timezone.utc).isoformat(),
        })

    ranked_ambs = engine.rank_ambulances(inc_dict, amb_list, scenario)
    ranked_hosps = engine.rank_hospitals(inc_dict, hosp_list, ho_list, scenario)

    return {
        "scenario": scenario,
        "simulated_scenario": scenario != "live",
        "routing_error": engine.state["routing_error"],
        "ambulances": ranked_ambs,
        "hospitals": ranked_hosps,
        "all_ambulances": amb_list,
    }


@router.post("/api/incidents/{iid}/verify")
def verify_incident(
    iid: int,
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "admin")),
):
    inc = inc_or_404(db, iid)
    if inc.status != "reported":
        raise HTTPException(409, f"Already {inc.status}")

    inc.status = "verified"
    inc.verified_by = r
    db.commit()

    record_audit(db, iid, r, "verified")
    return {"ok": True}


@router.post("/api/incidents/{iid}/assign")
def assign_ambulance(
    iid: int,
    b: Assign,
    scenario: str = "live",
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "admin")),
):
    inc = inc_or_404(db, iid)
    if inc.status not in ("verified", "dispatched"):
        raise HTTPException(409, "Verify the incident first")

    # Get ambulance list
    amb_rows = db.query(Ambulance).all()
    if b.ambulance_id < 1 or b.ambulance_id > len(amb_rows):
        raise HTTPException(404, "Ambulance not found")

    target_amb = amb_rows[b.ambulance_id - 1]
    amb_status_val = target_amb.status.value if hasattr(target_amb.status, "value") else str(target_amb.status)
    if amb_status_val != "available" and not b.manual:
        raise HTTPException(409, "Ambulance not available (use manual override)")

    target_lat = target_amb.last_latitude or 8.5100
    target_lng = target_amb.last_longitude or 76.9500

    amb_dicts = []
    for idx, a in enumerate(amb_rows):
        amb_dicts.append({
            "id": idx + 1,
            "callsign": a.callsign or a.registration_number,
            "type": a.category.value.upper() if hasattr(a.category, "value") else str(a.category).upper(),
            "lat": a.last_latitude or 8.5100,
            "lng": a.last_longitude or 76.9500,
            "status": a.status.value if hasattr(a.status, "value") else str(a.status),
        })

    avail = engine.rank_ambulances({"lat": inc.lat, "lng": inc.lng, "severity": inc.severity}, amb_dicts, scenario)
    t = engine.travel((target_lat, target_lng), (inc.lat, inc.lng), scenario)
    base_eta = sum(x["eta_min"] for x in avail) / len(avail) if avail else t["minutes"]
    base_km = sum(x["km"] for x in avail) / len(avail) if avail else t["km"]

    # Re-release previous ambulance if any
    if inc.ambulance_id and inc.ambulance_id <= len(amb_rows):
        prev_amb = amb_rows[inc.ambulance_id - 1]
        prev_amb.status = AmbulanceStatus.AVAILABLE

    target_amb.status = AmbulanceStatus.BUSY

    inc.status = "dispatched"
    inc.ambulance_id = b.ambulance_id
    inc.eta_min = t["minutes"]
    inc.pickup_km = t["km"]
    inc.baseline_eta_min = round(base_eta, 1)
    inc.baseline_km = round(base_km, 2)
    inc.source = t["source"]
    inc.simulated = int(t["simulated"])
    inc.assigned_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.commit()

    callsign = target_amb.callsign or target_amb.registration_number
    record_audit(
        db, iid, r,
        "ambulance_assigned" + ("_MANUAL" if b.manual else ""),
        f"{callsign} ETA {t['minutes']}m ({scenario})"
    )

    # Nearest police station safety log (demo only)
    stations = db.query(PoliceStation).all()
    nearest = None
    min_dist = float("inf")
    for st in stations:
        d = engine.hav((inc.lat, inc.lng), (st.lat, st.lng))
        if d < min_dist:
            min_dist = d
            nearest = st

    if nearest:
        dist = round(min_dist, 2)
        msg = (b.commit_message or "Driver accepted dispatch").strip()[:500]
        notif = PoliceNotification(
            incident_id=iid,
            station_name=nearest.name,
            station_lat=nearest.lat,
            station_lng=nearest.lng,
            distance_km=dist,
            ambulance_callsign=callsign,
            driver_message=msg,
            delivery_status="DEMO LOGGED ONLY - NOT SENT TO POLICE",
        )
        db.add(notif)
        db.commit()
        record_audit(db, iid, r, "police_safety_notice_logged", f"Nearest: {nearest.name}; demo log only")

    return {
        "ok": True,
        "eta_min": t["minutes"],
        "police_notice": "Safety notice logged in prototype only; no police station was contacted.",
    }


@router.post("/api/incidents/{iid}/hospital")
def pick_incident_hospital(
    iid: int,
    b: Pick,
    scenario: str = "live",
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "admin")),
):
    inc = inc_or_404(db, iid)
    if inc.status != "dispatched":
        raise HTTPException(409, "Assign an ambulance first")

    hosp_rows = db.query(Hospital).all()
    if b.hospital_id < 1 or b.hospital_id > len(hosp_rows):
        raise HTTPException(404, "Hospital not found")

    h = hosp_rows[b.hospital_id - 1]
    last = db.query(Handover).filter(
        Handover.incident_id == iid, Handover.hospital_id == b.hospital_id
    ).order_by(Handover.id.desc()).first()

    if last and last.status == "unavailable" and not b.manual:
        raise HTTPException(409, "Hospital marked unavailable (use manual override)")

    t = engine.travel((inc.lat, inc.lng), (h.latitude or 8.5241, h.longitude or 76.9264), scenario)
    inc.hospital_id = b.hospital_id
    inc.hosp_km = t["km"]

    if not last:
        ho = Handover(
            incident_id=iid,
            hospital_id=b.hospital_id,
            status="pending",
            note="",
            updated=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        )
        db.add(ho)

    db.commit()
    record_audit(db, iid, r, "hospital_selected" + ("_MANUAL" if b.manual else ""), h.name)
    return {"ok": True}


@router.post("/api/handover")
def update_handover(
    b: HandoverModel,
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "hospital", "admin")),
):
    if b.status not in engine.HANDOVER_ADJ:
        raise HTTPException(422, "status must be confirmed|pending|unavailable|unknown")
    if b.status == "confirmed" and not b.acknowledged_by.strip():
        raise HTTPException(422, "Record who acknowledged readiness")

    inc_or_404(db, b.incident_id)

    ho = Handover(
        incident_id=b.incident_id,
        hospital_id=b.hospital_id,
        status=b.status,
        acknowledged_by=b.acknowledged_by,
        note=b.note,
        updated=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    db.add(ho)
    db.commit()

    record_audit(
        db, b.incident_id, r,
        f"handover_{b.status}",
        f"hospital {b.hospital_id}; ack: {b.acknowledged_by}; {b.note}"
    )
    return {
        "ok": True,
        "advice": "Hospital cannot receive: pick an alternative from the ranked list." if b.status == "unavailable" else ""
    }


@router.post("/api/incidents/{iid}/cancel")
def cancel_incident(
    iid: int,
    b: Reason,
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "admin")),
):
    inc = inc_or_404(db, iid)
    if inc.status in ("closed", "cancelled"):
        raise HTTPException(409, "Already finished")

    amb_rows = db.query(Ambulance).all()
    if inc.ambulance_id and inc.ambulance_id <= len(amb_rows):
        amb_rows[inc.ambulance_id - 1].status = AmbulanceStatus.AVAILABLE

    inc.status = "cancelled"
    inc.cancel_reason = b.reason
    inc.closed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.commit()

    record_audit(db, iid, r, "cancelled", b.reason)
    return {"ok": True}


@router.post("/api/incidents/{iid}/close")
def close_incident(
    iid: int,
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "admin")),
):
    inc = inc_or_404(db, iid)
    if inc.status != "dispatched" or not inc.hospital_id:
        raise HTTPException(409, "Needs ambulance and hospital before closing")

    amb_rows = db.query(Ambulance).all()
    hosp_rows = db.query(Hospital).all()

    if inc.hospital_id <= len(hosp_rows) and inc.ambulance_id <= len(amb_rows):
        h = hosp_rows[inc.hospital_id - 1]
        a = amb_rows[inc.ambulance_id - 1]
        a.status = AmbulanceStatus.AVAILABLE
        a.last_latitude = h.latitude
        a.last_longitude = h.longitude
        a.trips = (a.trips or 0) + 1
        a.km_run = (a.km_run or 0.0) + (inc.pickup_km or 0.0) + (inc.hosp_km or 0.0)

    inc.status = "closed"
    inc.closed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.commit()

    record_audit(db, iid, r, "closed")
    return {"ok": True}


# ---- Fleet Management & ROI ----

@router.post("/api/ambulances/{aid}/status")
def update_ambulance_quick_status(
    aid: str,
    status: str = Query(...),
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "fleet_admin", "admin")),
):
    if status not in ("available", "maintenance", "offline", "busy"):
        raise HTTPException(422, "Invalid status")

    # Match by numeric index or string uuid/reg_num
    amb_rows = db.query(Ambulance).all()
    target = None
    if aid.isdigit():
        idx = int(aid) - 1
        if 0 <= idx < len(amb_rows):
            target = amb_rows[idx]
    if not target:
        target = db.query(Ambulance).filter((Ambulance.id == aid) | (Ambulance.registration_number == aid)).first()

    if not target:
        raise HTTPException(404, "Ambulance not found")

    status_map = {
        "available": AmbulanceStatus.AVAILABLE,
        "maintenance": AmbulanceStatus.MAINTENANCE,
        "offline": AmbulanceStatus.OFFLINE,
        "busy": AmbulanceStatus.BUSY,
    }
    target.status = status_map[status]
    db.commit()

    record_audit(db, None, r, "ambulance_status", f"{target.registration_number}->{status}")
    return {"ok": True}


@router.get("/api/fleet")
def get_fleet_overview(
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "fleet_admin", "admin")),
):
    amb_rows = db.query(Ambulance).all()
    soon = (date.today() + timedelta(days=14)).isoformat()
    ambs = []
    busy_count = 0

    for idx, a in enumerate(amb_rows):
        status_str = a.status.value if hasattr(a.status, "value") else str(a.status)
        if status_str in ("dispatched", "busy"):
            busy_count += 1
        cost = a.cost_per_km or 12.0
        km = a.km_run or 0.0
        next_srv = a.next_service or ""
        service_due = bool(next_srv and next_srv <= soon)

        ambs.append({
            "id": idx + 1,
            "db_id": a.id,
            "callsign": a.callsign or a.registration_number,
            "type": a.category.value.upper() if hasattr(a.category, "value") else str(a.category).upper(),
            "lat": a.last_latitude or 8.5100,
            "lng": a.last_longitude or 76.9500,
            "status": status_str,
            "cost_per_km": cost,
            "km_run": km,
            "trips": a.trips or 0,
            "next_service": next_srv,
            "est_operating_cost_inr": round(km * cost, 1),
            "service_due": service_due,
        })

    done = db.query(Incident).filter(Incident.status == "closed", Incident.assigned_at.isnot(None)).all()
    avg = round(sum(i.eta_min for i in done if i.eta_min) / len(done), 1) if done else None
    open_incidents = db.query(Incident).filter(Incident.status.in_(["reported", "verified", "dispatched"])).count()

    return {
        "ambulances": ambs,
        "utilization_pct": round(100 * busy_count / len(ambs)) if ambs else 0,
        "avg_response_min": avg,
        "open_incidents": open_incidents,
        "note": "Costs are estimates: km x configured cost/km.",
    }


@router.get("/api/roi")
def get_roi(
    db: Session = Depends(get_db),
    r: str = Depends(need_role("fleet_admin", "admin", "dispatcher")),
):
    closed = db.query(Incident).filter(Incident.status == "closed").all()
    amb_rows = db.query(Ambulance).all()

    n = len(closed)
    t_saved = 0.0
    c_saved = 0.0

    for i in closed:
        if i.baseline_eta_min and i.eta_min:
            t_saved += max(0.0, i.baseline_eta_min - i.eta_min)
        cost_km = 12.0
        if i.ambulance_id and i.ambulance_id <= len(amb_rows):
            cost_km = amb_rows[i.ambulance_id - 1].cost_per_km or 12.0
        if i.baseline_km and i.pickup_km:
            c_saved += (i.baseline_km - i.pickup_km) * cost_km

    measured = n > 0 and all(not i.simulated for i in closed)
    return {
        "basis": "MEASURED ROUTING DATA (not a clinical outcome claim)" if measured else "SIMULATED ESTIMATE",
        "closed_cases": n,
        "total_minutes_saved": round(t_saved, 1),
        "avg_minutes_saved": round(t_saved / n, 1) if n else 0,
        "operating_cost_saved_inr": round(c_saved, 1),
        "verified_pilot_results": False,
        "method": (
            "Baseline = average ETA/km of all ambulances available at assignment (proxy for unoptimised dispatch) "
            "vs the ambulance actually chosen. Not a real-world result until validated in a pilot."
        ),
    }


@router.get("/api/police-notifications")
def list_police_notifications(
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "admin")),
):
    rows = db.query(PoliceNotification).order_by(PoliceNotification.id.desc()).limit(200).all()
    return [
        {
            "id": p.id,
            "ts": p.ts,
            "incident_id": p.incident_id,
            "station_name": p.station_name,
            "station_lat": p.station_lat,
            "station_lng": p.station_lng,
            "distance_km": p.distance_km,
            "ambulance_callsign": p.ambulance_callsign,
            "driver_message": p.driver_message,
            "delivery_status": p.delivery_status,
        }
        for p in rows
    ]


@router.get("/api/police-stations")
def list_police_stations(db: Session = Depends(get_db)):
    stations = db.query(PoliceStation).all()
    return [{"id": s.id, "name": s.name, "lat": s.lat, "lng": s.lng} for s in stations]


@router.get("/api/audit")
def list_audit_trail(
    incident_id: Optional[int] = None,
    db: Session = Depends(get_db),
    r: str = Depends(need_role("dispatcher", "fleet_admin", "admin")),
):
    query = db.query(AuditLog)
    if incident_id:
        query = query.filter(AuditLog.resource_id == str(incident_id))
    rows = query.order_by(AuditLog.created_at.desc()).limit(300).all()
    return [
        {
            "id": log.id,
            "ts": log.created_at.isoformat() if log.created_at else "",
            "incident_id": int(log.resource_id) if log.resource_id and log.resource_id.isdigit() else incident_id,
            "actor": (log.detail or "").split("]")[0].replace("[", "") if "]" in (log.detail or "") else "system",
            "action": log.action,
            "detail": log.detail or "",
        }
        for log in rows
    ]
