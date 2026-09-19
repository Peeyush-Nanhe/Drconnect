/**
 * Real numbers for the ambulance header (replaces the old fixed "12 trips · 4 min · ₹9,200").
 * Reads only this crew's own emergency cases.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/features/mydox/backend";

const db = supabase as unknown as { from: (table: string) => any };

export interface CrewStats {
  tripsToday: number;
  completedToday: number;
  /** Average minutes from accepting a case to reaching the patient (last 30 days). */
  avgResponseMin: number | null;
}

export function useCrewStats(refreshMs = 30_000): CrewStats | null {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [stats, setStats] = useState<CrewStats | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = async () => {
      const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data } = await db
        .from("emergency_cases")
        .select("created_at, status, ambulance_accepted_at, ambulance_arrived_at")
        .eq("ambulance_id", userId)
        .gte("created_at", since30);
      if (!alive) return;
      const rows: Array<{ created_at: string; status: string; ambulance_accepted_at: string | null; ambulance_arrived_at: string | null }> = data ?? [];
      const today = new Date().toDateString();
      const todays = rows.filter((r) => new Date(r.created_at).toDateString() === today);
      const responses = rows
        .filter((r) => r.ambulance_accepted_at && r.ambulance_arrived_at)
        .map((r) => (Date.parse(r.ambulance_arrived_at!) - Date.parse(r.ambulance_accepted_at!)) / 60_000)
        .filter((m) => m > 0 && m < 240);
      setStats({
        tripsToday: todays.length,
        completedToday: todays.filter((r) => ["handed_over", "admitted", "closed"].includes(r.status)).length,
        avgResponseMin: responses.length ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length) : null,
      });
    };
    void load();
    const t = setInterval(load, refreshMs);
    return () => { alive = false; clearInterval(t); };
  }, [userId, refreshMs]);

  return stats;
}
