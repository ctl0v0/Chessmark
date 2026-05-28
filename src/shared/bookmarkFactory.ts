import { EXTENSION_VERSION } from "./constants";
import { buildBookmarkTitle } from "./bookmarkDisplay";
import { parseFen } from "./fen";
import type { BookmarkDraft, CapturedPosition, PositionBookmark } from "./types";
import { getSupportedSite } from "./urls";

export function createBookmarkFromCapture(input: {
  capture: CapturedPosition;
  draft: BookmarkDraft;
  screenshot?: {
    dataUrl?: string;
    width?: number;
    height?: number;
  };
  tab: {
    url: string;
    title?: string;
  };
}): PositionBookmark {
  const now = new Date().toISOString();
  const parsedFen = input.capture.fen ? parseFen(input.capture.fen) : undefined;
  const site = getSupportedSite(input.tab.url) ?? "chess.com";
  const title = buildBookmarkTitle({
    createdAt: now,
    site,
    notes: input.draft.notes,
    tags: input.draft.tags,
    metadata: input.capture.metadata,
    pageTitle: input.tab.title,
    fen: input.capture.fen
  });

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    source: {
      site,
      url: input.tab.url,
      pageTitle: input.tab.title
    },
    position: {
      fen: input.capture.fen,
      fenIsPartial: input.capture.fenIsPartial,
      sideToMove: parsedFen?.sideToMove,
      orientation: input.capture.orientation,
      castlingRights: parsedFen?.castlingRights,
      enPassantSquare: parsedFen?.enPassantSquare,
      halfmoveClock: parsedFen?.halfmoveClock,
      fullmoveNumber: parsedFen?.fullmoveNumber
    },
    screenshot: {
      dataUrl: input.screenshot?.dataUrl,
      width: input.screenshot?.width,
      height: input.screenshot?.height
    },
    game: input.capture.metadata,
    userContent: {
      title,
      notes: input.draft.notes?.trim() || undefined,
      tags: input.draft.tags
    },
    technical: {
      captureMethod: input.capture.captureMethod,
      extensionVersion: EXTENSION_VERSION
    }
  };
}
