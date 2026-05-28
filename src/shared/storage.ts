import { BOOKMARKS_STORAGE_KEY, TAG_PRESETS_STORAGE_KEY } from "./constants";
import { bookmarkToFenExportLine } from "./fen";
import { DEFAULT_TAG_PRESETS, mergeTags, normalizeTag } from "./tags";
import type { PositionBookmark } from "./types";

const STORAGE_HEADROOM_BYTES = 120_000;
const QUOTA_BYTES_FALLBACK = 10_485_760;

export class StorageQuotaError extends Error {
  constructor() {
    super(
      "Not enough local storage to save this position. Export or delete older bookmarks, then try again."
    );
    this.name = "StorageQuotaError";
  }
}

export async function saveBookmark(bookmark: PositionBookmark): Promise<void> {
  const bookmarks = await getBookmarks();
  await setBookmarks([bookmark, ...bookmarks]);
}

export async function getBookmarks(): Promise<PositionBookmark[]> {
  const result = await chrome.storage.local.get(BOOKMARKS_STORAGE_KEY);
  const bookmarks = result[BOOKMARKS_STORAGE_KEY];
  return Array.isArray(bookmarks) ? bookmarks : [];
}

export async function updateBookmark(id: string, patch: Partial<PositionBookmark>): Promise<void> {
  const bookmarks = await getBookmarks();
  const updated = bookmarks.map((bookmark) => {
    if (bookmark.id !== id) {
      return bookmark;
    }

    return deepMerge(bookmark, {
      ...patch,
      updatedAt: new Date().toISOString()
    });
  });

  await setBookmarks(updated);
}

export async function deleteBookmark(id: string): Promise<void> {
  const bookmarks = await getBookmarks();
  await setBookmarks(bookmarks.filter((bookmark) => bookmark.id !== id));
}

export async function clearBookmarks(): Promise<void> {
  await chrome.storage.local.set({ [BOOKMARKS_STORAGE_KEY]: [] });
}

export async function exportBookmarks(): Promise<string> {
  const bookmarks = await getBookmarks();
  return JSON.stringify(bookmarks, null, 2);
}

export async function exportFenText(): Promise<string> {
  const bookmarks = await getBookmarks();
  return bookmarks.map(bookmarkToFenExportLine).filter(Boolean).join("\n");
}

export async function getTagPresets(): Promise<string[]> {
  const result = await chrome.storage.local.get(TAG_PRESETS_STORAGE_KEY);
  const stored = result[TAG_PRESETS_STORAGE_KEY];
  return Array.isArray(stored) ? mergeTags(stored) : DEFAULT_TAG_PRESETS;
}

export async function saveTagPresets(tags: string[]): Promise<void> {
  await chrome.storage.local.set({ [TAG_PRESETS_STORAGE_KEY]: mergeTags(tags) });
}

export async function addTagPresets(tags: string[]): Promise<string[]> {
  const current = await getTagPresets();
  const updated = mergeTags(current, tags);
  await chrome.storage.local.set({ [TAG_PRESETS_STORAGE_KEY]: updated });
  return updated;
}

export async function deleteTagPreset(tag: string): Promise<string[]> {
  const normalized = normalizeTag(tag);
  const current = await getTagPresets();
  const updated = current.filter((preset) => preset !== normalized);
  await chrome.storage.local.set({ [TAG_PRESETS_STORAGE_KEY]: updated });
  return updated;
}

async function setBookmarks(bookmarks: PositionBookmark[]): Promise<void> {
  await assertLocalStorageRoom({ [BOOKMARKS_STORAGE_KEY]: bookmarks });

  try {
    await chrome.storage.local.set({ [BOOKMARKS_STORAGE_KEY]: bookmarks });
  } catch (error) {
    if (isQuotaError(error)) {
      throw new StorageQuotaError();
    }

    throw error;
  }
}

async function assertLocalStorageRoom(update: Record<string, unknown>): Promise<void> {
  const [existing, currentBytes] = await Promise.all([
    chrome.storage.local.get(null),
    chrome.storage.local.getBytesInUse(null)
  ]);
  const nextBytes = estimateStorageBytes({ ...existing, ...update });
  const quotaBytes = chrome.storage.local.QUOTA_BYTES ?? QUOTA_BYTES_FALLBACK;

  if (currentBytes > quotaBytes || nextBytes > quotaBytes - STORAGE_HEADROOM_BYTES) {
    throw new StorageQuotaError();
  }
}

function estimateStorageBytes(values: Record<string, unknown>): number {
  return Object.entries(values).reduce((total, [key, value]) => {
    const serializedValue = JSON.stringify(value) ?? "null";
    return total + key.length + serializedValue.length;
  }, 0);
}

function isQuotaError(error: unknown): boolean {
  return error instanceof Error && /quota|QUOTA_BYTES/i.test(error.message);
}

function deepMerge<T extends Record<string, unknown>>(target: T, patch: Partial<T>): T {
  const output: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
