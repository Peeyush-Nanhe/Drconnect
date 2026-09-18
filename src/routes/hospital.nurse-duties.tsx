import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ClipboardList, IndianRupee, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NURSE_SKILLS, NURSE_SKILL_LABEL, SHIFT_PREFS } from "@/lib/care-staff-catalog";
import { getFacilityNurseDuties, postFacilityNurseDuty } from "@/lib/booking-tracking.functions";
import { Card, Empty, Field, Section, StaffShell, Stat, inputClass } from "@/features/careteam/StaffUI";

export const Route = createFileRoute("/hospital/nurse-duties")({
  head: () => ({
    meta: [
      { title: "Post Nurse Duties — MedConnect Hospital" },
      { name: "description", content: "Hospitals and clinics post ward, ICU, OT and maternity nurse duties on MedConnect and reach verified nurses nearby within minutes." },
      { property: "og:title", content: "Post Nurse Duties — MedConnect Hospital" },
      { property: "og:description", content: "Post a nurse duty and let MedConnect find verified nurses nearby automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HospitalNurseDuties,
  ssr: false,
});

const OPEN = new Set(["requested", "searching", "expanded", "offered", "unavailable"]);
const STAGE: Record<string, string> = {
  requested: "Posted",
  searching: "Searching nurses",
  expanded: "Search widened",
  offered: "Nurses notified",
  accepted: "Nurse assigned",
  en_route: "On the way",
  arrived: "Arrived",
  started: "On duty",
  completed: "Completed",
  cancelled: "Cancelled",
  unavailable: "No nurse yet",
};

function HospitalNurseDuties() {
  const fetchDuties = useServerFn(getFacilityNurseDuties);
  const postDuty = useServerFn(postFacilityNurseDuty);
  const queryClient = useQueryClient();
  const board = useQuery({ queryKey: ["facility-nurse-duties"], queryFn: () => fetchDuties({}), refetchInterval: 15_000 });

  const boardData: any = board.data;
  const hospitals = boardData?.hospitals ?? [];
  const [hospitalId, setHospitalId] = useState("");
  const [skill, setSkill] = useState(NURSE_SKILLS[0]?.value ?? "ward");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shift, setShift] = useState(SHIFT_PREFS[0]?.value ?? "day");
  const [scheduledFor, setScheduledFor] = useState("");
  const [hours, setHours] = useState(8);
  const [payInr, setPayInr] = useState(1200);
  const [priority, setPriority] = useState<"normal" | "urgent" | "emergency">("normal");
  const chosenHospital = hospitalId || hospitals[0]?.id || "";

  const post = useMutation({
    mutationFn: () => postDuty({ data: { hospitalId: chosenHospital, skill, title: title.trim(), description: description.trim() || undefined, shift, scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined, durationMinutes: Math.round(hours * 60), payInr, priority } }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["facility-nurse-duties"] });
    },
  });

  const duties = boardData?.duties ?? [];
  const offers = boardData?.offers ?? [];
  const offersByDuty = useMemo(() => {
    const map = new Map<string, typeof offers>();
    for (const offer of offers) map.set(offer.booking_id, [...(map.get(offer.booking_id) ?? []), offer]);
    return map;
  }, [offers]);

  return (
    <StaffShell
      title="Nurse duties"
      subtitle="Post a duty and MedConnect offers it to verified nurses nearby straight away"
      right={<Button asChild size="sm" variant="outline"><Link to="/nurses/find">Browse nurses</Link></Button>}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Open duties" value={duties.filter((duty: any) => OPEN.has(duty.status)).length} />
        <Stat label="Nurse assigned" value={duties.filter((duty: any) => ["accepted", "en_route", "arrived", "started"].includes(duty.status)).length} tone="slate" />
        <Stat label="Completed" value={duties.filter((duty: any) => duty.status === "completed").length} tone="slate" />
        <Stat label="Nurses notified" value={duties.reduce((sum: number, duty: any) => sum + (duty.notified_provider_count ?? 0), 0)} tone="slate" />
      </div>

      {board.isLoading ? <Empty>Loading your duty board…</Empty> : hospitals.length === 0 ? (
        <Empty>This account is not linked to a hospital yet. Ask the MedConnect admin team to link your hospital, then post duties here.</Empty>
      ) : (
        <>
          <Section title="Post a duty">
            <Card>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Hospital or clinic">
                  <select className={inputClass} value={chosenHospital} onChange={(event) => setHospitalId(event.target.value)}>
                    {hospitals.map((hospital: any) => <option key={hospital.id} value={hospital.id}>{hospital.name}{hospital.area ? ` · ${hospital.area}` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Nursing skill needed">
                  <select className={inputClass} value={skill} onChange={(event) => setSkill(event.target.value)}>
                    {NURSE_SKILLS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Duty title">
                  <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Night ICU cover — 2 beds" />
                </Field>
                <Field label="Shift">
                  <select className={inputClass} value={shift} onChange={(event) => setShift(event.target.value)}>
                    {SHIFT_PREFS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Starts at">
                  <input className={inputClass} type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
                </Field>
                <Field label="Duty length (hours)">
                  <input className={inputClass} type="number" min={1} max={24} value={hours} onChange={(event) => setHours(Number(event.target.value))} />
                </Field>
                <Field label="Pay for the duty (₹)">
                  <input className={inputClass} type="number" min={0} step={50} value={payInr} onChange={(event) => setPayInr(Number(event.target.value))} />
                </Field>
                <Field label="Urgency">
                  <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
                    <option value="normal">Planned</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Anything the nurse should know">
                    <textarea className={inputClass} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ward, reporting person, patient load, entry gate" />
                  </Field>
                </div>
              </div>
              {post.error ? <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{(post.error as Error).message}</p> : null}
              {post.isSuccess ? <p className="mt-2 text-sm font-semibold text-emerald-700">Duty posted — nurses nearby are being contacted now.</p> : null}
              <div className="mt-3">
                <Button onClick={() => post.mutate()} disabled={post.isPending || !title.trim()}>
                  <ClipboardList />
                  {post.isPending ? "Posting…" : "Post duty to nurses"}
                </Button>
              </div>
            </Card>
          </Section>

          <Section title="Duties posted" count={duties.length}>
            {duties.length ? (
              <div className="space-y-3">
                {duties.map((duty: any) => {
                  const dutyOffers = offersByDuty.get(duty.id) ?? [];
                  const assignedName = duty.assigned_provider_id ? boardData?.nameById[duty.assigned_provider_id] : null;
                  return (
                    <Card key={duty.id} accent={duty.priority !== "normal"}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-extrabold uppercase text-clinical-strong">{NURSE_SKILL_LABEL[duty.service_code ?? ""] ?? duty.service_code ?? "Nursing"} · {duty.priority}</p>
                          <p className="truncate text-sm font-bold">{duty.title}</p>
                          <p className="text-xs text-muted-foreground">
                            <CalendarClock className="mr-1 inline size-3" />
                            {duty.scheduled_for ? new Date(duty.scheduled_for).toLocaleString() : "As soon as possible"} · {Math.round((duty.duration_minutes ?? 60) / 60)} h
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold uppercase">{STAGE[duty.status] ?? duty.status}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <p className="rounded-xl bg-muted p-2 font-semibold"><IndianRupee className="mr-1 inline size-3" />{duty.estimated_earnings ?? 0}</p>
                        <p className="rounded-xl bg-muted p-2 font-semibold"><Users className="mr-1 inline size-3" />{duty.notified_provider_count ?? 0} notified</p>
                        <p className="rounded-xl bg-muted p-2 font-semibold">{duty.current_radius_km} km search</p>
                      </div>
                      {assignedName ? <p className="mt-2 text-sm font-bold text-emerald-700">Assigned to {assignedName}</p> : null}
                      {dutyOffers.length ? (
                        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                          {dutyOffers.slice(0, 6).map((offer: any) => (
                            <li key={offer.id}>
                              {boardData?.nameById[offer.provider_id ?? ""] ?? "Nurse"} · {offer.status}
                              {offer.distance_km != null ? ` · ${Number(offer.distance_km).toFixed(1)} km` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Empty>No duties posted yet. Post one above and nurses nearby will see it on their home screen.</Empty>
            )}
          </Section>
        </>
      )}
    </StaffShell>
  );
}
