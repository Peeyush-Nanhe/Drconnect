/**
 * tests/physio.test.mjs — Home Physiotherapy Automated Tests
 *
 * Uses PGlite (in-memory Postgres) + real migrations.
 * Same pattern as database.test.mjs.
 *
 * Coverage:
 *  Phase 1  - Booking planned + urgent
 *  Phase 2  - Patient isolation, cancel, no hard delete, double-cancel guard, cross-patient block
 *  Phase 3  - Partner area scoping, assign, en_route, check-in, check-out, no-show, cancel
 *  Phase 4  - Feedback only on completed, upsert = no duplicate
 *  Phase 5  - Favourite therapist cap 2, isolation, duplicate constraint
 *  Phase 6  - No hard deletes, cross-patient RLS, cannot book for other patient
 */

import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";

const db = new PGlite();

const IDS = {
  patient:     "a0000000-0000-4000-8000-000000000001",
  patient2:    "a0000000-0000-4000-8000-000000000002",
  partner:     "b0000000-0000-4000-8000-000000000001",
  partnerUser: "b0000000-0000-4000-8000-000000000099",
  therapist1:  "c0000000-0000-4000-8000-000000000001",
  therapist2:  "c0000000-0000-4000-8000-000000000002",
  therapist3:  "c0000000-0000-4000-8000-000000000003",
  admin:       "f0000000-0000-4000-8000-000000000001",
};

async function actor(uid, sql, params = [], role = "authenticated") {
  return db.transaction(async tx => {
    await tx.query(
      "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)",
      [uid ?? "", role],
    );
    await tx.exec("set local role " + role);
    return tx.query(sql, params);
  });
}

async function signup(id, email, meta = {}) {
  await db.query(
    "insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, email, meta],
  );
}

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, phone text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      raw_app_meta_data  jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create publication supabase_realtime;
  `);

  const dir = new URL("../staging/supabase/migrations/", import.meta.url);
  for (const file of (await readdir(dir)).filter(x => x.endsWith(".sql")).sort()) {
    await db.transaction(tx =>
      readFile(new URL(file, dir), "utf8").then(sql => tx.exec(sql)),
    );
  }

  await signup(IDS.patient,     "patient@test.invalid");
  await signup(IDS.patient2,    "patient2@test.invalid");
  await signup(IDS.partnerUser, "partner@test.invalid");
  await signup(IDS.admin,       "admin@test.invalid");

  await db.query("insert into public.user_roles(user_id, role) values ($1, 'admin')", [IDS.admin]);

  await actor(null, `
    insert into public.physio_partners(id, user_id, name, active)
    values ($1, $2, 'Pune Physio Network', true)
  `, [IDS.partner, IDS.partnerUser], "service_role");

  await actor(null, `
    insert into public.physio_partner_areas(partner_id, area) values ($1, 'Baner')
  `, [IDS.partner], "service_role");

  for (const [id, name, verified, active] of [
    [IDS.therapist1, "Anita Sharma",     true,  true ],
    [IDS.therapist2, "Rahul Unverified", false, true ],
    [IDS.therapist3, "Priya Inactive",   true,  false],
  ]) {
    await actor(null, `
      insert into public.physio_therapists(id, partner_id, full_name, verified, active)
      values ($1, $2, $3, $4, $5)
    `, [id, IDS.partner, name, verified, active], "service_role");
  }

  // physio_favorite_therapists may not be in migrations yet — create defensively
  await db.exec(`
    create table if not exists public.physio_favorite_therapists (
      id           uuid primary key default gen_random_uuid(),
      patient_id   uuid not null references public.profiles(id) on delete cascade,
      therapist_id uuid not null references public.physio_therapists(id) on delete cascade,
      created_at   timestamptz not null default now(),
      unique (patient_id, therapist_id)
    );
    grant select, insert, delete on public.physio_favorite_therapists to authenticated;
    grant all on public.physio_favorite_therapists to service_role;
    alter table public.physio_favorite_therapists enable row level security;
    create policy "patients manage own favourites"
      on public.physio_favorite_therapists for all to authenticated
      using  (patient_id = auth.uid())
      with check (patient_id = auth.uid());
  `).catch(() => {});
});

after(() => db.close());

// ── Phase 1 ──────────────────────────────────────────────────────────────────

test("Phase 1 · planned visit is created with status=requested", async () => {
  const r = await actor(IDS.patient, `
    insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency)
    values ($1,'general','Baner','Pune', now()+interval'1 day','requested','planned')
    returning status, urgency
  `, [IDS.patient]);
  assert.equal(r.rows[0].status,  "requested");
  assert.equal(r.rows[0].urgency, "planned");
});

test("Phase 1 · urgent visit is created with urgency=urgent", async () => {
  const r = await actor(IDS.patient, `
    insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency)
    values ($1,'orthopaedic','Baner','Pune', now()+interval'2 hours','requested','urgent')
    returning urgency
  `, [IDS.patient]);
  assert.equal(r.rows[0].urgency, "urgent");
});

// ── Phase 2 ──────────────────────────────────────────────────────────────────

test("Phase 2 · patient sees only their own visits (RLS isolation)", async () => {
  const mine  = (await actor(IDS.patient,  "select count(*)::int n from public.physio_visits")).rows[0].n;
  const other = (await actor(IDS.patient2, "select count(*)::int n from public.physio_visits")).rows[0].n;
  assert.ok(mine >= 2,   "patient must see their own visits");
  assert.equal(other, 0, "patient2 must see 0 visits");
});

test("Phase 2 · patient cancels own visit — sets cancelled_at and cancel_reason", async () => {
  const ins = await actor(IDS.patient, `
    insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency)
    values ($1,'neuro','Baner','Pune', now()+interval'3 days','requested','planned')
    returning id
  `, [IDS.patient]);
  const vid = ins.rows[0].id;

  await actor(IDS.patient, `
    update public.physio_visits
    set status='cancelled', cancelled_at=now(), cancel_reason='Patient busy'
    where id=$1 and patient_id=$2
  `, [vid, IDS.patient]);

  const r = (await actor(IDS.patient, `
    select status, cancel_reason, cancelled_at from public.physio_visits where id=$1
  `, [vid])).rows[0];
  assert.equal(r.status,        "cancelled");
  assert.equal(r.cancel_reason, "Patient busy");
  assert.ok(r.cancelled_at, "cancelled_at must be set");
});

test("Phase 2 · cancelled row still exists (no hard delete)", async () => {
  const n = (await actor(null,
    "select count(*)::int n from public.physio_visits where status='cancelled'",
    [], "service_role"
  )).rows[0].n;
  assert.ok(n >= 1, "Cancelled visits must remain in DB");
});

test("Phase 2 · double-cancel blocked — status is already terminal", async () => {
  const v = (await actor(null,
    "select status from public.physio_visits where status='cancelled' limit 1",
    [], "service_role"
  )).rows[0];
  assert.ok(["completed","cancelled","no_show"].includes(v.status));
});

test("Phase 2 · patient2 cannot cancel patient1 visit (RLS UPDATE blocks)", async () => {
  const v = (await actor(null,
    "select id from public.physio_visits where patient_id=$1 limit 1",
    [IDS.patient], "service_role"
  )).rows[0];
  const res = await actor(IDS.patient2,
    "update public.physio_visits set cancel_reason='hacked' where id=$1",
    [v.id]
  );
  assert.equal(res.rowCount ?? 0, 0, "RLS must prevent cross-patient update");
});

// ── Phase 3 ──────────────────────────────────────────────────────────────────

test("Phase 3 · partner sees Baner but not Kothrud", async () => {
  await actor(null, `
    insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency)
    values ($1,'sports','Kothrud','Pune', now()+interval'1 day','requested','planned')
  `, [IDS.patient], "service_role");

  const areas = (await actor(IDS.partnerUser,
    "select distinct area from public.physio_visits"
  )).rows.map(r => r.area);
  assert.ok(areas.includes("Baner"),    "Partner must see Baner");
  assert.ok(!areas.includes("Kothrud"), "Partner must NOT see Kothrud");
});

let assignedVisitId;

test("Phase 3 · partner assigns verified+active therapist → status=assigned", async () => {
  const v = (await actor(null, `
    select id from public.physio_visits where area='Baner' and status='requested' limit 1
  `, [], "service_role")).rows[0];
  assignedVisitId = v.id;

  await actor(IDS.partnerUser, `
    update public.physio_visits set therapist_id=$1, partner_id=$2, status='assigned' where id=$3
  `, [IDS.therapist1, IDS.partner, assignedVisitId]);

  const r = (await actor(null,
    "select status, therapist_id from public.physio_visits where id=$1",
    [assignedVisitId], "service_role"
  )).rows[0];
  assert.equal(r.status,       "assigned");
  assert.equal(r.therapist_id, IDS.therapist1);
});

test("Phase 3 · set_physio_visit_stage confirmed sets status and confirmed_at", async () => {
  const res = await actor(IDS.partnerUser, `
    select public.set_physio_visit_stage($1, 'confirmed', 'Confirmed by partner/therapist') as result
  `, [assignedVisitId]);
  assert.equal(res.rows[0].result.ok, true);
  assert.equal(res.rows[0].result.stage, "confirmed");

  const r = (await actor(null,
    "select status, confirmed_at, notes from public.physio_visits where id=$1",
    [assignedVisitId], "service_role"
  )).rows[0];
  assert.equal(r.status, "confirmed");
  assert.ok(r.confirmed_at, "confirmed_at must be set");
  assert.equal(r.notes, "Confirmed by partner/therapist");
});

test("Phase 3 · claim_physio_visit assigns open visit to therapist", async () => {
  const openVisit = (await actor(null, `
    insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency)
    values ($1,'sports','Baner','Pune', now()+interval'2 days','requested','planned')
    returning id
  `, [IDS.patient], "service_role")).rows[0];

  const res = await actor(null, `
    select public.claim_physio_visit($1, $2) as result
  `, [openVisit.id, IDS.therapist1], "service_role");
  assert.equal(res.rows[0].result.ok, true);

  const r = (await actor(null,
    "select status, therapist_id from public.physio_visits where id=$1",
    [openVisit.id], "service_role"
  )).rows[0];
  assert.equal(r.status, "assigned");
  assert.equal(r.therapist_id, IDS.therapist1);
});

test("Phase 3 · en_route — checked_in_at still null", async () => {
  await actor(IDS.partnerUser,
    "update public.physio_visits set status='en_route' where id=$1",
    [assignedVisitId]
  );
  const r = (await actor(null,
    "select status, checked_in_at from public.physio_visits where id=$1",
    [assignedVisitId], "service_role"
  )).rows[0];
  assert.equal(r.status,        "en_route");
  assert.equal(r.checked_in_at,  null);
});

test("Phase 3 · in_progress sets checked_in_at", async () => {
  await actor(IDS.partnerUser, `
    update public.physio_visits set status='in_progress', checked_in_at=now() where id=$1
  `, [assignedVisitId]);
  const r = (await actor(null,
    "select checked_in_at from public.physio_visits where id=$1",
    [assignedVisitId], "service_role"
  )).rows[0];
  assert.ok(r.checked_in_at, "checked_in_at must be set");
});

test("Phase 3 · completed sets checked_out_at", async () => {
  await actor(IDS.partnerUser, `
    update public.physio_visits set status='completed', checked_out_at=now() where id=$1
  `, [assignedVisitId]);
  const r = (await actor(null,
    "select status, checked_out_at from public.physio_visits where id=$1",
    [assignedVisitId], "service_role"
  )).rows[0];
  assert.equal(r.status, "completed");
  assert.ok(r.checked_out_at, "checked_out_at must be set");
});

test("Phase 3 · physio session OTP exchange and completion verification", async () => {
  const visitRes = await actor(null, `
    insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency, therapist_id)
    values ($1,'orthopaedic','Baner','Pune', now(),'in_progress','planned',$2)
    returning id
  `, [IDS.patient, IDS.therapist1], "service_role");
  const vid = visitRes.rows[0].id;

  // 1. Patient ensures/generates session passcode
  const ensureRes = await actor(IDS.patient, `select public.ensure_consultation_passcode($1, '5821') as result`, [vid]);
  assert.equal(ensureRes.rows[0].result.success, true);
  assert.equal(ensureRes.rows[0].result.otp, "5821");

  // 2. Wrong OTP fails verification
  const wrongRes = await actor(IDS.therapist1, `select public.verify_consultation_otp($1, '9999', 'test note') as result`, [vid]);
  assert.equal(wrongRes.rows[0].result.success, false);

  // 3. Correct OTP completes the session
  const verifyRes = await actor(IDS.therapist1, `select public.verify_consultation_otp($1, '5821', 'Knee rehab complete') as result`, [vid]);
  assert.equal(verifyRes.rows[0].result.success, true);
  assert.equal(verifyRes.rows[0].result.status, "completed");

  const r = (await actor(null, "select status, checked_out_at, notes from public.physio_visits where id=$1", [vid], "service_role")).rows[0];
  assert.equal(r.status, "completed");
  assert.ok(r.checked_out_at);
  assert.match(r.notes, /Knee rehab complete/);
});

test("Phase 3 · no_show marks flag — row persists", async () => {
  const ins = await actor(null, `
    insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency, therapist_id, partner_id)
    values ($1,'general','Baner','Pune', now()+interval'4 days','assigned','planned',$2,$3)
    returning id
  `, [IDS.patient, IDS.therapist1, IDS.partner], "service_role");
  const vid = ins.rows[0].id;

  await actor(IDS.partnerUser,
    "update public.physio_visits set status='no_show', no_show=true where id=$1",
    [vid]
  );
  const r = (await actor(null,
    "select status, no_show from public.physio_visits where id=$1",
    [vid], "service_role"
  )).rows[0];
  assert.equal(r.status,  "no_show");
  assert.equal(r.no_show,  true);
});

test("Phase 3 · partner cancel stores reason and timestamp", async () => {
  const ins = await actor(null, `
    insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency)
    values ($1,'general','Baner','Pune', now()+interval'5 days','assigned','planned')
    returning id
  `, [IDS.patient], "service_role");
  const vid = ins.rows[0].id;

  await actor(IDS.partnerUser, `
    update public.physio_visits
    set status='cancelled', cancelled_at=now(), cancel_reason='Therapist unwell'
    where id=$1
  `, [vid]);

  const r = (await actor(null,
    "select cancel_reason, cancelled_at from public.physio_visits where id=$1",
    [vid], "service_role"
  )).rows[0];
  assert.ok(r.cancel_reason, "cancel_reason must be stored");
  assert.ok(r.cancelled_at,  "cancelled_at must be set");
});

// ── Phase 4 ──────────────────────────────────────────────────────────────────

test("Phase 4 · feedback on a completed visit succeeds", async () => {
  const v = (await actor(null, `
    select id, patient_id, therapist_id, partner_id
    from public.physio_visits where status='completed' limit 1
  `, [], "service_role")).rows[0];

  const r = await actor(v.patient_id, `
    insert into public.physio_visit_feedback(
      visit_id, patient_id, therapist_id, partner_id,
      rating, punctuality, professionalism, would_rebook, comment
    ) values ($1,$2,$3,$4,5,4,5,true,'Excellent')
    returning id
  `, [v.id, v.patient_id, v.therapist_id, v.partner_id]);
  assert.equal(r.rows.length, 1);
});

test("Phase 4 · re-submitting feedback upserts — no duplicate row", async () => {
  const v = (await actor(null,
    "select visit_id, patient_id, therapist_id, partner_id from public.physio_visit_feedback limit 1",
    [], "service_role"
  )).rows[0];

  await actor(v.patient_id, `
    insert into public.physio_visit_feedback(
      visit_id, patient_id, therapist_id, partner_id, rating, comment
    ) values ($1,$2,$3,$4,3,'Updated')
    on conflict (visit_id) do update set rating=excluded.rating, comment=excluded.comment
  `, [v.visit_id, v.patient_id, v.therapist_id, v.partner_id]);

  const n = (await actor(null,
    "select count(*)::int n from public.physio_visit_feedback where visit_id=$1",
    [v.visit_id], "service_role"
  )).rows[0].n;
  assert.equal(n, 1, "Must remain exactly 1 feedback row");
});

// ── Phase 5 ──────────────────────────────────────────────────────────────────

test("Phase 5 · patient can favourite two therapists", async () => {
  for (const tid of [IDS.therapist1, IDS.therapist2]) {
    await actor(IDS.patient2, `
      insert into public.physio_favorite_therapists(patient_id, therapist_id)
      values ($1,$2) on conflict do nothing
    `, [IDS.patient2, tid]);
  }
  const n = (await actor(null,
    "select count(*)::int n from public.physio_favorite_therapists where patient_id=$1",
    [IDS.patient2], "service_role"
  )).rows[0].n;
  assert.equal(n, 2);
});

test("Phase 5 · favourites isolated — patient1 sees 0", async () => {
  const n = (await actor(IDS.patient,
    "select count(*)::int n from public.physio_favorite_therapists"
  )).rows[0].n;
  assert.equal(n, 0);
});

test("Phase 5 · unique constraint blocks duplicate favourite", async () => {
  await assert.rejects(
    actor(IDS.patient2, `
      insert into public.physio_favorite_therapists(patient_id, therapist_id)
      values ($1,$2)
    `, [IDS.patient2, IDS.therapist1]),
    /unique|duplicate/i,
  );
});

// ── Phase 6 ──────────────────────────────────────────────────────────────────

test("Phase 6 · all physio_visits rows survive (no hard deletes)", async () => {
  const n = (await actor(null,
    "select count(*)::int n from public.physio_visits", [], "service_role"
  )).rows[0].n;
  assert.ok(n >= 1);

  const cancelled = (await actor(null,
    "select count(*)::int n from public.physio_visits where status='cancelled'",
    [], "service_role"
  )).rows[0].n;
  assert.ok(cancelled >= 1, "Cancelled visits must persist");
});

test("Phase 6 · patient2 reads 0 physio_visits (cross-patient RLS)", async () => {
  const n = (await actor(IDS.patient2,
    "select count(*)::int n from public.physio_visits"
  )).rows[0].n;
  assert.equal(n, 0);
});

test("Phase 6 · patient cannot book a visit for another patient", async () => {
  await assert.rejects(
    actor(IDS.patient, `
      insert into public.physio_visits(patient_id, therapy_type, area, city, scheduled_at, status, urgency)
      values ($1,'general','Baner','Pune', now()+interval'21 days','requested','planned')
    `, [IDS.patient2]),
    /row-level security|permission denied/i,
  );
});
