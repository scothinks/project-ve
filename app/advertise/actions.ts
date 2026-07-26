"use server";

import { redirect } from "next/navigation";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function normalizeEmail(value: FormDataEntryValue | null) {
  return sanitizePlainTextInput(String(value ?? ""), 254).trim().toLowerCase();
}

function requireHttpsUrl(value: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("Website must use HTTPS.");
    }
    return url.toString();
  } catch {
    throw new Error("Website must be a valid HTTPS URL.");
  }
}

export async function submitSponsorInquiry(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Sponsor inquiries are unavailable.");
  }

  const contactName = sanitizePlainTextInput(String(formData.get("contactName") ?? ""), 160).trim();
  const organizationName = sanitizePlainTextInput(
    String(formData.get("organizationName") ?? ""),
    180,
  ).trim();
  const email = normalizeEmail(formData.get("email"));
  const websiteUrl = requireHttpsUrl(
    sanitizePlainTextInput(String(formData.get("websiteUrl") ?? ""), 300).trim(),
  );
  const campaignGoal = sanitizePlainTextInput(
    String(formData.get("campaignGoal") ?? ""),
    1000,
  ).trim();

  if (!contactName) throw new Error("Contact name is required.");
  if (!organizationName) throw new Error("Organization name is required.");
  if (!email) throw new Error("Email is required.");
  if (!campaignGoal) throw new Error("Campaign goal is required.");

  const { error } = await supabase.rpc("submit_ad_sponsor_inquiry", {
    p_contact_name: contactName,
    p_organization_name: organizationName,
    p_email: email,
    p_website_url: websiteUrl,
    p_role_title: sanitizePlainTextInput(String(formData.get("roleTitle") ?? ""), 160).trim(),
    p_campaign_goal: campaignGoal,
    p_placement_interest: sanitizePlainTextInput(
      String(formData.get("placementInterest") ?? ""),
      240,
    ).trim(),
    p_budget_range: sanitizePlainTextInput(String(formData.get("budgetRange") ?? ""), 80).trim(),
    p_timing: sanitizePlainTextInput(String(formData.get("timing") ?? ""), 120).trim(),
    p_metadata: {
      sourcePath: "/advertise/inquiry",
    },
  });

  if (error) throw error;

  redirect("/advertise/inquiry?submitted=1");
}
