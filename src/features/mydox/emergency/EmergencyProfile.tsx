/**
 * Emergency profile — the details an ER / ambulance crew needs if the patient
 * cannot talk. Saved on `profiles` (columns created by the emergency dispatch
 * migration) and copied into every emergency case automatically by
 * create_emergency_case(), so nothing has to be typed during an emergency.
 */
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { AlertTriangle, Check, ChevronRight, Loader2, MessageCircle, Phone, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/features/mydox/backend";

// profiles columns added by the emergency migration are not in the generated types yet.
const db = supabase as unknown as {
  from: (table: string) => any;
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const FIELDS =
  "phone, blood_group, allergies, conditions, medications, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_2_name, emergency_contact_2_phone";

export interface EmergencyProfile {
  phone: string | null;
  blood_group: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  emergency_contact_1_name: string | null;
  emergency_contact_1_phone: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
}

/** Same rule as public.emergency_profile_ready(): own phone + one contact. */
export function isEmergencyReady(p: EmergencyProfile | null) {
  if (!p) return false;
  const ok = (v: string | null) => (v ?? "").replace(/\D/g, "").length >= 8;
  return ok(p.phone) && ok(p.emergency_contact_1_phone);
}

export function useEmergencyProfile() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await db.from("profiles").select(FIELDS).eq("id", userId).maybeSingle();
    setProfile(
      data
        ? { ...data, allergies: data.allergies ?? [], conditions: data.conditions ?? [], medications: data.medications ?? [] }
        : null,
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);
  return { userId, profile, loading, ready: isEmergencyReady(profile), reload };
}

// ─── helpers ────────────────────────────────────────────────────────────────
const digits = (v: string) => v.replace(/\D/g, "");
/** Indian mobile → "+91XXXXXXXXXX"; anything else is kept as typed. */
function normalisePhone(v: string) {
  const d = digits(v);
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  return v.trim();
}
const validMobile = (v: string) => { const d = digits(v); return d.length === 10 || (d.length === 12 && d.startsWith("91")); };
const toList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
const fromList = (v: string[] | null | undefined) => (v ?? []).join(", ");

const font = "'Plus Jakarta Sans', system-ui, sans-serif";
const label: CSSProperties = { display: "block", fontSize: 12, fontWeight: 800, color: "#374151", margin: "0 0 5px" };
const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "11px 12px",
  fontSize: 14, fontFamily: font, outline: "none", background: "#fff", color: "#111827",
};
const card: CSSProperties = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 14, marginBottom: 12 };

// ─── the form (renders as an overlay inside the app card) ────────────────────
export function EmergencyProfileForm({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { userId, profile, loading, reload } = useEmergencyProfile();
  const [f, setF] = useState({
    phone: "", blood: "", allergies: "", conditions: "", medications: "",
    c1n: "", c1p: "", c2n: "", c2p: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setF({
      phone: profile.phone ?? "", blood: profile.blood_group ?? "",
      allergies: fromList(profile.allergies), conditions: fromList(profile.conditions), medications: fromList(profile.medications),
      c1n: profile.emergency_contact_1_name ?? "", c1p: profile.emergency_contact_1_phone ?? "",
      c2n: profile.emergency_contact_2_name ?? "", c2p: profile.emergency_contact_2_phone ?? "",
    });
  }, [profile]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    setError(null);
    if (!userId) return setError("Please sign in again.");
    if (!validMobile(f.phone)) return setError("Enter your own 10-digit mobile number.");
    if (!f.c1n.trim() || !validMobile(f.c1p)) return setError("Add at least one emergency contact with a 10-digit mobile.");
    if (f.c2p.trim() && !validMobile(f.c2p)) return setError("Second contact's mobile must be 10 digits (or leave it empty).");
    if (digits(f.c1p) === digits(f.phone) || (f.c2p && digits(f.c2p) === digits(f.phone)))
      return setError("Emergency contacts must be someone other than you.");

    setSaving(true);
    const { error: err } = await db.from("profiles").update({
      phone: normalisePhone(f.phone),
      blood_group: f.blood || null,
      allergies: toList(f.allergies),
      conditions: toList(f.conditions),
      medications: toList(f.medications),
      emergency_contact_1_name: f.c1n.trim(),
      emergency_contact_1_phone: normalisePhone(f.c1p),
      emergency_contact_2_name: f.c2n.trim() || null,
      emergency_contact_2_phone: f.c2p.trim() ? normalisePhone(f.c2p) : null,
    }).eq("id", userId);
    setSaving(false);
    if (err) return setError(`Could not save: ${err.message}`);
    setSaved(true);
    await reload();
    onSaved?.();
    setTimeout(onClose, 900);
  }

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 95, background: "#F4F7F6", display: "flex", flexDirection: "column", fontFamily: font }}>
      <div style={{ flexShrink: 0, background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <ShieldCheck size={20} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Emergency profile</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, opacity: 0.9 }}>Shared with the ambulance & ER only during an emergency</p>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,.2)", border: 0, color: "#fff", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 24px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#6B7280", marginTop: 40 }}><Loader2 size={18} className="animate-spin" /> Loading…</p>
        ) : (
          <>
            <div style={card}>
              <p style={{ margin: "0 0 10px", fontWeight: 800, fontSize: 14, color: "#111827" }}>Your details</p>
              <span style={label}>Your mobile number *</span>
              <input style={input} inputMode="tel" placeholder="98XXXXXXXX" value={f.phone} onChange={set("phone")} />
              <span style={{ ...label, marginTop: 12 }}>Blood group</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {BLOOD_GROUPS.map((b) => (
                  <button key={b} type="button" onClick={() => setF((s) => ({ ...s, blood: s.blood === b ? "" : b }))}
                    style={{ border: `1.5px solid ${f.blood === b ? "#DC2626" : "#E5E7EB"}`, background: f.blood === b ? "#FEF2F2" : "#fff", color: f.blood === b ? "#B91C1C" : "#374151", borderRadius: 99, padding: "6px 12px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: font }}>
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div style={card}>
              <p style={{ margin: "0 0 10px", fontWeight: 800, fontSize: 14, color: "#111827" }}>Medical information</p>
              <span style={label}>Allergies</span>
              <input style={input} placeholder="e.g. Penicillin, Sulfa (comma separated)" value={f.allergies} onChange={set("allergies")} />
              <span style={{ ...label, marginTop: 12 }}>Conditions</span>
              <input style={input} placeholder="e.g. Hypertension, Diabetes" value={f.conditions} onChange={set("conditions")} />
              <span style={{ ...label, marginTop: 12 }}>Regular medicines</span>
              <input style={input} placeholder="e.g. Telmisartan 40mg, Metformin 500mg" value={f.medications} onChange={set("medications")} />
            </div>

            <div style={card}>
              <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 14, color: "#111827" }}>Emergency contacts</p>
              <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "#6B7280" }}>The crew calls them if you can't talk, and you can alert them in one tap.</p>
              <span style={label}>Contact 1 — name & relation *</span>
              <input style={input} placeholder="e.g. Sunita (Wife)" value={f.c1n} onChange={set("c1n")} />
              <input style={{ ...input, marginTop: 6 }} inputMode="tel" placeholder="Mobile *" value={f.c1p} onChange={set("c1p")} />
              <span style={{ ...label, marginTop: 12 }}>Contact 2 — name & relation</span>
              <input style={input} placeholder="e.g. Rohan (Son)" value={f.c2n} onChange={set("c2n")} />
              <input style={{ ...input, marginTop: 6 }} inputMode="tel" placeholder="Mobile" value={f.c2p} onChange={set("c2p")} />
            </div>

            {error && (
              <p style={{ display: "flex", gap: 6, alignItems: "flex-start", background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, fontWeight: 700, margin: "0 0 12px" }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </p>
            )}

            <button type="button" onClick={save} disabled={saving || saved}
              style={{ width: "100%", border: 0, borderRadius: 14, padding: "14px", fontWeight: 800, fontSize: 15, color: "#fff", cursor: "pointer", fontFamily: font, background: saved ? "#059669" : "linear-gradient(135deg,#DC2626,#B91C1C)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {saving ? <Loader2 size={17} className="animate-spin" /> : saved ? <Check size={17} /> : null}
              {saved ? "Saved" : saving ? "Saving…" : "Save emergency profile"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── home-screen reminder ("complete your profile") ──────────────────────────
export function EmergencyProfileNudge({ onOpen, refreshKey }: { onOpen: () => void; refreshKey?: unknown }) {
  const { profile, loading, ready, reload } = useEmergencyProfile();
  useEffect(() => { void reload(); }, [refreshKey, reload]);
  if (loading || !profile || ready) return null;
  return (
    <button type="button" onClick={onOpen}
      style={{ flexShrink: 0, margin: "8px 14px 0", display: "flex", alignItems: "center", gap: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 14, padding: "10px 12px", cursor: "pointer", textAlign: "left", fontFamily: font }}>
      <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#DC2626", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ShieldCheck size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 800, fontSize: 12.5, color: "#111827" }}>Complete your emergency profile</span>
        <span style={{ display: "block", fontSize: 10.5, color: "#B91C1C", fontWeight: 700 }}>Add family contacts & blood group — takes 1 minute</span>
      </span>
      <ChevronRight size={16} color="#DC2626" />
    </button>
  );
}

// ─── one-tap family alert (used on the patient emergency screen) ─────────────
export interface FamilyContact { name: string | null; phone: string }

export function familyAlertMessage(opts: { category?: string | null; lat?: number | null; lng?: number | null }) {
  const where = opts.lat != null && opts.lng != null ? ` My location: https://maps.google.com/?q=${opts.lat},${opts.lng}` : "";
  return `EMERGENCY: I have raised a ${opts.category ?? "medical"} emergency on MyDox. An ambulance and hospital are being arranged.${where}`;
}

export function FamilyAlert({ contacts, message }: { contacts: FamilyContact[]; message: string }) {
  if (!contacts.length) return null;
  const text = encodeURIComponent(message);
  return (
    <section style={{ ...card, background: "#F0FDF4", borderColor: "#BBF7D0", fontFamily: font }} aria-label="Alert your family">
      <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 13, color: "#166534" }}>Alert your family with your live location</p>
      {contacts.map((c) => {
        const d = digits(c.phone);
        const wa = d.length === 10 ? `91${d}` : d;
        return (
          <div key={c.phone} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.name || "Emergency contact"}
            </span>
            <a href={`https://wa.me/${wa}?text=${text}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, background: "#16A34A", color: "#fff", borderRadius: 99, padding: "6px 10px", fontSize: 11.5, fontWeight: 800, textDecoration: "none" }}>
              <MessageCircle size={13} /> WhatsApp
            </a>
            <a href={`sms:${c.phone}?body=${text}`}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", color: "#166534", border: "1px solid #86EFAC", borderRadius: 99, padding: "6px 10px", fontSize: 11.5, fontWeight: 800, textDecoration: "none" }}>
              SMS
            </a>
            <a href={`tel:${c.phone}`} aria-label={`Call ${c.name ?? "contact"}`}
              style={{ display: "flex", alignItems: "center", background: "#fff", color: "#166534", border: "1px solid #86EFAC", borderRadius: "50%", width: 30, height: 30, justifyContent: "center" }}>
              <Phone size={13} />
            </a>
          </div>
        );
      })}
    </section>
  );
}
