# Chrome Web Store Submission Packet

Use this file as the copy/paste source for the first public MVP submission.

## Upload Package

- Run `npm run package`.
- Upload `release/chessmark-0.1.1.zip`.
- The ZIP must contain `manifest.json` at the root.
- Load `dist` unpacked in Chrome before submission and test the full save/library/export flow.

## Store Listing

- Name: ChessMark
- Summary: Save Chess.com and Lichess board positions, notes, tags, screenshots, and FEN for later study.
- Category: Productivity
- Language: English
- Visibility: Public

Detailed description:

```text
ChessMark helps you save chess positions you want to remember.

When you are playing, reviewing, or studying on Chess.com or Lichess, ChessMark can capture the visible board, save a screenshot, store FEN when available, and let you add notes and tags. Later, you can open the ChessMark Library to search your saved positions, filter by tag, sort by date, copy FEN, reopen the source page, or open the saved position in an analysis board.

ChessMark is local-first and private. There is no account, no backend, no analytics, and no remote upload of your saved positions.

ChessMark is not a chess engine and does not provide move recommendations, evaluation bars, best moves, hints, or live assistance. It is a simple bookmarking tool for players who want to build a personal library of positions for later study.
```

## Store Assets

- Extension icon: `assets/icons/store_icon_128.png`
- Small promotional tile: `assets/store/promo_tile_440x280.png`
- Marquee promotional tile: `assets/store/marquee_1400x560.png`
- Screenshot 1: `assets/store/screenshot_popup_detected_1280x800.png`
- Screenshot 2: `assets/store/screenshot_popup_saved_1280x800.png`
- Screenshot 3: `assets/store/screenshot_library_1280x800.png`

The generated screenshots are ready as launch listing assets. If you capture live screenshots from an unpacked Chrome install, keep them at `1280x800` with square corners and no padding.

## Privacy Tab

Single purpose:

```text
ChessMark is a local-first bookmarking and study organization tool for saving chess positions from Chess.com and Lichess for later review.
```

Remote code:

```text
No. ChessMark does not execute remote code. All extension logic is included in the submitted package.
```

Data types to disclose:

- Website content: visible chess board screenshots, FEN, board state, and page metadata from supported chess pages.
- Web browsing activity or web history: limited to the source URL and page title of supported chess pages that the user chooses to save.
- User-provided content: notes and tags entered by the user.
- User activity: saved timestamps, local search/filter/sort state, and library actions if the dashboard asks about activity.
- Personally identifiable information: disclose player names or usernames only if the dashboard treats detected chess-site player metadata as PII.

Data-use certification:

- Data is used only for ChessMark's single purpose: saving and managing a private local library of chess positions.
- Data is stored locally in Chrome extension storage.
- No developer backend, analytics, ads, data sale, or third-party transfer.
- The only third-party navigation is user-initiated opening of Chess.com or Lichess analysis/source URLs.
- Certify Chrome Web Store Limited Use compliance.

Privacy policy URL:

- Use `https://ctl0v0.github.io/Chessmark/privacy-policy` in the Chrome Web Store dashboard.

## Permission Justifications

`storage`

```text
Stores the user's saved chess position bookmarks, screenshots, FEN, notes, tags, and tag presets locally in Chrome extension storage.
```

`activeTab`

```text
Allows ChessMark to inspect and capture the currently active supported chess tab only after the user opens the extension.
```

`https://www.chess.com/*`

```text
Injects ChessMark's board helper only on Chess.com pages so the extension can detect visible boards and capture positions selected by the user.
```

`https://lichess.org/*`

```text
Injects ChessMark's board helper only on Lichess pages so the extension can detect visible boards and capture positions selected by the user.
```

## Reviewer Test Instructions

```text
No account is required to test the extension.

1. Load the submitted extension.
2. Open a public Chess.com or Lichess page that displays a chess board.
3. Click the ChessMark extension icon.
4. Confirm the popup detects the board and shows a board preview.
5. Add optional notes/tags and click Save Position.
6. Open the ChessMark Library from the popup.
7. Verify the saved item can be searched, filtered, edited, deleted, exported as JSON/FEN, copied as FEN, and opened back on the source or analysis board when FEN is available.
8. Open an unsupported page and confirm ChessMark asks for a supported Chess.com or Lichess board.
```

## Final Manual Checklist

- Chrome Web Store developer account is registered and 2-step verification is enabled.
- `docs/privacy-policy.md` is published at `https://ctl0v0.github.io/Chessmark/privacy-policy`.
- `npm run package` passes immediately before upload.
- `npm audit` passes immediately before upload.
- `dist` has been loaded unpacked in Chrome and tested on Chess.com and Lichess.
- Dashboard privacy answers match this packet and the published privacy policy.
- Listing copy does not imply chess-engine analysis, hints, live move help, or gameplay automation.
