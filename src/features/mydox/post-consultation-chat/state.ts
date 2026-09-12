import type { ChatDetails, ChatInboxItem, ChatMessage, ChatReference, WireMessage, WireSummary } from "./types.ts";

export function referenceInput(reference: ChatReference): Record<string, string> {
  return "source" in reference
    ? { source_kind: reference.source, source_id: reference.sourceId }
    : { conversation_id: reference.conversationId, ...(reference.episodeId ? { episode_id: reference.episodeId } : {}) };
}

export function chatDetails(row: WireSummary): ChatDetails {
  return {
    conversationId: row.conversation_id, episodeId: row.episode_id, actorId: row.actor_id,
    counterpartId: row.other_id, counterpartName: row.other_name, counterpartRole: row.other_role,
    memberRole: row.member_role, consultationLabel: row.consultation_label, completedAt: row.completed_at,
    policyVersion: row.policy_version, testOnly: row.test_only,
    patientMessagesRemaining: row.patient_messages_remaining, patientMessagesLimit: row.patient_messages_limit,
    patientSendUntil: row.patient_send_until, canSend: row.can_send, sendDisabledReason: row.send_disabled_reason,
    episodes: (row.episodes ?? []).map(e => ({ episodeId: e.episode_id, consultationLabel: e.consultation_label, completedAt: e.completed_at })),
    prescriptionRequests: (row.prescription_requests ?? []).map(r => ({ id: r.id, episodeId: r.episode_id, status: r.status, requestedAt: r.requested_at, declineReason: r.decline_reason })),
  };
}

export function inboxItem(row: WireSummary): ChatInboxItem {
  return { conversationId: row.conversation_id, episodeId: row.episode_id, counterpartId: row.other_id,
    counterpartName: row.other_name, counterpartRole: row.other_role, consultationLabel: row.consultation_label,
    lastMessage: row.last_body, lastMessageAt: row.last_at, unreadCount: row.unread_count };
}

export function savedMessage(row: WireMessage, actorId: string): ChatMessage {
  return { id: row.id, conversationId: row.conversation_id, episodeId: row.episode_id,
    senderId: row.sender_id, senderRole: row.sender_role, body: row.body, createdAt: row.created_at,
    sequence: Number(row.sequence_id), idempotencyKey: row.idempotency_key,
    isOwn: row.sender_id === actorId, status: "saved" };
}

// A saved row replaces the uncertain outgoing operation by actor + key, even
// when the response was lost. Order comes from the server sequence, never clock time.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const rows = new Map(current.map(m => [m.id, m]));
  for (const message of incoming) {
    for (const [id, pending] of rows) {
      if (pending.status !== "saved" && pending.senderId === message.senderId && pending.idempotencyKey === message.idempotencyKey) rows.delete(id);
    }
    rows.set(message.id, message);
  }
  return [...rows.values()].sort((a, b) => {
    if (a.status !== "saved" || b.status !== "saved") return Number(a.status !== "saved") - Number(b.status !== "saved");
    return a.sequence - b.sequence || a.id.localeCompare(b.id);
  });
}

export function retryPayload(message: ChatMessage) {
  return { conversation_id: message.conversationId, episode_id: message.episodeId,
    body: message.body, idempotency_key: message.idempotencyKey };
}
