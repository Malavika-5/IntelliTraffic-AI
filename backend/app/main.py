"""
IntelliTraffic AI — FastAPI Backend
Smarter Ambulance Dispatch. Faster Healthcare Connections.
"""
import logging
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.database.init_db import init_db, seed_demo_data
from app.services.websocket_manager import ws_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown."""
    logger.info("🚑 IntelliTraffic AI starting up...")
    logger.info(f"  Mode: {'DEMO' if settings.DEMO_MODE else 'PRODUCTION'}")
    logger.info(f"  DB:   {settings.effective_database_url[:40]}...")
    logger.info(f"  Routing: {'Google Routes' if settings.google_routes_configured else 'Demo (simulated)'}")
    
    # Initialize DB
    init_db()
    
    # Seed demo data
    if settings.DEMO_SEED_ON_START:
        seed_demo_data()
    
    yield
    logger.info("IntelliTraffic AI shutting down.")


app = FastAPI(
    title="IntelliTraffic AI",
    description=(
        "Smarter Ambulance Dispatch. Faster Healthcare Connections.\n\n"
        "**DEMO MODE**: This instance uses simulated data where indicated. "
        "Not a substitute for official emergency services. In India, call 112 for emergencies."
    ),
    version="1.0.0-mvp",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
from app.api import auth, ambulances, bookings, hospitals, scheduled_trips, analytics, admin, routes as routes_api, incidents

app.include_router(auth.router)
app.include_router(ambulances.router)
app.include_router(bookings.router)
app.include_router(hospitals.router)
app.include_router(hospitals.notif_router)
app.include_router(scheduled_trips.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(routes_api.router)
app.include_router(incidents.router)


# ---- Health / Readiness ----

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "intellitraffic-ai"}


@app.get("/ready", tags=["Health"])
def ready():
    from app.database.database import engine
    try:
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        return {"status": "ready", "database": "connected", "demo_mode": settings.DEMO_MODE}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "not_ready", "error": str(e)})


# ---- WebSocket ----

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = Query(...)):
    """
    Real-time updates for a user.
    Connect with: ws://localhost:8000/ws/{user_id}?token=<jwt>
    """
    from app.core.security import decode_access_token
    payload = decode_access_token(token)
    if not payload or payload.get("sub") != user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await ws_manager.connect(websocket, user_id)
    try:
        # Send connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connected",
            "user_id": user_id,
            "message": "Real-time updates active",
        }))
        # Keep alive / handle ping
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)


# ---- Notifications ----

@app.get("/api/notifications", tags=["Notifications"])
def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(__import__("app.core.dependencies", fromlist=["get_current_user"]).get_current_user),
    db=Depends(__import__("app.database.database", fromlist=["get_db"]).get_db),
):
    from app.models.scheduled_trip import Notification
    from app.schemas.schemas import NotificationOut
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return [NotificationOut.model_validate(n) for n in notifs]


@app.patch("/api/notifications/{notif_id}/read", tags=["Notifications"])
def mark_notification_read(
    notif_id: str,
    current_user=Depends(__import__("app.core.dependencies", fromlist=["get_current_user"]).get_current_user),
    db=Depends(__import__("app.database.database", fromlist=["get_db"]).get_db),
):
    from app.models.scheduled_trip import Notification
    notif = db.query(Notification).filter(
        Notification.id == notif_id, Notification.user_id == current_user.id
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"ok": True}
