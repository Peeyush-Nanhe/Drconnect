import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { accessRejected, chatApi, chatError, ChatError } from "./api";
import { chatDetails, inboxItem, mergeMessages, retryPayload, savedMessage } from "./state";
import { ChatRecovery, recoverHistory } from "./recovery";
import type { ChatDetails, ChatInboxItem, ChatMessage, ChatReference } from "./types";

// Clinical text stays in component memory. Auth changes invalidate in-flight
// work before another account can receive its results.
function useChatIdentity() {
  const [identity, setIdentity] = useState<{ id: string | null; ready: boolean; generation: number }>({ id: null, ready: false, generation: 0 });
  const current = useRef(identity);
  useEffect(() => {
    let alive = true;
    let authEvent = false;
    const update = (id: string | null) => {
      if (!alive) return;
      if (current.current.ready && current.current.id === id) return;
      current.current = { id, ready: true, generation: current.current.generation + 1 };
      setIdentity(current.current);
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      authEvent = true;
      update(session?.user.id ?? null);
      if (event === "SIGNED_OUT") {
        // Retire the prototype's unprotected cache, never resolve it by names.
        try {
          for (const key of Object.keys(window.localStorage)) {
            if (key.startsWith("mydox_chat_thread_")) window.localStorage.removeItem(key);
          }
        } catch { /* Storage may be unavailable. This feature never reads it. */ }
      }
    });
    void supabase.auth.getSession().then(({ data: session }) => {
      if (!authEvent) update(session.session?.user.id ?? null);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  return { identity, current };
}

export function usePostConsultationChat(reference?: ChatReference) {
  const { identity, current: currentIdentity } = useChatIdentity();
  const referenceKey = reference ? JSON.stringify(reference) : "";
  const scope = `${identity.generation}:${referenceKey}`;
  const latestScope = useRef(scope);
  latestScope.current = scope;
  const [state, setState] = useState<{ scope: string; details: ChatDetails | null; messages: ChatMessage[] }>({ scope, details: null, messages: [] });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "refreshing" | "offline">("connecting");
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [refreshNumber, setRefreshNumber] = useState(0);
  const refresh = useCallback(() => setRefreshNumber(n => n + 1), []);
  const sending = useRef(false);
  const recovery = useRef(new ChatRecovery());
  const activeChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prescriptionPending = useRef<{ scope: string; input: string; key: string } | null>(null);
  const refreshNow = useRef<() => Promise<void>>(async () => {});

  const invalidateAccess = useCallback((failure: unknown) => {
    recovery.current.invalidate();
    setState({ scope, details: null, messages: [] });
    setNextBefore(null);
    setLoadingOlder(false);
    setLoading(false);
    sending.current = false;
    prescriptionPending.current = null;
    setError(chatError(failure));
    setConnectionState("offline");
    if (activeChannel.current) {
      void supabase.removeChannel(activeChannel.current);
      activeChannel.current = null;
    }
  }, [scope]);

  useEffect(() => {
    const capturedIdentity = currentIdentity.current;
    let alive = true;
    let refreshing = false;
    let again = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let live = false;
    if (stateRef.current.scope !== scope) {
      recovery.current.invalidate();
      setState({ scope, details: null, messages: [] });
      setNextBefore(null);
      setLoadingOlder(false);
      sending.current = false;
      prescriptionPending.current = null;
    }
    const accessGeneration = recovery.current.capture();
    const valid = () => alive && currentIdentity.current === capturedIdentity && latestScope.current === scope && recovery.current.isCurrent(accessGeneration);
    setError(null);
    setLoading(true);
    setConnectionState("connecting");
    const update = async () => {
      if (refreshing) { again = true; return; }
      if (!valid() || !capturedIdentity.ready) return;
      if (!capturedIdentity.id || !referenceKey) {
        setState({ scope, details: null, messages: [] });
        setError(!capturedIdentity.id ? "Sign in to open your consultation chat." : "Open chat from an authorised completed consultation or your inbox.");
        setLoading(false);
        return;
      }
      refreshing = true;
      try {
        const summary = await chatApi.open(JSON.parse(referenceKey) as ChatReference);
        if (!valid()) return;
        if (!channel) {
          // Events only prompt an authenticated refetch; event payloads are never
          // trusted as clinical data, roles, acknowledgements or membership.
          channel = supabase.channel(`pc-chat:${summary.conversation_id}:${crypto.randomUUID()}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${summary.conversation_id}` }, () => { void update(); })
            .subscribe(status => {
              if (!valid()) return;
              live = status === "SUBSCRIBED";
              setConnectionState(live ? "live" : "refreshing");
              if (live) void update();
            });
        }
        activeChannel.current = channel;
        // An isolated send response may arrive after many missed recipient rows.
        // It must never move this pagination boundary past those unseen rows.
        const newest = recovery.current.historyBoundary;
        const recovered = await recoverHistory(before => chatApi.history(summary.conversation_id, before), newest, valid);
        if (!recovered || !valid()) return;
        const collected = recovered.messages.map(message => savedMessage(message, capturedIdentity.id!));
        if (!recovery.current.confirmHistory(accessGeneration, collected.map(message => message.sequence))) return;
        setState(previous => ({ scope, details: chatDetails(summary), messages: mergeMessages(previous.scope === scope ? previous.messages : [], collected) }));
        if (newest == null) setNextBefore(recovered.nextBefore);
        setError(null);
        setConnectionState(live ? "live" : "refreshing");
      } catch (failure) {
        if (!valid()) return;
        setError(chatError(failure));
        setConnectionState("offline");
        if (accessRejected(failure)) {
          invalidateAccess(failure);
          setLoading(false);
        }
      } finally {
        refreshing = false;
        if (valid()) {
          setLoading(false);
          if (again) { again = false; void update(); }
        }
      }
    };
    refreshNow.current = update;
    void update();
    const resume = () => { if (document.visibilityState === "visible") void update(); };
    const offline = () => { if (valid()) setConnectionState("offline"); };
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void update(); }, 15000);
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false;
      window.clearInterval(interval);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      if (channel) void supabase.removeChannel(channel);
      if (activeChannel.current === channel) activeChannel.current = null;
    };
  }, [scope, referenceKey, currentIdentity, refreshNumber, invalidateAccess]);

  const submit = useCallback(async (message: ChatMessage): Promise<boolean> => {
    if (sending.current) return false;
    const captured = currentIdentity.current;
    const accessGeneration = recovery.current.capture();
    const valid = () => latestScope.current === scope && currentIdentity.current === captured && recovery.current.isCurrent(accessGeneration);
    if (!valid() || !recovery.current.authorised || message.senderId !== captured.id) return false;
    sending.current = true;
    setState(previous => ({ ...previous, messages: previous.messages.map(m => m.id === message.id ? { ...m, status: "sending", error: undefined } : m) }));
    try {
      const row = await chatApi.send(retryPayload(message));
      if (!valid()) return false;
      setState(previous => ({ ...previous, messages: mergeMessages(previous.messages, [savedMessage(row, captured.id!)]) }));
      void refreshNow.current();
      window.dispatchEvent(new Event("mydox:chat-inbox-refresh"));
      return true;
    } catch (failure) {
      if (valid()) {
        const reason = chatError(failure);
        if (accessRejected(failure)) {
          invalidateAccess(failure);
        } else {
          setState(previous => ({ ...previous, messages: previous.messages.map(m => m.id === message.id ? { ...m, status: "failed", error: reason } : m) }));
        }
      }
      return false;
    } finally { if (valid()) sending.current = false; }
  }, [scope, currentIdentity, invalidateAccess]);

  const send = useCallback(async (body: string) => {
    const current = stateRef.current;
    const details = current.details;
    if (current.scope !== scope || !recovery.current.authorised || !details?.canSend || current.messages.some(m => m.status !== "saved") || sending.current) return false;
    const text = body.trim();
    if (!text || [...text].length > 4000) return false;
    const key = crypto.randomUUID();
    const message: ChatMessage = { id: `pending:${key}`, conversationId: details.conversationId, episodeId: details.episodeId,
      senderId: details.actorId, senderRole: details.memberRole, body: text, createdAt: "", sequence: 0,
      idempotencyKey: key, isOwn: true, status: "sending" };
    setState(previous => ({ ...previous, messages: [...previous.messages, message] }));
    return submit(message);
  }, [scope, submit]);
  const retry = useCallback(async (id: string) => {
    const message = stateRef.current.messages.find(m => m.id === id && m.status === "failed");
    return message ? submit(message) : false;
  }, [submit]);
  const loadOlder = useCallback(async () => {
    const captured = currentIdentity.current;
    const details = stateRef.current.details;
    const accessGeneration = recovery.current.capture();
    const valid = () => latestScope.current === scope && currentIdentity.current === captured && recovery.current.isCurrent(accessGeneration);
    if (!details || !recovery.current.authorised || nextBefore == null || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await chatApi.history(details.conversationId, nextBefore);
      if (!valid()) return;
      setState(previous => ({ ...previous, messages: mergeMessages(previous.messages, page.messages.map(m => savedMessage(m, captured.id!))) }));
      setNextBefore(page.next_before_sequence);
    } catch (failure) {
      if (valid()) {
        setError(chatError(failure));
        if (accessRejected(failure)) invalidateAccess(failure);
      }
    } finally { if (valid()) setLoadingOlder(false); }
  }, [scope, currentIdentity, nextBefore, loadingOlder, invalidateAccess]);
  const markRead = useCallback(async (messageId?: string) => {
    if (document.visibilityState !== "visible" || !messageId) return;
    const current = stateRef.current;
    const captured = currentIdentity.current;
    const accessGeneration = recovery.current.capture();
    const valid = () => latestScope.current === scope && currentIdentity.current === captured && recovery.current.isCurrent(accessGeneration);
    const message = current.messages.find(m => m.id === messageId && m.status === "saved" && !m.isOwn);
    if (!valid() || !recovery.current.authorised || current.scope !== scope || !current.details || current.details.actorId !== captured.id || !message) return;
    try {
      await chatApi.read(current.details.conversationId, message.sequence);
      if (valid()) window.dispatchEvent(new Event("mydox:chat-inbox-refresh"));
    } catch (failure) {
      if (valid() && accessRejected(failure)) invalidateAccess(failure);
      // Transport failure leaves the message unread; a later visibility event retries it.
    }
  }, [scope, currentIdentity, invalidateAccess]);
  const prescription = useCallback(async (action: "request" | "review" | "decline", requestId?: string, reason?: string): Promise<boolean> => {
    const captured = currentIdentity.current;
    const details = stateRef.current.details;
    const accessGeneration = recovery.current.capture();
    const valid = () => latestScope.current === scope && currentIdentity.current === captured && recovery.current.isCurrent(accessGeneration);
    if (!details || !recovery.current.authorised || stateRef.current.scope !== scope) return false;
    const input = { conversation_id: details.conversationId, episode_id: details.episodeId, action, ...(requestId ? { request_id: requestId } : {}), ...(reason ? { reason } : {}) };
    const serial = JSON.stringify(input);
    const previous = prescriptionPending.current;
    if (previous && previous.scope === scope && previous.input !== serial) {
      setError("Retry the pending prescription action before starting another request."); return false;
    }
    const key = previous?.scope === scope ? previous.key : crypto.randomUUID();
    prescriptionPending.current = { scope, input: serial, key };
    try {
      await chatApi.prescription({ ...input, idempotency_key: key });
      if (!valid()) return false;
      prescriptionPending.current = null;
      await refreshNow.current();
      return true;
    } catch (failure) {
      if (valid()) {
        if (failure instanceof ChatError && /^(22|23|28|42|P000)/.test(failure.code ?? "")) prescriptionPending.current = null;
        setError(chatError(failure));
        if (accessRejected(failure)) invalidateAccess(failure);
      }
      return false;
    }
  }, [scope, currentIdentity, invalidateAccess]);
  return {
    identityKey: identity.id, details: state.scope === scope ? state.details : null,
    messages: state.scope === scope ? state.messages : [], loading: !identity.ready || loading,
    error, connectionState, hasOlder: nextBefore != null, loadingOlder,
    send, retry, refresh, loadOlder, markRead, prescription,
  };
}

export function usePostConsultationInbox() {
  const { identity, current } = useChatIdentity();
  const [state, setState] = useState<{ generation: number; items: ChatInboxItem[] }>({ generation: -1, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNumber, setRefreshNumber] = useState(0);
  const refresh = useCallback(() => setRefreshNumber(n => n + 1), []);
  useEffect(() => {
    const captured = current.current;
    let alive = true;
    let busy = false;
    const update = async () => {
      if (!captured.ready || busy) return;
      if (!captured.id) { setState({ generation: captured.generation, items: [] }); setLoading(false); return; }
      busy = true;
      try {
        const rows = await chatApi.inbox();
        if (!alive || current.current !== captured) return;
        setState({ generation: captured.generation, items: rows.map(inboxItem) }); setError(null);
      } catch (failure) {
        if (!alive || current.current !== captured) return;
        setError(chatError(failure));
        // No stale medical preview remains on failed revalidation.
        setState({ generation: captured.generation, items: [] });
      } finally { busy = false; if (alive && current.current === captured) setLoading(false); }
    };
    setLoading(true);
    void update();
    const resume = () => { if (document.visibilityState === "visible") void update(); };
    const interval = window.setInterval(resume, 15000);
    window.addEventListener("mydox:chat-inbox-refresh", resume);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false; window.clearInterval(interval);
      window.removeEventListener("mydox:chat-inbox-refresh", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [identity.generation, current, refreshNumber]);
  return { items: state.generation === identity.generation ? state.items : [], loading: !identity.ready || loading, error, refresh };
}
