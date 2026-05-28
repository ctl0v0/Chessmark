export type Site = "chess.com" | "lichess.org";

export type BoardOrientation = "white" | "black";

export type CaptureMethod = "fen-direct" | "dom-reconstruction" | "screenshot-only";

export type CaptureConfidence = "high" | "medium" | "low";

export type DOMRectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type BoardDetectionResult = {
  found: boolean;
  boardElementSelector?: string;
  boardRect?: DOMRectLike;
  orientation?: BoardOrientation;
  confidence: CaptureConfidence;
  reason?: string;
  viewport?: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
};

export type CapturedPosition = {
  fen?: string;
  fenIsPartial?: boolean;
  orientation?: BoardOrientation;
  captureMethod: CaptureMethod;
  boardRect?: DOMRectLike;
  metadata?: Record<string, string>;
  detection: BoardDetectionResult;
};

export type PositionBookmark = {
  id: string;
  createdAt: string;
  updatedAt: string;

  source: {
    site: Site;
    url: string;
    pageTitle?: string;
  };

  position: {
    fen?: string;
    fenIsPartial?: boolean;
    sideToMove?: "w" | "b";
    orientation?: BoardOrientation;
    moveNumber?: number;
    castlingRights?: string;
    enPassantSquare?: string;
    halfmoveClock?: number;
    fullmoveNumber?: number;
  };

  screenshot: {
    dataUrl?: string;
    width?: number;
    height?: number;
  };

  game?: {
    white?: string;
    black?: string;
    timeControl?: string;
    result?: string;
    gameId?: string;
    moveText?: string;
  };

  userContent: {
    title?: string;
    notes?: string;
    tags: string[];
  };

  technical: {
    captureMethod: CaptureMethod;
    extensionVersion: string;
  };
};

export type BookmarkDraft = {
  notes?: string;
  tags: string[];
};

export type MessageRequest =
  | { type: "CHESSMARK_DETECT_BOARD" }
  | { type: "CHESSMARK_CAPTURE_POSITION" };

export type MessageResponse =
  | { ok: true; detection: BoardDetectionResult }
  | { ok: true; capture: CapturedPosition }
  | { ok: false; error: string };
