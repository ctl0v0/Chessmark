import type { BoardOrientation, CapturedPosition } from "../shared/types";
import { detectChessComBoard, findBestBoardCandidate, findPieceLikeElements, parsePieceLetter } from "./boardDetection";

type FenExtractionResult = {
  fen?: string;
  fenIsPartial?: boolean;
  method: "fen-direct" | "dom-reconstruction" | "screenshot-only";
};

const FULL_FEN_REGEX =
  /\b([prnbqkPRNBQK1-8]{1,8}(?:\/[prnbqkPRNBQK1-8]{1,8}){7})\s+([wb])\s+(-|[KQkq]{1,4})\s+(-|[a-h][36])\s+(\d+)\s+(\d+)\b/g;

const FEN_ATTRIBUTE_NAMES = [
  "fen",
  "data-fen",
  "data-position",
  "position",
  "data-game-fen",
  "data-current-fen"
];

export function captureCurrentPosition(): CapturedPosition {
  const detection = detectChessComBoard();

  if (!detection.found) {
    return {
      captureMethod: "screenshot-only",
      detection
    };
  }

  const candidate = findBestBoardCandidate();
  const board = candidate?.element;
  const directFen = extractFenFromUrl() ?? (board ? extractFenDirect(board) : extractFenFromDocument());

  if (directFen) {
    return {
      fen: directFen,
      fenIsPartial: false,
      orientation: detection.orientation,
      captureMethod: "fen-direct",
      boardRect: detection.boardRect,
      metadata: collectMetadata(),
      detection
    };
  }

  const reconstructed = board
    ? reconstructFenFromDom(board, detection.orientation)
    : { method: "screenshot-only" as const };

  return {
    fen: reconstructed.fen,
    fenIsPartial: reconstructed.fenIsPartial,
    orientation: detection.orientation,
    captureMethod: reconstructed.method,
    boardRect: detection.boardRect,
    metadata: collectMetadata(),
    detection
  };
}

export function extractFenDirect(board: HTMLElement): string | undefined {
  const attributeFen = extractFenFromAttributes(board);
  if (attributeFen) {
    return attributeFen;
  }

  const nearbyFen = findFenInText(board.outerHTML.slice(0, 120_000));
  if (nearbyFen) {
    return nearbyFen;
  }

  return extractFenFromDocument();
}

function extractFenFromAttributes(board: HTMLElement): string | undefined {
  const elements = [board, ...Array.from(board.querySelectorAll<HTMLElement>("*")).slice(0, 500)];

  for (const element of elements) {
    for (const attribute of FEN_ATTRIBUTE_NAMES) {
      const value = element.getAttribute(attribute);
      if (value) {
        const fen = findFenInText(value);
        if (fen) {
          return fen;
        }
      }
    }
  }

  return undefined;
}

function extractFenFromDocument(): string | undefined {
  const inputFen = findFenInInputs();
  if (inputFen) {
    return inputFen;
  }

  for (const script of Array.from(document.scripts).slice(0, 80)) {
    const text = script.textContent;
    if (!text || text.length < 20) {
      continue;
    }

    const fen = findFenInText(text.slice(0, 300_000));
    if (fen) {
      return fen;
    }
  }

  return undefined;
}

function extractFenFromUrl(): string | undefined {
  const url = new URL(window.location.href);
  const queryFen = url.searchParams.get("fen");
  if (queryFen) {
    const fen = findFenInText(queryFen.replace(/_/g, " "));
    if (fen) {
      return fen;
    }
  }

  const lichessMatch = url.pathname.match(/^\/analysis\/(?:standard\/)?(.+)$/);
  if (url.hostname === "lichess.org" && lichessMatch?.[1]) {
    const fenText = decodeURIComponent(lichessMatch[1]).replace(/_/g, " ");
    const fen = findFenInText(fenText);
    if (fen) {
      return fen;
    }
  }

  return undefined;
}

function findFenInInputs(): string | undefined {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");

  for (const field of fields) {
    const fen = findFenInText(field.value);
    if (fen) {
      return fen;
    }
  }

  return undefined;
}

function reconstructFenFromDom(board: HTMLElement, orientation: BoardOrientation | undefined): FenExtractionResult {
  const grid = createEmptyGrid();
  const pieces = findPieceLikeElements(board);
  let placedPieces = 0;

  for (const piece of pieces) {
    const letter = parsePieceLetter(piece);
    const square = readSquareFromClass(piece) ?? readSquareFromGeometry(piece, board, orientation);

    if (!letter || !square) {
      continue;
    }

    grid[8 - square.rank][square.file - 1] = letter;
    placedPieces += 1;
  }

  if (placedPieces === 0) {
    return { method: "screenshot-only" };
  }

  const placement = pieceGridToFenPlacement(grid);
  return {
    fen: `${placement} w - - 0 1`,
    fenIsPartial: true,
    method: "dom-reconstruction"
  };
}

function readSquareFromClass(element: HTMLElement): { file: number; rank: number } | undefined {
  const classText = String(element.className);
  const match = classText.match(/\bsquare-([1-8])([1-8])\b/);
  if (!match) {
    return undefined;
  }

  return {
    file: Number(match[1]),
    rank: Number(match[2])
  };
}

function readSquareFromGeometry(
  element: HTMLElement,
  board: HTMLElement,
  orientation: BoardOrientation | undefined
): { file: number; rank: number } | undefined {
  const boardRect = board.getBoundingClientRect();
  const pieceRect = element.getBoundingClientRect();
  const cellSize = boardRect.width / 8;

  if (cellSize <= 0 || pieceRect.width === 0 || pieceRect.height === 0) {
    return undefined;
  }

  const centerX = pieceRect.left + pieceRect.width / 2 - boardRect.left;
  const centerY = pieceRect.top + pieceRect.height / 2 - boardRect.top;
  const col = Math.floor(centerX / cellSize);
  const row = Math.floor(centerY / cellSize);

  if (col < 0 || col > 7 || row < 0 || row > 7) {
    return undefined;
  }

  if (orientation === "black") {
    return {
      file: 8 - col,
      rank: row + 1
    };
  }

  return {
    file: col + 1,
    rank: 8 - row
  };
}

function collectMetadata(): Record<string, string> {
  const metadata: Record<string, string> = {};
  const title = document.title?.trim();

  if (title) {
    metadata.pageTitle = title;
  }

  const gameIdMatch = window.location.pathname.match(/(?:game|analysis|live|daily|puzzles?)\/(?:[^/]+\/)?(\d+)/i);
  if (gameIdMatch) {
    metadata.gameId = gameIdMatch[1];
  }

  const playerNames = Array.from(
    document.querySelectorAll<HTMLElement>("[class*='player-name'], [data-cy*='player'], .user-tagline-username")
  )
    .map((element) => element.textContent?.trim())
    .filter((value): value is string => Boolean(value));

  if (playerNames[0]) {
    metadata.white = playerNames[0];
  }

  if (playerNames[1]) {
    metadata.black = playerNames[1];
  }

  return metadata;
}

function findFenInText(text: string): string | undefined {
  FULL_FEN_REGEX.lastIndex = 0;

  for (const match of text.matchAll(FULL_FEN_REGEX)) {
    const fen = match[0].trim();
    if (isPlausibleFen(fen)) {
      return fen;
    }
  }

  return undefined;
}

function isPlausibleFen(fen: string): boolean {
  const [placement, side, castling, enPassant, halfmove, fullmove] = fen.trim().split(/\s+/);

  if (!placement || (side !== "w" && side !== "b")) {
    return false;
  }

  if (!/^(-|[KQkq]{1,4})$/.test(castling) || !/^(-|[a-h][36])$/.test(enPassant)) {
    return false;
  }

  if (!/^\d+$/.test(halfmove) || !/^\d+$/.test(fullmove)) {
    return false;
  }

  const ranks = placement.split("/");
  return (
    ranks.length === 8 &&
    ranks.every((rank) => {
      let count = 0;

      for (const char of rank) {
        if (/[1-8]/.test(char)) {
          count += Number(char);
        } else if (/[prnbqkPRNBQK]/.test(char)) {
          count += 1;
        } else {
          return false;
        }
      }

      return count === 8;
    })
  );
}

function createEmptyGrid(): Array<Array<string | undefined>> {
  return Array.from({ length: 8 }, () => Array.from<string | undefined>({ length: 8 }).fill(undefined));
}

function pieceGridToFenPlacement(grid: Array<Array<string | undefined>>): string {
  return grid
    .map((rank) => {
      let result = "";
      let emptyCount = 0;

      for (const piece of rank) {
        if (!piece) {
          emptyCount += 1;
          continue;
        }

        if (emptyCount > 0) {
          result += String(emptyCount);
          emptyCount = 0;
        }

        result += piece;
      }

      if (emptyCount > 0) {
        result += String(emptyCount);
      }

      return result;
    })
    .join("/");
}
