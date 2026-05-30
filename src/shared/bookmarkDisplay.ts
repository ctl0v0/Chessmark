import type { GameMetadata, PositionBookmark, Site } from "./types";
import { siteLabel } from "./urls";

const GENERIC_TITLE_PATTERNS = [
  /learn chess online/i,
  /lessons, openings/i,
  /play chess online/i,
  /free online chess/i,
  /chess\.com/i,
  /^lichess\.org/i
];

export function buildBookmarkTitle(input: {
  site: Site;
  notes?: string;
  tags: string[];
  metadata?: GameMetadata;
  pageTitle?: string;
  fen?: string;
}): string {
  const noteTitle = firstUsefulSentence(input.notes);
  if (noteTitle) {
    return noteTitle;
  }

  const players = buildPlayersTitle(input.metadata);
  if (players) {
    return players;
  }

  if (input.tags.length > 0) {
    return `${capitalize(input.tags[0])} position`;
  }

  const usefulPageTitle = cleanPageTitle(input.pageTitle);
  if (usefulPageTitle) {
    return usefulPageTitle;
  }

  const side = input.fen?.split(/\s+/)[1];
  const sideText = side === "w" ? "White to move" : side === "b" ? "Black to move" : "Saved position";
  return `${siteLabel(input.site)} position - ${sideText}`;
}

export function getBookmarkDisplayTitle(bookmark: PositionBookmark): string {
  return (
    bookmark.userContent.title ||
    buildBookmarkTitle({
      site: bookmark.source.site,
      notes: bookmark.userContent.notes,
      tags: bookmark.userContent.tags,
      metadata: bookmark.game,
      pageTitle: bookmark.source.pageTitle,
      fen: bookmark.position.fen
    })
  );
}

function firstUsefulSentence(notes?: string): string | undefined {
  const trimmed = notes?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.split(/\r?\n|(?<=[.!?])\s+/)[0]?.slice(0, 80);
}

function buildPlayersTitle(metadata?: GameMetadata): string | undefined {
  const white = metadata?.white?.trim();
  const black = metadata?.black?.trim();

  if (white && black) {
    return `${white} vs ${black}`;
  }

  return white || black;
}

function cleanPageTitle(pageTitle?: string): string | undefined {
  const title = pageTitle
    ?.replace(/\s*-\s*Chess\.com\s*$/i, "")
    .replace(/\s*[-|]\s*lichess\.org\s*$/i, "")
    .trim();

  if (!title || title.length < 4) {
    return undefined;
  }

  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(pageTitle ?? ""))) {
    return undefined;
  }

  return title.slice(0, 80);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
