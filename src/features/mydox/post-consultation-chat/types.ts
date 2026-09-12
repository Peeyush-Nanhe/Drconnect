export type ChatReference =
  | { source: "care_request" | "doctor_appointment"; sourceId: string }
  | { conversationId: string; episodeId?: string };

export type ChatRole = "patient" | "doctor";
export type PrescriptionRequest = {
  id: string; episodeId: string; status: "requested" | "reviewing" | "declined";
  requestedAt: string; declineReason?: string | null;
};
export type ChatDetails = {
  conversationId: string; episodeId: string; actorId: string;
  counterpartId: string; counterpartName: string; counterpartRole: ChatRole; memberRole: ChatRole;
  consultationLabel: string; completedAt: string; policyVersion: string; testOnly: boolean;
  patientMessagesRemaining: number; patientMessagesLimit: number; patientSendUntil: string;
  canSend: boolean; sendDisabledReason?: string | null;
  episodes: { episodeId: string; consultationLabel: string; completedAt: string }[];
  prescriptionRequests: PrescriptionRequest[];
};
export type ChatMessage = {
  id: string; conversationId: string; episodeId: string; senderId: string; senderRole: ChatRole;
  body: string; createdAt: string; sequence: number; idempotencyKey: string;
  isOwn: boolean; status: "sending" | "saved" | "failed"; error?: string;
};
export type ChatInboxItem = {
  conversationId: string; episodeId: string; counterpartId: string;
  counterpartName: string; counterpartRole: ChatRole; consultationLabel: string;
  lastMessage?: string | null; lastMessageAt?: string | null; unreadCount: number;
};
export type WireMessage = {
  id: string; conversation_id: string; episode_id: string; sender_id: string; sender_role: ChatRole;
  body: string; created_at: string; sequence_id: number; idempotency_key: string;
};
export type WireSummary = {
  conversation_id: string; episode_id: string; actor_id: string; member_role: ChatRole;
  other_id: string; other_name: string; other_role: ChatRole; consultation_label: string;
  completed_at: string; policy_version: string; test_only: boolean;
  patient_messages_remaining: number; patient_messages_limit: number; patient_send_until: string;
  can_send: boolean; send_disabled_reason?: string | null;
  last_body?: string | null; last_at?: string | null; unread_count: number;
  episodes: { episode_id: string; consultation_label: string; completed_at: string }[];
  prescription_requests: { id: string; episode_id: string; status: PrescriptionRequest["status"]; requested_at: string; decline_reason?: string | null }[];
};
