import React from "react";

type SlotTime = { h: number; m: number };
type AvailableSlot = SlotTime & { dateIdx: number };
type CalendarSize = "sm" | "md";

interface SlotPickerCalendarProps {
  schedDates: Date[];
  schedTimes: SlotTime[];
  schedDate: number | null;
  schedTime: number | null;
  setSchedDate: (index: number) => void;
  setSchedTime: (index: number | null) => void;
  accent?: string;
  seed?: string;
  size?: CalendarSize;
  line?: string;
  ink?: string;
  faint?: string;
  sub?: string;
  availableSlots?: AvailableSlot[];
}

interface SlotPickerCalendarStandaloneProps {
  days?: number;
  seed?: string;
  accent?: string;
  value?: string;
  onChange?: (iso: string) => void;
  size?: CalendarSize;
}

/**
 * Shared slot-picker calendar.
 * - Day chips (next N days, "Today" / "Tomorrow" labels)
 * - Times bucketed into Morning / Afternoon / Evening
 * - Deterministic unavailable slots (greyed-out + line-through, not clickable)
 *
 * Two flavours:
 *  1) Controlled by external state (schedDates + schedTimes + indices) — used
 *     inside SpecialtyPickerModern / SpecialtyPickerSimple in MyDoxFull.
 *  2) Self-contained (`SlotPickerCalendarStandalone`) — emits an ISO datetime
 *     string via `onChange`. Used by the Surgery planning flow.
 */

const BUCKETS = [
  { key: "morning",   label: "Morning",   emoji: "🌅", from: 9,  to: 12, sub: "9 AM – 12 PM" },
  { key: "afternoon", label: "Afternoon", emoji: "☀️", from: 12, to: 17, sub: "12 PM – 5 PM" },
  { key: "evening",   label: "Evening",   emoji: "🌆", from: 17, to: 21, sub: "5 PM – 9 PM"  },
];

export const fmtSlotTime = (t: SlotTime) => {
  const ap = t.h < 12 ? "AM" : "PM";
  const hh = t.h % 12 === 0 ? 12 : t.h % 12;
  return `${hh}:${t.m === 0 ? "00" : String(t.m).padStart(2, "0")} ${ap}`;
};

const dayLabel = (d: Date, i: number) =>
  i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });

function hashStr(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic "is this slot unavailable" — same (seed, day, hh:mm) always
 * returns the same answer, so the greyed-out pattern is stable per session.
 * Roughly ~35% of slots come back unavailable so the calendar looks real.
 */
export function isSlotUnavailable(seed: string, dateIdx: number, h: number, m: number) {
  return (hashStr(`${seed}|${dateIdx}|${h}:${m}`) % 100) < 35;
}

export function SlotPickerCalendar({
  schedDates,
  schedTimes,
  schedDate,
  schedTime,
  setSchedDate,
  setSchedTime,
  accent = "#7C3AED",
  seed = "default",
  size = "md", // "sm" | "md"
  line = "#E5E7EB",
  ink = "#0F172A",
  faint = "#94A3B8",
  sub = "#475569",
  availableSlots, // published slots in { h, m, dateIdx } format
}: SlotPickerCalendarProps) {
  const small = size === "sm";

  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: faint, textTransform: "uppercase", letterSpacing: .5 }}>
        📅 Date
      </p>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10, scrollbarWidth: "none" }}>
        {schedDates.map((d, i) => {
          const a = schedDate === i;
          return (
            <button
              key={i}
              onClick={() => { setSchedDate(i); setSchedTime(null); }}
              style={{
                flex: "0 0 auto",
                minWidth: small ? 48 : 56,
                padding: small ? "7px 5px" : "10px 6px",
                borderRadius: small ? 11 : 13,
                border: `1.5px solid ${a ? accent : line}`,
                background: a ? `${accent}14` : "#fff",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              <span style={{ fontSize: small ? 8.5 : 10, fontWeight: 700, color: a ? accent : faint }}>{dayLabel(d, i)}</span>
              <span style={{ fontSize: small ? 15 : 17, fontWeight: 800, color: ink, lineHeight: 1 }}>{d.getDate()}</span>
              <span style={{ fontSize: small ? 8 : 9, color: sub }}>{d.toLocaleDateString("en-US", { month: "short" })}</span>
            </button>
          );
        })}
      </div>

      {schedDate == null ? (
        <p style={{ margin: 0, fontSize: 11.5, color: faint }}>Pick a date to see available slots</p>
      ) : availableSlots && availableSlots.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: faint }}>No appointments published</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {BUCKETS.map((b) => {
            const inBucket = schedTimes
              .map((t, i) => ({ t, i }))
              .filter(({ t }) => t.h >= b.from && t.h < b.to);
            if (!inBucket.length) return null;
            const anyAvail = inBucket.some(({ t }) => {
              if (availableSlots) {
                return availableSlots.some(s => s.dateIdx === schedDate && s.h === t.h && s.m === t.m);
              }
              return !isSlotUnavailable(seed, schedDate, t.h, t.m);
            });
            return (
              <div key={b.key}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 5px" }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: ink }}>
                    {b.emoji} {b.label} <span style={{ color: faint, fontWeight: 600 }}>· {b.sub}</span>
                  </p>
                  {!anyAvail && (
                    <span style={{ fontSize: 9, color: "#B45309", fontWeight: 800 }}>Fully booked</span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${small ? 4 : 3},1fr)`, gap: 6 }}>
                  {inBucket.map(({ t, i }) => {
                    let unavail = true;
                    if (availableSlots) {
                       unavail = !availableSlots.some(s => s.dateIdx === schedDate && s.h === t.h && s.m === t.m);
                    } else {
                       unavail = isSlotUnavailable(seed, schedDate, t.h, t.m);
                    }
                    const a = schedTime === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={unavail}
                        onClick={() => setSchedTime(i)}
                        title={unavail ? "Slot unavailable" : undefined}
                        aria-disabled={unavail}
                        style={{
                          padding: small ? "8px 2px" : "10px 3px",
                          borderRadius: small ? 9 : 11,
                          border: `1.5px solid ${a ? accent : (unavail ? "#F1F5F9" : line)}`,
                          background: unavail ? "#F8FAFC" : (a ? accent : "#fff"),
                          color: unavail ? "#CBD5E1" : (a ? "#fff" : ink),
                          cursor: unavail ? "not-allowed" : "pointer",
                          fontSize: small ? 10.5 : 12,
                          fontWeight: 800,
                          textDecoration: unavail ? "line-through" : "none",
                          opacity: unavail ? .75 : 1,
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                        }}
                      >
                        {fmtSlotTime(t)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Self-contained variant — builds its own date + time arrays and emits
 * `onChange(isoString | "")` whenever the user picks a full slot.
 */
export function SlotPickerCalendarStandalone({
  days = 14,
  seed = "surgery",
  accent = "#0D9488",
  value,          // ISO string
  onChange,       // (iso: string) => void
  size = "md",
}: SlotPickerCalendarStandaloneProps) {
  const schedDates = React.useMemo(() => {
    const out = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      d.setHours(0, 0, 0, 0);
      out.push(d);
    }
    return out;
  }, [days]);

  const schedTimes = React.useMemo(() => {
    const out = [];
    for (let h = 9; h <= 21; h++) {
      for (const m of [0, 30]) {
        if (h === 21 && m > 0) continue;
        out.push({ h, m });
      }
    }
    return out;
  }, []);

  // Rehydrate indices from value on mount / when value changes externally.
  const [schedDate, setSchedDate] = React.useState<number | null>(null);
  const [schedTime, setSchedTime] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    if (isNaN(d.getTime())) return;
    const day0 = new Date(d); day0.setHours(0, 0, 0, 0);
    const di = schedDates.findIndex((x) => x.getTime() === day0.getTime());
    if (di < 0) return;
    const ti = schedTimes.findIndex((t) => t.h === d.getHours() && t.m === d.getMinutes());
    setSchedDate(di);
    setSchedTime(ti >= 0 ? ti : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTime = (i: number | null) => {
    setSchedTime(i);
    if (i == null || schedDate == null || !onChange) return;
    const d = new Date(schedDates[schedDate]);
    d.setHours(schedTimes[i].h, schedTimes[i].m, 0, 0);
    onChange(d.toISOString());
  };

  const handleDate = (i: number) => {
    setSchedDate(i);
    setSchedTime(null);
    if (onChange) onChange("");
  };

  return (
    <SlotPickerCalendar
      schedDates={schedDates}
      schedTimes={schedTimes}
      schedDate={schedDate}
      schedTime={schedTime}
      setSchedDate={handleDate}
      setSchedTime={handleTime}
      accent={accent}
      seed={seed}
      size={size}
    />
  );
}
