import { useCallback, useEffect, useState } from "react";
import { Wallet, Calendar, MapPin, Clock, QrCode, X, Loader2, AlertCircle, RefreshCw, Ban } from "lucide-react";
import {
  getMyPension,
  getMyBarangaySchedules,
  getMyUpcomingClaim,
  getMyClaimHistory,
  getMyClaimQr,
  bookClaimingSlot,
  cancelClaimingBooking,
} from "../../services/pensionService.js";

const COLORS = {
  yale: "#16425b",
  baltic: "#2f6690",
  cerulean: "#3a7ca5",
  sky: "#81c3d7",
  alabaster: "#d9dcd6",
};

const PENSION_TYPE_LABELS = {
  GOVERNMENT_PENSION: "Government Pension",
  SOCIAL_PENSION: "Social Pension",
  OTHER: "Other Pension",
};

const CLAIM_STATUS_DISPLAY = {
  SCHEDULED: { label: "⏳ Scheduled", color: COLORS.baltic },
  CLAIMED: { label: "✓ Claimed", color: "#2f7d43" },
  MISSED: { label: "✕ Missed", color: "#b8452f" },
  CANCELLED: { label: "✕ Cancelled", color: "#64748b" },
};

function formatCurrency(amount) {
  if (amount == null) return "—";
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

function EmptyBlock({ icon: Icon, title, message, t }) {
  return (
    <div
      className="rounded-lg border-2 border-dashed p-6 flex flex-col items-center text-center gap-2"
      style={{ borderColor: COLORS.alabaster }}
    >
      <Icon className="w-8 h-8 mb-1" style={{ color: COLORS.cerulean }} aria-hidden="true" />
      <p className={`${t.cardTitle} font-bold`} style={{ color: COLORS.yale }}>
        {title}
      </p>
      <p className={`${t.body} text-slate-600 max-w-md`}>{message}</p>
    </div>
  );
}

function QrModal({ claim, onClose, t }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyClaimQr(claim._id)
      .then((data) => {
        if (!cancelled) setQrDataUrl(data.qrDataUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "We couldn't load your claiming pass.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [claim._id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close claiming pass"
          className="absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center hover:bg-slate-100 focus:outline-none focus-visible:ring-2"
          style={{ color: COLORS.yale }}
        >
          <X className="w-6 h-6" aria-hidden="true" />
        </button>

        <h3 id="qr-modal-title" className={`${t.cardTitle} font-extrabold text-center mb-4`} style={{ color: COLORS.yale }}>
          Claiming Pass
        </h3>

        {loading && (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: COLORS.baltic }} aria-hidden="true" />
          </div>
        )}
        {!loading && error && (
          <p className={`${t.body} text-center`} style={{ color: "#b8452f" }}>
            {error}
          </p>
        )}
        {!loading && !error && qrDataUrl && (
          <>
            <div className="flex justify-center mb-4">
              <img src={qrDataUrl} alt="QR code for your pension claiming pass" width={220} height={220} />
            </div>
            <div className={`${t.body} text-center space-y-1`} style={{ color: COLORS.yale }}>
              <p className="font-bold">{formatDate(claim.scheduledDate)}</p>
              <p>
                {claim.scheduledStartTime} – {claim.scheduledEndTime}
              </p>
              <p>{claim.location}</p>
            </div>
          </>
        )}
        <p className={`${t.small} text-slate-500 text-center mt-4`}>
          Show this QR code to Barangay Staff when you arrive to claim your pension.
        </p>
      </div>
    </div>
  );
}

function CancelBookingDialog({ claim, onKeep, onConfirm, cancelling, error, t }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6">
        <h3 id="cancel-booking-title" className={`${t.cardTitle} font-extrabold text-center mb-3`} style={{ color: COLORS.yale }}>
          Cancel Booking
        </h3>
        <p className={`${t.body} text-center mb-1`} style={{ color: COLORS.yale }}>
          Are you sure you want to cancel this booking?
        </p>
        <p className={`${t.small} text-center text-slate-600 mb-4`}>
          {formatDate(claim.scheduledDate)} · {claim.scheduledStartTime} – {claim.scheduledEndTime}
        </p>
        {error && (
          <p className={`${t.small} font-semibold text-center mb-3`} style={{ color: "#b8452f" }}>
            {error}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onKeep}
            disabled={cancelling}
            className={`${t.body} flex-1 font-bold rounded-md px-4 py-3 border-2 focus:outline-none focus-visible:ring-4 disabled:opacity-60`}
            style={{ borderColor: COLORS.baltic, color: COLORS.baltic }}
          >
            Keep Booking
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            className={`${t.body} flex-1 font-bold text-white rounded-md px-4 py-3 focus:outline-none focus-visible:ring-4 disabled:opacity-60 flex items-center justify-center gap-2`}
            style={{ backgroundColor: "#b8452f" }}
          >
            {cancelling && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {cancelling ? "Cancelling..." : "Cancel Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PensionPanel({ t }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pension, setPension] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [upcomingClaim, setUpcomingClaim] = useState(null);
  const [history, setHistory] = useState([]);
  const [bookingSlotId, setBookingSlotId] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const [qrClaim, setQrClaim] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pensionData, upcoming, historyData] = await Promise.all([
        getMyPension(),
        getMyUpcomingClaim(),
        getMyClaimHistory(),
      ]);
      setPension(pensionData);
      setUpcomingClaim(upcoming);
      setHistory(historyData);
      // Only worth fetching bookable schedules if the senior has a
      // pension on file and doesn't already have an upcoming claim.
      if (pensionData && !upcoming) {
        setSchedules(await getMyBarangaySchedules());
      } else {
        setSchedules([]);
      }
    } catch (err) {
      setError(err.message || "We couldn't load your pension information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancelBooking = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelClaimingBooking(cancelTarget._id);
      setCancelTarget(null);
      await load();
    } catch (err) {
      setCancelError(err.message || "This booking could no longer be cancelled.");
    } finally {
      setCancelling(false);
    }
  };

  const handleBook = async (scheduleId, slotId) => {
    setBookingSlotId(slotId);
    setBookingError(null);
    try {
      await bookClaimingSlot({ scheduleId, slotId });
      await load();
    } catch (err) {
      setBookingError(err.message || "This claiming slot is no longer available. Please select another slot.");
    } finally {
      setBookingSlotId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 flex flex-col items-center gap-2" role="status" aria-live="polite">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: COLORS.baltic }} aria-hidden="true" />
        <p className={`${t.body} font-semibold`} style={{ color: COLORS.yale }}>
          Loading your pension information...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border-2 p-6 flex flex-col items-center text-center gap-3" style={{ borderColor: "#e3a893", backgroundColor: "#fbeae6" }}>
        <AlertCircle className="w-7 h-7" style={{ color: "#b8452f" }} aria-hidden="true" />
        <p className={`${t.body} font-semibold`} style={{ color: "#b8452f" }}>
          We couldn't load your pension information.
        </p>
        <button
          type="button"
          onClick={load}
          className={`${t.small} inline-flex items-center gap-2 font-bold text-white rounded-md px-4 py-2.5 focus:outline-none focus-visible:ring-4`}
          style={{ backgroundColor: COLORS.baltic }}
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Try Again
        </button>
      </div>
    );
  }

  if (!pension) {
    return (
      <EmptyBlock
        icon={Wallet}
        title="Pension information is not available yet."
        message="Your barangay will update your pension information when available."
        t={t}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Pension summary */}
      <div className="bg-white rounded-xl border-2 p-5 sm:p-6" style={{ borderColor: COLORS.alabaster }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <p className={`${t.small} font-bold uppercase tracking-wide`} style={{ color: COLORS.cerulean }}>
              Pension Type
            </p>
            <p className={`${t.cardTitle} font-bold mt-0.5`} style={{ color: COLORS.yale }}>
              {PENSION_TYPE_LABELS[pension.pensionType] || pension.pensionType}
            </p>
          </div>
          <div>
            <p className={`${t.small} font-bold uppercase tracking-wide`} style={{ color: COLORS.cerulean }}>
              Amount
            </p>
            <p className={`${t.cardTitle} font-bold mt-0.5`} style={{ color: COLORS.yale }}>
              {formatCurrency(pension.pensionAmount)}
            </p>
          </div>
          <div>
            <p className={`${t.small} font-bold uppercase tracking-wide`} style={{ color: COLORS.cerulean }}>
              Status
            </p>
            <p className={`${t.cardTitle} font-bold mt-0.5`} style={{ color: pension.status === "ACTIVE" ? "#2f7d43" : COLORS.yale }}>
              {pension.status === "ACTIVE" ? "Active" : "Inactive"}
            </p>
          </div>
        </div>
      </div>

      {/* Next claiming schedule / booking */}
      {upcomingClaim ? (
        <div className="rounded-xl border-2 p-5 sm:p-6" style={{ borderColor: COLORS.sky, backgroundColor: COLORS.sky + "1f" }}>
          <p className={`${t.small} font-bold uppercase tracking-wide`} style={{ color: COLORS.cerulean }}>
            Next Claiming Schedule
          </p>
          <p className={`${t.cardTitle} font-bold mt-1`} style={{ color: COLORS.yale }}>
            {formatDate(upcomingClaim.scheduledDate)}
          </p>
          <p className={`${t.body} mt-1`} style={{ color: COLORS.yale }}>
            {upcomingClaim.scheduledStartTime} – {upcomingClaim.scheduledEndTime} · {upcomingClaim.location}
          </p>
          <p className={`${t.small} font-bold mt-2`} style={{ color: CLAIM_STATUS_DISPLAY.SCHEDULED.color }}>
            {CLAIM_STATUS_DISPLAY.SCHEDULED.label}
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              type="button"
              onClick={() => setQrClaim(upcomingClaim)}
              className={`${t.button} inline-flex items-center gap-2 font-bold text-white rounded-md px-5 py-3 focus:outline-none focus-visible:ring-4`}
              style={{ backgroundColor: COLORS.baltic }}
            >
              <QrCode className="w-5 h-5" aria-hidden="true" /> View QR Pass
            </button>
            <button
              type="button"
              onClick={() => {
                setCancelError(null);
                setCancelTarget(upcomingClaim);
              }}
              className={`${t.button} inline-flex items-center gap-2 font-bold rounded-md px-5 py-3 border-2 focus:outline-none focus-visible:ring-4`}
              style={{ borderColor: "#b8452f", color: "#b8452f" }}
            >
              <Ban className="w-5 h-5" aria-hidden="true" /> Cancel Booking
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className={`${t.body} ${schedules.length ? "mb-3" : ""}`} style={{ color: COLORS.yale }}>
            {schedules.length === 0
              ? "No upcoming pension claiming schedule is available."
              : "Available Claiming Schedules"}
          </p>
          {bookingError && (
            <p className={`${t.small} font-semibold mb-3`} style={{ color: "#b8452f" }}>
              {bookingError}
            </p>
          )}
          {schedules.length === 0 ? (
            <EmptyBlock
              icon={Calendar}
              title="No claiming schedules are currently available."
              message="Your barangay will post new claiming schedules here when they're ready."
              t={t}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {schedules.map((schedule) => (
                <div key={schedule._id} className="bg-white rounded-xl border-2 p-5" style={{ borderColor: COLORS.alabaster }}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                    <span className={`${t.cardTitle} font-bold flex items-center gap-2`} style={{ color: COLORS.yale }}>
                      <Calendar className="w-5 h-5" style={{ color: COLORS.cerulean }} aria-hidden="true" />
                      {formatDate(schedule.date)}
                    </span>
                    <span className={`${t.body} flex items-center gap-1.5 text-slate-600`}>
                      <MapPin className="w-4 h-4" aria-hidden="true" /> {schedule.location}
                    </span>
                    <span className={`${t.body} flex items-center gap-1.5 text-slate-600`}>
                      <Clock className="w-4 h-4" aria-hidden="true" /> {schedule.startTime} – {schedule.endTime}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {schedule.slots
                      .filter((slot) => slot.status !== "CLOSED")
                      .map((slot) => {
                        const full = slot.availableCount <= 0;
                        return (
                          <button
                            key={slot._id}
                            type="button"
                            disabled={full || bookingSlotId === slot._id}
                            onClick={() => handleBook(schedule._id, slot._id)}
                            className={`${t.body} flex items-center justify-between rounded-lg border-2 px-4 py-3 font-semibold text-left focus:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:cursor-not-allowed`}
                            style={{ borderColor: full ? COLORS.alabaster : COLORS.baltic, color: COLORS.yale }}
                          >
                            <span>
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <span className={t.small} style={{ color: full ? "#94a3b8" : COLORS.cerulean }}>
                              {bookingSlotId === slot._id
                                ? "Booking..."
                                : full
                                ? "Full"
                                : `${slot.availableCount} slot${slot.availableCount === 1 ? "" : "s"} left`}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Claiming history */}
      <div>
        <p className={`${t.cardTitle} font-bold mb-3`} style={{ color: COLORS.yale }}>
          Claiming History
        </p>
        {history.length === 0 ? (
          <EmptyBlock icon={Wallet} title="No pension claiming records yet." message="Your completed claims will appear here." t={t} />
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((claim) => {
              const display = CLAIM_STATUS_DISPLAY[claim.status] || CLAIM_STATUS_DISPLAY.CANCELLED;
              return (
                <div
                  key={claim._id}
                  className="bg-white rounded-lg border-2 px-4 py-3 flex items-center justify-between gap-3"
                  style={{ borderColor: COLORS.alabaster }}
                >
                  <div>
                    <p className={`${t.body} font-bold`} style={{ color: COLORS.yale }}>
                      {formatDate(claim.scheduledDate)}
                    </p>
                    <p className={`${t.small} text-slate-600`}>{formatCurrency(claim.amount)}</p>
                  </div>
                  <span className={`${t.small} font-bold`} style={{ color: display.color }}>
                    {display.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {qrClaim && <QrModal claim={qrClaim} onClose={() => setQrClaim(null)} t={t} />}
      {cancelTarget && (
        <CancelBookingDialog
          claim={cancelTarget}
          onKeep={() => setCancelTarget(null)}
          onConfirm={handleCancelBooking}
          cancelling={cancelling}
          error={cancelError}
          t={t}
        />
      )}
    </div>
  );
}
