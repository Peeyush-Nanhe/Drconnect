import { supabase } from "@/integrations/supabase/client";

export type HomeVisitContext = {
  enabled: boolean;
  participant: boolean;
  consent_version: string;
  consent_text?: string;
  terms?: string;
  reason?: string;
  pay_at_visit_enabled: boolean;
  online_payment_enabled: boolean;
  dependent_booking_enabled: boolean;
};
export type HomeAddress = { full_address: string; locality: string; pincode: string; phone: string; landmark: string; reason: string };
export type HomeProvider = {
  provider_id: string; name: string; fee: number; currency: string; timezone: string;
  duration_minutes: number; buffer_before_minutes: number; buffer_after_minutes: number;
  slots: { start_time: string; end_time: string }[];
};
export type HomeQuote = {
  quote_id: string; provider_id: string | null; routing: "named" | "pool"; fee: number; total: number;
  currency: string; breakdown: Record<string, unknown> | { label?: string; amount?: number }[];
  payment_method: string; start_time: string; end_time: string; expires_at: string; candidate_count: number;
};
export type HomeVisit = {
  id: string; booking_id?: string; version: number; status: string; home_visit_status?: string;
  provider_id: string | null; patient_id: string; booker_id?: string; actor_id?: string; provider_name?: string;
  fee: number; currency: string; start_time: string; end_time: string; provider_timezone: string;
  address_snapshot?: Partial<HomeAddress>; eta_minutes?: number | null; en_route_at?: string | null;
  arrived_at?: string | null; doctor_arrived_at?: string | null; acceptance_deadline?: string; pending_deadline?: string;
  clinical_notes?: { summary?: string; follow_up?: string; signed_at?: string; amendments?: { summary?: string; follow_up?: string; reason?: string; amended_at?: string }[] } | null;
  payment_settlement?: { status?: string; method?: string; amount?: number; currency?: string; recorded_at?: string; reference?: string; receipt_id?: string } | null;
  reschedule?: { status?: string; start_time?: string; new_start_time?: string; expires_at?: string } | null;
  allowed_actions?: string[];
  disputes?: { id: string; actor_id: string; reason: string; opened_at: string; status: string }[];
  events?: { kind: string; reason?: string; created_at: string; version: number }[];
};
export type HomeProviderSettings = {
  enabled: boolean; coverage_pincodes: string[]; fee: number; currency: string; duration_minutes: number;
  buffer_before_minutes: number; buffer_after_minutes: number; lead_minutes: number; horizon_days: number;
  acceptance_minutes: number; timezone: string;
};
export type HomeAction = { booking_id: string; action: string; expected_version: number; [key: string]: unknown };
type RpcResult = { data: unknown; error: { message: string; code?: string } | null };
export class HomeVisitRpcError extends Error {
  readonly transactionRejected: boolean;
  constructor(message: string, readonly code?: string) {
    super(message);
    this.transactionRejected = !!code && /^(?:[A-Z0-9]{5}|PGRST\d+)$/.test(code) && !code.startsWith("08");
  }
}

// All mutations go through business RPCs. There is deliberately no table-write fallback.
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result: RpcResult = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<RpcResult>)(name, args);
  if (result.error) {
    if (["PGRST202", "42883"].includes(result.error.code || "")) throw new HomeVisitRpcError("Doctor home visits are not available on this server yet. Please try again later.", result.error.code);
    throw new HomeVisitRpcError(result.error.message, result.error.code);
  }
  const response = result.data as { ok?: boolean; error?: string } | null;
  if (response?.ok === false) throw new Error(response.error || "The action was not accepted. Refresh and retry.");
  return result.data as T;
}

export const homeVisits = {
  context: () => rpc<HomeVisitContext>("hv_context"),
  settings: () => rpc<HomeProviderSettings | null>("hv_provider_settings"),
  saveSettings: (settings: HomeProviderSettings) => rpc<HomeProviderSettings>("hv_save_provider_settings", { p_settings: settings }),
  discover: (query: { pincode: string; is_now: boolean; date?: string }) => rpc<HomeProvider[]>("hv_discover", { p_query: query }),
  quote: (input: { provider_id?: string | null; routing: "named" | "pool"; is_now: boolean; pincode: string; start_time?: string; booking_id?: string }) => rpc<HomeQuote>("hv_quote", { p_input: input }),
  create: (input: { quote_id: string; idempotency_key: string; address: HomeAddress; consent_version: string; consent: boolean; dependent_id?: string | null }) => rpc<HomeVisit>("hv_create", { p_input: input }),
  recover: (key: string) => rpc<HomeVisit | null>("hv_recover", { p_key: key }),
  list: () => rpc<HomeVisit[]>("hv_list"),
  action: (input: HomeAction) => rpc<HomeVisit>("hv_action", { p_input: input }),
  arrivalCode: (id: string) => rpc<{ code: string; expires_at: string }>("hv_arrival_code", { p_booking_id: id }),
  verifyArrival: (input: { booking_id: string; code: string; expected_version: number }) => rpc<HomeVisit>("hv_verify_arrival", { p_input: input }),
  operations: () => rpc<Record<string, unknown>[]>("hv_operations"),
};

export function homeVisitError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to reach the home-visit service. Your form is still available; please retry.";
}

// This is the only home-visit value kept on the device: no address, clinical data, code or quote.
export function readRecoveryReference(actorId: string): string | null {
  return window.localStorage.getItem(`mydox:home-visit:recovery:${actorId}`);
}
export function recoveryReference(actorId: string): string {
  const existing = readRecoveryReference(actorId);
  if (existing) return existing;
  const key = crypto.randomUUID();
  window.localStorage.setItem(`mydox:home-visit:recovery:${actorId}`, key);
  return key;
}
export function clearRecoveryReference(actorId: string) {
  window.localStorage.removeItem(`mydox:home-visit:recovery:${actorId}`);
}
