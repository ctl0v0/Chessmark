import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Library,
  Loader2,
  NotebookPen,
  Save,
  Tags
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createBookmarkFromCapture } from "../shared/bookmarkFactory";
import { cropVisibleTabImage, type CropResult } from "../shared/imageCrop";
import { addTagPresets, getTagPresets, saveBookmark, StorageQuotaError } from "../shared/storage";
import { mergeTags, parseTags, tagsToInputValue } from "../shared/tags";
import type { BoardDetectionResult, CapturedPosition, MessageResponse, PositionBookmark } from "../shared/types";
import { buildAnalysisUrl, getSupportedSite, isSupportedSiteUrl, siteLabel } from "../shared/urls";

type StatusState =
  | { kind: "checking"; message: string }
  | { kind: "ready"; message: string; detection: BoardDetectionResult }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

const LOGO_URL = chrome.runtime.getURL("assets/icons/icon_48.png");

export function Popup() {
  const [status, setStatus] = useState<StatusState>({
    kind: "checking",
    message: "Checking active tab."
  });
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>();
  const [lastCapture, setLastCapture] = useState<CapturedPosition>();
  const [lastScreenshot, setLastScreenshot] = useState<CropResult>();
  const [previewScreenshot, setPreviewScreenshot] = useState<CropResult>();
  const [lastSavedBookmark, setLastSavedBookmark] = useState<PositionBookmark>();
  const [tagPresets, setTagPresets] = useState<string[]>([]);

  useEffect(() => {
    detectActiveBoard().catch((error) => {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not inspect this tab."
      });
    });
    getTagPresets()
      .then(setTagPresets)
      .catch(() => setTagPresets([]));
  }, []);

  const captureStatus = useMemo(() => {
    if (lastCapture?.fen && lastCapture.captureMethod === "fen-direct") {
      return "Board detected. FEN captured.";
    }

    if (lastCapture?.fen && lastCapture.captureMethod === "dom-reconstruction") {
      return "Board detected. Position reconstructed from board.";
    }

    if (lastCapture?.captureMethod === "screenshot-only") {
      return "Board detected. Screenshot only.";
    }

    if (status.kind === "ready") {
      return status.message;
    }

    return status.message;
  }, [lastCapture, status]);

  const statusLabel = useMemo(() => {
    if (status.kind === "checking") {
      return "Checking";
    }

    if (status.kind === "empty") {
      return "No board";
    }

    if (status.kind === "error") {
      return "Error";
    }

    return "Board detected";
  }, [status.kind]);

  const canSave = status.kind === "ready" && status.detection.found && !isSaving;
  const displayedScreenshot = lastScreenshot ?? previewScreenshot;
  const analysisUrl = lastSavedBookmark ? buildAnalysisUrl(lastSavedBookmark) : null;
  const analysisSiteLabel = lastSavedBookmark ? siteLabel(lastSavedBookmark.source.site) : "Chess.com";
  const selectedTags = useMemo(() => parseTags(tags), [tags]);

  async function detectActiveBoard() {
    const tab = await getActiveTab();
    const site = getSupportedSite(tab.url);

    if (!tab.id || !isSupportedSiteUrl(tab.url)) {
      setPreviewScreenshot(undefined);
      setStatus({
        kind: "empty",
        message: "Open Chess.com or Lichess with a visible board."
      });
      return;
    }

    const response = await sendMessageToTab(tab.id, { type: "CHESSMARK_DETECT_BOARD" });
    if (!response.ok) {
      setStatus({ kind: "error", message: response.error });
      return;
    }

    if (!("detection" in response)) {
      setStatus({ kind: "error", message: "Unexpected board detection response." });
      return;
    }

    if (!response.detection.found) {
      setPreviewScreenshot(undefined);
      setStatus({
        kind: "empty",
        message: `No ${siteLabel(site)} board detected on this page.`
      });
      return;
    }

    setStatus({
      kind: "ready",
      message: `Board detected on ${siteLabel(site)}.`,
      detection: response.detection
    });

    try {
      const preview = await captureBoardScreenshot(tab, response.detection.boardRect, response.detection.viewport);
      setPreviewScreenshot(preview);
    } catch {
      setPreviewScreenshot(undefined);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage(undefined);
    setLastCapture(undefined);
    setLastScreenshot(undefined);
    setLastSavedBookmark(undefined);

    try {
      const tab = await getActiveTab();
      if (!tab.id || !tab.url) {
        throw new Error("Could not read the active supported chess site tab.");
      }

      const response = await sendMessageToTab(tab.id, { type: "CHESSMARK_CAPTURE_POSITION" });
      if (!response.ok) {
        throw new Error(response.error);
      }

      if (!("capture" in response)) {
        throw new Error("Unexpected position capture response.");
      }

      const capture = response.capture;
      let screenshot: CropResult | undefined;

      screenshot = await captureBoardScreenshot(tab, capture.boardRect, capture.detection.viewport);

      const parsedTags = parseTags(tags);
      const bookmark = createBookmarkFromCapture({
        capture,
        screenshot,
        draft: {
          notes,
          tags: parsedTags
        },
        tab: {
          url: tab.url,
          title: tab.title
        }
      });

      await saveBookmark(bookmark);
      setTagPresets(await addTagPresets(parsedTags));
      setLastCapture(capture);
      setLastScreenshot(screenshot);
      setLastSavedBookmark(bookmark);
      setSaveMessage("Saved for later review.");
      setNotes("");
      setTags("");
    } catch (error) {
      setSaveMessage(
        error instanceof StorageQuotaError
          ? `${error.message} You can open the library to export, delete, or clear saved positions.`
          : error instanceof Error
            ? error.message
            : "Could not save this position."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function openLibrary() {
    try {
      await chrome.runtime.openOptionsPage();
    } catch {
      await chrome.tabs.create({ url: chrome.runtime.getURL("src/library/library.html") });
    }
  }

  function openUrl(url: string) {
    chrome.tabs.create({ url }).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function togglePresetTag(tag: string) {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((selectedTag) => selectedTag !== tag)
      : mergeTags(selectedTags, [tag]);

    setTags(tagsToInputValue(nextTags));
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="brand-mark">
          <img src={LOGO_URL} alt="ChessMark logo" width={34} height={34} />
        </div>
        <div className="title-copy">
          <h1>ChessMark</h1>
          <p>Save positions.</p>
        </div>
        <div className={`status-chip status-${status.kind}`} aria-live="polite" title={captureStatus}>
          {status.kind === "checking" ? (
            <Loader2 className="spin" size={14} aria-hidden="true" />
          ) : status.kind === "ready" ? (
            <CheckCircle2 size={14} aria-hidden="true" />
          ) : (
            <AlertCircle size={14} aria-hidden="true" />
          )}
          <span>{statusLabel}</span>
        </div>
      </header>

      {displayedScreenshot?.dataUrl ? (
        <img
          className="thumbnail"
          src={displayedScreenshot.dataUrl}
          alt={lastScreenshot ? "Saved board position" : "Detected board position"}
        />
      ) : (
        <div className="thumbnail-placeholder" aria-hidden="true">
          <div />
        </div>
      )}

      <label className="field">
        <span>
          <NotebookPen size={16} aria-hidden="true" />
          Notes
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="Missed tactic here"
        />
      </label>

      <label className="field">
        <span>
          <Tags size={16} aria-hidden="true" />
          Tags
        </span>
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="tactic, endgame, mistake"
        />
      </label>

      {tagPresets.length > 0 ? (
        <div className="quick-tags" aria-label="Quick tags">
          {tagPresets.map((tag) => {
            const selected = selectedTags.includes(tag);

            return (
              <button
                key={tag}
                className={selected ? "quick-tag selected" : "quick-tag"}
                type="button"
                onClick={() => togglePresetTag(tag)}
                aria-pressed={selected}
                title={`Toggle ${tag}`}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      ) : null}

      {lastCapture?.fen ? (
        <div className="fen-preview">
          <span>{lastCapture.fenIsPartial ? "Partial FEN" : "FEN"}</span>
          <code>{lastCapture.fen}</code>
        </div>
      ) : null}

      {saveMessage ? <div className="save-message">{saveMessage}</div> : null}

      {analysisUrl ? (
        <button className="analysis-button" type="button" onClick={() => openUrl(analysisUrl)}>
          <ExternalLink size={17} aria-hidden="true" />
          <span>Open {analysisSiteLabel} Board</span>
        </button>
      ) : null}

      <div className="actions">
        <button className="primary-button" type="button" disabled={!canSave} onClick={handleSave}>
          {isSaving ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
          <span>{isSaving ? "Saving" : "Save Position"}</span>
        </button>
        <button className="icon-button" type="button" onClick={openLibrary} title="Open library" aria-label="Open library">
          <Library size={18} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={detectActiveBoard}
          title="Check board again"
          aria-label="Check board again"
        >
          <ExternalLink size={18} aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    throw new Error("No active tab found.");
  }

  return tab;
}

function sendMessageToTab(
  tabId: number,
  request: { type: "CHESSMARK_DETECT_BOARD" } | { type: "CHESSMARK_CAPTURE_POSITION" }
): Promise<MessageResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, request, (response?: MessageResponse) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve({
          ok: false,
          error: "ChessMark board helper is not available on this tab."
        });
        return;
      }

      resolve(response ?? { ok: false, error: "No response from ChessMark board helper." });
    });
  });
}

async function captureBoardScreenshot(
  tab: chrome.tabs.Tab,
  boardRect: BoardDetectionResult["boardRect"],
  viewport: BoardDetectionResult["viewport"]
): Promise<CropResult | undefined> {
  if (!boardRect || !viewport || tab.windowId === undefined) {
    return undefined;
  }

  const visibleTab = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  return cropVisibleTabImage(visibleTab, boardRect, viewport);
}
