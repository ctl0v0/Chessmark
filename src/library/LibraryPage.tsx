import {
  Clipboard,
  Download,
  ExternalLink,
  FileJson,
  LayoutGrid,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getBookmarkDisplayTitle } from "../shared/bookmarkDisplay";
import { BOOKMARKS_STORAGE_KEY, TAG_PRESETS_STORAGE_KEY } from "../shared/constants";
import {
  addTagPresets,
  clearBookmarks,
  deleteBookmark,
  deleteTagPreset,
  exportBookmarks,
  exportFenText,
  getBookmarks,
  getTagPresets,
  updateBookmark
} from "../shared/storage";
import { mergeTags, parseTags, tagsToInputValue } from "../shared/tags";
import type { PositionBookmark } from "../shared/types";
import { buildAnalysisUrl, buildLichessAnalysisUrl, siteLabel } from "../shared/urls";

type EditState = {
  id: string;
  notes: string;
  tags: string;
};

type ViewMode = "grid" | "table";
type SortOrder = "newest" | "oldest";

const LOGO_URL = chrome.runtime.getURL("assets/icons/icon_128.png");

export function LibraryPage() {
  const [bookmarks, setBookmarks] = useState<PositionBookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [tagPresets, setTagPresets] = useState<string[]>([]);
  const [newPresetTags, setNewPresetTags] = useState("");
  const [editing, setEditing] = useState<EditState>();
  const [notice, setNotice] = useState<string>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshData().catch((error) => {
      setNotice(error instanceof Error ? error.message : "Could not load bookmarks.");
    });
  }, []);

  useEffect(() => {
    const refreshSilently = () => {
      refreshData().catch((error) => {
        setNotice(error instanceof Error ? error.message : "Could not refresh bookmarks.");
      });
    };

    const handleFocus = () => refreshSilently();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName
    ) => {
      if (areaName !== "local" || (!changes[BOOKMARKS_STORAGE_KEY] && !changes[TAG_PRESETS_STORAGE_KEY])) {
        return;
      }

      refreshSilently();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const allTags = useMemo(() => {
    const bookmarkTags = bookmarks.flatMap((bookmark) => bookmark.userContent.tags);
    return mergeTags(tagPresets, bookmarkTags).sort((a, b) => a.localeCompare(b));
  }, [bookmarks, tagPresets]);

  const filteredBookmarks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return bookmarks
      .filter((bookmark) => {
        const tagMatch = selectedTag === "all" || bookmark.userContent.tags.includes(selectedTag);
        if (!tagMatch) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchable = [
          getBookmarkDisplayTitle(bookmark),
          bookmark.userContent.notes,
          bookmark.userContent.tags.join(" "),
          bookmark.position.fen,
          bookmark.source.url,
          bookmark.source.pageTitle,
          bookmark.game?.white,
          bookmark.game?.black
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [bookmarks, searchQuery, selectedTag, sortOrder]);

  async function refreshData() {
    setIsRefreshing(true);
    try {
      const [storedBookmarks, storedTagPresets] = await Promise.all([getBookmarks(), getTagPresets()]);
      setBookmarks(storedBookmarks);
      setTagPresets(storedTagPresets);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function refreshBookmarks() {
    setBookmarks(await getBookmarks());
  }

  async function handleCopyFen(bookmark: PositionBookmark) {
    if (!bookmark.position.fen) {
      setNotice("No FEN available for this bookmark.");
      return;
    }

    await navigator.clipboard.writeText(bookmark.position.fen);
    setNotice("FEN copied.");
  }

  async function handleDelete(bookmark: PositionBookmark) {
    const label = getBookmarkDisplayTitle(bookmark) || "this bookmark";
    if (!confirm(`Delete ${label}?`)) {
      return;
    }

    await deleteBookmark(bookmark.id);
    await refreshBookmarks();
    setNotice("Bookmark deleted.");
  }

  async function handleSaveEdit() {
    if (!editing) {
      return;
    }

    await updateBookmark(editing.id, {
      userContent: {
        notes: editing.notes.trim() || undefined,
        tags: parseTags(editing.tags)
      }
    });
    setTagPresets(await addTagPresets(parseTags(editing.tags)));
    setEditing(undefined);
    await refreshBookmarks();
    setNotice("Bookmark updated.");
  }

  async function handleAddPresetTags() {
    const parsedTags = parseTags(newPresetTags);
    if (parsedTags.length === 0) {
      return;
    }

    setTagPresets(await addTagPresets(parsedTags));
    setNewPresetTags("");
    setNotice("Quick tags saved.");
  }

  async function handleDeletePresetTag(tag: string) {
    setTagPresets(await deleteTagPreset(tag));
    if (selectedTag === tag) {
      setSelectedTag("all");
    }
  }

  async function handleExportJson() {
    downloadTextFile("chessmark-bookmarks.json", await exportBookmarks(), "application/json");
    setNotice("JSON export created.");
  }

  async function handleExportFen() {
    const text = await exportFenText();
    downloadTextFile("chessmark-bookmarks.fen.txt", text || "# No FEN positions available yet.\n", "text/plain");
    setNotice("FEN export created.");
  }

  async function handleClearAll() {
    if (!bookmarks.length || !confirm("Delete all local position bookmarks?")) {
      return;
    }

    await clearBookmarks();
    await refreshBookmarks();
    setNotice("All bookmarks deleted.");
  }

  async function handleManualRefresh() {
    try {
      await refreshData();
      setNotice("Library refreshed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not refresh bookmarks.");
    }
  }

  function openUrl(url: string) {
    chrome.tabs.create({ url }).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function toggleEditingTag(tag: string) {
    if (!editing) {
      return;
    }

    const selectedTags = parseTags(editing.tags);
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((selectedTag) => selectedTag !== tag)
      : mergeTags(selectedTags, [tag]);

    setEditing({
      ...editing,
      tags: tagsToInputValue(nextTags)
    });
  }

  function renderEditQuickTags() {
    if (!editing || tagPresets.length === 0) {
      return null;
    }

    const selectedTags = parseTags(editing.tags);

    return (
      <div className="edit-quick-tags" aria-label="Quick tags">
        {tagPresets.map((tag) => {
          const selected = selectedTags.includes(tag);

          return (
            <button
              key={tag}
              className={selected ? "selected" : undefined}
              type="button"
              onClick={() => toggleEditingTag(tag)}
              aria-pressed={selected}
              title={`Toggle ${tag}`}
            >
              #{tag}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <main className="library-shell">
      <header className="library-header">
        <div className="title-block">
          <div className="title-icon">
            <img src={LOGO_URL} alt="ChessMark logo" width={46} height={46} />
          </div>
          <div>
            <h1>ChessMark Library</h1>
            <p>
              Bookmark chess positions for later study.{" "}
              {bookmarks.length === 1 ? "1 saved bookmark." : `${bookmarks.length} saved bookmarks.`}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="refresh-button"
            type="button"
            onClick={handleManualRefresh}
            title="Refresh library"
            aria-label="Refresh library"
          >
            <RefreshCw className={isRefreshing ? "spin" : undefined} size={17} aria-hidden="true" />
          </button>
          <button type="button" onClick={handleExportJson}>
            <FileJson size={17} aria-hidden="true" />
            JSON
          </button>
          <button type="button" onClick={handleExportFen}>
            <Download size={17} aria-hidden="true" />
            FEN
          </button>
          <button className="danger-button" type="button" onClick={handleClearAll}>
            <Trash2 size={17} aria-hidden="true" />
            Clear
          </button>
        </div>
      </header>

      <section className="toolbar" aria-label="Bookmark filters">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search notes, tags, FEN, source"
          />
        </label>
        <label className="tag-filter">
          <Tags size={18} aria-hidden="true" />
          <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label className="sort-filter">
          <SlidersHorizontal size={18} aria-hidden="true" />
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <div className="view-switch" aria-label="Library view">
          <button
            className={viewMode === "grid" ? "selected" : undefined}
            type="button"
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            title="Card grid"
          >
            <LayoutGrid size={17} aria-hidden="true" />
            Cards
          </button>
          <button
            className={viewMode === "table" ? "selected" : undefined}
            type="button"
            onClick={() => setViewMode("table")}
            aria-pressed={viewMode === "table"}
            title="Table view"
          >
            <Rows3 size={17} aria-hidden="true" />
            Table
          </button>
        </div>
      </section>

      <section className="preset-panel" aria-label="Quick tag presets">
        <div className="preset-chips">
          {tagPresets.map((tag) => (
            <button key={tag} type="button" onClick={() => handleDeletePresetTag(tag)} title={`Remove ${tag}`}>
              #{tag}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
        <label className="preset-input">
          <Tags size={17} aria-hidden="true" />
          <input
            value={newPresetTags}
            onChange={(event) => setNewPresetTags(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddPresetTags();
              }
            }}
            placeholder="Add quick tags"
          />
        </label>
        <button type="button" onClick={handleAddPresetTags}>
          <Plus size={17} aria-hidden="true" />
          Add
        </button>
      </section>

      {notice ? (
        <div className="notice-toast" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(undefined)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {filteredBookmarks.length === 0 ? (
        <section className="empty-state">
          <h2>No positions found</h2>
          <p>Saved Chess.com and Lichess boards will appear here with screenshots, notes, tags, and FEN when available.</p>
        </section>
      ) : viewMode === "grid" ? (
        <section className="bookmark-grid" aria-label="Saved position bookmarks">
          {filteredBookmarks.map((bookmark) => {
            const analysisUrl = buildAnalysisUrl(bookmark);
            const lichessUrl =
              bookmark.position.fen && bookmark.source.site !== "lichess.org"
                ? buildLichessAnalysisUrl(bookmark.position.fen, bookmark.position.orientation)
                : undefined;
            const analysisLabel = analysisUrl ? siteLabel(bookmark.source.site) : "Lichess";
            const isEditing = editing?.id === bookmark.id;

            return (
              <article className="bookmark-card" key={bookmark.id}>
                {bookmark.screenshot.dataUrl ? (
                  <img className="board-image" src={bookmark.screenshot.dataUrl} alt="Saved chess board" />
                ) : (
                  <div className="board-missing">Screenshot unavailable</div>
                )}

                <div className="card-body">
                  <div className="card-meta">
                    <time dateTime={bookmark.createdAt}>{formatDate(bookmark.createdAt)}</time>
                  </div>

                  {isEditing ? (
                    <div className="edit-form">
                      <label>
                        Notes
                        <textarea
                          value={editing.notes}
                          rows={4}
                          onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                        />
                      </label>
                      <label>
                        Tags
                        <input
                          value={editing.tags}
                          onChange={(event) => setEditing({ ...editing, tags: event.target.value })}
                        />
                      </label>
                      {renderEditQuickTags()}
                      <div className="edit-actions">
                        <button type="button" onClick={handleSaveEdit}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditing(undefined)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2>{getBookmarkDisplayTitle(bookmark)}</h2>
                      {bookmark.userContent.notes ? <p className="notes-preview">{bookmark.userContent.notes}</p> : null}

                      <div className="tag-list card-tags">
                        {bookmark.userContent.tags.length > 0 ? (
                          bookmark.userContent.tags.map((tag) => <span key={tag}>{tag}</span>)
                        ) : (
                          <span className="muted-tag">no tags</span>
                        )}
                      </div>

                      {bookmark.position.fen ? (
                        <code className={bookmark.position.fenIsPartial ? "fen partial" : "fen"}>{bookmark.position.fen}</code>
                      ) : (
                        <p className="no-fen">Screenshot-only bookmark. Copy and analysis actions need FEN.</p>
                      )}
                    </>
                  )}

                  <div className="card-actions">
                    <button type="button" onClick={() => openUrl(bookmark.source.url)} title="Open source">
                      <ExternalLink size={16} aria-hidden="true" />
                      Source
                    </button>
                    <button type="button" disabled={!bookmark.position.fen} onClick={() => handleCopyFen(bookmark)} title="Copy FEN">
                      <Clipboard size={16} aria-hidden="true" />
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={!analysisUrl && !lichessUrl}
                      onClick={() => openUrl(analysisUrl ?? lichessUrl ?? bookmark.source.url)}
                      title={`Open ${analysisLabel} analysis`}
                    >
                      <ExternalLink size={16} aria-hidden="true" />
                      Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: bookmark.id,
                          notes: bookmark.userContent.notes ?? "",
                          tags: tagsToInputValue(bookmark.userContent.tags)
                        })
                      }
                      title="Edit notes and tags"
                    >
                      <Pencil size={16} aria-hidden="true" />
                      Edit
                    </button>
                    <button className="delete-action" type="button" onClick={() => handleDelete(bookmark)} title="Delete">
                      <Trash2 size={16} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="bookmark-table" aria-label="Saved position bookmarks table">
          {filteredBookmarks.map((bookmark) => {
            const analysisUrl = buildAnalysisUrl(bookmark);
            const lichessUrl =
              bookmark.position.fen && bookmark.source.site !== "lichess.org"
                ? buildLichessAnalysisUrl(bookmark.position.fen, bookmark.position.orientation)
                : undefined;
            const analysisLabel = analysisUrl ? siteLabel(bookmark.source.site) : "Lichess";
            const isEditing = editing?.id === bookmark.id;

            return (
              <article className="bookmark-row" key={bookmark.id}>
                {bookmark.screenshot.dataUrl ? (
                  <img className="row-board-image" src={bookmark.screenshot.dataUrl} alt="Saved chess board" />
                ) : (
                  <div className="row-board-missing">Screenshot unavailable</div>
                )}

                <div className="row-main">
                  <div className="row-topline">
                    <span className="source-badge">{siteLabel(bookmark.source.site)}</span>
                    <time dateTime={bookmark.createdAt}>{formatDate(bookmark.createdAt)}</time>
                  </div>

                  {isEditing ? (
                    <div className="edit-form">
                      <label>
                        Notes
                        <textarea
                          value={editing.notes}
                          rows={4}
                          onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                        />
                      </label>
                      <label>
                        Tags
                        <input
                          value={editing.tags}
                          onChange={(event) => setEditing({ ...editing, tags: event.target.value })}
                        />
                      </label>
                      {renderEditQuickTags()}
                      <div className="edit-actions">
                        <button type="button" onClick={handleSaveEdit}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditing(undefined)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2>{getBookmarkDisplayTitle(bookmark)}</h2>
                      {bookmark.userContent.notes ? <p className="notes-preview">{bookmark.userContent.notes}</p> : null}
                      <div className="tag-list row-tags">
                        {bookmark.userContent.tags.length > 0 ? (
                          bookmark.userContent.tags.map((tag) => <span key={tag}>{tag}</span>)
                        ) : (
                          <span className="muted-tag">no tags</span>
                        )}
                      </div>
                      {bookmark.position.fen ? (
                        <code className={bookmark.position.fenIsPartial ? "fen row-fen partial" : "fen row-fen"}>
                          {bookmark.position.fen}
                        </code>
                      ) : (
                        <p className="no-fen">Screenshot-only bookmark. Copy and analysis actions need FEN.</p>
                      )}
                    </>
                  )}
                </div>

                <div className="row-actions">
                  <button type="button" onClick={() => openUrl(bookmark.source.url)} title="Open source">
                    <ExternalLink size={16} aria-hidden="true" />
                    Source
                  </button>
                  <button type="button" disabled={!bookmark.position.fen} onClick={() => handleCopyFen(bookmark)} title="Copy FEN">
                    <Clipboard size={16} aria-hidden="true" />
                    Copy
                  </button>
                  <button
                    type="button"
                    disabled={!analysisUrl && !lichessUrl}
                    onClick={() => openUrl(analysisUrl ?? lichessUrl ?? bookmark.source.url)}
                    title={`Open ${analysisLabel} analysis`}
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: bookmark.id,
                        notes: bookmark.userContent.notes ?? "",
                        tags: tagsToInputValue(bookmark.userContent.tags)
                      })
                    }
                    title="Edit notes and tags"
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Edit
                  </button>
                  <button className="delete-action" type="button" onClick={() => handleDelete(bookmark)} title="Delete">
                    <Trash2 size={16} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function downloadTextFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
