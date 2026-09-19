import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { searchNurses } from "@/lib/nurse.functions";
import { NURSE_SKILLS, NURSE_SKILL_LABEL, PUNE_AREAS, SHIFT_LABEL, SHIFT_PREFS } from "@/lib/care-staff-catalog";
import { Card, Chips, Empty, Field, Section, StaffShell, Switch, inputClass } from "@/features/careteam/StaffUI";

export const Route = createFileRoute("/nurses/find")({
  head: () => ({
    meta: [
      { title: "Find a Nurse — MedConnect" },
      {
        name: "description",
        content:
          "Hospitals, clinics and families filter MedConnect nurses by ward skills, ICU and OT experience, shift, area and availability to find the right nurse for a duty.",
      },
      { property: "og:title", content: "Find a Nurse — MedConnect" },
      {
        property: "og:description",
        content: "Filter nurses by ICU, OT scrub, maternity, neonatal and home-care skills, shift and area.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FindNurse,
  ssr: false,
});

function FindNurse() {
  const search = useServerFn(searchNurses);
  const [skills, setSkills] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [shift, setShift] = useState("");
  const [minExperience, setMinExperience] = useState(0);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [homeCareOnly, setHomeCareOnly] = useState(false);

  const query = useQuery({
    queryKey: ["nurse-search", skills, area, shift, minExperience, onlineOnly, homeCareOnly],
    queryFn: () =>
      search({
        data: {
          skills,
          area: area || null,
          shift: shift || null,
          minExperience: minExperience || null,
          onlineOnly,
          homeCareOnly,
        },
      }),
  });

  const nurses = query.data?.nurses ?? [];

  return (
    <StaffShell title="Find a nurse" subtitle="Filter by skills, ward, shift and area" right={<Link to="/hospital/nurse-duties" className="text-sm font-semibold text-teal-700 hover:underline">Post a nurse duty →</Link>}>
      <Card>
        <h3 className="mb-2 text-sm font-extrabold">Skills & wards needed</h3>
        <Chips
          options={NURSE_SKILLS}
          selected={skills}
          onToggle={(v) => setSkills((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          grouped
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Area">
            <select className={inputClass} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Any area</option>
              {PUNE_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shift">
            <select className={inputClass} value={shift} onChange={(e) => setShift(e.target.value)}>
              <option value="">Any shift</option>
              {SHIFT_PREFS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minimum experience (years)">
            <input
              type="number"
              min={0}
              max={40}
              className={inputClass}
              value={minExperience}
              onChange={(e) => setMinExperience(Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Switch on={onlineOnly} onChange={setOnlineOnly} label="Only nurses online now" />
          <Switch on={homeCareOnly} onChange={setHomeCareOnly} label="Only home-care nurses" />
        </div>
      </Card>

      <Section title="Matching nurses" count={nurses.length}>
        {query.isLoading ? (
          <Empty>Searching…</Empty>
        ) : query.isError ? (
          <Empty>{query.error instanceof Error ? query.error.message : "Could not search nurses."}</Empty>
        ) : !nurses.length ? (
          <Empty>No nurse matches these filters. Try fewer skills or a wider area.</Empty>
        ) : (
          <div className="space-y-3">
            {nurses.map((n) => (
              <Card key={n.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold">
                      {n.fullName}
                      {n.verified ? <span className="ml-2 text-[10px] font-bold text-teal-700">verified</span> : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {n.specialty ?? "Nurse"} · {n.yearsExperience} yrs · {n.city}
                    </div>
                    <div className="text-xs text-slate-500">{n.areas.length ? n.areas.join(", ") : "Any area"}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
                      n.isOnline ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {n.isOnline ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  {n.skills.slice(0, 8).map((s) => (
                    <span key={s} className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {NURSE_SKILL_LABEL[s] ?? s}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {n.shiftPrefs.map((s) => SHIFT_LABEL[s] ?? s).join(" · ") || "Shift flexible"}
                  {n.homeCare ? " · home care" : ""}
                  {n.hospitalDuty ? " · hospital duty" : ""}
                  {n.phone ? ` · ${n.phone}` : ""}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </StaffShell>
  );
}
