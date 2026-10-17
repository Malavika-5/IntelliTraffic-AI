import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Clock,
  Repeat,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Loader2,
  ChevronLeft,
  Navigation,
  Phone,
} from "lucide-react";
import { PublicNavbar } from "@/components/layout/Navbar";
import api from "@/services/api";
import type { ScheduledTrip } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORIES = [
  { value: "basic", label: "Basic Transport" },
  { value: "als", label: "Advanced Life Support" },
  { value: "icu", label: "ICU Ambulance" },
  { value: "wheelchair", label: "Wheelchair Accessible" },
  { value: "non_emergency", label: "Non-Emergency Transport" },
];

const PURPOSES = [
  "Dialysis appointment",
  "Rehabilitation visit",
  "Follow-up consultation",
  "Hospital discharge",
  "Elderly transport",
  "Outpatient procedure",
  "Other",
];

const RECURRENCE = [
  { value: "none", label: "One-time trip" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

// Turns any API error (including FastAPI 422 arrays) into a plain string
function getErrorMessage(err: any, fallback = "Something went wrong."): string {
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d?.loc)
          ? d.loc.filter((p: any) => p !== "body").join(".")
          : "";
        const msg = typeof d?.msg === "string" ? d.msg : JSON.stringify(d);
        return field ? `${field}: ${msg}` : msg;
      })
      .join(" · ");
  }

  if (detail && typeof detail === "object") {
    return typeof detail.msg === "string" ? detail.msg : JSON.stringify(detail);
  }

  return err?.message || fallback;
}

// Empty/whitespace string -> undefined so the field is omitted from the JSON body
const clean = (v: string) => (v.trim() === "" ? undefined : v.trim());

// Local-time value for <input type="datetime-local" min=...> (toISOString would use UTC)
const toLocalInputValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function SchedulePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [createdTrip, setCreatedTrip] = useState<ScheduledTrip | null>(null);

  const [form, setForm] = useState({
    title: "",
    trip_purpose: "",
    requested_category: "non_emergency",
    pickup_address: "",
    destination_address: "",
    scheduled_at: "",
    recurrence_type: "none",
    contact_phone: user?.phone || "",
    patient_notes: "",
  });

  // Fill phone once the user loads, without overwriting what they typed
  useEffect(() => {
    if (user?.phone) {
      setForm((f) =>
        f.contact_phone ? f : { ...f, contact_phone: user.phone as string },
      );
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.pickup_address.trim()) {
      setError("Pickup address is required.");
      return;
    }
    if (!form.scheduled_at) {
      setError("Scheduled date and time is required.");
      return;
    }
    if (new Date(form.scheduled_at) <= new Date()) {
      setError("Scheduled time must be in the future.");
      return;
    }

    setLoading(true);
    try {
      const hasDestination = form.destination_address.trim() !== "";

      const payload = {
        title: clean(form.title),
        trip_purpose: clean(form.trip_purpose),
        requested_category: form.requested_category,
        pickup_address: form.pickup_address.trim(),
        destination_address: clean(form.destination_address),
        scheduled_at: new Date(form.scheduled_at).toISOString(), // full ISO with timezone
        recurrence_type: form.recurrence_type,
        contact_phone: clean(form.contact_phone),
        patient_notes: clean(form.patient_notes),
        pickup_latitude: 9.9312 + Math.random() * 0.05, // Demo coords
        pickup_longitude: 76.2673 + Math.random() * 0.05,
        destination_latitude: hasDestination
          ? 9.95 + Math.random() * 0.03
          : undefined,
        destination_longitude: hasDestination
          ? 76.28 + Math.random() * 0.03
          : undefined,
      };

      const res = await api.post<ScheduledTrip>("/scheduled-trips", payload);
      setCreatedTrip(res.data);
      setSuccess(true);
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to schedule trip."));
    } finally {
      setLoading(false);
    }
  };

  if (success && createdTrip) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicNavbar />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="card p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Trip Scheduled!
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Your {createdTrip.trip_purpose || "transport"} has been scheduled
              for {new Date(createdTrip.scheduled_at).toLocaleString()}. An
              operator will confirm your booking.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Category</span>
                <span className="font-medium capitalize">
                  {createdTrip.requested_category.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Pickup</span>
                <span className="font-medium text-right max-w-[200px] truncate">
                  {createdTrip.pickup_address}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Recurrence</span>
                <span className="font-medium capitalize">
                  {createdTrip.recurrence_type}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSuccess(false);
                  setCreatedTrip(null);
                  setError("");
                  setForm({
                    ...form,
                    title: "",
                    trip_purpose: "",
                    scheduled_at: "",
                  });
                }}
                className="btn-secondary flex-1"
              >
                Schedule Another
              </button>
              <button
                onClick={() => navigate("/my-bookings")}
                className="btn-primary flex-1"
              >
                View Bookings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            Schedule Medical Transport
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Book planned trips: dialysis, appointments, rehabilitation,
            discharge.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Trip details */}
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-700" /> Trip Details
            </h2>

            <div>
              <label className="label">Trip Title (optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Dialysis at Amrita Hospital"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Purpose of Trip</label>
              <select
                className="input-field"
                value={form.trip_purpose}
                onChange={(e) =>
                  setForm({ ...form, trip_purpose: e.target.value })
                }
              >
                <option value="">Select purpose...</option>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">
                Transport Category <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={form.requested_category}
                onChange={(e) =>
                  setForm({ ...form, requested_category: e.target.value })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="datetime-local"
                    className="input-field pl-10"
                    min={toLocalInputValue(new Date(Date.now() + 60000))}
                    value={form.scheduled_at}
                    onChange={(e) =>
                      setForm({ ...form, scheduled_at: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="label">Recurrence</label>
                <div className="relative">
                  <Repeat className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    className="input-field pl-10"
                    value={form.recurrence_type}
                    onChange={(e) =>
                      setForm({ ...form, recurrence_type: e.target.value })
                    }
                  >
                    {RECURRENCE.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Locations */}
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-700" /> Locations
            </h2>

            <div>
              <label className="label">
                Pickup Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="Full pickup address"
                  value={form.pickup_address}
                  onChange={(e) =>
                    setForm({ ...form, pickup_address: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="label">Destination</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="Hospital or destination"
                  value={form.destination_address}
                  onChange={(e) =>
                    setForm({ ...form, destination_address: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary-700" /> Contact & Notes
            </h2>
            <div>
              <label className="label">Contact Phone</label>
              <input
                type="tel"
                className="input-field"
                placeholder="+91 98765 43210"
                value={form.contact_phone}
                onChange={(e) =>
                  setForm({ ...form, contact_phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Notes for Crew</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="Medical conditions, equipment needs, access notes..."
                value={form.patient_notes}
                onChange={(e) =>
                  setForm({ ...form, patient_notes: e.target.value })
                }
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Scheduling...
              </>
            ) : (
              <>
                Schedule Trip <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
