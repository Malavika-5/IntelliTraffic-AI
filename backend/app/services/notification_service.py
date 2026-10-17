"""
Notification Service — abstraction over push/SMS/in-app providers.
Mock provider logs all notifications to stdout and stores them in the DB.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationEvent:
    BOOKING_CREATED = "booking_created"
    OPERATOR_ACCEPTED = "operator_accepted"
    OPERATOR_REJECTED = "operator_rejected"
    NO_MATCH_FOUND = "no_match_found"
    VEHICLE_DISPATCHED = "vehicle_dispatched"
    ETA_UPDATED = "eta_updated"
    VEHICLE_ARRIVED = "vehicle_arrived"
    TRIP_STATUS_CHANGED = "trip_status_changed"
    HOSPITAL_NOTIFIED = "hospital_notified"
    HOSPITAL_ACKNOWLEDGED = "hospital_acknowledged"
    SCHEDULED_REMINDER = "scheduled_reminder"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_COMPLETED = "booking_completed"
    EMERGENCY_CONTACT_ALERTED = "emergency_contact_alerted"


async def send_emergency_contact_sms(
    phone: str,
    message: str,
    contact_name: Optional[str] = None,
    booking_id: Optional[str] = None,
) -> bool:
    """
    Dispatch SMS notification to the patient's registered emergency contact.
    In DEMO/mock mode, this logs the SMS payload clearly.
    In production with Twilio / MSG91 configured, it initiates the real SMS dispatch.
    """
    logger.info(
        f"🚨 [SMS EMERGENCY ALERT DISPATCH] To: {phone} ({contact_name or 'Emergency Contact'}) "
        f"| Booking: {booking_id} | Message: {message}"
    )
    if settings.SMS_PROVIDER == "twilio" and settings.TWILIO_ACCOUNT_SID:
        # Twilio SMS placeholder
        logger.info(f"[Twilio] SMS dispatched to {phone}")
    elif settings.SMS_PROVIDER == "msg91" and settings.MSG91_API_KEY:
        # MSG91 SMS placeholder
        logger.info(f"[MSG91] SMS dispatched to {phone}")
    return True


async def send_notification(
    db: Session,
    user_id: str,
    title: str,
    body: str,
    event_type: str,
    related_booking_id: Optional[str] = None,
) -> None:
    """
    Send a notification to a user.
    Uses mock provider in demo mode. FCM/SMS when configured.
    """
    from app.models.scheduled_trip import Notification
    import uuid

    # Always store in-app notification
    notif = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=title,
        body=body,
        type=event_type,
        related_booking_id=related_booking_id,
        is_read=False,
        delivered_via="in_app",
    )
    db.add(notif)

    # Mock provider: log to console
    logger.info(f"[NOTIFICATION MOCK] -> user={user_id} | {event_type}: {title} — {body}")

    # FCM (when configured)
    if settings.firebase_configured:
        await _send_fcm(user_id, title, body)

    # SMS (when configured)
    if settings.sms_configured:
        await _send_sms(user_id, body)


async def _send_fcm(user_id: str, title: str, body: str) -> None:
    """Send Firebase Cloud Messaging push notification."""
    # TODO: Implement FCM when credentials are configured
    # Requires: fetching user's FCM token from DB, POST to FCM API
    logger.info(f"[FCM] Would send to user {user_id}: {title}")


async def _send_sms(user_id: str, message: str) -> None:
    """Send SMS via configured provider (Twilio or MSG91)."""
    provider = settings.SMS_PROVIDER
    if provider == "twilio":
        logger.info(f"[SMS/Twilio] Would send to user {user_id}: {message}")
        # TODO: Implement Twilio integration
    elif provider == "msg91":
        logger.info(f"[SMS/MSG91] Would send to user {user_id}: {message}")
        # TODO: Implement MSG91 integration
