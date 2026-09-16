import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const H = 3600 * 1000;

export const TEST_LABEL: Record<string, string> = {
  ecg: "ECG (12-lead)",
  holter: "Holter monitoring",
  eeg: "EEG (brain activity)",
  nerve_conduction: "Nerve conduction study",
  vng: "VNG (vertigo & balance)",
  audiometry: "Audiometry (hearing)",
  tympanometry: "Tympanometry",
  spirometry: "Spirometry (lung function)",
  ot_assist: "Operation theatre assist",
  other: "Other test",
};

type Scope = { isAdmin: boolean; isSuper: boolean; technicianId: string | null; technicianName: string | null };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function resolveScope(ctx: { supabase: any; userId: string }): Promise<Scope> {
  const sb = await admin();
  const { data: roles, error } = await sb.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (error) throw new Error(error.message);
  const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
  const isAdmin = isSuper || (roles ?? []).some((r: any) => r.role === "admin");
  if (isAdmin) return { isAdmin: true, isSuper, technicianId: null, technicianName: null };

  const { data: tech, error: tErr } = await sb
    .from("technicians")
    .select("id, full_name, active")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!tech || !tech.active) {
    throw new Error("Forbidden: this console is restricted to administrators and active technicians.");
  }
  return { isAdmin: false, isSuper: false, technicianId: tech.id, technicianName: tech.full_name };
}

async function buildOverview(days: number, scope: Scope) {
  const sb = await admin();
  const since = new Date(Date.now() - days * 24 * H).toISOString();

  let testsQ = sb.from("technician_tests").select("*").gte("created_at", since);
  if (!scope.isAdmin) testsQ = testsQ.eq("technician_id", scope.technicianId);

  let fbQ = sb.from("technician_test_feedback").select("*").gte("created_at", since);
  if (!scope.isAdmin) fbQ = fbQ.eq("technician_id", scope.technicianId);

  const [tRes, techRes, fRes] = await Promise.all([
    testsQ.order("scheduled_at", { ascending: false }),
    sb.from("technicians").select("*").order("full_name"),
    fbQ,
  ]);
  for (const r of [tRes, techRes, fRes]) if (r.error) throw new Error(r.error.message);

  const tests: any[] = tRes.data ?? [];
  const technicians: any[] = (techRes.data ?? []).filter(
    (t: any) => scope.isAdmin || t.id === scope.technicianId,
  );
  const feedback: any[] = fRes.data ?? [];
  const techById = new Map<string, any>(technicians.map((t) => [t.id, t]));

  const now = Date.now();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = start.getTime() + 24 * H;
  const isToday = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < end;
  };
  const bump = (o: Record<string, number>, k: string | null | undefined) => {
    if (!k) return;
    o[k] = (o[k] ?? 0) + 1;
  };
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const stateOf = (t: any) => {
    const sched = t.scheduled_at ? new Date(t.scheduled_at).getTime() : null;
    if (t.status === "completed") return "completed";
    if (t.status === "no_show" || t.no_show) return "absent";
    if (t.status === "cancelled") return "cancelled";
    if (t.status === "in_progress" || t.checked_in_at) return "in_progress";
    if (!t.technician_id || t.status === "requested") return "unassigned";
    if (sched != null && now > sched) return "late";
    if (sched != null && sched - now <= 3 * H) return "en_route";
    return "scheduled";
  };

  const today = {
    total: 0,
    inProgress: 0,
    enRoute: 0,
    late: 0,
    absent: 0,
    completed: 0,
    cancelled: 0,
    unassigned: 0,
    testMix: {} as Record<string, number>,
    areaMix: {} as Record<string, number>,
  };
  const board: any[] = [];

  const testMix: Record<string, number> = {};
  const statusMix: Record<string, number> = {};
  const areaMap = new Map<string, { area: string; tests: number; completed: number; noShows: number; cancelled: number; urgent: number; revenue: number }>();
  const perTech = new Map<
    string,
    {
      id: string;
      name: string;
      org: string | null;
      area: string | null;
      types: string[];
      tests: number;
      completed: number;
      noShows: number;
      cancelled: number;
      lateArrivals: number;
      turnaround: number[];
      reportsFiled: number;
      revenue: number;
      ratings: number[];
      punctuality: number[];
      clarity: number[];
      rebook: number;
      rebookVotes: number;
      mix: Record<string, number>;
    }
  >();

  let revenue = 0;
  let pendingPayments = 0;
  let missingReports = 0;

  tests.forEach((t) => {
    const state = stateOf(t);
    const label = t.test_label ?? TEST_LABEL[t.test_type] ?? t.test_type;

    if (isToday(t.scheduled_at)) {
      today.total++;
      bump(today.testMix, t.test_type);
      bump(today.areaMix, t.area);
      if (state === "in_progress") today.inProgress++;
      if (state === "en_route") today.enRoute++;
      if (state === "late") today.late++;
      if (state === "absent") today.absent++;
      if (state === "completed") today.completed++;
      if (state === "cancelled") today.cancelled++;
      if (state === "unassigned") today.unassigned++;
    }

    if (isToday(t.scheduled_at) || ["late", "in_progress", "unassigned"].includes(state)) {
      board.push({
        id: t.id,
        patient: t.patient_name ?? "Patient",
        testType: t.test_type,
        testLabel: label,
        area: t.area,
        homeVisit: t.home_visit,
        scheduledAt: t.scheduled_at,
        urgency: t.urgency,
        technicianId: t.technician_id ?? null,
        technician: t.technician_id ? techById.get(t.technician_id)?.full_name ?? "Technician" : null,
        referredBy: t.referring_doctor_name,
        state,
        minutesLate: state === "late" && t.scheduled_at ? Math.round((now - new Date(t.scheduled_at).getTime()) / 60000) : null,
        fee: t.fee == null ? null : Number(t.fee),
        reportUrl: t.report_url,
      });
    }

    bump(testMix, t.test_type);
    bump(statusMix, t.status);
    const fee = Number(t.fee ?? 0);
    if (t.status === "completed") {
      revenue += fee;
      if (!t.report_url && !t.findings) missingReports++;
    }
    if (t.payment_status !== "paid" && t.status === "completed") pendingPayments += fee;

    const areaKey = t.area ?? "Unassigned area";
    const a =
      areaMap.get(areaKey) ?? { area: areaKey, tests: 0, completed: 0, noShows: 0, cancelled: 0, urgent: 0, revenue: 0 };
    a.tests++;
    if (t.status === "completed") {
      a.completed++;
      a.revenue += fee;
    }
    if (t.status === "no_show" || t.no_show) a.noShows++;
    if (t.status === "cancelled") a.cancelled++;
    if (t.urgency === "urgent") a.urgent++;
    areaMap.set(areaKey, a);

    if (t.technician_id) {
      const meta = techById.get(t.technician_id);
      const rec =
        perTech.get(t.technician_id) ??
        {
          id: t.technician_id,
          name: meta?.full_name ?? "Technician",
          org: meta?.org ?? null,
          area: meta?.area ?? null,
          types: meta?.test_types ?? [],
          tests: 0,
          completed: 0,
          noShows: 0,
          cancelled: 0,
          lateArrivals: 0,
          turnaround: [] as number[],
          reportsFiled: 0,
          revenue: 0,
          ratings: [] as number[],
          punctuality: [] as number[],
          clarity: [] as number[],
          rebook: 0,
          rebookVotes: 0,
          mix: {} as Record<string, number>,
        };
      rec.tests++;
      bump(rec.mix, t.test_type);
      if (t.status === "completed") {
        rec.completed++;
        rec.revenue += fee;
        if (t.report_url || t.findings) rec.reportsFiled++;
        if (t.checked_in_at && t.completed_at) {
          rec.turnaround.push((new Date(t.completed_at).getTime() - new Date(t.checked_in_at).getTime()) / 60000);
        }
      }
      if (t.status === "no_show" || t.no_show) rec.noShows++;
      if (t.status === "cancelled") rec.cancelled++;
      if (t.checked_in_at && t.scheduled_at) {
        const lateMin = (new Date(t.checked_in_at).getTime() - new Date(t.scheduled_at).getTime()) / 60000;
        if (lateMin > 15) rec.lateArrivals++;
      }
      perTech.set(t.technician_id, rec);
    }
  });

  feedback.forEach((f) => {
    const rec = f.technician_id ? perTech.get(f.technician_id) : null;
    if (!rec) return;
    rec.ratings.push(f.rating);
    if (f.punctuality != null) rec.punctuality.push(f.punctuality);
    if (f.report_clarity != null) rec.clarity.push(f.report_clarity);
    if (f.would_rebook != null) {
      rec.rebookVotes++;
      if (f.would_rebook) rec.rebook++;
    }
  });

  const order = ["late", "unassigned", "absent", "in_progress", "en_route", "scheduled", "completed", "cancelled"];
  board.sort(
    (a, b) =>
      order.indexOf(a.state) - order.indexOf(b.state) ||
      new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime(),
  );

  const technicianRows = [...perTech.values()]
    .map((t) => ({
      id: t.id,
      name: t.name,
      org: t.org,
      area: t.area,
      types: t.types,
      tests: t.tests,
      completed: t.completed,
      noShows: t.noShows,
      cancelled: t.cancelled,
      lateArrivals: t.lateArrivals,
      reliability: t.tests ? Math.round(((t.tests - t.noShows - t.cancelled) / t.tests) * 100) : null,
      reportRate: t.completed ? Math.round((t.reportsFiled / t.completed) * 100) : null,
      avgTurnaroundMin: t.turnaround.length ? Math.round(avg(t.turnaround)!) : null,
      avgRating: t.ratings.length ? Number(avg(t.ratings)!.toFixed(2)) : null,
      avgPunctuality: t.punctuality.length ? Number(avg(t.punctuality)!.toFixed(2)) : null,
      avgClarity: t.clarity.length ? Number(avg(t.clarity)!.toFixed(2)) : null,
      rebookRate: t.rebookVotes ? Math.round((t.rebook / t.rebookVotes) * 100) : null,
      reviews: t.ratings.length,
      revenue: Math.round(t.revenue),
      topTest: Object.entries(t.mix).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.tests - a.tests);

  const idleTechnicians = technicians
    .filter((t) => !perTech.has(t.id))
    .map((t) => ({ id: t.id, name: t.full_name, org: t.org, area: t.area, types: t.test_types, active: t.active }));

  const hotspots = [...areaMap.values()]
    .map((a) => ({
      ...a,
      revenue: Math.round(a.revenue),
      completionRate: a.tests ? Math.round((a.completed / a.tests) * 100) : 0,
      perDay: Number((a.tests / days).toFixed(2)),
    }))
    .sort((a, b) => b.tests - a.tests);

  const completed = tests.filter((t) => t.status === "completed").length;
  const noShows = tests.filter((t) => t.status === "no_show" || t.no_show).length;
  const cancelled = tests.filter((t) => t.status === "cancelled").length;

  const recentFeedback = [...feedback]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((f) => ({
      id: f.id,
      technician: f.technician_id ? techById.get(f.technician_id)?.full_name ?? "Technician" : "Technician",
      rating: f.rating,
      punctuality: f.punctuality,
      professionalism: f.professionalism,
      reportClarity: f.report_clarity,
      wouldRebook: f.would_rebook,
      comment: f.comment,
      createdAt: f.created_at,
    }));

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    testLabels: TEST_LABEL,
    scope: { isAdmin: scope.isAdmin, isSuper: scope.isSuper, technicianName: scope.technicianName },
    today,
    totals: {
      tests: tests.length,
      completed,
      noShows,
      cancelled,
      completionRate: tests.length ? Math.round((completed / tests.length) * 100) : 0,
      noShowRate: tests.length ? Math.round((noShows / tests.length) * 100) : 0,
      revenue: Math.round(revenue),
      pendingPayments: Math.round(pendingPayments),
      missingReports,
      technicians: technicians.length,
      activeTechnicians: technicians.filter((t) => t.active).length,
      homeVisits: tests.filter((t) => t.home_visit).length,
      urgent: tests.filter((t) => t.urgency === "urgent").length,
      testMix,
      statusMix,
    },
    board: board.slice(0, 40),
    hotspots,
    technicians: technicianRows,
    idleTechnicians,
    roster: technicians.map((t) => ({
      id: t.id,
      name: t.full_name,
      org: t.org,
      area: t.area,
      types: t.test_types,
      active: t.active,
      phone: t.phone,
    })),
    feedback: {
      count: feedback.length,
      avgRating: feedback.length ? Number(avg(feedback.map((f) => f.rating))!.toFixed(2)) : null,
      recent: recentFeedback,
    },
  };
}

export type TechnicianAdminOverview = Awaited<ReturnType<typeof buildOverview>>;

export const getTechnicianAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => ({
    days: Math.min(Math.max(Number(d?.days ?? 30), 1), 365),
  }))
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context as any);
    return buildOverview(data.days, scope);
  });

/** Admin: assign (or reassign) a technician to a test booking. */
export const assignTechnicianToTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string; technicianId: string | null }) => ({
    testId: String(d.testId),
    technicianId: d.technicianId ? String(d.technicianId) : null,
  }))
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context as any);
    if (!scope.isAdmin) throw new Error("Forbidden: admin only");
    const sb = await admin();
    const { error } = await sb
      .from("technician_tests")
      .update({
        technician_id: data.technicianId,
        status: data.technicianId ? "assigned" : "requested",
      })
      .eq("id", data.testId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin or the assigned technician: move a test along its lifecycle. */
export const setTechnicianTestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string; status: string; findings?: string | null }) => ({
    testId: String(d.testId),
    status: String(d.status),
    findings: d.findings == null ? null : String(d.findings),
  }))
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context as any);
    const allowed = ["assigned", "en_route", "in_progress", "completed", "cancelled", "no_show"];
    if (!allowed.includes(data.status)) throw new Error("Unknown status");

    const sb = await admin();
    const { data: row, error: rErr } = await sb
      .from("technician_tests")
      .select("id, technician_id")
      .eq("id", data.testId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) throw new Error("Test not found");
    if (!scope.isAdmin && row.technician_id !== scope.technicianId) {
      throw new Error("Forbidden: this test is not assigned to you");
    }

    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "in_progress") patch["checked_in_at"] = nowIso;
    if (data.status === "completed") patch["completed_at"] = nowIso;
    if (data.status === "cancelled") patch["cancelled_at"] = nowIso;
    if (data.status === "no_show") patch["no_show"] = true;
    if (data.findings != null && data.findings.trim()) patch["findings"] = data.findings.trim();

    const { error } = await sb.from("technician_tests").update(patch).eq("id", data.testId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
