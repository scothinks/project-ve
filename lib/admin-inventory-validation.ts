import {
  formFailed,
  formOk,
  getFormInteger,
  getFormString,
  getOptionalFormDate,
  getOptionalFormString,
} from "./form-data-validation.ts";
import type { ValidationIssue } from "./request-validation.ts";

function result<T>(issues: ValidationIssue[], data: T) {
  return issues.length > 0 ? formFailed<T>(issues) : formOk(data);
}

function checkDateOrder(
  issues: ValidationIssue[],
  availableFrom: string | null,
  expiresAt: string | null,
) {
  if (availableFrom && expiresAt && new Date(expiresAt) <= new Date(availableFrom)) {
    issues.push({ path: "expiresAt", message: "Must be after availableFrom." });
  }
}

export function parseInventoryBatchForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const availableFrom = getOptionalFormDate(formData, "availableFrom", issues);
  const expiresAt = getOptionalFormDate(formData, "expiresAt", issues);

  checkDateOrder(issues, availableFrom, expiresAt);

  return result(issues, {
    availableFrom,
    batchLabel: getOptionalFormString(formData, "batchLabel", issues, {
      allowEmpty: true,
      maxLength: 160,
    }) || null,
    campaignId: getOptionalFormString(formData, "campaignId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }) || null,
    expiresAt,
    inventoryText: getOptionalFormString(formData, "inventoryText", issues, {
      allowEmpty: true,
      maxLength: 2_000_000,
      trim: false,
    }),
    originalFileName: getOptionalFormString(formData, "originalFileName", issues, {
      allowEmpty: true,
      maxLength: 240,
    }) || null,
    partnerReference: getOptionalFormString(formData, "partnerReference", issues, {
      allowEmpty: true,
      maxLength: 160,
    }) || null,
    rewardId: getFormString(formData, "rewardId", issues, { maxLength: 120 }) ?? "",
    source: getOptionalFormString(formData, "source", issues, {
      allowEmpty: true,
      maxLength: 40,
    }) || "partner",
  });
}

export function parseSetInventoryQuantityForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const availableFrom = getOptionalFormDate(formData, "availableFrom", issues);
  const expiresAt = getOptionalFormDate(formData, "expiresAt", issues);

  checkDateOrder(issues, availableFrom, expiresAt);

  return result(issues, {
    availableFrom,
    batchLabel: getOptionalFormString(formData, "batchLabel", issues, {
      allowEmpty: true,
      maxLength: 160,
    }) || null,
    campaignId: getOptionalFormString(formData, "campaignId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }) || null,
    expiresAt,
    partnerReference: getOptionalFormString(formData, "partnerReference", issues, {
      allowEmpty: true,
      maxLength: 160,
    }) || null,
    reason: getOptionalFormString(formData, "reason", issues, {
      allowEmpty: true,
      maxLength: 300,
    }) || "Inventory quantity allocation",
    rewardId: getFormString(formData, "rewardId", issues, { maxLength: 120 }) ?? "",
    totalAvailable: getFormInteger(formData, "totalAvailable", issues, {
      fallback: 0,
      min: 0,
    }) ?? 0,
  });
}

export function parseReallocateInventoryForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const availableFrom = getOptionalFormDate(formData, "availableFrom", issues);
  const expiresAt = getOptionalFormDate(formData, "expiresAt", issues);

  checkDateOrder(issues, availableFrom, expiresAt);

  return result(issues, {
    availableFrom,
    expiresAt,
    fromCampaignId: getFormString(formData, "fromCampaignId", issues, { maxLength: 120 }) ?? "",
    quantity: getFormInteger(formData, "quantity", issues, {
      fallback: 0,
      min: 0,
    }) ?? 0,
    reason: getOptionalFormString(formData, "reason", issues, {
      allowEmpty: true,
      maxLength: 300,
    }) || "Inventory reallocation",
    rewardId: getFormString(formData, "rewardId", issues, { maxLength: 120 }) ?? "",
    toCampaignId: getFormString(formData, "toCampaignId", issues, { maxLength: 120 }) ?? "",
  });
}
