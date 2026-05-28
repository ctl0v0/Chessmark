import type { BoardOrientation, PositionBookmark, Site } from "./types";

export function buildAnalysisUrl(bookmark: PositionBookmark): string | null {
  if (!bookmark.position.fen) {
    return null;
  }

  if (bookmark.source.site === "lichess.org") {
    return buildLichessAnalysisUrl(bookmark.position.fen, bookmark.position.orientation);
  }

  return buildChessComAnalysisUrl(bookmark.position.fen, bookmark.position.orientation);
}

export function buildChessComAnalysisUrl(fen: string, orientation?: BoardOrientation): string {
  const url = new URL("https://www.chess.com/analysis");
  url.searchParams.set("fen", fen);

  if (orientation === "black") {
    url.searchParams.set("flip", "true");
  }

  return url.toString();
}

export function buildLichessAnalysisUrl(fen: string, orientation?: BoardOrientation): string {
  const encodedFen = fen.trim().replace(/\s+/g, "_");
  const url = new URL(`https://lichess.org/analysis/standard/${encodedFen}`);

  if (orientation) {
    url.searchParams.set("color", orientation);
  }

  return url.toString();
}

export function isChessComUrl(url?: string): boolean {
  return getSupportedSite(url) === "chess.com";
}

export function isLichessUrl(url?: string): boolean {
  return getSupportedSite(url) === "lichess.org";
}

export function isSupportedSiteUrl(url?: string): boolean {
  return Boolean(getSupportedSite(url));
}

export function getSupportedSite(url?: string): Site | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "www.chess.com" || parsed.hostname === "chess.com") {
      return "chess.com";
    }

    if (parsed.hostname === "lichess.org") {
      return "lichess.org";
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function siteLabel(site?: Site): string {
  if (site === "lichess.org") {
    return "Lichess";
  }

  return "Chess.com";
}
