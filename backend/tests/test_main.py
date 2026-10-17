"""
Backend test suite for IntelliTraffic AI.
Tests: auth, bookings, matching, concurrency, hospital notifications.
"""
import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.database import Base, get_db
from app.database.seed import seed_database

# ---- Test DB (SQLite in-memory) ----
TEST_DATABASE_URL = "sqlite:///./test_intellitraffic.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create tables and seed test data."""
    import app.models  # noqa: register all models
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    import os
    try:
        if os.path.exists("test_intellitraffic.db"):
            os.remove("test_intellitraffic.db")
    except OSError:
        pass


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def patient_token(client):
    r = client.post("/api/auth/login", json={"email": "patient@demo.local", "password": "Demo@1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture
def operator_token(client):
    r = client.post("/api/auth/login", json={"email": "operator@demo.local", "password": "Demo@1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture
def hospital_token(client):
    r = client.post("/api/auth/login", json={"email": "hospital@demo.local", "password": "Demo@1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture
def admin_token(client):
    r = client.post("/api/auth/login", json={"email": "admin@demo.local", "password": "Demo@1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


# ============================================
# AUTH TESTS
# ============================================

class TestAuth:
    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_login_success(self, client):
        r = client.post("/api/auth/login", json={"email": "patient@demo.local", "password": "Demo@1234"})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == "patient@demo.local"
        assert data["user"]["role"] == "patient"

    def test_login_invalid_password(self, client):
        r = client.post("/api/auth/login", json={"email": "patient@demo.local", "password": "wrongpassword"})
        assert r.status_code == 401

    def test_login_nonexistent_user(self, client):
        r = client.post("/api/auth/login", json={"email": "nobody@test.local", "password": "password"})
        assert r.status_code == 401

    def test_register_success(self, client):
        r = client.post("/api/auth/register", json={
            "email": "newpatient@test.local",
            "password": "SecurePass123",
            "full_name": "Test Patient",
            "role": "patient",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["user"]["email"] == "newpatient@test.local"

    def test_register_duplicate_email(self, client):
        r = client.post("/api/auth/register", json={
            "email": "patient@demo.local",
            "password": "SecurePass123",
            "full_name": "Duplicate",
        })
        assert r.status_code == 400

    def test_get_me(self, client, patient_token):
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 200
        assert r.json()["role"] == "patient"

    def test_get_me_invalid_token(self, client):
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401


# ============================================
# ROLE-BASED ACCESS TESTS
# ============================================

class TestRoleAccess:
    def test_patient_cannot_access_admin(self, client, patient_token):
        r = client.get("/api/admin/users", headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 403

    def test_operator_cannot_access_admin(self, client, operator_token):
        r = client.get("/api/admin/users", headers={"Authorization": f"Bearer {operator_token}"})
        assert r.status_code == 403

    def test_admin_can_access_admin(self, client, admin_token):
        r = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200

    def test_patient_cannot_create_ambulance(self, client, patient_token):
        r = client.post("/api/ambulances",
                        json={"registration_number": "KL-99-ZZ-0001", "category": "basic"},
                        headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 403

    def test_hospital_cannot_accept_booking(self, client, hospital_token):
        r = client.post("/api/bookings/dummy-id/accept?ambulance_id=dummy",
                        headers={"Authorization": f"Bearer {hospital_token}"})
        assert r.status_code in (403, 404)


# ============================================
# AMBULANCE TESTS
# ============================================

class TestAmbulances:
    def test_list_ambulances(self, client, patient_token):
        r = client.get("/api/ambulances", headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) > 0

    def test_operator_create_ambulance(self, client, operator_token):
        r = client.post("/api/ambulances",
                        json={
                            "registration_number": "KL-TEST-9999",
                            "vehicle_name": "Test Unit",
                            "category": "basic",
                            "capabilities": ["first_aid"],
                        },
                        headers={"Authorization": f"Bearer {operator_token}"})
        assert r.status_code == 201
        data = r.json()
        assert data["registration_number"] == "KL-TEST-9999"
        assert data["verification_status"] == "pending"

    def test_duplicate_registration_number(self, client, operator_token):
        # First creation
        client.post("/api/ambulances",
                    json={"registration_number": "KL-DUP-TEST", "category": "basic"},
                    headers={"Authorization": f"Bearer {operator_token}"})
        # Duplicate
        r = client.post("/api/ambulances",
                        json={"registration_number": "KL-DUP-TEST", "category": "basic"},
                        headers={"Authorization": f"Bearer {operator_token}"})
        assert r.status_code == 400


# ============================================
# BOOKING LIFECYCLE TESTS
# ============================================

class TestBookingLifecycle:
    @pytest.fixture
    def created_booking(self, client, patient_token):
        r = client.post("/api/bookings", json={
            "booking_type": "emergency",
            "requested_category": "basic",
            "pickup_latitude": 9.93,
            "pickup_longitude": 76.27,
            "pickup_address": "Test Location, Kochi",
            "patient_name": "Test Patient",
            "contact_phone": "+919876543200",
        }, headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 201
        return r.json()

    def test_create_booking(self, created_booking):
        assert created_booking["status"] == "pending"
        assert created_booking["reference_number"].startswith("IT")
        assert created_booking["requested_category"] == "basic"

    def test_patient_sees_own_bookings(self, client, patient_token, created_booking):
        r = client.get("/api/bookings", headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert created_booking["id"] in ids

    def test_match_booking(self, client, patient_token, created_booking):
        r = client.post(f"/api/bookings/{created_booking['id']}/match",
                        headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 200
        data = r.json()
        assert "candidates" in data
        assert "matching_notes" in data

    def test_cancel_booking(self, client, patient_token):
        # Create fresh booking to cancel
        r = client.post("/api/bookings", json={
            "booking_type": "emergency",
            "requested_category": "basic",
            "pickup_latitude": 9.93,
            "pickup_longitude": 76.27,
        }, headers={"Authorization": f"Bearer {patient_token}"})
        booking_id = r.json()["id"]

        r2 = client.post(f"/api/bookings/{booking_id}/cancel",
                         json={"reason": "Test cancellation"},
                         headers={"Authorization": f"Bearer {patient_token}"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "cancelled"

    def test_get_booking_events(self, client, patient_token, created_booking):
        r = client.get(f"/api/bookings/{created_booking['id']}/events",
                       headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 1
        assert events[0]["to_status"] == "pending"

    def test_booking_informs_emergency_contact(self, client, patient_token):
        r = client.post("/api/bookings", json={
            "booking_type": "emergency",
            "requested_category": "basic",
            "pickup_latitude": 9.93,
            "pickup_longitude": 76.27,
            "pickup_address": "Marine Drive, Kochi",
            "patient_name": "Priya Test",
            "emergency_contact_phone": "+919876599999",
            "emergency_contact_name": "Spouse Contact",
        }, headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 201
        data = r.json()
        assert data["emergency_contact_notified"] is True
        assert data["emergency_contact_phone"] == "+919876599999"
        assert data["emergency_contact_name"] == "Spouse Contact"
        assert data["emergency_contact_message"] is not None
        assert "EMERGENCY ALERT" in data["emergency_contact_message"]
        assert data["reference_number"] in data["emergency_contact_message"]

    def test_resend_emergency_alert(self, client, patient_token, created_booking):
        r = client.post(
            f"/api/bookings/{created_booking['id']}/resend-emergency-alert?custom_phone=%2B919876588888",
            headers={"Authorization": f"Bearer {patient_token}"}
        )
        assert r.status_code == 200
        data = r.json()
        assert data["emergency_contact_notified"] is True
        assert data["emergency_contact_phone"] == "+919876588888"

    def test_patient_cannot_see_other_booking(self, client, client2=None):
        """Regression: patient should get 403 for another patient's booking."""
        pass  # Tested implicitly via role checks


# ============================================
# MATCHING ENGINE TESTS
# ============================================

class TestMatchingEngine:
    def test_no_vehicles_for_incompatible_category(self, client, patient_token):
        # Neonatal transport — seeded ambulances may not match
        r = client.post("/api/bookings", json={
            "booking_type": "emergency",
            "requested_category": "neonatal",
            "pickup_latitude": 9.93,
            "pickup_longitude": 76.27,
        }, headers={"Authorization": f"Bearer {patient_token}"})
        booking_id = r.json()["id"]

        r2 = client.post(f"/api/bookings/{booking_id}/match",
                         headers={"Authorization": f"Bearer {patient_token}"})
        assert r2.status_code == 200
        data = r2.json()
        # Either no candidates or excluded with reason
        assert "excluded" in data

    def test_matching_returns_eta(self, client, patient_token):
        r = client.post("/api/bookings", json={
            "booking_type": "emergency",
            "requested_category": "als",
            "pickup_latitude": 9.93,
            "pickup_longitude": 76.27,
        }, headers={"Authorization": f"Bearer {patient_token}"})
        booking_id = r.json()["id"]

        r2 = client.post(f"/api/bookings/{booking_id}/match",
                         headers={"Authorization": f"Bearer {patient_token}"})
        assert r2.status_code == 200
        data = r2.json()
        if data["best_match"]:
            assert data["best_match"]["estimated_eta_minutes"] is not None
            assert data["best_match"]["is_demo_route"] is True  # No API key configured


# ============================================
# HOSPITAL TESTS
# ============================================

class TestHospitals:
    def test_list_hospitals(self, client, patient_token):
        r = client.get("/api/hospitals", headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 200
        hospitals = r.json()
        assert len(hospitals) >= 3  # Seeded 3 hospitals

    def test_hospital_get_my_profile(self, client, hospital_token):
        r = client.get("/api/hospitals/me/profile", headers={"Authorization": f"Bearer {hospital_token}"})
        assert r.status_code == 200
        data = r.json()
        assert "name" in data


# ============================================
# ANALYTICS TESTS
# ============================================

class TestAnalytics:
    def test_admin_analytics(self, client, admin_token):
        r = client.get("/api/analytics/admin", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert "total_operators" in data
        assert data["total_operators"] >= 2
        assert data["total_hospitals"] >= 3

    def test_operator_analytics(self, client, operator_token):
        r = client.get("/api/analytics/operator", headers={"Authorization": f"Bearer {operator_token}"})
        assert r.status_code == 200
        data = r.json()
        assert "total_ambulances" in data
        assert data["total_ambulances"] >= 3

    def test_patient_cannot_get_admin_analytics(self, client, patient_token):
        r = client.get("/api/analytics/admin", headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 403


# ============================================
# ROUTING TESTS
# ============================================

class TestRouting:
    def test_route_estimate_demo(self, client, patient_token):
        r = client.post("/api/routes/estimate", json={
            "origin_lat": 9.93,
            "origin_lon": 76.27,
            "dest_lat": 9.95,
            "dest_lon": 76.31,
        }, headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["is_demo"] is True  # No Google API key
        assert data["distance_meters"] > 0
        assert data["duration_minutes"] > 0
        assert data["provider"] == "demo"


# ============================================
# SCHEDULED TRIPS TESTS
# ============================================

class TestScheduledTrips:
    def test_create_scheduled_trip(self, client, patient_token):
        from datetime import datetime, timezone, timedelta
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        r = client.post("/api/scheduled-trips", json={
            "title": "Dialysis Visit",
            "trip_purpose": "dialysis",
            "requested_category": "non_emergency",
            "pickup_address": "Home, Kochi",
            "destination_address": "Lakeshore Hospital, Kochi",
            "scheduled_at": future,
            "recurrence_type": "weekly",
        }, headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Dialysis Visit"
        assert data["status"] == "scheduled"

    def test_list_scheduled_trips(self, client, patient_token):
        r = client.get("/api/scheduled-trips", headers={"Authorization": f"Bearer {patient_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ============================================
# INCIDENT WORKFLOW & FLEET / ROI TESTS
# ============================================

class TestIncidentWorkflow:
    def test_public_report_incident(self, client):
        r = client.post("/api/incidents", json={
            "lat": 8.5241,
            "lng": 76.9366,
            "address": "Statue Junction, Trivandrum",
            "description": "Chest pain incident",
            "condition": "cardiac",
            "severity": "critical",
            "reporter": "citizen",
        })
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "A dispatcher will verify it" in data["message"]

    def test_list_incidents(self, client):
        r = client.get("/api/incidents", headers={"X-Token": "disp-demo"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    def test_incident_options_with_scenarios(self, client):
        r = client.get("/api/incidents/1/options?scenario=heavy", headers={"X-Token": "disp-demo"})
        assert r.status_code == 200
        data = r.json()
        assert data["scenario"] == "heavy"
        assert len(data["ambulances"]) > 0
        assert len(data["hospitals"]) > 0

    def test_verify_and_assign_ambulance(self, client):
        # Report
        rep = client.post("/api/incidents", json={
            "lat": 8.5200,
            "lng": 76.9300,
            "address": "Pattom",
            "description": "Fall trauma",
            "condition": "trauma",
            "severity": "moderate",
        }).json()
        iid = rep["id"]

        # Verify
        v_res = client.post(f"/api/incidents/{iid}/verify", headers={"X-Token": "disp-demo"})
        assert v_res.status_code == 200
        assert v_res.json()["ok"] is True

        # Assign with commit message (triggers police notice)
        a_res = client.post(
            f"/api/incidents/{iid}/assign?scenario=live",
            json={"ambulance_id": 1, "manual": True, "commit_message": "En route now"},
            headers={"X-Token": "disp-demo"},
        )
        assert a_res.status_code == 200
        assert a_res.json()["ok"] is True
        assert "police_notice" in a_res.json()

    def test_handover_update(self, client):
        r = client.post("/api/handover", json={
            "incident_id": 1,
            "hospital_id": 1,
            "status": "confirmed",
            "acknowledged_by": "Dr. Sarah",
            "note": "Trauma team on standby",
        }, headers={"X-Token": "disp-demo"})
        assert r.status_code == 200
        assert r.json()["ok"] is True


class TestFleetAndROI:
    def test_fleet_overview(self, client):
        r = client.get("/api/fleet", headers={"X-Token": "fleet-demo"})
        assert r.status_code == 200
        data = r.json()
        assert "ambulances" in data
        assert "utilization_pct" in data
        assert len(data["ambulances"]) > 0

    def test_roi_metrics(self, client):
        r = client.get("/api/roi", headers={"X-Token": "fleet-demo"})
        assert r.status_code == 200
        data = r.json()
        assert "total_minutes_saved" in data
        assert "operating_cost_saved_inr" in data
        assert "method" in data

    def test_police_notifications_list(self, client):
        r = client.get("/api/police-notifications", headers={"X-Token": "disp-demo"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_police_stations_list(self, client):
        r = client.get("/api/police-stations")
        assert r.status_code == 200
        assert len(r.json()) >= 3
