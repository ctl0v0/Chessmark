import type { MessageRequest, MessageResponse } from "../shared/types";
import { detectChessComBoard } from "./boardDetection";
import { captureCurrentPosition } from "./fenExtraction";

chrome.runtime.onMessage.addListener(
  (request: MessageRequest, _sender, sendResponse: (response: MessageResponse) => void) => {
    try {
      if (request.type === "CHESSMARK_DETECT_BOARD") {
        sendResponse({ ok: true, detection: detectChessComBoard() });
        return false;
      }

      if (request.type === "CHESSMARK_CAPTURE_POSITION") {
        sendResponse({ ok: true, capture: captureCurrentPosition() });
        return false;
      }

      sendResponse({ ok: false, error: "Unsupported ChessMark message." });
      return false;
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown content script error."
      });
      return false;
    }
  }
);
