import { supabase } from "@/integrations/supabase/client";
import type { ChatReference, WireMessage, WireSummary } from "./types";
import { referenceInput } from "./state";

export class ChatError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };
const unavailableRpcs = new Set<string>();

async function rpc<T>(name: string, input?: Record<string, unknown>): Promise<T> {
  if (unavailableRpcs.has(name)) {
    throw new ChatError("Post-consultation chat is not available on this server yet.", "PGRST202");
  }
  const result = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcResult>)(name, input ? { p_input: input } : {});
  if (result.error) {
    const unavailable = ["PGRST202", "42883"].includes(result.error.code ?? "");
    if (unavailable) {
      unavailableRpcs.add(name);
    }
    throw new ChatError(unavailable ? "Post-consultation chat is not available on this server yet." : result.error.message, result.error.code);
  }
  return result.data as T;
}
export const chatApi = {
  open: (reference: ChatReference) => rpc<WireSummary>("pc_chat_open", referenceInput(reference)),
  inbox: () => rpc<WireSummary[]>("pc_chat_inbox"),
  history: (conversationId: string, before?: number) => rpc<{ messages: WireMessage[]; next_before_sequence: number | null }>("pc_chat_history", {
    conversation_id: conversationId, limit: 50, ...(before == null ? {} : { before_sequence: before }),
  }),
  send: (input: { conversation_id: string; episode_id: string; body: string; idempotency_key: string }) => rpc<WireMessage>("pc_chat_send", input),
  read: (conversationId: string, throughSequence: number) => rpc<{ last_read_sequence: number }>("pc_chat_ack_read", { conversation_id: conversationId, through_sequence: throughSequence }),
  prescription: (input: Record<string, unknown>) => rpc<unknown>("pc_chat_prescription", input),
};
export function chatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to reach chat. Your message is still pending; retry when connected.";
}
export function accessRejected(error: unknown): boolean {
  return error instanceof ChatError && ["42501", "P0002", "PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? "");
}
