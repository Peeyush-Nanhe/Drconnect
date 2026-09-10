import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMyMwTeams, listMwTeamMembers, listVerifiedProviders, assignMwMember, claimMwTeam } from "@/features/mydox/backend";

const INK = "#0F172A";
const SUB = "#64748B";
const LINE = "#E2E8F0";
const TEAL = "#0D9488";

export default function CoordinatorApp({ profilePill }) {
  const [profile, setProfile] = React.useState({ service_area: "", languages: "Hindi, English", experience_years: 0, qualifications: "", availability_note: "", is_available: true, application_status: "draft" });
  const [cases, setCases] = React.useState([]);
  const [tab, setTab] = React.useState("inbox");
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  const refresh = React.useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { setLoading(false); return; }
    const [profileResult, caseResult] = await Promise.all([
      supabase.from("coordinator_profiles").select("application_status, service_area, languages, experience_years, qualifications, availability_note, is_available").eq("user_id", uid).maybeSingle(),
      supabase.from("coordinator_cases").select("id, request_type, summary, priority, status, created_at, patient_id, assigned_coordinator_id").order("created_at", { ascending: false }),
    ]);
    if (profileResult.data) setProfile({ ...profileResult.data, languages: (profileResult.data.languages || []).join(", ") });
    setCases(caseResult.data || []);
    setLoading(false);
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  async function saveProfile(submit = false) {
    setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const payload = { user_id: auth.user.id, ...profile, languages: String(profile.languages).split(",").map((x) => x.trim()).filter(Boolean), application_status: submit ? "submitted" : profile.application_status };
    const { error } = await supabase.from("coordinator_profiles").upsert(payload);
    setMessage(error ? error.message : submit ? "Application submitted for verification." : "Profile saved.");
    if (!error) { setProfile((current) => ({ ...current, application_status: payload.application_status })); await refresh(); }
  }

  async function acceptCase(item) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("coordinator_cases").update({ assigned_coordinator_id: auth.user.id, status: "assigned" }).eq("id", item.id).is("assigned_coordinator_id", null);
    setMessage(error ? error.message : "Case accepted.");
    await refresh();
  }

  const visible = cases.filter((item) => tab === "inbox" ? item.status === "requested" : tab === "active" ? ["assigned", "active", "waiting"].includes(item.status) : ["completed", "cancelled"].includes(item.status));
  return <div style={{ minHeight: 720, background: "#F8FAFC", fontFamily: "'Plus Jakarta Sans',sans-serif", color: INK }}>
    <header style={{ background: "linear-gradient(135deg,#0F766E,#0D9488)", color: "#fff", padding: "18px 16px 16px", display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", fontSize: 22 }}>🤝</div><div style={{ flex: 1 }}><strong>Health Coordinator</strong><div style={{ fontSize: 11, opacity: .85 }}>{profile.is_available ? "Available for assigned cases" : "Currently unavailable"}</div></div>{profilePill}</header>
    <div style={{ padding: 14 }}>
      <section style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 14, marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong>Professional profile</strong><span style={{ fontSize: 10, color: TEAL, fontWeight: 800, textTransform: "uppercase" }}>{profile.application_status}</span></div><div style={{ display: "grid", gap: 8, marginTop: 10 }}><input value={profile.service_area || ""} onChange={(e) => setProfile((p) => ({ ...p, service_area: e.target.value }))} placeholder="Service area" style={inputStyle}/><input value={profile.languages || ""} onChange={(e) => setProfile((p) => ({ ...p, languages: e.target.value }))} placeholder="Languages, comma separated" style={inputStyle}/><input type="number" min="0" value={profile.experience_years} onChange={(e) => setProfile((p) => ({ ...p, experience_years: Number(e.target.value) }))} placeholder="Experience years" style={inputStyle}/><input value={profile.qualifications || ""} onChange={(e) => setProfile((p) => ({ ...p, qualifications: e.target.value }))} placeholder="Qualifications" style={inputStyle}/></div><div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={() => saveProfile(false)} style={secondary}>Save</button><button onClick={() => saveProfile(true)} style={primary}>Submit for verification</button></div></section>
      <nav style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#E2E8F0", borderRadius: 12, padding: 3, marginBottom: 12 }}>{[["inbox","New"],["active","Active"],["closed","Closed"],["wellness","Wellness"]].map(([id,label]) => <button key={id} onClick={() => setTab(id)} style={{ border: 0, borderRadius: 9, padding: 9, background: tab === id ? "#fff" : "transparent", color: tab === id ? INK : SUB, fontWeight: 800, cursor: "pointer", fontSize: 12 }}>{label}</button>)}</nav>
      {message && <p style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>{message}</p>}
      {tab === "wellness" ? <WellnessTeamsQueue/> :
        loading ? <Empty text="Loading cases…"/> : visible.length === 0 ? <Empty text="No cases in this section."/> : visible.map((item) => <article key={item.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 13, padding: 13, marginBottom: 9 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ textTransform: "capitalize" }}>{item.request_type.replace(/_/g," ")}</strong><span style={{ color: item.priority === "urgent" ? "#B91C1C" : TEAL, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{item.priority}</span></div><p style={{ margin: "5px 0", color: SUB, fontSize: 12, lineHeight: 1.45 }}>{item.summary}</p><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 10, color: SUB, textTransform: "capitalize" }}>{item.status}</span>{item.status === "requested" && <button onClick={() => acceptCase(item)} style={primary}>Accept case</button>}</div></article>)}
    </div>
  </div>;
}

const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 10, padding: 10, fontFamily: "inherit" };
const primary = { border: 0, borderRadius: 9, padding: "8px 11px", background: TEAL, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 11 };
const secondary = { ...primary, background: "#E2E8F0", color: INK };
function Empty({ text }) { return <div style={{ padding: 34, textAlign: "center", color: SUB, background: "#fff", borderRadius: 13, border: `1px dashed ${LINE}`, fontSize: 12 }}>{text}</div>; }
function WellnessTeamsQueue() {
  const [teams, setTeams] = React.useState([]);
  const [membersByTeam, setMembersByTeam] = React.useState({});
  const [providers, setProviders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState("");
  const [open, setOpen] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [teamRows, providerRows] = await Promise.all([listMyMwTeams(), listVerifiedProviders()]);
      const sorted = [...teamRows].sort((a, b) => (Number(b.urgent) - Number(a.urgent)) || (new Date(a.first_contact_due_at) - new Date(b.first_contact_due_at)));
      setTeams(sorted);
      setProviders(providerRows);
      const entries = await Promise.all(sorted.map(async (t) => [t.id, await listMwTeamMembers(t.id)]));
      setMembersByTeam(Object.fromEntries(entries));
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : "Could not load wellness teams.");
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function claim(team) {
    setNote("");
    try { await claimMwTeam(team.id); await load(); setNote("First contact logged."); }
    catch (caught) { setNote(caught instanceof Error ? caught.message : "Could not claim this case."); }
  }

  async function assign(member, providerId) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;
    setNote("");
    try { await assignMwMember(member.id, { id: provider.id, name: provider.name }); await load(); setNote(`${provider.name} assigned as ${member.role_label}.`); }
    catch (caught) { setNote(caught instanceof Error ? caught.message : "This provider cannot be assigned to that role."); }
  }

  const overdue = (iso, done) => !done && new Date(iso).getTime() < Date.now();

  if (loading) return <Empty text="Loading wellness teams…"/>;
  if (teams.length === 0) return <Empty text="No mental wellness cases yet."/>;

  return <div>
    {note && <p style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>{note}</p>}
    {teams.map((team) => {
      const members = membersByTeam[team.id] || [];
      const pending = members.filter((m) => m.status !== "confirmed");
      return <article key={team.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 13, padding: 13, marginBottom: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ textTransform: "capitalize" }}>{String(team.track).replace(/_/g, " ")}</strong>
          {team.urgent && <span style={{ color: "#B91C1C", fontSize: 10, fontWeight: 800 }}>URGENT</span>}
        </div>
        <p style={{ margin: "5px 0", color: SUB, fontSize: 12, lineHeight: 1.45 }}>
          {team.screening_instrument ? `${team.screening_instrument} ${team.screening_score} · ${team.screening_band}` : "Enquiry — no screener"} · {team.anchor_modality === "in_person" ? "first visit in person" : "teleconsult allowed"}
        </p>
        <div style={{ display: "flex", gap: 10, fontSize: 10, fontWeight: 800, marginBottom: 7 }}>
          <span style={{ color: overdue(team.first_contact_due_at, team.first_contact_at) ? "#B91C1C" : TEAL }}>4h call {team.first_contact_at ? "done" : overdue(team.first_contact_due_at, team.first_contact_at) ? "overdue" : "pending"}</span>
          <span style={{ color: overdue(team.assembly_due_at, team.assembled_at) ? "#B91C1C" : TEAL }}>48h team {team.assembled_at ? "assembled" : overdue(team.assembly_due_at, team.assembled_at) ? "overdue" : `${pending.length} open`}</span>
          {team.screening_red_flag && <span style={{ color: "#B91C1C" }}>SAFETY FLAG</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!team.first_contact_at && <button onClick={() => claim(team)} style={primary}>Log first contact</button>}
          <button onClick={() => setOpen(open === team.id ? null : team.id)} style={secondary}>{open === team.id ? "Hide team" : "Manage team"}</button>
        </div>
        {open === team.id && <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {members.map((m) => <div key={m.id} style={{ border: `1px dashed ${LINE}`, borderRadius: 10, padding: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ fontSize: 12 }}>{m.role_label}{m.required ? "" : " · optional"}</strong>
              <span style={{ fontSize: 10, color: m.status === "confirmed" ? TEAL : SUB, fontWeight: 800, textTransform: "uppercase" }}>{m.status}</span>
            </div>
            {m.provider_name ? <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>{m.provider_name}</div>
              : <select defaultValue="" onChange={(e) => assign(m, e.target.value)} style={{ ...inputStyle, marginTop: 6, fontSize: 12 }}>
                  <option value="" disabled>Assign a verified provider…</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.specialty}</option>)}
                </select>}
          </div>)}
          <p style={{ fontSize: 10.5, color: SUB, lineHeight: 1.4 }}>Only verified providers appear here, and the database rejects an unverified provider for a gated clinical role.</p>
        </div>}
      </article>;
    })}
  </div>;
}
