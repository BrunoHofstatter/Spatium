# Spatium: Implementation Plan

## Accepted grid redesign ? 2026-11-15

This revision supersedes the free-canvas layout and its dependent interactions below.

- Panels contain manually arranged, independent columns of top-level areas. About two fixed-width columns are visible on a phone, more on desktop. Native horizontal/vertical scrolling has no paging or canvas zoom.
- Areas retain their chosen column and order. Their height follows a miniature of all visible tasks, including expanded content. No automatic cross-column balancing. Hold an area to drag; mouse drag starts after a movement threshold. Dropping beyond the last column creates a column. There is no Add column command. Empty columns remain until explicitly removed, with at least one remaining.
- Tap an area to open it alone with a smooth transition (reduced-motion users get an immediate change). Back, desktop Escape and a reserved left-edge rightward swipe restore the board position. Area routes participate in browser history; direct links have a safe in-app Back fallback.
- Focused areas fit screen width and scroll vertically. Task width/height and flow are automatic. Two independently stacked task columns are the default; expansion affects only the same column. Manual canvas sizing, positional attachment and alignment snapping are retired.
- New tasks start collapsed. A tap expands; expanded title/description text edits inline; a chevron collapses. Hold to reorder. Native scrolling wins when movement begins before the hold. Subtasks keep grip reordering. Desktop state patterns and the explicit touch state picker remain.
- An area can switch to one task column without losing per-task left/right membership. The shared reading order updates when reordered, and switching back restores the remembered sides.
- Select more toggles task membership and supports bulk sizing, moving/deleting and group reorder. Move to transfers tasks to another area. Preserve task states, descriptions, Important, subtasks, colors, title sizes, filters, grouped undo, offline storage and sync.
- Version 1?3 documents validate before deterministic conversion to version 4. Preserve task/area IDs, content and timestamps. Nested areas become Parent ? Child board areas. Loose tasks go into a deterministically named Unsorted area per panel. Notes are omitted from the new document at the owner's request.
- Before writing version 4, pin the untouched local document; pin the original cloud copy as well. Supabase setup also creates a private permanent pre-grid backup and rejects version-3 writes from older clients. Migrate sync fingerprints deterministically to avoid false conflicts. Board/focused scroll positions stay device-local.

---

## Accepted mobile revision — 2026-11-15

These later owner-approved mobile adaptations take precedence over conflicting interaction details below:

- Preserve tap selection, immediate one-finger item dragging, empty-space panning, and two-finger pan/pinch. Mouse click patterns remain desktop-only; touch uses an explicit four-state chooser.
- The mobile bottom bar prioritizes State, Edit, Expand/Collapse and More; areas keep Focus prominent. More exposes title size, Important, subtasks, Select more and Delete as applicable.
- Select more is an explicit mode: taps toggle item membership, the bar shows a count and Finish selection, and two-finger navigation remains available. Finish retains the selection for bulk actions and group dragging.
- On touch, the first tap on an unselected item's text selects it; a subsequent tap edits. Keep transparent inline editing and add Done editing, caret accommodation above the software keyboard, and temporary readable canvas framing without changing saved typography. Restore automatic framing on completion unless the user navigated manually.
- Selected task title overrides/reset and area title sizing have touch-accessible −/+ controls. Preserve the area title drag handle. Selected resize handles compensate for zoom within a bounded size; common fixed controls have larger touch targets.
- Creation uses visible space inside the selected expanded area, avoids occupied positions when room exists, and reveals new items. Focus uses the unobscured canvas above the bottom bar. Mobile Focus task frames the heading at a readable width rather than fitting an entire long description.
- Home and subtask touch reorder show a moving preview/insertion marker and scroll/pan near viewport edges. Home also has Move up/down actions. Native browser scrolling must not consume the next tap after a controlled drag.
- Alignment snapping is slightly more forgiving on touch (9 screen pixels versus 6 with a mouse), with identical preview and release calculations.
- Defer subtask swipes until phone testing; card swipe actions are not part of this revision.

---

## Latest accepted revision — 2026-11-15

These decisions take precedence over both the 2026-11-14 revision and the original plan:

- Settings has a shared task-title font size. Existing/new tasks inherit it unless they have an override. Right-click a task selection to change all selected task title sizes or restore the shared default. Title size changes also fit the collapsed row height.
- Click patterns are now left = Done, double-left = In Progress, right = Blank, double-right = Delayed. The explicit four-choice mode remains available. State dots are about 25% larger.
- New tasks start collapsed. Task width is manually adjustable; expanded height fits the description and open subtask list automatically. Vertical task resize handles are retired.
- Height changes preserve the current gaps beneath the resized task: following tasks in the same parent and aligned column move down on growth and up on shrinkage. This includes tasks added below an already expanded task. Other columns, notes and separate areas are not rearranged. Column membership follows aligned left, center or right coordinates within a small tolerance.
- Description edits resize live. Text, automatic heights and resulting column movement form one undo step per editing session. Expanding/collapsing, bulk typography and width changes include their resulting movement in their own undo action.
- Task dragging snaps gently to other tasks' edges or centers, horizontally and vertically, with temporary alignment guides. This is alignment snapping only; the background grid remains removed.
- Settings opens with a direct return to its originating panel, preserving the viewport. Escape finishes an active field first; another Escape returns. Home-origin Settings returns to Home. Settings uses a substantially wider, responsive layout.
- Home is an unboxed workspace board headed exactly **my Spatium**, centered above panel headings and compact previews. Desktop uses three reorderable columns, adapting to smaller screens. A floating bottom-right + creates panels. Introductory/tagline/footer copy and the old enclosing cards are removed.
- Version-1/2 saved documents migrate to version 3 without discarding tasks, content, nesting or placements. Existing tasks keep their collapsed/expanded state; only newly created tasks default to collapsed.

---

## Accepted interaction revision — 2026-11-14

These later owner-approved decisions supersede conflicting details in the original plan below:

- Areas remain real, position-based nested groups. Their resting appearance is a colored heading and strong underline above the group, with no permanent box or fill. Temporary boundaries appear when selected or during dragging; a drop target receives a stronger boundary.
- Drag the selected heading's handle to change its font size. Headings shrink more gently than tasks when zooming out and enlarge more gently when zooming in.
- Remove the dot grid, snapping behavior, and all grid settings and controls.
- Tasks have a separate title-only collapsed form. The chevron sits next to Important. A small progress ring replaces the numeric subtask counter while collapsed. Expanding restores the prior card height and subtask expansion.
- Editing keeps the displayed typography and uses a transparent editor. Escape and clicking elsewhere commit the edit. Enter commits single-line titles; descriptions and notes retain multiline Enter behavior.
- Right-click empty canvas or empty area interior to open the Task / Area / Note creation menu at that point. The floating + menu remains available.
- Focus an area using its focus button, selection action bar, or double middle-click. Fit the area and its external heading into the viewport without moving any content. Middle-drag remains pan.
- Desktop task/subtask state controls have a persisted Settings option: four visible choices on hover/selection, or four click patterns. The initial mode is click patterns: left = In Progress, double-left = Done, right = Delayed, double-right = Blank. Single clicks briefly wait to distinguish doubles. Touch and keyboard retain an explicit picker.
- Rectangle selection from left to right requires full containment. Right to left selects intersecting items. Crossing selection uses the visible heading for areas, so crossing tasks inside a group does not inadvertently select their entire area.
- Existing version-1 documents migrate to version 2 with positions, content, nesting and viewports preserved; task collapse and heading font sizes receive defaults, and retired grid settings are removed.

---

A personal, freeform, spatial task manager. It runs as a static web app on GitHub Pages and works on desktop and on a portrait iPhone.

This plan combines the original vision document with the decisions made in the Q&A. Where they conflict, the Q&A answers win. Every item is tagged:

- **[Decided]**: chosen by the owner.
- **[Default]**: picked by the agent to fill a gap. Fine to build as written, and easy to change later.

---

## 1. Decisions summary

### 1.1 Structure and content

| Topic | Decision |
|---|---|
| Top-level unit | **Panels** (workspaces, usually one per project) [Decided] |
| Elements on a canvas | **Task**, **Area**, **Note** (plain text) [Decided] |
| Tasks outside areas | Allowed. Tasks and notes can sit directly on the panel canvas [Decided] |
| Nesting | Areas can contain tasks, notes and other areas, with unlimited depth [Decided] |
| How items join an area | **By position.** Dropping an item puts it in the innermost area under the pointer. Dragging it out takes it out. [Decided] |
| Area size | Set manually. The area **grows automatically** when a child is dropped or resized past its edge, and never shrinks on its own. Growth also passes up to its parent areas. [Decided] |
| Collapsed area | Shrinks **in place** to its title bar and shows task counts by state. Nothing around it moves. [Decided] |
| Deleting an area with contents | Asks for confirmation, then deletes everything inside. Undo restores it. [Decided] |
| Area color | Optional accent color for each area [Decided] |
| Overlapping items | Allowed. The item you select comes to the front among its siblings. [Default] |

### 1.2 Tasks

| Topic | Decision |
|---|---|
| Fields | Title, optional description, state, Important flag, subtasks [Decided] |
| States | Exactly 4: **Blank**, **Delayed**, **In Progress**, **Done**. Only one at a time. [Decided] |
| State colors | Blank = gray, Delayed = amber, In Progress = blue, Done = green. Can be changed in Settings. [Decided] |
| How a card shows its state | A soft tint of the state color across the whole card [Decided] |
| Important | A separate on/off flag, shown as a star. It uses **rose/red** so it doesn't look like Delayed amber. [Default for the color] |
| Changing state | Click the **state dot** on the card to open a small 4-option picker [Decided] |
| Editing | **On the card itself**: double-click the title to edit it; the description and subtasks are edited in place too. [Decided] |
| Card size | You set it manually, and **text never resizes the card**. Overflowing description text is clipped with a fade. While you edit, the editor shows the full text. [Decided] |
| Creating a task | **Double-click empty space** (on the canvas or inside an area) to create a task at that spot [Decided]. On mobile, use the **floating + button** (see §1.5). |

### 1.3 Subtasks

| Topic | Decision |
|---|---|
| Depth | **One level.** A subtask has a title and a state only: no description, no Important flag, no subtasks of its own. [Decided] |
| States | The same 4 states and colors as tasks [Decided] |
| Display | An expand toggle on the card. Subtasks appear **inside the parent card as a compact list**. [Decided] |
| Expanded layout | The card gets taller by the height of the list. It **overlaps** whatever is below rather than pushing it away, so the layout is never rearranged. [Default] |
| Automation | None. The card shows a small **progress counter** (e.g. `2/5`). [Decided] |
| Hiding Done subtasks | In "hide Done" mode, Done subtasks are hidden as well. The counter still counts all of them. [Default] |
| Reordering | Drag to reorder inside the list. [Default] |

### 1.4 Viewing, highlighting, navigation (desktop)

| Topic | Decision |
|---|---|
| Zoom | **Mouse wheel**, zooming toward the cursor (range about 10% to 300%) [Decided] |
| Pan | **Hold the middle mouse button and drag** [Decided] |
| Left-drag on empty canvas | **Draws a selection box** to select several items and move them together [Decided] |
| Canvas size | Unbounded coordinates, so there are no edges to manage. Each panel remembers its last view position and zoom. [Default] |
| Grid | Free movement by default. A **grid-snap toggle** is available. [Decided] |
| Highlight criteria | Blank, Delayed, In Progress, Done, Important. You can select several, and a task is highlighted if it matches **any** of them. [Decided] |
| Highlight effect | **Both**: matching tasks get an outline or glow, and every other task is dimmed and desaturated. Nothing moves. [Decided] |
| Collapsed areas while highlighting | Show a small glow badge when the collapsed area contains matching tasks. [Default] |
| Done visibility | **One global switch** that the app remembers: "Hide Done" or "Show all". In Show all, Done tasks have strikethrough text and the green tint. Hidden tasks keep their position. [Decided] |
| Done highlight while Done is hidden | The Done chip is disabled while Done tasks are hidden. [Default] |
| Moving between panels | **Home button only** [Decided] |
| Undo/redo | **Yes**: Ctrl+Z and Ctrl+Shift+Z (also Ctrl+Y) for every change. On mobile, buttons in the top bar. [Decided] |
| Other keys | Only the basics: Delete/Backspace deletes the selection, Esc deselects or cancels editing, Enter confirms the title. No other shortcuts. [Default, kept small on purpose] |
| Search | Not in the first version [Decided] |

### 1.5 Mobile (portrait iPhone)

| Topic | Decision |
|---|---|
| Gestures | One finger on **empty space** pans; **pinch** zooms; one finger on an **item drags it right away**; a **tap** selects it. [Decided] Two-finger pan also works, so you can pan even when the screen is full of items. [Default] |
| What counts as empty space | The open interior of an area. Areas are dragged by their **title bar**. [Default] |
| Editing | Tap selects the item. Larger resize handles and a **floating action bar** appear (state, Important, subtasks, color, collapse, delete). Editing happens in place. [Decided] |
| Creating | A **floating + button** places the new task at the center of the screen, or inside the selected area if there is one. [Decided] A small menu on the + button also offers Area and Note. [Default] |
| Same model as desktop | Yes: the same canvas and the same rules, only different controls. |

### 1.6 Home screen

| Topic | Decision |
|---|---|
| Layout | A grid of panel cards, each with a **mini-map thumbnail** of that panel's canvas and its title [Decided] |
| Thumbnail drawing | A simplified SVG: areas as rectangles with their titles, tasks as small blocks in their state color. It follows the Done-visibility switch. [Default] |
| Order | **Manual**, drag to rearrange [Decided] |
| Actions | Create, rename, delete (with confirmation), open [Default] |

### 1.7 Look and platform

| Topic | Decision |
|---|---|
| Theme | **Light only** [Decided] |
| Style | **Clean and modern**, similar to Linear or Notion: subtle shadows, rounded cards, a quiet dot-grid background [Decided] |
| Interface language | **English** [Decided] |
| Storage | **Automatic local save only** (IndexedDB), no export or import [Decided]. See the risk note in §8. |
| Sync | Not in the first version. The data layer is designed so sync can be added later (§3.4). |
| Hosting | GitHub Pages from a **public** repo [Decided] |
| Canvas engine | **A custom, lightweight canvas** built with React and CSS transforms, without a canvas library [Decided] |
| Installable app (PWA) | Yes: a manifest and icons so you can choose "Add to Home Screen" on iPhone, which opens full-screen in portrait. It also helps protect against iOS clearing the data (§8). [Default, recommended] |

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite** | Fast and simple. Outputs a static site for GitHub Pages. |
| UI | **React 19 + TypeScript (strict)** | |
| State | **Zustand** + **Immer** | Small and fast, and it can update only the parts of the screen that change. |
| Persistence | **idb-keyval** (IndexedDB) | Larger storage limits than localStorage, and asynchronous. |
| IDs | **nanoid** | |
| Styling | **CSS Modules + CSS custom properties** | State colors live in variables, which makes them easy to change in Settings. |
| Gestures | Custom code on **Pointer Events** | Full control over the middle-button pan, the selection box, pinch zoom and drag thresholds. |
| Routing | A small **hash router** (`#/`, `#/panel/:id`, `#/settings`) | GitHub Pages can't handle client-side routes, so hash URLs avoid 404s. |
| Tests | **Vitest** for the store and geometry logic | |
| Deploy | **GitHub Actions** → GitHub Pages. Vite `base: '/Spatium/'`. | |
| PWA | `vite-plugin-pwa` (manifest plus a basic offline cache) | |

No backend.

---

## 3. Data model

### 3.1 Types

```ts
type ID = string;
type TaskState = 'blank' | 'delayed' | 'inProgress' | 'done';

interface Doc {                       // the whole persisted document
  schemaVersion: number;
  panels: Record<ID, Panel>;
  panelOrder: ID[];                   // manual order on the home screen
  items: Record<ID, Item>;            // every canvas item from every panel, stored flat
  settings: Settings;
}

interface Panel {
  id: ID;
  title: string;
  viewport: { x: number; y: number; zoom: number };  // remembered view
  createdAt: number; updatedAt: number;
}

interface ItemBase {
  id: ID;
  panelId: ID;
  parentId: ID | null;      // null = directly on the panel canvas; otherwise the id of an area
  x: number; y: number;     // position RELATIVE TO THE PARENT's content origin
  w: number; h: number;
  z: number;                // stacking order among siblings
  createdAt: number; updatedAt: number;
}

interface TaskItem extends ItemBase {
  type: 'task';
  title: string;
  description: string;      // '' = none
  state: TaskState;
  important: boolean;
  subtasks: Subtask[];      // ordered
  subtasksExpanded: boolean;
}

interface Subtask { id: ID; title: string; state: TaskState; }

interface AreaItem extends ItemBase {
  type: 'area';
  title: string;
  color: string | null;     // accent color
  collapsed: boolean;
}

interface NoteItem extends ItemBase {
  type: 'note';
  text: string;
}

type Item = TaskItem | AreaItem | NoteItem;

interface Settings {
  stateColors: Record<TaskState, string>;
  importantColor: string;
  showDone: boolean;        // the global Done-visibility switch
  gridSnap: boolean;
  gridSize: number;         // e.g. 20
}
```

### 3.2 Why it is shaped this way

- **Flat items with `parentId`** instead of nested trees. Moving an item to another area only changes `parentId`, `x` and `y`. A flat structure is also easy to sync later.
- **Positions relative to the parent.** Moving an area moves everything inside it automatically, with no updates to the children.
- **Derived indexes** (`childrenByParent`, `itemsByPanel`) are computed in memory with memoized selectors and are not stored.
- A **`updatedAt` on every entity** prepares for a future sync that merges changes per entity.

### 3.3 Persistence

- The whole `Doc` is saved to IndexedDB under a single key, **at most once every 300 ms (debounced)** after any change, and again on `visibilitychange`/`pagehide`. iOS can close a tab without warning, so the final save matters.
- On startup the app loads the document, runs migrations (`schemaVersion`), and then calls `navigator.storage.persist()`.
- On the very first run, the app creates one empty panel called "Personal".

### 3.4 Preparing for sync later

All reads and writes go through a small `Repository` interface (`load(): Promise<Doc>`, `save(doc): Promise<void>`). The first version has a single `IndexedDbRepository`. A future `SyncedRepository` (for example Supabase, Firebase, or a JSON file in a private Gist) can be swapped in without touching the user interface.

---

## 4. Architecture

```
src/
  main.tsx, App.tsx              # hash router: Home | Panel | Settings
  model/
    types.ts
    store.ts                     # Zustand store (document + view state), every action
    history.ts                   # undo/redo
    selectors.ts                 # children by parent, visible items, counts
    geometry.ts                  # absolute positions, hit tests, area auto-grow
    persistence.ts               # Repository + IndexedDB implementation + migrations
  canvas/
    Canvas.tsx                   # viewport: pan, zoom, selection box, background grid
    useViewport.ts               # converts between screen and world coordinates; zoom toward a point
    gestures.ts                  # pointer state machine (mouse + touch)
    ItemRenderer.tsx             # renders items recursively, nested inside their parents
    TaskCard.tsx
    AreaBox.tsx
    NoteBlock.tsx
    ResizeHandles.tsx
    SelectionToolbar.tsx         # floating action bar (used on mobile and desktop)
    StatePicker.tsx
  panel/
    PanelScreen.tsx              # top bar + canvas + mobile + button
    TopBar.tsx                   # Home, title, highlight chips, Done switch, undo/redo, grid, settings
  home/
    HomeScreen.tsx
    PanelThumbnail.tsx           # SVG mini-map
  settings/
    SettingsScreen.tsx           # state colors, grid size
  styles/
    tokens.css                   # colors, shadows, border radii
```

### 4.1 Rendering approach

- A world `<div>` is moved and scaled with a single `transform: translate(x,y) scale(z)`. Panning and zooming only change that transform, so React doesn't redraw the items while you navigate.
- Items are rendered **nested in the page structure**: a child sits inside its parent area's content `<div>`, positioned absolutely at its own `x`/`y`. This makes relative positioning, clipping (if ever needed) and collapsing work naturally.
- Each item is wrapped in `React.memo` and subscribes only to its own record, so a drag only redraws the item being dragged.
- While dragging, the position is applied directly to the element's style. The store is updated once, on release, which also creates **one undo entry**.
- Performance: hundreds of items are fine without extra work. If it ever slows down, items outside the visible area can be skipped (off-screen culling). This is not needed for the first version.

### 4.2 Gesture state machine (`gestures.ts`)

| Input | On | Result |
|---|---|---|
| Mouse wheel | anywhere | Zoom toward the cursor |
| Middle button drag | anywhere | Pan |
| Left button drag | empty canvas or the empty interior of an area | Selection box |
| Left button drag | task, note, or area title bar | Moves the item, or the whole selection if it is selected |
| Left button click | item | Selects it (Shift+click adds to or removes from the selection) |
| Double-click | empty space | Creates a task there, with its title ready to type |
| Double-click | task title, note | Edits in place |
| 1 finger | empty space | Pan |
| 1 finger | item or area title bar | Drag; a tap selects |
| 2 fingers | anywhere | Pinch zoom + pan |

- A **movement threshold** (about 4 px for the mouse, 8 px for touch) separates a tap from a drag.
- While a text field is being edited, pointer handling stops for that element so text selection works normally.
- iOS: `touch-action: none` on the canvas. Block Safari's `gesturestart` event. Use `user-scalable=no` in the viewport meta tag, `100dvh` for full height, and safe-area insets. Inputs use a font size of at least 16 px so iOS doesn't zoom when one is focused.

### 4.3 Nesting rules (`geometry.ts`)

1. **Choosing the new parent when you drop**: the innermost **expanded** area under the pointer. The dragged item itself and its descendants are excluded. Collapsed areas don't accept drops.
2. **Changing parent**: keep the item's absolute position, then convert it to coordinates relative to the new parent. The item comes to the front among its new siblings.
3. **Auto-grow**: after a drop or resize, if the item extends past its parent's right or bottom edge (plus a margin), the parent grows to fit. This repeats up through every enclosing area. If an item extends past the left or top edge, the parent's content is shifted instead: the parent's `x`/`y` decreases and every child's position is adjusted to match, so nothing appears to move.
4. **Multi-selection drag**: every selected item moves by the same amount and gets its own new parent. If both an area and one of its children are selected, only the area moves (the child follows automatically).
5. **Collapse**: the area is drawn as only its title bar (same width). The children stay in the data but are not rendered. The title bar shows counts by state (`● 3 ● 1 ● 2`) and the highlight badge.
6. **Delete**: the item and all its descendants are deleted together, in one undo entry.
7. **Minimum sizes**: task 160×56, note 80×32, area 200×120 (world units).

### 4.4 Undo/redo (`history.ts`)

- Before each user action, the app stores a snapshot of the `Doc` (cheap thanks to Immer's structural sharing).
- Up to 200 steps, kept in memory only.
- Rapid changes made with the same gesture or the same editing session are merged into one step: a drag is one step, and a title edit is one step when you finish editing.
- View changes (panning, zooming, the highlight chips, the Done switch) are **not** recorded in undo history.

---

## 5. Screens and visual spec

### 5.1 Task card (desktop)

```
┌────────────────────────────────┐   soft tint of the state color
│ ●  Fix scoring bug          ★  │   ● state dot → 4-option picker   ★ Important toggle
│    Happens when the timer…     │   description: muted, clipped with a fade
│ ▸ 2/5                          │   subtask toggle + counter (shows "+ subtask" on hover if there are none)
└────────────────────────────────┘
expanded:
│ ▾ 2/5                          │
│   ● Repro on iOS               │   each subtask: state dot (same picker), title edited in place
│   ● Write test                 │   drag to reorder, × on hover to delete
│   + Add subtask                │   Enter in the last field adds the next one
```

- **Done**: green tint, strikethrough title, slightly faded.
- **Selected**: a 2 px accent outline and resize handles (corners and edges).
- While **highlighting**: matching tasks get a glow ring in their state color (or the Important color); the others drop to about 35% opacity and are desaturated.

### 5.2 Area

```
┌ ▾ Bugs  ··········  ●3 ●1 ●2  ⋯ ┐   title bar = where you drag; accent color strip on the left
│                                 │   double-click the title to rename
│   [task]      [task]            │   double-click empty space inside = new task here
│        ┌ ▾ Game A ─────────┐    │
│        │  [task]           │    │
└─────────────────────────────────┘
```

- The area body uses a very light fill (about 4% of the accent color, or neutral) with a subtle border. Nested areas sit slightly above their parent.
- The `⋯` menu (or the action bar when selected): Rename, Color, Collapse, Delete.

### 5.3 Note

Plain text with no card background (a light outline when selected or hovered). Resizable, edited in place, and it takes part in nesting like a task. It has no state, so highlighting ignores it.

### 5.4 Panel top bar

`[⌂ Home]  Panel title   ·   Highlight: (Blank)(Delayed)(In Progress)(Done)(★ Important)   ·   [Hide Done ⇄ Show all]   [⟲][⟳]   [# grid]   [⚙]`

On mobile it compacts to `[⌂] Title … [⟲][⟳] [filter ▾] [⋯]`. The highlight chips and the Done switch move into the filter popover.

### 5.5 Selection action bar

It floats above the selected item; on mobile it is fixed to the bottom of the screen.

- **Task**: state picker · ★ · subtasks · delete
- **Area**: color · collapse · delete
- **Note**: delete
- **Several items**: delete · (state, if all are tasks)

### 5.6 Home screen

The title "Spatium", then a grid of panel cards (2 to 4 columns on desktop, 1 to 2 in portrait). Each card shows the SVG mini-map and the panel title, plus a `⋯` menu to rename or delete. A final "+ New panel" card. Press and hold, or drag, to reorder.

### 5.7 Settings

Color pickers for each state and for Important, the grid size, and a "Reset colors" button.

---

## 6. Build phases

Each phase ends in a state that can be deployed. AI agents should complete them in order.

### Phase 0: Scaffold and deploy
- Vite + React + TS (strict), ESLint and Prettier, Vitest, CSS tokens.
- GitHub Actions workflow publishing to Pages; `base: '/Spatium/'`; hash router with placeholder screens.
- **Done when** the placeholder page loads at `https://<user>.github.io/Spatium/` on desktop and on the iPhone.

### Phase 1: Model, store, persistence, undo
- Types, Zustand store, every document action (create, update, move, change parent, resize, delete with descendants, reorder panels, subtask actions), selectors, geometry helpers, IndexedDB repository with migrations, history.
- Unit tests: changing parent keeps the absolute position; auto-grow passes up through parents; deleting removes descendants; undo/redo merges steps correctly.
- **Done when** the tests pass and data survives a reload.

### Phase 2: Canvas viewport
- Panning and zooming (wheel toward the cursor, middle-button pan, pinch and two-finger pan), dot-grid background that scales with zoom, the view remembered for each panel.
- **Done when** navigation is smooth on desktop and iPhone, and the page itself never zooms or scrolls on iOS.

### Phase 3: Items on the canvas
- Drawing tasks, areas and notes nested inside their parents; selection (click, Shift+click, selection box); dragging (direct style updates, saved on release); resize handles; snapping to the grid; bring-to-front; double-click to create; Delete and Esc.
- **Done when** you can create, move and resize all three item types, and multi-select drag works.

### Phase 4: Nesting
- Choosing the parent on drop, changing parent, auto-grow (including the left and top edges), collapse and expand with state counts, deleting an area with confirmation, area accent colors.
- **Done when** you can nest areas three or more levels deep, moving a parent moves everything inside it, and collapse works.

### Phase 5: Task features
- Editing the title and description in place, the state dot picker, the Important star, subtasks (add, edit, change state, reorder, delete, expand and collapse, counter), strikethrough and styling for Done.
- **Done when** every task field can be edited directly on the card, with undo.

### Phase 6: Highlighting and Done visibility
- Highlight chips (several allowed, any one matching), glow and dim effect, badges on collapsed areas, global Done switch (applies to tasks, subtasks and thumbnails), Done chip disabled while Done is hidden.
- **Done when** turning these on and off never changes any position.

### Phase 7: Home screen
- Panel cards with SVG mini-maps, create, rename, delete, drag to reorder, opening a panel, Home button.
- **Done when** you can manage several panels from the home screen.

### Phase 8: Mobile polish and PWA
- Floating + button (Task, Area, Note), bottom-docked action bar, larger touch handles, compact top bar and filter popover, safe areas, PWA manifest and icons, `storage.persist()`.
- **Done when** every Phase 3–7 feature works one-handed in portrait on the iPhone, including from the Home Screen app.

### Phase 9: Settings and final polish
- Settings screen (state colors, grid size), empty states, subtle animations (collapse, picker), a performance check with about 500 items.

---

## 7. Out of scope for the first version (from the vision document and the Q&A)

Deadlines, due dates, reminders, calendar, priority levels, automatic sorting, suggestions, a combined view of all tasks, onboarding, search, export/import, sync, dark theme, keyboard shortcuts beyond the basics, extra element types (images, links, embeds), multiple locations for one task, and nested subtasks.

---

## 8. Risks and notes

> **Data loss risk (please read).** With local save only and no export, all data lives in a single browser on a single device. Safari may **delete website data that hasn't been visited in about 7 days**. Using the app from the **Home Screen (PWA)** and requesting persistent storage greatly reduces that risk. Clearing Safari's website data would still erase everything. A hidden "Export JSON" button costs about 30 minutes to add if you change your mind.

- Desktop and phone data are **separate** until sync exists.
- The repo is public, but **no task data is ever stored in it**. Only the app code is.
- Middle-button panning needs a mouse. A trackpad has no middle button, so on a trackpad you could pan with Space + left-drag. Not planned unless you ask for it.
