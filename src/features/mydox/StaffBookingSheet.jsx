import React from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { SlotPickerCalendarStandalone } from "@/features/mydox/SlotPickerCalendar";
import {
  bookHomeNursing,
  bookTechnicianTest,
  currentPosition,
  fetchLastBookedNurseId,
  fetchLastBookedTechnicianId,
  fetchNurseBookedDates,
  fetchNurseRoster,
  fetchNursingDayRate,
  fetchProviderSlots,
  fetchTechnicianCatalog,
  fetchTechnicianRoster,
  nurseStartSlots,
} from "@/features/mydox/care-staff-booking";

/**
 * One booking sheet for home nursing and technician visits, built like the
 * physiotherapy booking page:
 *
 *   1. what      — package length (nurse) or test (technician)
 *   2. who       — "Any available" or a specific verified provider
 *   3. when      — a slot calendar. For a named technician it shows only that
 *                  technician's real free slots; for a named nurse it only
 *                  offers start days on which she is free for the whole
 *                  package.
 *   4. where     — area and address
 *
 * Every list, price and slot comes from the database.
 */

const INK = "#0F172A";
const SUB = "#475569";
const FAINT = "#94A3B8";
const LINE = "#E5E7EB";
const CANVAS = "#F8FAFC";
const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

const NURSE_PACKAGES = [1, 3, 7, 15, 30];
const HORIZON_DAYS = 14;

const inr = (n) => "\u20B9" + Number(n || 0).toLocaleString("en-IN");
const initials = (name) => String(name || "?").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Label({ children, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 0 7px" }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: SUB, textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</p>
      {right ? <span style={{ fontSize: 10.5, color: FAINT, fontWeight: 600 }}>{right}</span> : null}
    </div>
  );
}

function Note({ tone = "info", children }) {
  const tones = {
    info: { bg: "#F1F5F9", fg: SUB },
    warn: { bg: "#FFFBEB", fg: "#92400E" },
    error: { bg: "#FEF2F2", fg: "#B91C1C" },
  };
  const t = tones[tone];
  return <div style={{ background: t.bg, color: t.fg, borderRadius: 11, padding: "9px 11px", fontSize: 11.5, fontWeight: 600, lineHeight: 1.4 }}>{children}</div>;
}

function ProviderRow({ selected, accent, title, subtitle, badge, avatar, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 13,
        border: `1.5px solid ${selected ? accent : LINE}`, background: selected ? `${accent}0F` : "#fff",
        cursor: "pointer", textAlign: "left", fontFamily: FONT,
      }}
    >
      <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}1A`, color: accent, fontWeight: 800, fontSize: avatar?.length > 2 ? 16 : 12 }}>
        {avatar}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: INK }}>{title}</span>
        {subtitle ? <span style={{ display: "block", fontSize: 11, color: FAINT, marginTop: 1 }}>{subtitle}</span> : null}
      </span>
      {badge ? <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, color: accent, background: `${accent}14`, borderRadius: 99, padding: "3px 8px" }}>{badge}</span> : null}
    </button>
  );
}

export function StaffBookingSheet({ kind, area: initialArea, initialDays = 7, initialTestType = null, onClose, onBooked, variant = "sheet" }) {
  const isNurse = kind === "nurse";
  const accent = isNurse ? "#DB2777" : "#8B5CF6";
  const inline = variant === "inline";

  const [area, setArea] = React.useState(initialArea || "");
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [urgent, setUrgent] = React.useState(false);
  const [days, setDays] = React.useState(NURSE_PACKAGES.includes(initialDays) ? initialDays : 7);
  const [testType, setTestType] = React.useState(initialTestType);
  const [providerKey, setProviderKey] = React.useState(null); // null = any available
  const [startIso, setStartIso] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  // ─── reference data (all from the database) ───
  const [dayRate, setDayRate] = React.useState(null);
  const [catalog, setCatalog] = React.useState([]);
  const [roster, setRoster] = React.useState([]);
  const [rosterLoading, setRosterLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        if (isNurse) {
          const rate = await fetchNursingDayRate();
          if (!off) setDayRate(rate);
        } else {
          const list = await fetchTechnicianCatalog();
          if (off) return;
          setCatalog(list);
          setTestType((cur) => (cur && list.some((t) => t.testType === cur) ? cur : list[0]?.testType ?? null));
        }
      } catch (e) {
        if (!off) setLoadError(e?.message || "Could not load booking options.");
      }
    })();
    return () => { off = true; };
  }, [isNurse]);

  const test = catalog.find((t) => t.testType === testType) || null;

  // Roster: nurses, or technicians who do the chosen test.
  React.useEffect(() => {
    let off = false;
    if (!isNurse && !testType) return undefined;
    setRosterLoading(true);
    (isNurse ? fetchNurseRoster(area) : fetchTechnicianRoster(testType, area))
      .then((list) => {
        if (off) return;
        setRoster(list);
        // Keep the chosen provider only if they still qualify.
        setProviderKey((cur) => (cur && list.some((p) => (isNurse ? p.userId : p.technicianId) === cur) ? cur : null));
      })
      .catch((e) => { if (!off) { setRoster([]); setLoadError(e?.message || "Could not load providers."); } })
      .finally(() => { if (!off) setRosterLoading(false); });
    return () => { off = true; };
  }, [isNurse, testType, area]);

  const provider = roster.find((p) => (isNurse ? p.userId : p.technicianId) === providerKey) || null;

  // Whoever the patient last booked (if they're still active/verified) is
  // offered again first, the same way physio surfaces a "Suggested Doctor".
  const [suggestedId, setSuggestedId] = React.useState(null);
  React.useEffect(() => {
    let off = false;
    (isNurse ? fetchLastBookedNurseId() : fetchLastBookedTechnicianId())
      .then((id) => { if (!off) setSuggestedId(id); })
      .catch(() => {});
    return () => { off = true; };
  }, [isNurse]);
  const autoSelectedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoSelectedRef.current || !suggestedId || rosterLoading || !roster.length) return;
    const key = isNurse ? "userId" : "technicianId";
    if (roster.some((p) => p[key] === suggestedId)) {
      setProviderKey(suggestedId);
      autoSelectedRef.current = true;
    }
  }, [suggestedId, roster, rosterLoading, isNurse]);
  const orderedRoster = React.useMemo(() => {
    if (!suggestedId) return roster;
    const key = isNurse ? "userId" : "technicianId";
    const idx = roster.findIndex((p) => p[key] === suggestedId);
    if (idx <= 0) return roster;
    const copy = roster.slice();
    const [suggested] = copy.splice(idx, 1);
    copy.unshift(suggested);
    return copy;
  }, [roster, suggestedId, isNurse]);

  // ─── slots ───
  const [nurseBooked, setNurseBooked] = React.useState([]);
  const [techSlots, setTechSlots] = React.useState(null); // null = not loaded / not needed
  const [slotsLoading, setSlotsLoading] = React.useState(false);

  React.useEffect(() => {
    let off = false;
    setStartIso("");
    if (!provider) { setNurseBooked([]); setTechSlots(null); return undefined; }
    setSlotsLoading(true);
    const job = isNurse
      ? fetchNurseBookedDates(provider.userId, new Date(), HORIZON_DAYS + 31).then((d) => { if (!off) setNurseBooked(d); })
      : fetchProviderSlots(provider.userId, test?.durationMin || 60, HORIZON_DAYS).then((s) => { if (!off) setTechSlots(s); });
    job
      .catch((e) => { if (!off) { setError(e?.message || "Could not load availability."); if (!isNurse) setTechSlots([]); } })
      .finally(() => { if (!off) setSlotsLoading(false); });
    return () => { off = true; };
  }, [isNurse, provider?.userId, test?.durationMin]);

  // What the calendar may offer.
  const availableIso = React.useMemo(() => {
    if (isNurse) return nurseStartSlots({ horizonDays: HORIZON_DAYS, packageDays: days, bookedDates: provider ? nurseBooked : [] });
    if (provider) return techSlots ?? [];
    return null; // any available technician: any future time on the grid
  }, [isNurse, days, provider, nurseBooked, techSlots]);

  // Same +20% surcharge doctor/physio urgent bookings apply — the server
  // (create_nursing_engagement / create_technician_request /
  // atomic_book_technician_test) enforces the real charge; this is only the
  // preview so the price shown here matches what gets booked.
  const basePrice = isNurse ? (dayRate != null ? dayRate * days : null) : test?.fee ?? null;
  const price = urgent && basePrice != null ? Math.round(basePrice * 1.2) : basePrice;
  const noSlots = !slotsLoading && Array.isArray(availableIso) && availableIso.length === 0;
  const ready = !!startIso && !!area.trim() && (isNurse || !!testType) && !submitting;

  const submit = async () => {
    if (!ready) return;
    setError("");
    setSubmitting(true);
    try {
      if (isNurse) {
        const here = await currentPosition();
        const eng = await bookHomeNursing({
          days, kind: "General Duty Nurse", startIso, area: area.trim(), address, urgent,
          nurseUserId: provider?.userId ?? null, lat: here?.lat ?? null, lng: here?.lng ?? null,
        });
        onBooked?.({
          id: eng.id, refType: "nursing_engagement", role: "nurse", pending: true,
          name: `${eng.days_scheduled}-day Home Nursing`,
          label: provider ? `Offered to ${provider.name} first` : "Sent to verified nurses nearby",
          startIso,
        });
      } else {
        const here = await currentPosition();
        const id = await bookTechnicianTest({
          testType, startIso, area: area.trim(), address, notes, urgent,
          technicianId: provider?.technicianId ?? null,
          lat: here?.lat ?? null, lng: here?.lng ?? null,
        });
        onBooked?.({
          id, refType: "technician_test", role: "technician",
          // A named technician's slot is booked outright; "any" waits for a claim.
          pending: !provider,
          name: test?.label || "Technician visit",
          label: provider ? `${provider.name} · slot reserved` : "Sent to technicians who do this test",
          doctor: provider ? { name: provider.name, spec: provider.org || "Technician" } : null,
          startIso,
        });
      }
    } catch (e) {
      setError(e?.message || "Could not complete the booking.");
      // A slot that was just taken must disappear from the calendar.
      if (!isNurse && provider) {
        fetchProviderSlots(provider.userId, test?.durationMin || 60, HORIZON_DAYS).then(setTechSlots).catch(() => {});
      }
    } finally {
      setSubmitting(false);
    }
  };

  const whenHint = isNurse
    ? provider
      ? `Only days when ${provider.name.split(" ")[0]} is free for all ${days} day${days === 1 ? "" : "s"}`
      : "Shift start · first day of the package"
    : provider
      ? `${provider.name.split(" ")[0]}'s free ${test?.durationMin || 60}-min slots`
      : "Preferred time · a technician confirms it";

  const card = (
    <div style={inline
      ? { background: "#fff", border: `2px solid ${accent}`, borderRadius: 16, display: "flex", flexDirection: "column", fontFamily: FONT }
      : { position: "absolute", inset: 0, zIndex: 110, background: "#fff", display: "flex", flexDirection: "column", fontFamily: FONT }}
    >
      {inline ? (
        <div style={{ padding: "12px 13px 0" }}>
          <p style={{ margin: 0, fontWeight: 800, color: INK, fontSize: 13.5 }}>{isNurse ? "Home Nursing Care" : "Technician at home"}</p>
          <p style={{ margin: "1px 0 0", fontSize: 10.5, color: FAINT }}>{isNurse ? "Verified freelance nurses · first to accept gets assigned" : "Verified technicians · pick a test, then a time"}</p>
        </div>
      ) : (
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose} aria-label="Back" style={{ width: 34, height: 34, borderRadius: "50%", background: CANVAS, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={18} color={INK} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, color: INK, fontSize: 16 }}>{isNurse ? "Book home nursing" : "Book a technician"}</p>
            <p style={{ margin: 0, fontSize: 11, color: FAINT }}>{isNurse ? "A verified nurse comes to your home" : "A verified technician visits your home"}</p>
          </div>
        </div>
      )}

      <div style={inline
        ? { padding: "10px 13px 13px", display: "flex", flexDirection: "column", gap: 14 }
        : { flex: 1, overflowY: "auto", padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 18 }}
      >
        {loadError ? <Note tone="error">{loadError}</Note> : null}

        {/* 0 · urgency — same "Book for later / Urgent +20%" toggle doctor/physio use */}
        <div style={{ position: "relative", display: "flex", background: CANVAS, borderRadius: 12, padding: 4, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 4, bottom: 4, left: urgent ? "50%" : "4px", width: "calc(50% - 4px)", borderRadius: 9, background: urgent ? "linear-gradient(135deg,#F97316,#EA580C)" : "linear-gradient(135deg,#2563EB,#3B82F6)", transition: "left .3s cubic-bezier(.4,1.35,.5,1), background .25s" }} />
          {[{ v: false, icon: "📅", t: "Book for later", d: "Pick date & time" }, { v: true, icon: "⚡", t: "Urgent", d: "Priority · +20%" }].map((opt) => (
            <button key={String(opt.v)} type="button" onClick={() => setUrgent(opt.v)} style={{ flex: 1, position: "relative", zIndex: 1, border: "none", background: "transparent", padding: "7px 6px", cursor: "pointer", fontFamily: FONT }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: urgent === opt.v ? "#fff" : SUB }}>{opt.icon} {opt.t}</p>
              <p style={{ margin: "1px 0 0", fontSize: 9, fontWeight: 600, color: urgent === opt.v ? "rgba(255,255,255,.9)" : FAINT }}>{opt.d}</p>
            </button>
          ))}
        </div>

        {/* 1 · what */}
        {isNurse ? (
          <div>
            <Label right={dayRate != null ? `${inr(dayRate)} / day` : null}>Duration</Label>
            <div style={{ display: "flex", gap: 6 }}>
              {NURSE_PACKAGES.map((d) => {
                const on = days === d;
                return (
                  <button key={d} type="button" onClick={() => setDays(d)} style={{ flex: 1, padding: "9px 0", borderRadius: 99, border: `1.5px solid ${on ? accent : LINE}`, background: on ? accent : "#fff", color: on ? "#fff" : SUB, fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: FONT }}>
                    {d}d
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <Label>Test</Label>
            {!catalog.length && !loadError ? <Note>Loading tests…</Note> : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {catalog.map((t) => {
                const on = testType === t.testType;
                return (
                  <button key={t.testType} type="button" onClick={() => setTestType(t.testType)} style={{ textAlign: "left", padding: "9px 10px", borderRadius: 12, border: `1.5px solid ${on ? accent : LINE}`, background: on ? `${accent}0F` : "#fff", cursor: "pointer", fontFamily: FONT }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: INK }}>{t.label}</span>
                    <span style={{ display: "block", fontSize: 10.5, color: FAINT, marginTop: 1 }}>{inr(t.fee)} · {t.durationMin} min</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2 · who */}
        <div>
          <Label>{isNurse ? "Choose your nurse" : "Choose your technician"}</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <ProviderRow
              selected={providerKey === null}
              accent={accent}
              avatar="📡"
              title={isNurse ? "Any available nurse" : "Any available technician"}
              subtitle={isNurse ? "Sent to verified nurses — the first to accept is assigned" : "Sent to technicians who do this test — the first to accept is assigned"}
              onClick={() => setProviderKey(null)}
            />
            {rosterLoading ? <Note>Loading {isNurse ? "nurses" : "technicians"}…</Note> : null}
            {!rosterLoading && !roster.length ? (
              <Note tone="warn">No verified {isNurse ? "nurse" : "technician for this test"} is registered yet. Your request will wait for the first one who joins.</Note>
            ) : null}
            {orderedRoster.map((p) => {
              const key = isNurse ? p.userId : p.technicianId;
              const sub = isNurse
                ? [p.specialty, p.yearsExperience ? `${p.yearsExperience} yrs` : null, p.areas.slice(0, 3).join(", ")].filter(Boolean).join(" · ")
                : [p.org, p.areas.slice(0, 3).join(", ")].filter(Boolean).join(" · ");
              return (
                <ProviderRow
                  key={key}
                  selected={providerKey === key}
                  accent={accent}
                  avatar={initials(p.name)}
                  title={p.name}
                  subtitle={sub}
                  badge={key === suggestedId ? "Booked before" : (p.coversArea ? "Covers your area" : null)}
                  onClick={() => setProviderKey(key)}
                />
              );
            })}
          </div>
        </div>

        {/* 3 · when */}
        <div>
          <Label right={whenHint}>{isNurse ? "Start date & shift time" : "Date & time"}</Label>
          {slotsLoading ? <Note>Checking availability…</Note> : null}
          {noSlots ? (
            <Note tone="warn">
              {provider
                ? `${provider.name} has no free ${isNurse ? `${days}-day window` : "slots"} in the next ${HORIZON_DAYS} days. Pick someone else or "Any available".`
                : "No start times left in the next two weeks."}
            </Note>
          ) : null}
          {!slotsLoading ? (
            <div style={{ marginTop: noSlots ? 8 : 0 }}>
              <SlotPickerCalendarStandalone
                days={HORIZON_DAYS}
                accent={accent}
                value={startIso}
                onChange={setStartIso}
                availableIso={availableIso}
                startHour={7}
                endHour={20}
                stepMin={30}
                size="sm"
              />
            </div>
          ) : null}
        </div>

        {/* 4 · where */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Visit address</Label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            maxLength={100}
            placeholder="Area / locality, e.g. Kothrud"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 11, border: `1.5px solid ${LINE}`, padding: "10px 12px", fontSize: 13, fontFamily: FONT, color: INK }}
          />
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={400}
            rows={2}
            placeholder="Flat, building, street, landmark"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 11, border: `1.5px solid ${LINE}`, padding: "10px 12px", fontSize: 13, fontFamily: FONT, color: INK, resize: "vertical" }}
          />
          {!isNurse ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Notes for the technician (optional) — doctor's instructions, fasting, mobility…"
              style={{ width: "100%", boxSizing: "border-box", borderRadius: 11, border: `1.5px solid ${LINE}`, padding: "10px 12px", fontSize: 13, fontFamily: FONT, color: INK, resize: "vertical" }}
            />
          ) : null}
        </div>

        {error ? <Note tone="error">{error}</Note> : null}
      </div>

      <div style={inline
        ? { padding: "0 13px 13px", flexShrink: 0 }
        : { borderTop: `1px solid ${LINE}`, padding: "12px 14px 14px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, background: "#fff" }}
      >
        {!inline ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, color: FAINT, fontWeight: 700 }}>{isNurse ? `${days} day${days === 1 ? "" : "s"}` : test?.label || "Test"}</p>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: INK }}>{price != null ? inr(price) : "—"}{urgent && price != null ? <span style={{ fontSize: 11, fontWeight: 800, color: "#EA580C" }}> +20%</span> : null}</p>
          </div>
        ) : null}
        <button
          type="button"
          disabled={!ready}
          onClick={submit}
          style={inline
            ? { width: "100%", background: ready ? accent : "#E5E7EB", borderRadius: 11, padding: "10px 12px", fontSize: 13, fontWeight: 800, color: ready ? "#fff" : FAINT, border: "none", cursor: ready ? "pointer" : "not-allowed", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }
            : { flexShrink: 0, borderRadius: 13, padding: "13px 20px", border: "none", background: ready ? accent : "#E5E7EB", color: ready ? "#fff" : FAINT, fontWeight: 800, fontSize: 14, cursor: ready ? "pointer" : "not-allowed", fontFamily: FONT, display: "flex", alignItems: "center", gap: 7 }}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting
            ? "Booking…"
            : !startIso
              ? "Pick a time"
              : provider && !isNurse
                ? "Book this slot"
                : inline
                  ? `Send request${price != null ? ` · ${inr(price)}` : ""}`
                  : "Send request"}
        </button>
      </div>
    </div>
  );

  return inline ? <div style={{ padding: "8px 14px 0" }}>{card}</div> : card;
}

export default StaffBookingSheet;

