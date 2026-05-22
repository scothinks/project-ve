"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { sanitizePlainTextInput } from "@/lib/input-safety";

export type InventoryBatchDryRunState = {
  ok: boolean;
  message: string;
  totalRows: number;
  validRows: number;
  blankRows: number;
  duplicateRows: number;
  existingDuplicateRows: number;
  itemType: string;
  rewardTitle: string;
  sample: string[];
  errors: string[];
  warnings: string[];
};

const initialInventoryBatchDryRunState: InventoryBatchDryRunState = {
  ok: false,
  message: "",
  totalRows: 0,
  validRows: 0,
  blankRows: 0,
  duplicateRows: 0,
  existingDuplicateRows: 0,
  itemType: "",
  rewardTitle: "",
  sample: [],
  errors: [],
  warnings: [],
};

type InventoryBatchValidation = InventoryBatchDryRunState & {
  rewardId: string;
  campaignId: string | null;
  batchLabel: string | null;
  partnerReference: string | null;
  source: string;
  originalFileName: string | null;
  availableFrom: string | null;
  expiresAt: string | null;
  values: string[];
};

function parseOptionalDateString(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isInvalidDateInput(rawValue: string | null | undefined) {
  const raw = String(rawValue ?? "").trim();
  return Boolean(raw) && Number.isNaN(new Date(raw).getTime());
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  return parseOptionalDateString(String(value ?? ""));
}

function parseOptionalText(value: FormDataEntryValue | null, maxLength = 160) {
  const parsed = sanitizePlainTextInput(String(value ?? ""), maxLength).trim();
  return parsed || null;
}

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseInventoryValues(raw: string, itemType: string) {
  const lines = raw.split(/\r?\n/);
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  const firstLine = nonEmpty[0] ?? "";
  const preferredHeader = itemType === "voucher_code" ? "code" : "qr_payload";

  if (firstLine.includes(",")) {
    const headers = parseCsvLine(firstLine).map((header) => header.trim().toLowerCase());
    const preferredIndex = headers.indexOf(preferredHeader);
    const fallbackIndex = headers.indexOf("value");
    const targetIndex = preferredIndex >= 0 ? preferredIndex : fallbackIndex;

    if (targetIndex >= 0) {
      return lines.slice(1).map((line) => parseCsvLine(line)[targetIndex] ?? "");
    }
  }

  return lines.map((line) => {
    const trimmed = line.trim();
    return trimmed.toLowerCase() === preferredHeader || trimmed.toLowerCase() === "value"
      ? ""
      : trimmed;
  });
}

async function findExistingValues(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  rewardId: string,
  itemType: string,
  values: string[],
) {
  const existing = new Set<string>();
  const chunkSize = 5000;

  for (let index = 0; index < values.length; index += chunkSize) {
    const chunk = values.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .rpc("find_existing_reward_inventory_values", {
        p_reward_id: rewardId,
        p_item_type: itemType,
        p_values: chunk,
      });

    if (error) {
      throw error;
    }

    for (const row of Array.isArray(data) ? data : []) {
      const value = typeof row?.value === "string" ? row.value : "";
      if (value) {
        existing.add(value);
      }
    }
  }

  return existing;
}

async function validateInventoryBatch(formData: FormData): Promise<InventoryBatchValidation> {
  const { supabase } = await requireAdmin();
  const rewardId = sanitizePlainTextInput(String(formData.get("rewardId") ?? ""), 120);
  const campaignId = parseOptionalText(formData.get("campaignId"), 120);
  const batchLabel = parseOptionalText(formData.get("batchLabel"), 160);
  const partnerReference = parseOptionalText(formData.get("partnerReference"), 160);
  const source = sanitizePlainTextInput(String(formData.get("source") ?? "partner"), 40) || "partner";
  const originalFileName = parseOptionalText(formData.get("originalFileName"), 240);
  const availableFrom = parseOptionalDate(formData.get("availableFrom"));
  const expiresAt = parseOptionalDate(formData.get("expiresAt"));
  const rawInventory = String(formData.get("inventoryText") ?? "");
  const errors: string[] = [];
  const warnings: string[] = [];
  let rewardTitle = "";
  let itemType = "";

  if (!rewardId) {
    errors.push("Select a reward before running validation.");
  }

  if (isInvalidDateInput(formData.get("availableFrom")?.toString())) {
    errors.push("Available from is not a valid date.");
  }

  if (isInvalidDateInput(formData.get("expiresAt")?.toString())) {
    errors.push("Expiry is not a valid date.");
  }

  if (availableFrom && expiresAt && new Date(expiresAt) <= new Date(availableFrom)) {
    errors.push("Expiry must be after available from.");
  }

  if (campaignId) {
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw error;
    }

    if (!campaign) {
      errors.push("Selected campaign was not found.");
    }
  }

  if (rewardId) {
    const { data: reward, error } = await supabase
      .from("rewards")
      .select("id, title, fulfillment_type")
      .eq("id", rewardId)
      .maybeSingle<{ id: string; title: string; fulfillment_type: string }>();

    if (error) {
      throw error;
    }

    if (!reward) {
      errors.push("Selected reward was not found.");
    } else {
      rewardTitle = reward.title;
      itemType = reward.fulfillment_type;

      if (itemType !== "voucher_code" && itemType !== "qr_code") {
        errors.push("Batch uploads only support voucher and QR rewards.");
      }
    }
  }

  const parsedValues = parseInventoryValues(rawInventory, itemType);
  const blankRows = parsedValues.filter((value) => !value.trim()).length;
  const sanitizedValues = parsedValues
    .map((value) => sanitizePlainTextInput(value, 500).trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const duplicateValues = new Set<string>();
  const values: string[] = [];

  for (const value of sanitizedValues) {
    if (seen.has(value)) {
      duplicateValues.add(value);
    } else {
      seen.add(value);
      values.push(value);
    }
  }

  let existingValues = new Set<string>();

  if (rewardId && itemType && values.length > 0 && errors.length === 0) {
    existingValues = await findExistingValues(supabase, rewardId, itemType, values);
  }

  if (values.length === 0) {
    errors.push("Upload or paste at least one code or QR payload.");
  }

  if (duplicateValues.size > 0) {
    errors.push(
      `${duplicateValues.size} duplicate value${duplicateValues.size === 1 ? "" : "s"} found in this file.`,
    );
  }

  if (existingValues.size > 0) {
    errors.push(
      `${existingValues.size} value${existingValues.size === 1 ? "" : "s"} already exist for this reward.`,
    );
  }

  if (blankRows > 0) {
    warnings.push(`${blankRows} blank row${blankRows === 1 ? "" : "s"} will be ignored.`);
  }

  return {
    ...initialInventoryBatchDryRunState,
    ok: errors.length === 0,
    message: errors.length === 0 ? "Batch is ready to import." : "Fix the batch issues before importing.",
    totalRows: parsedValues.length,
    validRows: errors.length === 0 ? values.length : 0,
    blankRows,
    duplicateRows: duplicateValues.size,
    existingDuplicateRows: existingValues.size,
    itemType,
    rewardTitle,
    sample: values.slice(0, 10),
    errors,
    warnings,
    rewardId,
    campaignId,
    batchLabel,
    partnerReference,
    source,
    originalFileName,
    availableFrom,
    expiresAt,
    values,
  };
}

export async function dryRunInventoryBatch(
  _previousState: InventoryBatchDryRunState,
  formData: FormData,
) {
  return validateInventoryBatch(formData);
}

export async function setInventoryQuantity(formData: FormData) {
  const rewardId = sanitizePlainTextInput(String(formData.get("rewardId") ?? ""), 120);
  const totalAvailable = Math.max(0, parseInteger(formData.get("totalAvailable")));
  const availableFrom = parseOptionalDate(formData.get("availableFrom"));
  const expiresAt = parseOptionalDate(formData.get("expiresAt"));

  if (isInvalidDateInput(formData.get("availableFrom")?.toString())) {
    throw new Error("Available from is not a valid date.");
  }

  if (isInvalidDateInput(formData.get("expiresAt")?.toString())) {
    throw new Error("Expiry is not a valid date.");
  }

  if (availableFrom && expiresAt && new Date(expiresAt) <= new Date(availableFrom)) {
    throw new Error("Expiry must be after available from.");
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_set_reward_quantity", {
    p_reward_id: rewardId,
    p_total_available: totalAvailable,
    p_reason: sanitizePlainTextInput(String(formData.get("reason") ?? ""), 300) || "Inventory quantity allocation",
    p_campaign_id: parseOptionalText(formData.get("campaignId")),
    p_batch_label: parseOptionalText(formData.get("batchLabel")),
    p_partner_reference: parseOptionalText(formData.get("partnerReference")),
    p_available_from: availableFrom,
    p_expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/inventory/new");
  revalidatePath("/admin/rewards");
  revalidatePath(`/admin/rewards/${rewardId}`);
  revalidatePath("/xp-store");
  redirect(`/admin/inventory/new?rewardId=${encodeURIComponent(rewardId)}&mode=quantity&saved=quantity`);
}

export async function reallocateInventory(formData: FormData) {
  const rewardId = sanitizePlainTextInput(String(formData.get("rewardId") ?? ""), 120);
  const fromCampaignId = sanitizePlainTextInput(String(formData.get("fromCampaignId") ?? ""), 120);
  const toCampaignId = sanitizePlainTextInput(String(formData.get("toCampaignId") ?? ""), 120);
  const quantity = Math.max(0, parseInteger(formData.get("quantity")));
  const availableFrom = parseOptionalDate(formData.get("availableFrom"));
  const expiresAt = parseOptionalDate(formData.get("expiresAt"));

  if (isInvalidDateInput(formData.get("availableFrom")?.toString())) {
    throw new Error("Available from is not a valid date.");
  }

  if (isInvalidDateInput(formData.get("expiresAt")?.toString())) {
    throw new Error("Expiry is not a valid date.");
  }

  if (availableFrom && expiresAt && new Date(expiresAt) <= new Date(availableFrom)) {
    throw new Error("Expiry must be after available from.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_reallocate_reward_inventory", {
    p_reward_id: rewardId,
    p_from_campaign_id: fromCampaignId,
    p_to_campaign_id: toCampaignId,
    p_quantity: quantity,
    p_available_from: availableFrom,
    p_expires_at: expiresAt,
    p_reason: sanitizePlainTextInput(String(formData.get("reason") ?? ""), 300) || "Inventory reallocation",
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/inventory/new");
  revalidatePath("/admin/inventory/reallocate");
  revalidatePath("/admin/rewards");
  revalidatePath(`/admin/rewards/${rewardId}`);
  revalidatePath("/xp-store");
  redirect("/admin/inventory/reallocate?saved=1");
}

export async function uploadInventoryBatch(formData: FormData) {
  const validation = await validateInventoryBatch(formData);

  if (!validation.ok) {
    throw new Error("Batch has validation errors. Run dry run and fix the issues before importing.");
  }

  const { supabase } = await requireAdmin();
  const batchResult = await supabase.rpc("admin_create_reward_inventory_batch", {
    p_reward_id: validation.rewardId,
    p_campaign_id: validation.campaignId,
    p_batch_label: validation.batchLabel,
    p_partner_reference: validation.partnerReference,
    p_source: validation.source,
    p_original_filename: validation.originalFileName,
    p_available_from: validation.availableFrom,
    p_expires_at: validation.expiresAt,
    p_total_rows: validation.totalRows,
    p_valid_rows: validation.values.length,
    p_invalid_rows: validation.blankRows,
    p_duplicate_rows: validation.duplicateRows + validation.existingDuplicateRows,
  });

  if (batchResult.error) {
    throw batchResult.error;
  }

  const batchData = batchResult.data as { batchId?: string } | null;
  const batchId = batchData?.batchId;

  if (!batchId) {
    throw new Error("Inventory batch could not be created.");
  }

  try {
    const chunkSize = 1000;
    for (let index = 0; index < validation.values.length; index += chunkSize) {
      const chunk = validation.values.slice(index, index + chunkSize);
      const { error } = await supabase.rpc("admin_upload_reward_inventory", {
        p_reward_id: validation.rewardId,
        p_item_type: validation.itemType,
        p_items: chunk.map((value) => ({ value, availableFrom: validation.availableFrom })),
        p_expires_at: validation.expiresAt,
        p_available_from: validation.availableFrom,
        p_campaign_id: validation.campaignId,
        p_batch_label: validation.batchLabel,
        p_partner_reference: validation.partnerReference,
        p_batch_id: batchId,
      });

      if (error) {
        throw error;
      }
    }

    const { error } = await supabase.rpc("admin_complete_reward_inventory_batch", {
      p_batch_id: batchId,
      p_status: "completed",
      p_error_message: null,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    await supabase.rpc("admin_complete_reward_inventory_batch", {
      p_batch_id: batchId,
      p_status: "failed",
      p_error_message: error instanceof Error ? error.message : "Batch import failed.",
    });
    throw error;
  }

  revalidatePath("/admin/inventory/new");
  revalidatePath("/admin/rewards");
  revalidatePath(`/admin/rewards/${validation.rewardId}`);
  revalidatePath("/xp-store");
  redirect(
    `/admin/inventory/new?rewardId=${encodeURIComponent(validation.rewardId)}&mode=batch&saved=batch&count=${validation.values.length}`,
  );
}
