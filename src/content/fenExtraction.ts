import type { BoardOrientation, CapturedPosition, GameMetadata, PlayerColor, TimeClass } from "../shared/types";
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
      metadata: collectMetadata(detection.orientation),
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
    metadata: collectMetadata(detection.orientation),
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

type PlayerSnapshot = {
  name?: string;
  rating?: number;
};

const TOP_PLAYER_SELECTORS = [
  "[class*='board-layout-player-top']",
  "[class*='player-top']",
  "[class*='player-component-top']",
  "[data-cy*='player-top']",
  ".ruser-top",
  ".ruser.top"
];

const BOTTOM_PLAYER_SELECTORS = [
  "[class*='board-layout-player-bottom']",
  "[class*='player-bottom']",
  "[class*='player-component-bottom']",
  "[data-cy*='player-bottom']",
  ".ruser-bottom",
  ".ruser.bottom"
];

const PLAYER_CONTAINER_SELECTORS = [
  "[class*='board-layout-player']",
  "[class*='player-component']",
  "[class*='player-row']",
  "[class*='player-info']",
  "[class*='player-tag']",
  "[data-cy*='player']",
  ".ruser",
  ".user-tagline",
  ".user-link"
];

const PLAYER_NAME_SELECTORS = [
  "a[href*='/member/']",
  "a[href^='/@/']",
  "[class*='user-tagline-username']",
  "[class*='username']",
  "[class*='user-name']",
  "[class*='player-name']",
  ".user-link"
];

const TIME_CONTROL_SELECTORS = [
  "[class*='time-control']",
  "[class*='timeControl']",
  "[class*='game-time']",
  "[class*='game-speed']",
  "[class*='game-meta']",
  "[class*='game__meta']",
  "[class*='setup']",
  "[data-cy*='time']",
  "[data-test*='time']"
];

function collectMetadata(orientation: BoardOrientation | undefined): GameMetadata {
  const metadata: GameMetadata = {};
  const title = document.title?.trim();

  if (title) {
    metadata.pageTitle = title;
  }

  const gameIdMatch = window.location.pathname.match(/(?:game|analysis|live|daily|puzzles?)\/(?:[^/]+\/)?(\d+)/i);
  if (gameIdMatch) {
    metadata.gameId = gameIdMatch[1];
  }

  Object.assign(metadata, collectPlayerMetadata(orientation), collectTimeControlMetadata());

  return metadata;
}

function collectPlayerMetadata(orientation: BoardOrientation | undefined): GameMetadata {
  const metadata: GameMetadata = {};
  const topPlayer = findPlayerBySelectors(TOP_PLAYER_SELECTORS);
  const bottomPlayer = findPlayerBySelectors(BOTTOM_PLAYER_SELECTORS);

  if (topPlayer && orientation) {
    assignPlayer(metadata, orientation === "white" ? "black" : "white", topPlayer);
  }

  if (bottomPlayer && orientation) {
    assignPlayer(metadata, orientation, bottomPlayer);
    metadata.myColor = orientation;
  }

  if (!metadata.white || metadata.whiteRating === undefined) {
    const whitePlayer = findPlayerByColor("white");
    if (whitePlayer) {
      assignPlayer(metadata, "white", whitePlayer);
    }
  }

  if (!metadata.black || metadata.blackRating === undefined) {
    const blackPlayer = findPlayerByColor("black");
    if (blackPlayer) {
      assignPlayer(metadata, "black", blackPlayer);
    }
  }

  if (!metadata.white && !metadata.black) {
    const orderedPlayers = findOrderedPlayers();

    if (orderedPlayers[0]) {
      assignPlayer(metadata, "white", orderedPlayers[0]);
    }

    if (orderedPlayers[1]) {
      assignPlayer(metadata, "black", orderedPlayers[1]);
    }
  }

  if (!metadata.myColor && orientation && (metadata.whiteRating !== undefined || metadata.blackRating !== undefined)) {
    metadata.myColor = orientation;
  }

  applyPerspectiveRatings(metadata);
  return metadata;
}

function findPlayerBySelectors(selectors: string[]): PlayerSnapshot | undefined {
  for (const selector of selectors) {
    const element = firstVisibleElement(selector);
    const player = element ? extractPlayerSnapshot(element) : undefined;
    if (player) {
      return player;
    }
  }

  return undefined;
}

function findPlayerByColor(color: PlayerColor): PlayerSnapshot | undefined {
  const selector = [
    `[class*='player'][class*='${color}']`,
    `[class*='${color}'][class*='player']`,
    `.ruser.${color}`,
    `.player.${color}`
  ].join(",");

  const element = firstVisibleElement(selector);
  return element ? extractPlayerSnapshot(element) : undefined;
}

function findOrderedPlayers(): PlayerSnapshot[] {
  const containers = dedupeElements(
    PLAYER_CONTAINER_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
  );
  const players = containers.map(extractPlayerSnapshot).filter((player): player is PlayerSnapshot => Boolean(player));

  if (players.length >= 2) {
    return dedupePlayers(players).slice(0, 2);
  }

  const nameElements = dedupeElements(
    PLAYER_NAME_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
  );

  return dedupePlayers(
    nameElements
      .map((element) => extractPlayerSnapshot(findClosestPlayerContainer(element) ?? element))
      .filter((player): player is PlayerSnapshot => Boolean(player))
  ).slice(0, 2);
}

function extractPlayerSnapshot(element: HTMLElement): PlayerSnapshot | undefined {
  if (!isVisibleElement(element)) {
    return undefined;
  }

  const text = visibleText(element);
  if (!text || text.length > 220 || /fen|analysis board/i.test(text)) {
    return undefined;
  }

  const name =
    readNameFromHref(element) ??
    readNameFromNameElement(element) ??
    cleanPlayerName(text);
  const rating = extractRating(text);

  if (!name && rating === undefined) {
    return undefined;
  }

  return { name, rating };
}

function readNameFromHref(element: HTMLElement): string | undefined {
  const link = element.matches("a") ? element : element.querySelector<HTMLAnchorElement>("a[href*='/member/'], a[href^='/@/']");
  const href = link instanceof HTMLAnchorElement ? link.getAttribute("href") : undefined;
  if (!href) {
    return undefined;
  }

  const memberMatch = href.match(/\/member\/([^/?#]+)/i);
  const lichessMatch = href.match(/\/@\/([^/?#]+)/i);
  return cleanPlayerName(decodeURIComponent(memberMatch?.[1] ?? lichessMatch?.[1] ?? ""));
}

function readNameFromNameElement(element: HTMLElement): string | undefined {
  for (const selector of PLAYER_NAME_SELECTORS) {
    const nameElement = element.matches(selector) ? element : element.querySelector<HTMLElement>(selector);
    const name = cleanPlayerName(nameElement?.textContent ?? "");
    if (name) {
      return name;
    }
  }

  return undefined;
}

function cleanPlayerName(value: string): string | undefined {
  const cleaned = value
    .replace(/\(\s*\d{3,4}\??\s*\)/g, " ")
    .replace(/\b([4-9]\d{2}|[1-3]\d{3})\??\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ")
    .replace(/\b(white|black|rated|casual|bullet|blitz|rapid|classical|correspondence)\b/gi, " ")
    .replace(/[|•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 2 || /^\d+$/.test(cleaned)) {
    return undefined;
  }

  return cleaned.slice(0, 60);
}

function extractRating(text: string): number | undefined {
  for (const match of text.matchAll(/\b([4-9]\d{2}|[1-3]\d{3})\??\b/g)) {
    const rating = Number(match[1]);
    if (rating >= 400 && rating <= 3999) {
      return rating;
    }
  }

  return undefined;
}

function assignPlayer(metadata: GameMetadata, color: PlayerColor, player: PlayerSnapshot): void {
  if (color === "white") {
    metadata.white = player.name ?? metadata.white;
    metadata.whiteRating = player.rating ?? metadata.whiteRating;
    return;
  }

  metadata.black = player.name ?? metadata.black;
  metadata.blackRating = player.rating ?? metadata.blackRating;
}

function applyPerspectiveRatings(metadata: GameMetadata): void {
  if (metadata.myColor === "white") {
    metadata.myRating = metadata.whiteRating;
    metadata.opponentRating = metadata.blackRating;
  } else if (metadata.myColor === "black") {
    metadata.myRating = metadata.blackRating;
    metadata.opponentRating = metadata.whiteRating;
  }
}

function collectTimeControlMetadata(): Partial<GameMetadata> {
  const candidateTexts = [
    document.title,
    ...Array.from(document.querySelectorAll<HTMLMetaElement>("meta[property='og:title'], meta[name='description']"))
      .map((element) => element.content),
    ...TIME_CONTROL_SELECTORS.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).map(visibleText)
    ),
    ...extractScriptTimeControlTexts()
  ].filter((value): value is string => Boolean(value));

  for (const text of candidateTexts) {
    const timeControl = parseTimeControl(text);
    if (timeControl) {
      return timeControl;
    }
  }

  const bodyText = document.body?.innerText?.slice(0, 8_000);
  return bodyText ? parseTimeControl(bodyText) ?? {} : {};
}

function extractScriptTimeControlTexts(): string[] {
  const matches: string[] = [];

  for (const script of Array.from(document.scripts).slice(0, 80)) {
    const text = script.textContent?.slice(0, 250_000);
    if (!text || !/time_?control|TimeControl/i.test(text)) {
      continue;
    }

    const timeControlMatch =
      text.match(/["']time_?control["']\s*:\s*["']?([^"',}\]]+)/i) ??
      text.match(/\[TimeControl\s+"([^"]+)"/i);

    if (timeControlMatch?.[1]) {
      matches.push(timeControlMatch[1]);
    }
  }

  return matches;
}

function parseTimeControl(text: string): Partial<GameMetadata> | undefined {
  const normalized = text.replace(/\s+/g, " ");
  const correspondenceMatch = normalized.match(/\b(\d{1,3})\s*days?\b/i);
  if (correspondenceMatch) {
    const days = Number(correspondenceMatch[1]);
    return {
      timeControl: `${days} day${days === 1 ? "" : "s"}`,
      timeClass: "correspondence"
    };
  }

  const plusMatch = normalized.match(/\b(\d+(?:\.\d+)?|\d+\/\d+)\s*(?:\+|\|)\s*(\d{1,3})\b/);
  if (plusMatch) {
    const base = parseClockNumber(plusMatch[1]);
    const incrementSeconds = Number(plusMatch[2]);
    if (base !== undefined && Number.isFinite(incrementSeconds)) {
      return buildClockMetadata(base, incrementSeconds, Number.isInteger(base) && base >= 100 ? "seconds" : "minutes");
    }
  }

  const minutesMatch = normalized.match(
    /\b(\d+(?:\.\d+)?|\d+\/\d+)\s*(?:min|mins|minute|minutes)\b(?:\s*(?:\+|with)?\s*(\d{1,3})\s*(?:sec|secs|second|seconds)?)?/i
  );
  if (minutesMatch) {
    const minutes = parseClockNumber(minutesMatch[1]);
    const incrementSeconds = minutesMatch[2] ? Number(minutesMatch[2]) : 0;
    if (minutes !== undefined && Number.isFinite(incrementSeconds)) {
      return buildClockMetadata(minutes, incrementSeconds, "minutes");
    }
  }

  return undefined;
}

function parseClockNumber(value: string): number | undefined {
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/").map(Number);
    return denominator ? numerator / denominator : undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildClockMetadata(
  baseValue: number,
  incrementSeconds: number,
  baseUnit: "minutes" | "seconds"
): Partial<GameMetadata> {
  const initialClockSeconds = Math.round(baseUnit === "seconds" ? baseValue : baseValue * 60);

  return {
    timeControl: `${formatClockMinutes(initialClockSeconds)}+${incrementSeconds}`,
    initialClockSeconds,
    incrementSeconds,
    timeClass: classifyTimeControl(initialClockSeconds)
  };
}

function formatClockMinutes(initialClockSeconds: number): string {
  const minutes = initialClockSeconds / 60;
  return Number.isInteger(minutes) ? String(minutes) : String(Number(minutes.toFixed(2)));
}

function classifyTimeControl(initialClockSeconds: number): TimeClass {
  if (initialClockSeconds < 180) {
    return "bullet";
  }

  if (initialClockSeconds < 600) {
    return "blitz";
  }

  if (initialClockSeconds < 1800) {
    return "rapid";
  }

  return "classical";
}

function firstVisibleElement(selector: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisibleElement);
}

function findClosestPlayerContainer(element: HTMLElement): HTMLElement | undefined {
  return element.closest<HTMLElement>(PLAYER_CONTAINER_SELECTORS.join(",")) ?? undefined;
}

function dedupeElements(elements: HTMLElement[]): HTMLElement[] {
  return Array.from(new Set(elements)).filter(isVisibleElement);
}

function dedupePlayers(players: PlayerSnapshot[]): PlayerSnapshot[] {
  const seen = new Set<string>();
  const output: PlayerSnapshot[] = [];

  for (const player of players) {
    const key = `${player.name ?? ""}:${player.rating ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(player);
  }

  return output;
}

function visibleText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
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
