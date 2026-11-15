# Spatium

A personal task board organized into areas. React, TypeScript, Zustand/Immer, IndexedDB and optional private Supabase sync.

## Using the board

Open a panel to see independent columns of areas. A phone shows roughly two columns; wider screens show more. Scroll sideways or vertically without page snapping. Hold an area to move it within or between columns (drag with a mouse). Drop beyond the last column to create another column. Empty columns stay until you remove them. The + button creates an area.

Tap an area to open it alone. Its tasks fit the screen in two independent columns and scroll vertically. Switch to one column from the header; switching back remembers the tasks' original sides and updated ordering. New tasks start collapsed. Tap to expand, tap expanded text to edit, and use the chevron to collapse. Heights follow content automatically. Hold a task to reorder; moving before the hold scrolls normally. Back, Escape on desktop, or the reserved left-edge rightward swipe returns to the board at its previous position. Browser Back also works.

The + button inside an area creates a task. Task actions offer Important, subtasks, title size, Move to another area, Select more and Delete. Select more supports bulk actions and group reordering. Descriptions edit live as one undo session; Escape, Done editing and blur commit. Enter finishes titles and inserts newlines in descriptions. State controls retain the desktop four-click patterns (left Done, double-left In Progress, right Blank, double-right Delayed) and explicit touch/keyboard choices. Settings offers the alternative visible-choice mode, default title sizes, colors and cloud sync.

Home remains the **my Spatium** board of panel previews. Panels and subtasks have reorder grips; Home also offers Move up/down. Settings returns directly to the originating panel or area.

## Existing writing and the grid upgrade

Version 1?3 data validates and converts automatically to format 4. Task IDs, text, state, Important, subtasks, title sizes, area colors and timestamps remain. Nested areas become separate Parent ? Child areas. Loose tasks go into Unsorted. Existing notes are intentionally omitted, as requested by the owner. Free-canvas coordinates become ordered grid positions.

Before the first converted local save, the original document is pinned at IndexedDB key **spatium-before-grid-v4**. The old cloud document is pinned separately at **spatium-cloud-before-grid-v4** when first read. These copies are not rotated out with recent sync recovery. Invalid or unsupported documents are never replaced by an empty document.

**Existing Supabase installations must rerun the updated [setup.sql](supabase/setup.sql) before using the grid release.** It preserves the live document, pins a private pre-grid cloud backup, and switches writes to format 4 so old cached clients cannot overwrite the new structure. See [cloud setup and upgrade](supabase/README.md). The public browser key is insufficient to apply SQL; use the project SQL Editor or an authorized management token.

Cloud sync still checks whole-document revisions, saves locally before uploading, and pauses for an explicit choice when both devices change. Board positions and the focused-area scroll position stay local to each device. Closing and reopening old PWA sessions loads the updated app. Wait for **Saved to cloud** before switching devices.

## Development and verification

```sh
npm ci
npm run dev
npm test
npm run lint
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:production
```

Serve at /Spatium/. Hash routes work on GitHub Pages. Pushes to main run the Pages build/deploy workflow. Production tests check the built CSS, routes, IndexedDB reload and offline service worker. Browser tests cover the grid on desktop and portrait Chromium; they do not replace real iPhone Safari/Home Screen acceptance.
