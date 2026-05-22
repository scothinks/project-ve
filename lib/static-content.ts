import { createSupabaseServerClient } from "@/lib/supabase-server";

export type StaticContentSlug = "faq" | "terms" | "privacy";

export type FaqItem = {
  question: string;
  answer: string;
};

export type StaticContentPage = {
  slug: StaticContentSlug;
  title: string;
  subtitle: string;
  body: string;
  faqItems: FaqItem[];
  isPublished: boolean;
  updatedAt: string | null;
};

type StaticContentRow = {
  slug: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  faq_items: unknown;
  is_published: boolean | null;
  updated_at: string | null;
};

const defaultPages: Record<StaticContentSlug, StaticContentPage> = {
  faq: {
    slug: "faq",
    title: "Frequently asked questions",
    subtitle: "Quick answers about lessons, XP, rewards, and missions.",
    body: "",
    faqItems: [
      {
        question: "How do I earn XP?",
        answer: "You earn XP by answering quiz questions correctly and by completing valid missions.",
      },
      {
        question: "Why can't I earn quiz XP right now?",
        answer:
          "You may have reached your daily quiz XP limit. You can keep reading lessons and return when quiz XP unlocks again.",
      },
      {
        question: "Can I repeat a lesson?",
        answer:
          "Yes. Some lessons allow retries right away, while others require a reread or cooldown before more XP can be earned.",
      },
      {
        question: "Where do I use my XP?",
        answer: "Open the XP Store to redeem eligible rewards or unlock a surprise perk.",
      },
      {
        question: "How do missions work?",
        answer:
          "Missions reward extra XP for validated actions like finishing learning tasks, referrals, or approved proof submissions.",
      },
    ],
    isPublished: true,
    updatedAt: null,
  },
  terms: {
    slug: "terms",
    title: "Terms",
    subtitle: "The rules for using Project VE.",
    body:
      "Project VE is a learning product. We may change lessons, rewards, missions, or XP rules when needed to protect fairness, prevent abuse, or improve the experience.\n\n" +
      "You are responsible for using accurate account information. Rewards, mission approvals, and XP grants may be paused, reversed, or cancelled if we detect abuse, duplicate accounts, or misleading submissions.\n\n" +
      "Some rewards are fulfilled by third parties. When that applies, your reward details may be shared only as needed to complete the redemption process.\n\n" +
      "XP has no cash value. We may set caps, cooldowns, retry rules, or reward limits to protect the system and keep access fair.\n\n" +
      "By continuing to use Project VE, you agree to these rules and any future updates shown in the app.",
    faqItems: [],
    isPublished: true,
    updatedAt: null,
  },
  privacy: {
    slug: "privacy",
    title: "Privacy",
    subtitle: "How Project VE handles your data.",
    body:
      "Project VE collects the information needed to run your account, track learning progress, award XP, and fulfill rewards.\n\n" +
      "We may store details such as your name, email address, lesson progress, quiz activity, mission activity, and reward redemption history.\n\n" +
      "When you redeem a partner-managed reward, we may share only the details required to fulfill that reward. We do not share more than is needed for that process.\n\n" +
      "We use system limits, audits, and fraud controls to protect the platform and keep XP, rewards, and missions fair.\n\n" +
      "If our privacy practices change, we will update this page in the app.",
    faqItems: [],
    isPublished: true,
    updatedAt: null,
  },
};

function normalizeFaqItems(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const question = typeof (item as { question?: unknown }).question === "string" ? (item as { question: string }).question.trim() : "";
      const answer = typeof (item as { answer?: unknown }).answer === "string" ? (item as { answer: string }).answer.trim() : "";

      if (!question || !answer) {
        return null;
      }

      return { question, answer };
    })
    .filter((item): item is FaqItem => Boolean(item));
}

function toStaticContentPage(slug: StaticContentSlug, row?: StaticContentRow | null): StaticContentPage {
  const fallback = defaultPages[slug];

  if (!row) {
    return fallback;
  }

  return {
    slug,
    title: row.title || fallback.title,
    subtitle: row.subtitle?.trim() || fallback.subtitle,
    body: row.body ?? fallback.body,
    faqItems: normalizeFaqItems(row.faq_items).length > 0 ? normalizeFaqItems(row.faq_items) : fallback.faqItems,
    isPublished: row.is_published ?? fallback.isPublished,
    updatedAt: row.updated_at,
  };
}

export async function getStaticContentPage(slug: StaticContentSlug): Promise<StaticContentPage> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return defaultPages[slug];
  }

  const { data } = await supabase
    .from("static_content_pages")
    .select("slug, title, subtitle, body, faq_items, is_published, updated_at")
    .eq("slug", slug)
    .maybeSingle<StaticContentRow>();

  return toStaticContentPage(slug, data);
}

export function getDefaultStaticContentPages() {
  return defaultPages;
}
