import { useState } from "react";
import Icon from "../icons/Icon";

const initialCard = { number: "", expiry: "", cvv: "", name: "" };

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function PaymentModal({
  amount,
  details,
  onClose,
  onSuccess,
  // Second line shown on the in-modal success screen. Defaults to the
  // original "booking confirmed" wording for flows where payment really
  // does confirm the booking (e.g. the authenticated client wizard).
  // Guest/public booking requests still require Admin approval after
  // payment, so that flow passes a different label instead.
  successSubtitle = "Booking Confirmed ✓",
}) {
  const [method, setMethod] = useState("card");
  const [card, setCard] = useState(initialCard);
  const [upiId, setUpiId] = useState("");
  const [phase, setPhase] = useState("form"); // form | processing | success
  const [error, setError] = useState("");

  const totalAmount = details?.totalAmount ?? amount;

  const cardValid =
    card.number.replace(/\s/g, "").length === 16 &&
    /^\d{2}\/\d{2}$/.test(card.expiry) &&
    card.cvv.length === 3 &&
    card.name.trim().length > 1;

  const upiValid = /^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim());

  const canPay = method === "card" ? cardValid : upiValid;

  function handlePay(e) {
    e.preventDefault();
    if (!canPay || phase !== "form") return;
    setError("");
    setPhase("processing");

    setTimeout(() => {
      setPhase("success");
      setTimeout(() => {
        onSuccess(method);
      }, 1300);
    }, 1500);
  }

  const busy = phase !== "form";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        onClick={busy ? undefined : onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
      />

      <div className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {phase !== "form" ? (
          <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
            {phase === "processing" ? (
              <>
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                <p className="text-sm font-semibold text-slate-700">Processing Payment...</p>
                <p className="text-xs text-slate-400">Please don't close this window.</p>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Icon name="checkCircle" className="h-8 w-8" strokeWidth={1.8} />
                </div>
                <p className="text-base font-semibold text-emerald-600">Payment Successful ✓</p>
                <p className="text-sm font-medium text-slate-500">{successSubtitle}</p>
                {details && (
                  <p className="text-xs text-slate-400">
                    ₹{totalAmount.toLocaleString("en-IN")} paid for {details.roomName}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Complete Payment</p>
                <p className="text-xs text-slate-400">Simulated checkout — no real charge is made.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              {details && (
                <div className="mb-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room</span>
                    <span className="font-medium text-slate-800">{details.roomName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room Number</span>
                    <span className="font-medium text-slate-800">{details.roomNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date</span>
                    <span className="font-medium text-slate-800">{details.dateLabel}</span>
                  </div>
                  {details.startTimeLabel && details.endTimeLabel && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Time</span>
                      <span className="font-medium text-slate-800">
                        {details.startTimeLabel} – {details.endTimeLabel}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Duration</span>
                    <span className="font-medium text-slate-800">{details.durationLabel}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-500">
                    <span>Room Charge</span>
                    <span className="text-slate-700">₹{Math.round(details.roomCharge).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Amenities</span>
                    <span className="text-slate-700">₹{Math.round(details.amenityCharge).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                    <span>Total</span>
                    <span>₹{totalAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}

              <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setMethod("card")}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                    method === "card" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                  }`}
                >
                  <Icon name="creditCard" className="h-4 w-4" />
                  Card
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("upi")}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                    method === "upi" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                  }`}
                >
                  <Icon name="rupee" className="h-4 w-4" />
                  UPI
                </button>
              </div>

              <form onSubmit={handlePay} className="space-y-4">
                {method === "card" ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Card Number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="1234 5678 9012 3456"
                        value={card.number}
                        onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Expiry</label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={card.expiry}
                          onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">CVV</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          placeholder="123"
                          maxLength={3}
                          value={card.cvv}
                          onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Name on Card</label>
                      <input
                        type="text"
                        placeholder="As printed on the card"
                        value={card.name}
                        onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">UPI ID</label>
                    <input
                      type="text"
                      placeholder="yourname@bank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">e.g. priya.nair@okhdfc</p>
                  </div>
                )}

                {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

                <button
                  type="submit"
                  disabled={!canPay}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  Pay ₹{totalAmount.toLocaleString("en-IN")}
                </button>

                <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <Icon name="shieldCheck" className="h-3.5 w-3.5" />
                  This is a frontend simulation — no real payment is processed.
                </p>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
