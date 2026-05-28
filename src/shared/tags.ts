export const DEFAULT_TAG_PRESETS = ["tactic", "endgame", "mistake"];

export function parseTags(value: string): string[] {
  const tags = new Set<string>();

  for (const tag of value.split(",")) {
    const normalized = normalizeTag(tag);
    if (normalized) {
      tags.add(normalized);
    }
  }

  return Array.from(tags);
}

export function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
}

export function mergeTags(...tagGroups: string[][]): string[] {
  const merged = new Set<string>();

  for (const group of tagGroups) {
    for (const tag of group) {
      const normalized = normalizeTag(tag);
      if (normalized) {
        merged.add(normalized);
      }
    }
  }

  return Array.from(merged);
}

export function tagsToInputValue(tags: string[]): string {
  return tags.join(", ");
}
