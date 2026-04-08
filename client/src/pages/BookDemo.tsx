import { useState, useEffect } from "react";
import { Video, CalendarDays, Clock, CheckCircle2, ChevronLeft, User, Phone } from "lucide-react";

interface DaySlots {
  date: string;
  label: string;
  slots: string[];
}

type PageState = "loading" | "error" | "details" | "picking" | "confirming" | "success";

const inputClass =
  "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F510F]/20 focus:border-[#0F510F]/40 transition-colors";

export default function BookDemo() {
  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [days, setDays] = useState<DaySlots[]>([]);

  // Step 1: contact details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Step 2: slot picking
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookedLabel, setBookedLabel] = useState("");

  useEffect(() => {
    fetch("/api/book-demo")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load");
        const data = await r.json();
        setDays(data.days || []);
        setState("details");
      })
      .catch(() => {
        setState("error");
        setErrorMsg("Failed to load booking page. Please try again.");
      });
  }, []);

  const validatePhone = (v: string) => /^\+[0-9]{9,14}$/.test(v);

  const handleDetailsNext = () => {
    if (!name.trim()) return;
    if (!validatePhone(phone)) {
      setPhoneError("Must start with + and contain 10–15 digits (e.g. +966501234567)");
      return;
    }
    setPhoneError("");
    setState("picking");
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          time: selectedTime,
          customerName: name.trim(),
          customerPhone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Booking failed. Please try another slot.");
        setSelectedTime(null);
        setSubmitting(false);
        return;
      }
      setBookedLabel(data.ksa_label || `${selectedDate} at ${selectedTime}`);
      setState("success");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  const selectedDayData = days.find((d) => d.date === selectedDate);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F510F]/5 to-background flex flex-col">
      {/* Header */}
      <header className="bg-[#0F510F] text-white px-5 py-4 flex items-center gap-3 shadow-md">
        <Video className="w-5 h-5" />
        <div>
          <p className="font-semibold text-sm">WAK Solutions</p>
          <p className="text-xs text-white/70">Book a Demo</p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-8">

        {/* Loading */}
        {state === "loading" && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-[#0F510F]/20 border-t-[#0F510F] rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
            <p className="font-semibold text-foreground">Unable to load booking page</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
        )}

        {/* Step 1: Contact details */}
        {state === "details" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">Book a demo</h1>
              <p className="text-sm text-muted-foreground mt-1">
                See WAK Solutions in action — book a live walkthrough with our team.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Your name</span>
                </label>
                <input
                  className={inputClass}
                  placeholder="Ahmed Al-Rashidi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />WhatsApp number</span>
                </label>
                <input
                  className={`${inputClass} ${phoneError ? "border-red-300 focus:ring-red-200 focus:border-red-400" : ""}`}
                  placeholder="+966501234567"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                />
                {phoneError && (
                  <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  We'll send your meeting confirmation and link here via WhatsApp.
                </p>
              </div>
            </div>

            <button
              onClick={handleDetailsNext}
              disabled={!name.trim() || !phone.trim()}
              className="w-full bg-[#0F510F] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#0d4510] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              Choose a time
            </button>
          </div>
        )}

        {/* Step 2: Date/time picker */}
        {state === "picking" && (
          <div className="space-y-6">
            <div>
              <button
                onClick={() => { setState("details"); setSelectedDate(null); setSelectedTime(null); setErrorMsg(""); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <h1 className="text-xl font-bold text-foreground">Choose a time</h1>
              <p className="text-sm text-muted-foreground mt-1">All times shown in Saudi Arabia time (AST, UTC+3).</p>
            </div>

            {errorMsg && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                {errorMsg}
              </p>
            )}

            {days.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
                No available slots in the next 30 days. Please contact us directly via WhatsApp.
              </div>
            ) : !selectedDate ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CalendarDays className="w-4 h-4 text-[#0F510F]" />
                  Select a date
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {days.map((d) => (
                    <button
                      key={d.date}
                      onClick={() => { setSelectedDate(d.date); setSelectedTime(null); setErrorMsg(""); }}
                      className="bg-card border border-border hover:border-[#0F510F] hover:bg-[#0F510F]/5 text-left px-4 py-3 rounded-xl transition-colors"
                    >
                      <p className="font-semibold text-sm text-foreground">{d.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.slots.length} slot{d.slots.length !== 1 ? "s" : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => { setSelectedDate(null); setSelectedTime(null); setErrorMsg(""); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {selectedDayData?.label}
                </button>

                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Clock className="w-4 h-4 text-[#0F510F]" />
                  Select a time
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {selectedDayData?.slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => { setSelectedTime(slot); setErrorMsg(""); }}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        selectedTime === slot
                          ? "bg-[#0F510F] text-white border-[#0F510F]"
                          : "bg-card border-border hover:border-[#0F510F] hover:bg-[#0F510F]/5 text-foreground"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>

                {selectedTime && (
                  <div className="bg-[#0F510F]/5 border border-[#0F510F]/20 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">Selected:</span>{" "}
                      {selectedDayData?.label} at {selectedTime} KSA time
                    </p>
                    <button
                      onClick={handleConfirm}
                      disabled={submitting}
                      className="w-full bg-[#0F510F] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#0d4510] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Confirming…
                        </>
                      ) : (
                        "Confirm Demo"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#0F510F]/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#0F510F]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Demo confirmed!</h2>
              <p className="text-sm text-muted-foreground mt-1">We're looking forward to meeting you.</p>
            </div>
            <div className="bg-muted rounded-xl px-5 py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date & Time (KSA)</p>
              <p className="font-semibold text-foreground">{bookedLabel}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              A confirmation has been sent to your WhatsApp. You'll receive your meeting link 15 minutes before the demo starts.
            </p>
          </div>
        )}

      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border/50">
        © 2026 WAK Solutions ·{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          Terms &amp; Conditions
        </a>
      </footer>
    </div>
  );
}
