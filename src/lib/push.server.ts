// Server-only push transport helpers. Never import from client code.

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
  topic?: string | null;
};

type TokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  provider: string;
};

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)!;
  return bytes.buffer;
}

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env["FCM_SERVICE_ACCOUNT_JSON"];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${base64url(signature)}`;

  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("FCM auth returned no access token");
  return json.access_token;
}

async function sendViaFcm(
  sa: ServiceAccount,
  accessToken: string,
  token: string,
  message: PushMessage,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body },
          data: message.data ?? {},
          android: { priority: "HIGH" },
          apns: { headers: { "apns-priority": "10" } },
        },
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `${res.status}: ${text.slice(0, 400)}` };
  try {
    const parsed = JSON.parse(text) as { name?: string };
    return { ok: true, id: parsed.name ?? "" };
  } catch {
    return { ok: true, id: "" };
  }
}

/**
 * Fan a push message out to every enabled device of every target user.
 * Always writes a push_deliveries row per device so the app has an audit trail,
 * even when no push provider credentials are configured yet.
 */
export async function dispatchPush(
  userIds: string[],
  message: PushMessage,
): Promise<{
  targeted: number;
  sent: number;
  failed: number;
  skipped: number;
  deliveries: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("device_tokens")
    .select("id, user_id, token, platform, provider")
    .in("user_id", userIds)
    .eq("enabled", true);

  if (error) throw new Error(error.message);
  const tokens = (data ?? []) as TokenRow[];

  const sa = readServiceAccount();
  let accessToken: string | null = null;
  let authError: string | null = null;
  if (sa && tokens.some((t) => t.provider === "fcm")) {
    try {
      accessToken = await getAccessToken(sa);
    } catch (e) {
      authError = e instanceof Error ? e.message : "FCM auth failed";
    }
  }

  const rows: Array<{
    user_id: string;
    device_token_id: string;
    title: string;
    body: string;
    data: Record<string, string>;
    topic: string | null;
    status: "sent" | "failed" | "skipped";
    provider_message_id: string | null;
    error: string | null;
  }> = [];

  const disableTokenIds: string[] = [];

  for (const t of tokens) {
    if (t.provider !== "fcm" || !sa || !accessToken) {
      rows.push({
        user_id: t.user_id,
        device_token_id: t.id,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        topic: message.topic ?? null,
        status: "skipped",
        provider_message_id: null,
        error:
          authError ??
          (sa ? `no transport for provider ${t.provider}` : "push provider not configured"),
      });
      continue;
    }

    try {
      const result = await sendViaFcm(sa, accessToken, t.token, message);
      if (result.ok) {
        rows.push({
          user_id: t.user_id,
          device_token_id: t.id,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          topic: message.topic ?? null,
          status: "sent",
          provider_message_id: result.id,
          error: null,
        });
      } else {
        if (result.error.startsWith("404") || result.error.includes("UNREGISTERED")) {
          disableTokenIds.push(t.id);
        }
        rows.push({
          user_id: t.user_id,
          device_token_id: t.id,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          topic: message.topic ?? null,
          status: "failed",
          provider_message_id: null,
          error: result.error,
        });
      }
    } catch (e) {
      rows.push({
        user_id: t.user_id,
        device_token_id: t.id,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        topic: message.topic ?? null,
        status: "failed",
        provider_message_id: null,
        error: e instanceof Error ? e.message : "unknown send error",
      });
    }
  }

  if (disableTokenIds.length) {
    await supabaseAdmin
      .from("device_tokens")
      .update({ enabled: false })
      .in("id", disableTokenIds);
  }

  let deliveries: string[] = [];
  if (rows.length) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("push_deliveries")
      .insert(rows)
      .select("id");
    if (insertError) throw new Error(insertError.message);
    deliveries = (inserted ?? []).map((r) => r.id);
  }

  return {
    targeted: tokens.length,
    sent: rows.filter((r) => r.status === "sent").length,
    failed: rows.filter((r) => r.status === "failed").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    deliveries,
  };
}
