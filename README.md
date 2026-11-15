# Spatium

A local, spatial task manager built from [PLAN.md](PLAN.md). React 19, TypeScript, Zustand/Immer, IndexedDB and a custom DOM canvas. No backend or account is required.

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:production
```

Open the development URL at `/Spatium/`. The build in `dist/` uses the same base path and hash routes, so it can be served directly from GitHub Pages.

The Pages workflow runs on pushes to `main` and can also be run manually. Set the repository’s **Settings → Pages → Source** to **GitHub Actions**, then push the implementation. The expected URL is `https://brunohofstatter.github.io/Spatium/`. Deployment and real iPhone/Home Screen acceptance require the owner’s GitHub/device environment; local checks cannot verify those.

On desktop, double-click empty canvas to create a task, or right-click empty space for Task / Area / Note at the pointer. The + menu creates items at the viewport center or inside the selected area. Wheel zooms toward the pointer and middle-drag pans. Drag left to right for full-containment selection, or right to left for crossing selection.

Areas are real groups displayed as colored headings and underlines. Boundaries appear during selection and dragging. Drag a heading to move its group; drag its selected title handle to resize the font. Headings scale gently with zoom. Double middle-click an area heading or use Focus to frame it. There is no background grid or grid snapping.

Use the chevron beside a task's Important star for its title-only collapsed form. A small ring shows subtask completion; expansion restores the subtask view and fits the current content. Double-click a title or note to edit, or click a description. Editors keep the same typography. Escape and clicking away save the edit; Enter finishes a title and inserts a line break in descriptions and notes.

New tasks start collapsed. Expanded height fits the description and open subtasks automatically; drag the left/right handles to change width. Growing or shrinking a task pushes/pulls following tasks in the same parent and aligned column while preserving their gaps. Description editing and its column movement undo together. Temporary alignment guides help snap task edges and centers during dragging.

Settings → Task titles changes the shared default title size. Right-click selected tasks for a bulk font-size override or **Use default size**. Settings is wider and offers a direct Back link to the panel it was opened from; Escape finishes a focused field first, then returns to that panel.

Settings → Task state control switches between four visible state choices and four click patterns. Click patterns are the initial desktop mode: left = Done, double-left = In Progress, right = Blank, double-right = Delayed. Single clicks wait briefly to distinguish doubles. Keyboard activation and touch open the explicit state picker.

Home is the **my Spatium** board: panel headings above compact previews, three desktop columns, drag-to-reorder and a floating + for creation.

On touch screens, the first tap on an item's text selects it; tap again or use Edit to write. Done editing commits and dismisses the editor. Inline editors temporarily frame text at a readable scale and follow the caret above the keyboard; automatic framing returns afterward unless you navigated manually. Real iPhone keyboard behavior still needs device acceptance.

The bottom bar prioritizes State, Edit, Expand/Collapse and More (plus Focus for areas). More → Select more enables tap-to-toggle selection with a visible count; Finish selection retains the group for dragging and bulk actions. More → Title size has −/+ controls for tasks or an area heading, with Use default size for tasks. Touch state choices remain explicit; desktop four-click patterns do not apply.

Selected resize handles compensate for zoom, within a bounded size. Area Focus reserves space above the bottom dock, and More → Focus task brings its heading to a readable width. Creating inside a selected area chooses visible space and avoids occupied positions where possible. Drag the grip beside a panel or subtask to reorder with a moving preview, insertion marker and edge scrolling/panning. Home panel menus also offer Move up/down. Card swipes remain unused so dragging stays immediate; subtask swipes are deferred.

Changes save automatically on this browser/device. Undo/redo keeps 200 document actions in memory; navigation, highlights and Done visibility are excluded. Closing the tab clears undo history. Data does not sync between devices. Installing the PWA and requesting persistent storage help retention, but clearing browser site data still removes the document. An unreadable or newer-version document is left intact rather than replaced.

Use one tab for editing. If another tab saves a newer document, a stale tab stops saving and displays a message instead of overwriting that work. Its unsaved edits stay in memory while it remains open; tabs do not merge changes.

Production builds include the manifest, PNG icons and an offline service worker. `test:production` checks the built app’s CSS, IndexedDB reload and offline service worker with headless Chromium after `npm run build`. Icons can be regenerated on Windows with `powershell -File scripts/generate-icons.ps1`.
