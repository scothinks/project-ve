import iconMetadata from "@/data/tabler-icons.json";

type TablerIconMetadata = {
  name: string;
  category?: string;
  tags?: string[];
};

export type TablerIconCatalogEntry = {
  value: string;
  label: string;
  category: string;
  keywords: string[];
  searchText: string;
};

function toLabel(iconName: string) {
  return iconName
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) {
        return part;
      }

      if (/^\d+[a-z]+$/i.test(part)) {
        return part.toUpperCase();
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

const typedIconMetadata = iconMetadata as Record<string, TablerIconMetadata>;

export const allRewardTablerIcons: TablerIconCatalogEntry[] = Object.entries(typedIconMetadata).map(
  ([value, meta]) => {
    const label = toLabel(value);
    const keywords = Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === "string") : [];

    return {
      value,
      label,
      category: typeof meta.category === "string" ? meta.category : "Other",
      keywords,
      searchText: `${value} ${label.toLowerCase()} ${keywords.join(" ").toLowerCase()}`,
    };
  },
);

export function searchTablerIcons(query: string, limit = 24) {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return [];
  }

  const startsWithMatches: TablerIconCatalogEntry[] = [];
  const containsMatches: TablerIconCatalogEntry[] = [];

  for (const option of allRewardTablerIcons) {
    if (option.value.startsWith(trimmed) || option.label.toLowerCase().startsWith(trimmed)) {
      startsWithMatches.push(option);
      continue;
    }

    if (option.searchText.includes(trimmed)) {
      containsMatches.push(option);
    }

    if (startsWithMatches.length + containsMatches.length >= limit * 2) {
      continue;
    }
  }

  return [...startsWithMatches, ...containsMatches].slice(0, limit);
}
