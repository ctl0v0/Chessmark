import type { BoardDetectionResult, BoardOrientation } from "../shared/types";
import { isUsefulBoardRect, rectVisibleArea, toDOMRectLike } from "./screenshotBounds";

export type BoardCandidate = {
  element: HTMLElement;
  selector: string;
  score: number;
  pieceCount: number;
};

const BOARD_SELECTORS = [
  "wc-chess-board",
  "chess-board",
  "cg-board",
  "cg-container",
  ".cg-wrap",
  "[data-cy='board']",
  "[data-test-element='board']",
  ".board",
  ".board-layout-board",
  ".game-board",
  ".analysis-board"
];

export function detectChessComBoard(): BoardDetectionResult {
  const candidate = findBestBoardCandidate();

  if (!candidate) {
    return {
      found: false,
      confidence: "low",
      reason: "No visible supported chess board was detected.",
      viewport: getViewport()
    };
  }

  const rect = candidate.element.getBoundingClientRect();
  const confidence = candidate.pieceCount >= 8 || candidate.selector.includes("chess-board") ? "high" : "medium";

  return {
    found: true,
    boardElementSelector: candidate.selector,
    boardRect: toDOMRectLike(rect),
    orientation: detectBoardOrientation(candidate.element),
    confidence,
    reason: candidate.pieceCount > 0 ? `${candidate.pieceCount} visible piece elements found.` : "Board element found.",
    viewport: getViewport()
  };
}

export function findBestBoardCandidate(): BoardCandidate | undefined {
  const seen = new Set<HTMLElement>();
  const candidates: BoardCandidate[] = [];

  for (const selector of BOARD_SELECTORS) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (seen.has(element)) {
        continue;
      }

      seen.add(element);
      const rect = element.getBoundingClientRect();
      const visibleArea = rectVisibleArea(rect);
      if (!isUsefulBoardRect(rect) || visibleArea < 10_000) {
        continue;
      }

      const pieceCount = countPieceLikeElements(element);
      const selectorWeight =
        selector.includes("chess-board") || selector.includes("wc-chess-board") || selector.includes("cg-board")
          ? 80
          : 30;
      const score = selectorWeight + pieceCount * 4 + Math.min(40, visibleArea / 12_000);

      candidates.push({ element, selector, score, pieceCount });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export function detectBoardOrientation(board: HTMLElement): BoardOrientation | undefined {
  const orientationText = [
    board.getAttribute("orientation"),
    board.getAttribute("data-orientation"),
    board.getAttribute("data-board-orientation"),
    board.className,
    board.parentElement?.className,
    board.closest(".orientation-white, .orientation-black, .flipped")?.className
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(black|flipped|flip-black|board-flipped)\b/.test(orientationText)) {
    return "black";
  }

  if (/\b(white|not-flipped|flip-white)\b/.test(orientationText)) {
    return "white";
  }

  return undefined;
}

export function countPieceLikeElements(board: HTMLElement): number {
  return findPieceLikeElements(board).length;
}

export function findPieceLikeElements(board: HTMLElement): HTMLElement[] {
  const matches = board.querySelectorAll<HTMLElement>(
    "piece, .piece, [class*='piece'], [class*='square-'], [data-piece], [aria-label*='piece' i], img[src*='pieces'], img[src*='piece']"
  );

  return Array.from(matches).filter((element) => element !== board && parsePieceLetter(element));
}

export function parsePieceLetter(element: HTMLElement): string | undefined {
  const haystack = [
    element.className,
    element.getAttribute("data-piece"),
    element.getAttribute("piece"),
    element.getAttribute("aria-label"),
    element.getAttribute("alt"),
    element instanceof HTMLImageElement ? element.src : undefined
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const compactMatch = haystack.match(/\b([wb])([prnbqk])\b/);
  if (compactMatch) {
    return compactMatch[1] === "w" ? compactMatch[2].toUpperCase() : compactMatch[2];
  }

  const colorMatch = haystack.match(/\b(white|black)\b/);
  const pieceMatch = haystack.match(/\b(pawn|rook|knight|bishop|queen|king)\b/);

  if (!colorMatch || !pieceMatch) {
    return undefined;
  }

  const pieceByName: Record<string, string> = {
    pawn: "p",
    rook: "r",
    knight: "n",
    bishop: "b",
    queen: "q",
    king: "k"
  };

  const letter = pieceByName[pieceMatch[1]];
  return colorMatch[1] === "white" ? letter.toUpperCase() : letter;
}

function getViewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1
  };
}
