"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { sanitizePlainTextInput } from "@/lib/input-safety";

const validSlugs = new Set(["faq", "terms", "privacy"]);

function normalizeBody(value: string, maxLength: number) {
  return sanitizePlainTextInput(value, maxLength).replace(/\r\n/g, "\n").trim();
}

export async function saveStaticContentPage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();

  if (!validSlugs.has(slug)) {
    throw new Error("Unsupported content page.");
  }

  const title = sanitizePlainTextInput(String(formData.get("title") ?? ""), 160).trim();
  const subtitle = sanitizePlainTextInput(String(formData.get("subtitle") ?? ""), 300).trim();
  const isPublished = String(formData.get("isPublished") ?? "") === "true";

  if (!title) {
    throw new Error("Enter a title.");
  }

  let body = "";
  let faqItems: { question: string; answer: string }[] = [];

  if (slug === "faq") {
    const rawFaqItems = String(formData.get("faqItemsJson") ?? "[]");
    const parsed = JSON.parse(rawFaqItems) as Array<{ question?: string; answer?: string }>;
    faqItems = parsed
      .map((item) => ({
        question: sanitizePlainTextInput(String(item.question ?? ""), 240).trim(),
        answer: normalizeBody(String(item.answer ?? ""), 2000),
      }))
      .filter((item) => item.question && item.answer);

    if (faqItems.length === 0) {
      throw new Error("Add at least one FAQ item.");
    }
  } else {
    body = normalizeBody(String(formData.get("body") ?? ""), 20000);
    if (!body) {
      throw new Error(slug === "privacy" ? "Enter the privacy body." : "Enter the terms body.");
    }
  }

  const { error } = await supabase.from("static_content_pages").upsert({
    slug,
    title,
    subtitle: subtitle || null,
    body,
    faq_items: faqItems,
    is_published: isPublished,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/content");
  revalidatePath("/faq");
  revalidatePath("/terms");
  revalidatePath("/privacy");
  revalidatePath("/profile");
  revalidatePath("/login");
  redirect(`/admin/content?saved=${slug}`);
}
