import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type LicenseKeyRow = {
  id: string;
  client_id: string;
  license_key: string;
  status: "active" | "banned";
  created_by: string | null;
  duration_days: number | null;
  duration_value: number | null;
  duration_unit: "hours" | "days" | "weeks" | "months" | "years" | null;
  expires_at: string | null;
  first_used_at: string | null;
  last_used_at: string | null;
  last_validation_at: string | null;
  bound_hwid: string | null;
  bound_hwid_hash: string | null;
  bound_user_label: string | null;
  note: string;
  banned_reason: string | null;
  created_at: string;
};

type DurationUnit = "hours" | "days" | "weeks" | "months" | "years";

type ProductRow = {
  id: string;
  client_id: string;
  display_name: string;
  is_active: boolean;
};

type ValidateRequest = {
  client_id?: string;
  license_key?: string;
  hwid?: string;
  user_label?: string;
  bind_on_first_use?: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-timestamp",
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
  "duration_value",
  "duration_unit",
  "expires_at",
  "first_used_at",
  "last_used_at",
  "last_validation_at",
  "bound_hwid",
  "bound_hwid_hash",
  "bound_user_label",
  "note",
  "banned_reason",
  "created_at",
].join(",");

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function normalizeLicenseKey(value: string) {
  return value.trim().toUpperCase();
}

function normalizeHwid(value: string) {
  return value.trim();
}

function normalizeUserLabel(value: string) {
  return value.trim().slice(0, 120);
}

function durationLabel(durationValue: number | null, durationUnit: DurationUnit | null) {
  if (durationValue === null || durationUnit === null) {
    return "Lifetime";
  }

  return `${durationValue} ${durationUnit.slice(0, -1)}${durationValue === 1 ? "" : "s"}`;
}

function legacyDurationDays(durationValue: number | null, durationUnit: DurationUnit | null) {
  if (durationValue === null || durationUnit === null) {
    return null;
  }

  if (durationUnit === "days") {
    return durationValue;
  }

  if (durationUnit === "weeks") {
    return durationValue * 7;
  }

  return null;
}

function durationFromRow(row: Pick<LicenseKeyRow, "duration_days" | "duration_value" | "duration_unit">) {
  const durationValue = row.duration_value ?? (row.duration_days ?? null);
  const durationUnit = row.duration_unit ?? (durationValue !== null ? "days" : null);

  return {
    duration_value: durationValue,
    duration_unit: durationUnit ?? "lifetime",
    duration_days: legacyDurationDays(durationValue, durationUnit),
    duration_label: durationLabel(durationValue, durationUnit),
  };
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

function serializeLicenseKey(row: LicenseKeyRow) {
  const status = derivedStatus(row);
  const duration = durationFromRow(row);

  return {
    id: row.id,
    client_id: row.client_id,
    license_key: row.license_key,
    status,
    created_at: row.created_at,
    created_by: row.created_by,
    duration_days: duration.duration_days,
    duration_value: duration.duration_value,
    duration_unit: duration.duration_unit,
    duration_label: duration.duration_label,
    expires_at: row.expires_at,
    is_used: Boolean(row.bound_hwid_hash),
    hwid: row.bound_hwid,
    user_label: row.bound_user_label,
    note: row.note,
    first_used_at: row.first_used_at,
    last_used_at: row.last_used_at,
    last_validation_at: row.last_validation_at,
    banned_reason: row.banned_reason,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ status: "error", message: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ status: "error", message: "Server misconfigured" }, 500);
  }

  let payload: ValidateRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ status: "error", message: "Invalid JSON body" }, 400);
  }

  const clientId = String(payload.client_id ?? "").trim();
  const licenseKey = normalizeLicenseKey(String(payload.license_key ?? ""));
  const hwid = normalizeHwid(String(payload.hwid ?? ""));
  const userLabel = normalizeUserLabel(String(payload.user_label ?? ""));
  const bindOnFirstUse = payload.bind_on_first_use !== false;

  if (!clientId || !licenseKey || !hwid) {
    return jsonResponse(
      { status: "error", message: "client_id, license_key, and hwid are required" },
      400,
    );
  }

  if (hwid.length > 200) {
    return jsonResponse({ status: "error", message: "hwid is too long" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,client_id,display_name,is_active")
    .eq("client_id", clientId)
    .maybeSingle<ProductRow>();

  if (productError) {
    return jsonResponse({ status: "error", message: "Server error" }, 500);
  }

  if (!product || !product.is_active) {
    return jsonResponse({ status: "invalid_product", message: "Unknown or inactive product" }, 200);
  }

  const keyHash = await sha256Hex(licenseKey);
  const hwidHash = await sha256Hex(hwid);

  const { data: row, error: selectError } = await supabase
    .from("license_keys")
    .select(selectColumns)
    .eq("client_id", clientId)
    .eq("key_hash", keyHash)
    .maybeSingle<LicenseKeyRow>();

  if (selectError) {
    return jsonResponse({ status: "error", message: "Server error" }, 500);
  }

  if (!row) {
    return jsonResponse({ status: "invalid", message: "Invalid license key" }, 200);
  }

  if (row.status === "banned") {
    await insertEvent(supabase, row.id, "validation_rejected", "client", {
      reason: "banned",
      hwid,
      user_label: userLabel || null,
    });

    return jsonResponse({ status: "banned", message: "This key has been banned" }, 200);
  }

  if (isExpired(row.expires_at)) {
    await insertEvent(supabase, row.id, "validation_rejected", "client", {
      reason: "expired",
      hwid,
      user_label: userLabel || null,
    });

    return jsonResponse({ status: "expired", message: "This key has expired" }, 200);
  }

  if (row.bound_hwid_hash && row.bound_hwid_hash !== hwidHash) {
    await insertEvent(supabase, row.id, "validation_rejected", "client", {
      reason: "hwid_mismatch",
      hwid,
      user_label: userLabel || null,
    });

    return jsonResponse(
      { status: "hwid_mismatch", message: "Key is locked to another device" },
      200,
    );
  }

  const now = new Date().toISOString();

  if (!row.bound_hwid_hash) {
    if (!bindOnFirstUse) {
      return jsonResponse(
        {
          status: "valid",
          message: "Key is valid and not yet bound",
          bound_now: false,
          key: serializeLicenseKey(row),
        },
        200,
      );
    }

    const { data: boundRows, error: bindError } = await supabase
      .from("license_keys")
      .update({
        bound_hwid: hwid,
        bound_hwid_hash: hwidHash,
        bound_user_label: userLabel || null,
        first_used_at: row.first_used_at ?? now,
        last_used_at: now,
        last_validation_at: now,
      })
      .eq("id", row.id)
      .is("bound_hwid_hash", null)
      .select(selectColumns);

    if (bindError) {
      return jsonResponse({ status: "error", message: "Server error" }, 500);
    }

    if (boundRows && boundRows.length > 0) {
      const boundRow = boundRows[0] as LicenseKeyRow;
      await insertEvent(supabase, row.id, "bound", "client", {
        hwid,
        user_label: userLabel || null,
      });

      return jsonResponse(
        {
          status: "valid",
          message: "License valid and bound to this HWID",
          bound_now: true,
          key: serializeLicenseKey(boundRow),
        },
        200,
      );
    }

    const { data: rebound, error: reboundError } = await supabase
      .from("license_keys")
      .select(selectColumns)
      .eq("id", row.id)
      .maybeSingle<LicenseKeyRow>();

    if (reboundError || !rebound) {
      return jsonResponse({ status: "error", message: "Server error" }, 500);
    }

    if (rebound.bound_hwid_hash !== hwidHash) {
      return jsonResponse(
        { status: "hwid_mismatch", message: "Key is locked to another device" },
        200,
      );
    }

    await insertEvent(supabase, row.id, "validated", "client", {
      hwid,
      user_label: userLabel || null,
      rebound: true,
    });

    return jsonResponse(
      {
        status: "valid",
        message: "License valid for this HWID",
        bound_now: false,
        key: serializeLicenseKey(rebound),
      },
      200,
    );
  }

  const updates: Record<string, unknown> = {
    last_used_at: now,
    last_validation_at: now,
  };

  if (userLabel && row.bound_user_label !== userLabel) {
    updates.bound_user_label = userLabel;
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("license_keys")
    .update(updates)
    .eq("id", row.id)
    .select(selectColumns);

  if (updateError || !updatedRows || updatedRows.length === 0) {
    return jsonResponse({ status: "error", message: "Server error" }, 500);
  }

  await insertEvent(supabase, row.id, "validated", "client", {
    hwid,
    user_label: userLabel || null,
  });

  return jsonResponse(
    {
      status: "valid",
      message: "License valid for this HWID",
      bound_now: false,
      key: serializeLicenseKey(updatedRows[0] as LicenseKeyRow),
    },
    200,
  );
});
