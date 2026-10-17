"""
Demo data seeder.
Creates sample users, operators, ambulances, hospitals, and bookings.
All seeded data is clearly marked as demo data.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.ambulance import (
    Ambulance, Operator, Driver, VehicleLocationUpdate,
    AmbulanceStatus, AmbulanceCategory, VerificationStatus
)
from app.models.booking import Booking, BookingStatusEvent, BookingStatus, BookingType
from app.models.hospital import Hospital, HospitalVerificationStatus
from app.models.scheduled_trip import ScheduledTrip, AuditLog, RecurrenceType, ScheduledTripStatus
from app.models.incident import Incident, PoliceStation, PoliceNotification, Handover
from app.core.security import hash_password
from datetime import date

logger = logging.getLogger(__name__)

# -----------------------------------------------
# Demo accounts (local development only)
# -----------------------------------------------
DEMO_ACCOUNTS = [
    {
        "email": "patient@demo.local",
        "password": "Demo@1234",
        "full_name": "Priya Nair",
        "phone": "+919876543210",
        "emergency_contact_phone": "+919840123456",
        "emergency_contact_name": "Kavitha Nair (Spouse)",
        "role": UserRole.PATIENT,
    },
    {
        "email": "operator@demo.local",
        "password": "Demo@1234",
        "full_name": "Rajesh Kumar",
        "phone": "+919876543211",
        "emergency_contact_phone": "+919840123499",
        "emergency_contact_name": "Suresh (Operations Lead)",
        "role": UserRole.OPERATOR,
    },
    {
        "email": "hospital@demo.local",
        "password": "Demo@1234",
        "full_name": "Dr. Meena Thomas",
        "phone": "+919876543212",
        "role": UserRole.HOSPITAL,
    },
    {
        "email": "admin@demo.local",
        "password": "Demo@1234",
        "full_name": "Platform Admin",
        "phone": "+919876543213",
        "role": UserRole.ADMIN,
    },
    # Extra patient for demo variety
    {
        "email": "patient2@demo.local",
        "password": "Demo@1234",
        "full_name": "Arun Krishnan",
        "phone": "+919876543214",
        "emergency_contact_phone": "+919840199999",
        "emergency_contact_name": "Deepa Krishnan (Mother)",
        "role": UserRole.PATIENT,
    },
    # Extra operator
    {
        "email": "operator2@demo.local",
        "password": "Demo@1234",
        "full_name": "Suresh Menon",
        "phone": "+919876543215",
        "role": UserRole.OPERATOR,
    },
]


def utcnow():
    return datetime.now(timezone.utc)


def generate_ref():
    return "IT" + str(uuid.uuid4())[:8].upper()


def seed_database(db: Session) -> None:
    """Idempotent seed — skips if demo data already exists, but updates emergency contacts."""
    if db.query(User).filter(User.email == "admin@demo.local").first():
        logger.info("Demo data already seeded. Updating demo emergency contacts...")
        for acc in DEMO_ACCOUNTS:
            u = db.query(User).filter(User.email == acc["email"]).first()
            if u:
                if acc.get("emergency_contact_phone") and not u.emergency_contact_phone:
                    u.emergency_contact_phone = acc.get("emergency_contact_phone")
                if acc.get("emergency_contact_name") and not u.emergency_contact_name:
                    u.emergency_contact_name = acc.get("emergency_contact_name")
        db.commit()
        return

    logger.info("Seeding demo data...")

    # ---- Users ----
    users = {}
    for acc in DEMO_ACCOUNTS:
        user = User(
            id=str(uuid.uuid4()),
            email=acc["email"],
            hashed_password=hash_password(acc["password"]),
            full_name=acc["full_name"],
            phone=acc["phone"],
            emergency_contact_phone=acc.get("emergency_contact_phone"),
            emergency_contact_name=acc.get("emergency_contact_name"),
            role=acc["role"],
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        users[acc["email"]] = user

    db.flush()

    # ---- Operator 1 ----
    op1 = Operator(
        id=str(uuid.uuid4()),
        user_id=users["operator@demo.local"].id,
        organization_name="Kerala LifeLine Ambulance Services",
        registration_number="KL-AMB-2023-001",
        address="MG Road, Kochi, Kerala",
        city="Kochi",
        verification_status=VerificationStatus.VERIFIED,
        subscription_plan="professional",
        subscription_expires_at=utcnow() + timedelta(days=365),
        is_active=True,
    )
    db.add(op1)

    # ---- Operator 2 ----
    op2 = Operator(
        id=str(uuid.uuid4()),
        user_id=users["operator2@demo.local"].id,
        organization_name="Trivandrum Rapid Medical Transport",
        registration_number="KL-AMB-2023-002",
        address="Statue Junction, Thiruvananthapuram, Kerala",
        city="Thiruvananthapuram",
        verification_status=VerificationStatus.VERIFIED,
        subscription_plan="starter",
        subscription_expires_at=utcnow() + timedelta(days=180),
        is_active=True,
    )
    db.add(op2)
    db.flush()

    # ---- Drivers ----
    driver1 = Driver(
        id=str(uuid.uuid4()),
        operator_id=op1.id,
        full_name="Anoop Varghese",
        phone="+919876543220",
        license_number="KL01 20230001",
        license_expiry=utcnow() + timedelta(days=730),
        is_active=True,
    )
    driver2 = Driver(
        id=str(uuid.uuid4()),
        operator_id=op1.id,
        full_name="Biju George",
        phone="+919876543221",
        license_number="KL01 20230002",
        license_expiry=utcnow() + timedelta(days=365),
        is_active=True,
    )
    driver3 = Driver(
        id=str(uuid.uuid4()),
        operator_id=op2.id,
        full_name="Satheesh Kumar",
        phone="+919876543222",
        license_number="KL10 20230001",
        license_expiry=utcnow() + timedelta(days=500),
        is_active=True,
    )
    db.add_all([driver1, driver2, driver3])
    db.flush()

    # ---- Ambulances ----
    # Kochi coordinates: ~9.9312° N, 76.2673° E
    d_svc = lambda k: (date.today() + timedelta(days=k)).isoformat()

    amb1 = Ambulance(
        id=str(uuid.uuid4()),
        operator_id=op1.id,
        driver_id=driver1.id,
        registration_number="KL-07-AB-1234",
        vehicle_name="Kerala LifeLine Unit 1",
        callsign="KL-AMB-01",
        category=AmbulanceCategory.ALS,
        status=AmbulanceStatus.AVAILABLE,
        verification_status=VerificationStatus.VERIFIED,
        capabilities=["oxygen_supply", "defibrillator", "ecg_monitor", "iv_access"],
        last_latitude=8.5100,
        last_longitude=76.9500,
        last_location_update=utcnow() - timedelta(minutes=3),
        equipment_notes="Fully equipped ALS unit with trained paramedic",
        capacity=2,
        cost_per_km=14.0,
        km_run=240.0,
        trips=12,
        next_service=d_svc(40),
        insurance_expiry=utcnow() + timedelta(days=300),
        permit_expiry=utcnow() + timedelta(days=180),
        fitness_expiry=utcnow() + timedelta(days=90),
        is_active=True,
    )
    amb2 = Ambulance(
        id=str(uuid.uuid4()),
        operator_id=op1.id,
        driver_id=driver2.id,
        registration_number="KL-07-AB-5678",
        vehicle_name="Kerala LifeLine Unit 2 (BLS)",
        callsign="KL-AMB-02",
        category=AmbulanceCategory.BASIC,
        status=AmbulanceStatus.AVAILABLE,
        verification_status=VerificationStatus.VERIFIED,
        capabilities=["ventilator", "oxygen_supply", "defibrillator", "ecg_monitor", "iv_access", "pulse_oximeter"],
        last_latitude=8.5400,
        last_longitude=76.9000,
        last_location_update=utcnow() - timedelta(minutes=1),
        equipment_notes="Mobile unit with oxygen and emergency equipment",
        capacity=1,
        cost_per_km=11.0,
        km_run=180.0,
        trips=8,
        next_service=d_svc(9),
        insurance_expiry=utcnow() + timedelta(days=250),
        permit_expiry=utcnow() + timedelta(days=150),
        fitness_expiry=utcnow() + timedelta(days=60),
        is_active=True,
    )
    amb3 = Ambulance(
        id=str(uuid.uuid4()),
        operator_id=op1.id,
        registration_number="KL-07-AB-9012",
        vehicle_name="Kerala LifeLine ALS Unit 3",
        callsign="KL-AMB-03",
        category=AmbulanceCategory.ALS,
        status=AmbulanceStatus.AVAILABLE,
        verification_status=VerificationStatus.VERIFIED,
        capabilities=["first_aid", "oxygen_supply", "stretcher", "defibrillator"],
        last_latitude=8.4900,
        last_longitude=76.9300,
        last_location_update=utcnow() - timedelta(minutes=5),
        equipment_notes="ALS transport ambulance",
        capacity=2,
        cost_per_km=14.5,
        km_run=520.0,
        trips=26,
        next_service=d_svc(25),
        insurance_expiry=utcnow() + timedelta(days=200),
        permit_expiry=utcnow() + timedelta(days=100),
        fitness_expiry=utcnow() + timedelta(days=30),
        is_active=True,
    )
    # Trivandrum
    amb4 = Ambulance(
        id=str(uuid.uuid4()),
        operator_id=op2.id,
        driver_id=driver3.id,
        registration_number="KL-01-AM-4321",
        vehicle_name="Trivandrum Rapid Unit 1 (BLS)",
        callsign="KL-AMB-04",
        category=AmbulanceCategory.BASIC,
        status=AmbulanceStatus.AVAILABLE,
        verification_status=VerificationStatus.VERIFIED,
        capabilities=["wheelchair_ramp", "stretcher", "first_aid", "oxygen_supply"],
        last_latitude=8.5600,
        last_longitude=76.9600,
        last_location_update=utcnow() - timedelta(minutes=2),
        equipment_notes="BLS patient transport",
        capacity=2,
        cost_per_km=10.5,
        km_run=310.0,
        trips=15,
        next_service=d_svc(60),
        insurance_expiry=utcnow() + timedelta(days=180),
        permit_expiry=utcnow() + timedelta(days=90),
        fitness_expiry=utcnow() + timedelta(days=45),
        is_active=True,
    )
    amb5 = Ambulance(
        id=str(uuid.uuid4()),
        operator_id=op2.id,
        registration_number="KL-01-AM-8765",
        vehicle_name="Trivandrum Rapid ALS Unit 5",
        callsign="KL-AMB-05",
        category=AmbulanceCategory.ALS,
        status=AmbulanceStatus.MAINTENANCE,
        verification_status=VerificationStatus.VERIFIED,
        capabilities=["oxygen_supply", "defibrillator", "ecg_monitor"],
        last_latitude=8.5250,
        last_longitude=76.9350,
        last_location_update=utcnow() - timedelta(hours=2),
        equipment_notes="ALS unit currently undergoing scheduled service",
        capacity=2,
        cost_per_km=14.0,
        km_run=890.0,
        trips=42,
        next_service=d_svc(-2),
        is_active=True,
    )
    db.add_all([amb1, amb2, amb3, amb4, amb5])

    # ---- Hospitals ----
    hosp1 = Hospital(
        id=str(uuid.uuid4()),
        user_id=users["hospital@demo.local"].id,
        name="Govt Medical College Hospital",
        address="Medical College PO, Thiruvananthapuram, Kerala 695011",
        city="Thiruvananthapuram",
        latitude=8.5241,
        longitude=76.9264,
        contact_phone="+91471-2528386",
        contact_email="gmctvm@kerala.gov.in",
        emergency_phone="+91471-2528000",
        website="https://gmctvm.kerala.gov.in",
        services=["emergency", "icu", "cardiology", "neurology", "trauma", "neonatal", "burns", "obstetrics", "pediatrics", "pulmonology"],
        capabilities="emergency,trauma,cardiology,neurology,obstetrics,pediatrics,burns,pulmonology",
        er_beds=12,
        info_updated=utcnow(),
        verification_status=HospitalVerificationStatus.VERIFIED,
        is_active=True,
    )
    hosp2 = Hospital(
        id=str(uuid.uuid4()),
        user_id=None,
        name="KIMS Health",
        address="Anayara PO, Thiruvananthapuram, Kerala 695029",
        city="Thiruvananthapuram",
        latitude=8.5389,
        longitude=76.9200,
        contact_phone="+91471-2941000",
        contact_email="info@kimshealth.org",
        emergency_phone="+91471-2941111",
        services=["emergency", "trauma", "cardiology", "neurology", "pulmonology", "obstetrics"],
        capabilities="emergency,trauma,cardiology,neurology,pulmonology,obstetrics",
        er_beds=6,
        info_updated=utcnow(),
        verification_status=HospitalVerificationStatus.VERIFIED,
        is_active=True,
    )
    hosp3 = Hospital(
        id=str(uuid.uuid4()),
        user_id=None,
        name="SUT Hospital Pattom",
        address="Pattom, Thiruvananthapuram, Kerala 695004",
        city="Thiruvananthapuram",
        latitude=8.5266,
        longitude=76.9438,
        contact_phone="+91471-4077777",
        contact_email="info@suthospital.com",
        emergency_phone="+91471-4077888",
        services=["emergency", "cardiology", "obstetrics", "pediatrics"],
        capabilities="emergency,cardiology,obstetrics,pediatrics",
        er_beds=4,
        info_updated=utcnow(),
        verification_status=HospitalVerificationStatus.VERIFIED,
        is_active=True,
    )
    hosp4 = Hospital(
        id=str(uuid.uuid4()),
        user_id=None,
        name="Cosmopolitan Hospital",
        address="Murinjapalam, Pattom, Thiruvananthapuram, Kerala 695004",
        city="Thiruvananthapuram",
        latitude=8.5278,
        longitude=76.9427,
        contact_phone="+91471-2448182",
        contact_email="info@cosmopolitanhospital.in",
        emergency_phone="+91471-2448181",
        services=["emergency", "trauma", "neurology", "pulmonology"],
        capabilities="emergency,trauma,neurology,pulmonology",
        er_beds=0,
        info_updated=utcnow(),
        verification_status=HospitalVerificationStatus.VERIFIED,
        is_active=True,
    )
    hosp5 = Hospital(
        id=str(uuid.uuid4()),
        user_id=None,
        name="General Hospital",
        address="Vanchiyoor, Thiruvananthapuram, Kerala 695035",
        city="Thiruvananthapuram",
        latitude=8.4960,
        longitude=76.9480,
        contact_phone="+91471-2473108",
        contact_email="gh@kerala.gov.in",
        emergency_phone="+91471-2473108",
        services=["emergency", "trauma", "pediatrics"],
        capabilities="emergency,trauma,pediatrics",
        er_beds=5,
        info_updated=utcnow() - timedelta(days=3),
        verification_status=HospitalVerificationStatus.VERIFIED,
        is_active=True,
    )
    hosp6 = Hospital(
        id=str(uuid.uuid4()),
        user_id=None,
        name="Ananthapuri Hospitals",
        address="Chacka, NH Bypass, Thiruvananthapuram, Kerala 695024",
        city="Thiruvananthapuram",
        latitude=8.4838,
        longitude=76.9232,
        contact_phone="+91471-6669999",
        contact_email="info@ananthapurihospitals.com",
        emergency_phone="+91471-6669000",
        services=["emergency", "cardiology", "pulmonology", "trauma"],
        capabilities="emergency,cardiology,pulmonology,trauma",
        er_beds=3,
        info_updated=utcnow(),
        verification_status=HospitalVerificationStatus.VERIFIED,
        is_active=True,
    )
    db.add_all([hosp1, hosp2, hosp3, hosp4, hosp5, hosp6])
    db.flush()

    # ---- Sample Bookings ----
    now = utcnow()

    booking1 = Booking(
        id=str(uuid.uuid4()),
        reference_number=generate_ref(),
        patient_user_id=users["patient@demo.local"].id,
        booking_type=BookingType.EMERGENCY,
        requested_category="als",
        status=BookingStatus.COMPLETED,
        pickup_latitude=9.9200,
        pickup_longitude=76.2600,
        pickup_address="Fort Kochi Beach, Kochi, Kerala",
        destination_latitude=hosp1.latitude,
        destination_longitude=hosp1.longitude,
        destination_address=hosp1.address,
        destination_hospital_id=hosp1.id,
        patient_name="Priya Nair",
        patient_age="34",
        patient_notes="Chest pain, shortness of breath",
        contact_phone="+919876543210",
        assigned_ambulance_id=amb1.id,
        assigned_operator_id=op1.id,
        accepted_at=now - timedelta(hours=3, minutes=45),
        completed_at=now - timedelta(hours=3),
        estimated_arrival_minutes=18.0,
        eta_last_updated_at=now - timedelta(hours=3, minutes=40),
        estimated_fare_inr=850.0,
        recorded_fare_inr=850.0,
        is_demo=True,
        created_at=now - timedelta(hours=4),
    )

    booking2 = Booking(
        id=str(uuid.uuid4()),
        reference_number=generate_ref(),
        patient_user_id=users["patient2@demo.local"].id,
        booking_type=BookingType.EMERGENCY,
        requested_category="basic",
        status=BookingStatus.EN_ROUTE_PICKUP,
        pickup_latitude=9.9350,
        pickup_longitude=76.2700,
        pickup_address="Ernakulam Junction, Kochi",
        destination_latitude=hosp2.latitude,
        destination_longitude=hosp2.longitude,
        destination_address=hosp2.address,
        destination_hospital_id=hosp2.id,
        patient_name="Arun Krishnan",
        patient_age="58",
        patient_notes="Fall injury, possible fracture",
        contact_phone="+919876543214",
        assigned_ambulance_id=amb3.id,
        assigned_operator_id=op1.id,
        accepted_at=now - timedelta(minutes=15),
        estimated_arrival_minutes=12.0,
        eta_last_updated_at=now - timedelta(minutes=5),
        estimated_fare_inr=600.0,
        is_demo=True,
        created_at=now - timedelta(minutes=20),
    )

    booking3 = Booking(
        id=str(uuid.uuid4()),
        reference_number=generate_ref(),
        patient_user_id=users["patient@demo.local"].id,
        booking_type=BookingType.SCHEDULED,
        requested_category="wheelchair",
        status=BookingStatus.PENDING,
        pickup_latitude=9.9100,
        pickup_longitude=76.2500,
        pickup_address="Mattancherry, Kochi",
        destination_latitude=hosp1.latitude,
        destination_longitude=hosp1.longitude,
        destination_address=hosp1.address,
        destination_hospital_id=hosp1.id,
        patient_name="Priya Nair",
        patient_age="34",
        patient_notes="Dialysis appointment",
        contact_phone="+919876543210",
        scheduled_at=now + timedelta(days=1, hours=8),
        is_demo=True,
        created_at=now - timedelta(hours=1),
    )
    db.add_all([booking1, booking2, booking3])
    db.flush()

    # ---- Status events for completed booking ----
    events = [
        BookingStatusEvent(booking_id=booking1.id, from_status=None, to_status=BookingStatus.PENDING,
                           created_at=now - timedelta(hours=4)),
        BookingStatusEvent(booking_id=booking1.id, from_status=BookingStatus.PENDING, to_status=BookingStatus.SEARCHING,
                           created_at=now - timedelta(hours=3, minutes=59)),
        BookingStatusEvent(booking_id=booking1.id, from_status=BookingStatus.SEARCHING, to_status=BookingStatus.ACCEPTED,
                           created_at=now - timedelta(hours=3, minutes=45)),
        BookingStatusEvent(booking_id=booking1.id, from_status=BookingStatus.ACCEPTED, to_status=BookingStatus.EN_ROUTE_PICKUP,
                           created_at=now - timedelta(hours=3, minutes=44)),
        BookingStatusEvent(booking_id=booking1.id, from_status=BookingStatus.EN_ROUTE_PICKUP, to_status=BookingStatus.ARRIVED_PICKUP,
                           created_at=now - timedelta(hours=3, minutes=25)),
        BookingStatusEvent(booking_id=booking1.id, from_status=BookingStatus.ARRIVED_PICKUP, to_status=BookingStatus.PATIENT_ONBOARD,
                           created_at=now - timedelta(hours=3, minutes=20)),
        BookingStatusEvent(booking_id=booking1.id, from_status=BookingStatus.PATIENT_ONBOARD, to_status=BookingStatus.EN_ROUTE_DESTINATION,
                           created_at=now - timedelta(hours=3, minutes=18)),
        BookingStatusEvent(booking_id=booking1.id, from_status=BookingStatus.EN_ROUTE_DESTINATION, to_status=BookingStatus.COMPLETED,
                           created_at=now - timedelta(hours=3)),
    ]
    for e in events:
        e.id = str(uuid.uuid4())
        db.add(e)

    # Active booking events
    active_events = [
        BookingStatusEvent(id=str(uuid.uuid4()), booking_id=booking2.id, from_status=None, to_status=BookingStatus.PENDING,
                           created_at=now - timedelta(minutes=20)),
        BookingStatusEvent(id=str(uuid.uuid4()), booking_id=booking2.id, from_status=BookingStatus.PENDING, to_status=BookingStatus.ACCEPTED,
                           created_at=now - timedelta(minutes=15)),
        BookingStatusEvent(id=str(uuid.uuid4()), booking_id=booking2.id, from_status=BookingStatus.ACCEPTED, to_status=BookingStatus.EN_ROUTE_PICKUP,
                           created_at=now - timedelta(minutes=14)),
    ]
    db.add_all(active_events)

    # ---- Scheduled Trip ----
    sched_trip = ScheduledTrip(
        id=str(uuid.uuid4()),
        patient_user_id=users["patient@demo.local"].id,
        title="Dialysis - Weekly Tuesday",
        trip_purpose="dialysis",
        requested_category="non_emergency",
        pickup_address="Mattancherry, Kochi, Kerala",
        pickup_latitude=9.9100,
        pickup_longitude=76.2500,
        destination_address="Lakeshore Hospital, Kochi",
        destination_latitude=hosp1.latitude,
        destination_longitude=hosp1.longitude,
        destination_hospital_id=hosp1.id,
        scheduled_at=now + timedelta(days=1, hours=8),
        recurrence_type=RecurrenceType.WEEKLY,
        recurrence_days="TUE",
        contact_phone="+919876543210",
        patient_notes="Patient requires wheelchair assistance",
        status=ScheduledTripStatus.SCHEDULED,
    )
    db.add(sched_trip)

    # ---- Audit log entries ----
    audit_entries = [
        AuditLog(id=str(uuid.uuid4()), action="seed_demo_data", resource_type="system",
                 detail="Demo data seeded on application startup", created_at=utcnow()),
        AuditLog(id=str(uuid.uuid4()), user_id=users["operator@demo.local"].id,
                 action="booking_accepted", resource_type="booking", resource_id=booking1.id,
                 detail=f"Operator accepted booking {booking1.reference_number}",
                 created_at=now - timedelta(hours=3, minutes=45)),
        AuditLog(id=str(uuid.uuid4()), user_id=users["operator@demo.local"].id,
                 action="booking_completed", resource_type="booking", resource_id=booking1.id,
                 detail=f"Trip completed for booking {booking1.reference_number}",
                 created_at=now - timedelta(hours=3)),
    ]
    db.add_all(audit_entries)

    # ---- Police Stations (Illustrative demo data) ----
    police_stations = [
        PoliceStation(name="Museum Police Station (sample location)", lat=8.5070, lng=76.9560),
        PoliceStation(name="Medical College Police Station (sample location)", lat=8.5310, lng=76.9280),
        PoliceStation(name="Kazhakkoottam Police Station (sample location)", lat=8.5680, lng=76.8720),
        PoliceStation(name="Ernakulam Central Police Station (sample location)", lat=9.9723, lng=76.2842),
    ]
    db.add_all(police_stations)
    db.flush()

    # ---- Demo Incidents from IntelliTraffic AI ----
    inc1 = Incident(
        created=(now - timedelta(hours=2)).isoformat(timespec="seconds"),
        reporter="citizen",
        lat=8.5241,
        lng=76.9366,
        address="Near Pattom Junction, Thiruvananthapuram",
        description="Elderly male experiencing acute chest pain and shortness of breath.",
        condition="cardiac",
        severity="critical",
        status="dispatched",
        verified_by="disp-demo",
        ambulance_id=1,
        hospital_id=1,
        eta_min=7.5,
        pickup_km=4.2,
        baseline_eta_min=14.0,
        baseline_km=8.1,
        hosp_km=2.8,
        source="estimate",
        simulated=1,
        assigned_at=(now - timedelta(hours=1, minutes=45)).isoformat(timespec="seconds"),
    )
    inc2 = Incident(
        created=(now - timedelta(minutes=45)).isoformat(timespec="seconds"),
        reporter="citizen",
        lat=8.5680,
        lng=76.8750,
        address="Kazhakkoottam Bypass Road",
        description="Two-wheeler collision with minor injuries, patient conscious.",
        condition="trauma",
        severity="moderate",
        status="verified",
        verified_by="disp-demo",
    )
    inc3 = Incident(
        created=(now - timedelta(minutes=15)).isoformat(timespec="seconds"),
        reporter="citizen",
        lat=8.5020,
        lng=76.9520,
        address="Palayam Underpass, MG Road",
        description="Patient with sudden severe breathing difficulty, asthmatic history.",
        condition="respiratory",
        severity="moderate",
        status="reported",
    )
    inc4 = Incident(
        created=(now - timedelta(hours=6)).isoformat(timespec="seconds"),
        reporter="citizen",
        lat=8.4900,
        lng=76.9320,
        address="East Fort Bus Stand",
        description="Fall injury near bus station, suspected limb fracture.",
        condition="trauma",
        severity="moderate",
        status="closed",
        verified_by="disp-demo",
        ambulance_id=3,
        hospital_id=1,
        eta_min=11.2,
        pickup_km=6.1,
        baseline_eta_min=18.4,
        baseline_km=11.5,
        hosp_km=4.3,
        source="estimate",
        simulated=0,
        assigned_at=(now - timedelta(hours=5, minutes=50)).isoformat(timespec="seconds"),
        closed_at=(now - timedelta(hours=4, minutes=30)).isoformat(timespec="seconds"),
    )
    db.add_all([inc1, inc2, inc3, inc4])
    db.flush()

    # ---- Police Notifications & Handovers ----
    pol_notif = PoliceNotification(
        ts=(now - timedelta(hours=1, minutes=45)).isoformat(timespec="seconds"),
        incident_id=inc1.id,
        station_name="Medical College Police Station (sample location)",
        station_lat=8.5310,
        station_lng=76.9280,
        distance_km=1.2,
        ambulance_callsign="KL-AMB-01",
        driver_message="Driver accepted dispatch; proceeding to incident.",
        delivery_status="DEMO LOGGED ONLY - NOT SENT TO POLICE",
    )
    handover1 = Handover(
        incident_id=inc1.id,
        hospital_id=1,
        status="confirmed",
        acknowledged_by="Dr. Meena (ER Lead)",
        note="Cath lab pre-notified and ready for patient arrival.",
        updated=(now - timedelta(hours=1, minutes=30)).isoformat(timespec="seconds"),
    )
    db.add_all([pol_notif, handover1])

    db.commit()
    logger.info("✅ Demo data seeded successfully.")
    logger.info("Demo accounts (local use only):")
    for acc in DEMO_ACCOUNTS:
        logger.info(f"  {acc['role'].value:10} | {acc['email']:30} | {acc['password']}")
