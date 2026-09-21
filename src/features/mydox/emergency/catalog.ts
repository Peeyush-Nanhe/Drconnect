import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EmergencyCategory } from "./types";

/**
 * The emergency catalog lives in the database
 * (public.emergency_category_catalog + public.emergency_triage_questions), not
 * in this bundle. A clinical change — a reworded question, a new red-flag
 * answer, a category switched off — takes effect without an app release.
 */

export interface TriageQuestion {
  q: string;
  opts: string[];
  /** Answers that should push the case to the front of a responder queue. */
  red?: string[];
}

export interface EmergencyCategoryDef {
  id: EmergencyCategory;
  label: string;
  emoji: string;
  /** Shown under the chosen category so the patient knows where they are going. */
  routing: string;
  team: string;
  triage: TriageQuestion[];
}

interface CategoryRow {
  category: EmergencyCategory;
  label: string;
  emoji: string;
  routing: string;
  team: string;
  sort_order: number;
}

interface QuestionRow {
  category: EmergencyCategory;
  prompt: string;
  options: string[];
  red_flags: string[] | null;
  sort_order: number;
}

// The generated Database type has not been regenerated since these tables were
// added, so they are read through a loose handle rather than weakening the
// typed client the rest of the app uses.
type LooseClient = { from: (table: string) => any };
const db = supabase as unknown as LooseClient;

/**
 * One fetch per session, shared by the patient wizard and the hospital, doctor
 * and ambulance screens. A failed load is not cached, so a retry re-fetches.
 */
let inflight: Promise<EmergencyCategoryDef[]> | null = null;
let cache: EmergencyCategoryDef[] | null = null;

async function loadCatalog(): Promise<EmergencyCategoryDef[]> {
  const [categories, questions] = await Promise.all([
    db
      .from("emergency_category_catalog")
      .select("category, label, emoji, routing, team, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    db
      .from("emergency_triage_questions")
      .select("category, prompt, options, red_flags, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (categories.error) throw new Error(catalogError(categories.error));
  if (questions.error) throw new Error(catalogError(questions.error));

  const rows = (categories.data ?? []) as CategoryRow[];
  const triage = (questions.data ?? []) as QuestionRow[];
  if (!rows.length) {
    throw new Error("No emergency categories are configured. Call 108 for urgent help.");
  }

  return rows.map((row) => ({
    id: row.category,
    label: row.label,
    emoji: row.emoji,
    routing: row.routing,
    team: row.team,
    triage: triage
      .filter((q) => q.category === row.category)
      .map((q) => ({ q: q.prompt, opts: q.options ?? [], red: q.red_flags ?? [] })),
  }));
}

function catalogError(error: { code?: string; message?: string }): string {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return "Emergency catalog tables are missing on this database. Apply the emergency catalog migration. Call 108 for urgent help.";
  }
  return error.message || "Could not load the emergency options. Call 108 for urgent help.";
}

export function fetchEmergencyCatalog(force = false): Promise<EmergencyCategoryDef[]> {
  if (!force && cache) return Promise.resolve(cache);
  if (force) {
    cache = null;
    inflight = null;
  }
  if (!inflight) {
    inflight = loadCatalog()
      .then((loaded) => {
        cache = loaded;
        return loaded;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Warm the cache as soon as any emergency screen is imported. */
export function prefetchEmergencyCatalog(): void {
  if (!cache && !inflight) void fetchEmergencyCatalog().catch(() => { });
}

export interface EmergencyCatalogState {
  catalog: EmergencyCategoryDef[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useEmergencyCatalog(): EmergencyCatalogState {
  const [catalog, setCatalog] = useState<EmergencyCategoryDef[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (cache && attempt === 0) {
      setCatalog(cache);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEmergencyCatalog(attempt > 0)
      .then((loaded) => {
        if (cancelled) return;
        setCatalog(loaded);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setCatalog([]);
        setError(e instanceof Error ? e.message : "Could not load the emergency options. Call 108 for urgent help.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { catalog, loading, error, reload: () => setAttempt((n) => n + 1) };
}

export function categoryDef(
  catalog: EmergencyCategoryDef[],
  id: string | null | undefined,
): EmergencyCategoryDef | null {
  return catalog.find((c) => c.id === id) ?? null;
}

/**
 * True when any answer was flagged red, used to sort responder queues. The same
 * rule exists in SQL as public.emergency_case_has_red_flag, so a queue can sort
 * on it server-side instead of trusting a client-sent flag.
 */
export function hasRedFlag(
  catalog: EmergencyCategoryDef[],
  category: string | null | undefined,
  answers: { q: string; a: string }[],
): boolean {
  const def = categoryDef(catalog, category);
  if (!def) return false;
  return def.triage.some((question) =>
    (question.red ?? []).some((flag) =>
      answers.some((answer) => answer.q === question.q && answer.a === flag),
    ),
  );
}
