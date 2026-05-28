import type { PositionBookmark } from "./types";
import { getBookmarkDisplayTitle } from "./bookmarkDisplay";

const FULL_FEN_REGEX =
  /\b([prnbqkPRNBQK1-8]{1,8}(?:\/[prnbqkPRNBQK1-8]{1,8}){7})\s+([wb])\s+(-|[KQkq]{1,4})\s+(-|[a-h][36])\s+(\d+)\s+(\d+)\b/g;

export type ParsedFen = {
  fen: string;
  placement: string;
  sideToMove: "w" | "b";
  castlingRights: string;
  enPassantSquare: string;
  halfmoveClock: number;
  fullmoveNumber: number;
};

export function findFenInText(text: string): string | undefined {
  FULL_FEN_REGEX.lastIndex = 0;

  for (const match of text.matchAll(FULL_FEN_REGEX)) {
    const fen = match[0].trim();
    if (isPlausibleFen(fen)) {
      return fen;
    }
  }

  return undefined;
}

export function isPlausibleFen(fen: string): boolean {
  const parsed = parseFen(fen);
  return Boolean(parsed);
}

export function parseFen(fen: string): ParsedFen | undefined {
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) {
    return undefined;
  }

  const [placement, sideToMove, castlingRights, enPassantSquare, halfmove, fullmove] = parts;
  if (sideToMove !== "w" && sideToMove !== "b") {
    return undefined;
  }

  if (!/^(-|[KQkq]{1,4})$/.test(castlingRights) || !/^(-|[a-h][36])$/.test(enPassantSquare)) {
    return undefined;
  }

  const ranks = placement.split("/");
  if (ranks.length !== 8) {
    return undefined;
  }

  const ranksAreValid = ranks.every((rank) => {
    let fileCount = 0;
    for (const char of rank) {
      if (/[1-8]/.test(char)) {
        fileCount += Number(char);
      } else if (/[prnbqkPRNBQK]/.test(char)) {
        fileCount += 1;
      } else {
        return false;
      }
    }

    return fileCount === 8;
  });

  if (!ranksAreValid) {
    return undefined;
  }

  const halfmoveClock = Number(halfmove);
  const fullmoveNumber = Number(fullmove);
  if (!Number.isInteger(halfmoveClock) || !Number.isInteger(fullmoveNumber) || fullmoveNumber < 1) {
    return undefined;
  }

  return {
    fen: parts.join(" "),
    placement,
    sideToMove,
    castlingRights,
    enPassantSquare,
    halfmoveClock,
    fullmoveNumber
  };
}

export function pieceGridToFenPlacement(grid: Array<Array<string | undefined>>): string {
  return grid
    .map((rank) => {
      let emptyCount = 0;
      let rankText = "";

      for (const piece of rank) {
        if (!piece) {
          emptyCount += 1;
          continue;
        }

        if (emptyCount > 0) {
          rankText += String(emptyCount);
          emptyCount = 0;
        }

        rankText += piece;
      }

      if (emptyCount > 0) {
        rankText += String(emptyCount);
      }

      return rankText;
    })
    .join("/");
}

export function bookmarkToFenExportLine(bookmark: PositionBookmark): string | undefined {
  if (!bookmark.position.fen) {
    return undefined;
  }

  const label = getBookmarkDisplayTitle(bookmark) || bookmark.source.url;
  const tags = bookmark.userContent.tags.length > 0 ? ` [${bookmark.userContent.tags.join(", ")}]` : "";
  return `${bookmark.position.fen} ; ${label}${tags}`;
}
