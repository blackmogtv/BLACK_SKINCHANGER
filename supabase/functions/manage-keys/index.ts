import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type LicenseKeyRow = {
  id: string;
  client_id: string;
  license_key: string;
  status: "active" | "banned";
  created_by: string | null;
  duration_days: number | null;
  expires_at: string | null;
  first_used_at: string | null;
  last_used_at: string | null;
  last_validation_at: string | null;
  bound_hwid: string | null;
  bound_hwid_hash: string | null;
  bound_user_label: string | null;
  hwid_reset_count: number;
  last_hwid_reset_at: string | null;
  note: string;
  banned_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ActionRequest = {
  action?:
    | "list_keys"
    | "get_key"
    | "create_keys"
    | "ban_key"
    | "unban_key"
    | "reset_hwid"
    | "update_note"
    | "set_duration";
  client_id?: string;
  license_key?: string;
  license_key_id?: string;
  quantity?: number;
  created_by?: string;
  note?: string;
  duration_days?: number | null;
  banned_reason?: string;
  actor?: string;
  limit?: number;
  offset?: number;
  only_used?: boolean;
  only_status?: "active" | "banned";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const selectColumns = [
  "id",
  "client_id",
  "license_key",
  "status",
  "created_by",
  "duration_days",
  "expires_at",
  "first_used_at",
  "last_used_at",
  "last_validation_at",
  "bound_hwid",
  "bound_hwid_hash",
  "bound_user_label",
  "hwid_reset_count",
  "last_hwid_reset_at",
  "note",
  "banned_reason",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

const keyAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function normalizeLicenseKey(value: string) {
  return value.trim().toUpperCase();
}

function normalizeClientId(value: string) {
  return value.trim();
}

function normalizeText(value: string, maxLength = 200) {
  return value.trim().slice(0, maxLength);
}

function isExpired(expiresAt: string | null) {
  return expiresAt !== null && new Date(expiresAt).getTime() <= Date.now();
}

function derivedStatus(row: Pick<LicenseKeyRow, "status" | "expires_at" | "bound_hwid_hash">) {
  if (row.status === "banned") {
    return "banned";
  }

  if (isExpired(row.expires_at)) {
    return "expired";
  }

  if (row.bound_hwid_hash) {
    return "used";
  }

  return "unused";
}

function durationLabel(durationDays: number | null) {
  if (durationDays === null) {
    return "Lifetime";
  }

  return `${durationDays} day${durationDays === 1 ? "" : "s"}`;
}

function serializeKey(row: LicenseKeyRow) {
  const status = derivedStatus(row);

  return {
    id: row.id,
    client_id: row.client_id,
    license_key: row.license_key,
    status,
    status_raw: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    duration_days: row.duration_days,
    duration_label: durationLabel(row.duration_days),
    expires_at: row.expires_at,
    note: row.note,
    is_used: Boolean(row.bound_hwid_hash),
    hwid: row.bound_hwid,
    user_label: row.bound_user_label,
    first_used_at: row.first_used_at,
    last_used_at: row.last_used_at,
    last_validation_at: row.last_validation_at,
    hwid_reset_count: row.hwid_reset_count,
    last_hwid_reset_at: row.last_hwid_reset_at,
    banned_reason: row.banned_reason,
    metadata: row.metadata,
    card: {
      title: row.license_key,
      status_badge: status.toUpperCase(),
      created: row.created_at,
      duration: durationLabel(row.duration_days),
      generated_by: row.created_by ?? "System",
      used_by: row.bound_user_label ?? null,
      note: row.note || null,
      used_on: row.first_used_at,
      hwid: row.bound_hwid,
    },
  };
}

function generateLicenseKey() {
  const random = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(random, (value) => keyAlphabet[value % keyAlphabet.length]);
  return [
    chars.slice(0, 5).join(""),
    chars.slice(5, 10).join(""),
    chars.slice(10, 15).join(""),
    chars.slice(15, 20).join(""),
  ].join("-");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function insertEvent(
  supabase: ReturnType<typeof createClient>,
  licenseKeyId: string,
  eventType: string,
  actor: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("license_key_events").insert({
    license_key_id: licenseKeyId,
    event_type: eventType,
    actor,
    details,
  });
}

async function fetchOneKey(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  licenseKeyId?: string,
  licenseKey?: string,
) {
  let query = supabase
    .from("license_keys")
    .select(selectColumns)
    .eq("client_id", clientId);

  if (licenseKeyId) {
    query = query.eq("id", licenseKeyId);
  } else if (licenseKey) {
    query = query.eq("license_key", normalizeLicenseKey(licenseKey));
  } else {
    return { data: null, error: "license_key_id or license_key is required" };
  }

  const { data, error } = await query.maybeSingle<LicenseKeyRow>();
  if (error) {
    return { data: null, error: "Database error" };
  }

  return { data, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ status: "error", message: "Method not allowed" }, 405);
  }

  const adminToken = Deno.env.get("KEYAUTH_ADMIN_TOKEN");
  const providedAdminToken = req.headers.get("x-admin-token")?.trim();

  if (!adminToken || !providedAdminToken || providedAdminToken !== adminToken) {
    return jsonResponse({ status: "error", message: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ status: "error", message: "Server misconfigured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: ActionRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ status: "error", message: "Invalid JSON body" }, 400);
  }

  const action = payload.action;
  const clientId = normalizeClientId(String(payload.client_id ?? ""));
  const actor = normalizeText(String(payload.actor ?? "admin"), 120);

  if (!action) {
    return jsonResponse({ status: "error", message: "action is required" }, 400);
  }

  if (!clientId) {
    return jsonResponse({ status: "error", message: "client_id is required" }, 400);
  }

  if (action === "list_keys") {
    const limit = Math.min(Math.max(Number(payload.limit ?? 25), 1), 100);
    const offset = Math.max(Number(payload.offset ?? 0), 0);
    let query = supabase
      .from("license_keys")
      .select(selectColumns, { count: "exact" })
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (payload.only_status) {
      query = query.eq("status", payload.only_status);
    }

    if (payload.only_used === true) {
      query = query.not("bound_hwid_hash", "is", null);
    } else if (payload.only_used === false) {
      query = query.is("bound_hwid_hash", null);
    }

    const { data, count, error } = await query.returns<LicenseKeyRow[]>();
    if (error) {
      return jsonResponse({ status: "error", message: "Server error" }, 500);
    }

    return jsonResponse({
      status: "ok",
      total: count ?? data.length,
      items: data.map(serializeKey),
    });
  }

  if (action === "get_key") {
    const { data, error } = await fetchOneKey(
      supabase,
      clientId,
      payload.license_key_id,
      payload.license_key,
    );

    if (error) {
      return jsonResponse({ status: "error", message: error }, 400);
    }

    if (!data) {
      return jsonResponse({ status: "error", message: "Key not found" }, 404);
    }

    const { data: events, error: eventsError } = await supabase
      .from("license_key_events")
      .select("id,event_type,actor,details,created_at")
      .eq("license_key_id", data.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (eventsError) {
      return jsonResponse({ status: "error", message: "Server error" }, 500);
    }

    return jsonResponse({
      status: "ok",
      item: serializeKey(data),
      events,
    });
  }

  if (action === "create_keys") {
    const quantity = Math.min(Math.max(Number(payload.quantity ?? 1), 1), 100);
    const createdBy = normalizeText(String(payload.created_by ?? actor), 120) || actor;
    const note = normalizeText(String(payload.note ?? ""), 500);
    const durationDays = payload.duration_days === null || payload.duration_days === undefined
      ? null
      : Number(payload.duration_days);

    if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays <= 0)) {
      return jsonResponse(
        { status: "error", message: "duration_days must be a positive integer or null" },
        400,
      );
    }

    const rowsToInsert = [];
    for (let i = 0; i < quantity; i += 1) {
      const licenseKey = generateLicenseKey();
      rowsToInsert.push({
        client_id: clientId,
        license_key: licenseKey,
        key_hash: await sha256Hex(licenseKey),
        created_by: createdBy,
        duration_days: durationDays,
        note,
      });
    }

    const { data, error } = await supabase
      .from("license_keys")
      .insert(rowsToInsert)
      .select(selectColumns);

    if (error || !data) {
      return jsonResponse({ status: "error", message: "Failed to create keys" }, 500);
    }

    for (const row of data as LicenseKeyRow[]) {
      await insertEvent(supabase, row.id, "created", actor, {
        created_by: createdBy,
        duration_days: durationDays,
        note,
      });
    }

    return jsonResponse({
      status: "ok",
      items: (data as LicenseKeyRow[]).map(serializeKey),
    });
  }

  if (action === "ban_key") {
    const bannedReason = normalizeText(String(payload.banned_reason ?? ""), 500) || null;
    const { data, error } = await fetchOneKey(
      supabase,
      clientId,
      payload.license_key_id,
      payload.license_key,
    );

    if (error) {
      return jsonResponse({ status: "error", message: error }, 400);
    }

    if (!data) {
      return jsonResponse({ status: "error", message: "Key not found" }, 404);
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("license_keys")
      .update({ status: "banned", banned_reason: bannedReason })
      .eq("id", data.id)
      .select(selectColumns);

    if (updateError || !updatedRows || updatedRows.length === 0) {
      return jsonResponse({ status: "error", message: "Failed to ban key" }, 500);
    }

    await insertEvent(supabase, data.id, "banned", actor, {
      banned_reason: bannedReason,
    });

    return jsonResponse({ status: "ok", item: serializeKey(updatedRows[0] as LicenseKeyRow) });
  }

  if (action === "unban_key") {
    const { data, error } = await fetchOneKey(
      supabase,
      clientId,
      payload.license_key_id,
      payload.license_key,
    );

    if (error) {
      return jsonResponse({ status: "error", message: error }, 400);
    }

    if (!data) {
      return jsonResponse({ status: "error", message: "Key not found" }, 404);
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("license_keys")
      .update({ status: "active", banned_reason: null })
      .eq("id", data.id)
      .select(selectColumns);

    if (updateError || !updatedRows || updatedRows.length === 0) {
      return jsonResponse({ status: "error", message: "Failed to unban key" }, 500);
    }

    await insertEvent(supabase, data.id, "unbanned", actor);

    return jsonResponse({ status: "ok", item: serializeKey(updatedRows[0] as LicenseKeyRow) });
  }

  if (action === "reset_hwid") {
    const { data, error } = await fetchOneKey(
      supabase,
      clientId,
      payload.license_key_id,
      payload.license_key,
    );

    if (error) {
      return jsonResponse({ status: "error", message: error }, 400);
    }

    if (!data) {
      return jsonResponse({ status: "error", message: "Key not found" }, 404);
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("license_keys")
      .update({
        bound_hwid: null,
        bound_hwid_hash: null,
        bound_user_label: null,
        hwid_reset_count: data.hwid_reset_count + 1,
        last_hwid_reset_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select(selectColumns);

    if (updateError || !updatedRows || updatedRows.length === 0) {
      return jsonResponse({ status: "error", message: "Failed to reset HWID" }, 500);
    }

    await insertEvent(supabase, data.id, "hwid_reset", actor, {
      previous_hwid: data.bound_hwid,
      previous_user_label: data.bound_user_label,
    });

    return jsonResponse({ status: "ok", item: serializeKey(updatedRows[0] as LicenseKeyRow) });
  }

  if (action === "update_note") {
    const note = normalizeText(String(payload.note ?? ""), 500);
    const { data, error } = await fetchOneKey(
      supabase,
      clientId,
      payload.license_key_id,
      payload.license_key,
    );

    if (error) {
      return jsonResponse({ status: "error", message: error }, 400);
    }

    if (!data) {
      return jsonResponse({ status: "error", message: "Key not found" }, 404);
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("license_keys")
      .update({ note })
      .eq("id", data.id)
      .select(selectColumns);

    if (updateError || !updatedRows || updatedRows.length === 0) {
      return jsonResponse({ status: "error", message: "Failed to update note" }, 500);
    }

    await insertEvent(supabase, data.id, "note_updated", actor, { note });

    return jsonResponse({ status: "ok", item: serializeKey(updatedRows[0] as LicenseKeyRow) });
  }

  if (action === "set_duration") {
    const durationDays = payload.duration_days === null || payload.duration_days === undefined
      ? null
      : Number(payload.duration_days);

    if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays <= 0)) {
      return jsonResponse(
        { status: "error", message: "duration_days must be a positive integer or null" },
        400,
      );
    }

    const { data, error } = await fetchOneKey(
      supabase,
      clientId,
      payload.license_key_id,
      payload.license_key,
    );

    if (error) {
      return jsonResponse({ status: "error", message: error }, 400);
    }

    if (!data) {
      return jsonResponse({ status: "error", message: "Key not found" }, 404);
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("license_keys")
      .update({ duration_days: durationDays })
      .eq("id", data.id)
      .select(selectColumns);

    if (updateError || !updatedRows || updatedRows.length === 0) {
      return jsonResponse({ status: "error", message: "Failed to update duration" }, 500);
    }

    await insertEvent(supabase, data.id, "duration_updated", actor, {
      duration_days: durationDays,
    });

    return jsonResponse({ status: "ok", item: serializeKey(updatedRows[0] as LicenseKeyRow) });
  }

  return jsonResponse({ status: "error", message: "Unknown action" }, 400);
});
