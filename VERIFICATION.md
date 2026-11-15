# Spatium implementation and review record

## Private cloud sync — 2026-11-15

The owner approved adding single-user phone/PC sync through Supabase. The client uses project `pfomcrdvmrrufutppuwl` and the provided browser publishable key. Credentials for database administration and app login are not embedded in the app. This supersedes the original local-only scope for the sync work.

Implemented: email/password login, explicit first upload or whole-copy choice, local persistence before cloud writes, server-enforced revision checks, refresh on focus/foreground and lightweight revision polling, offline retry/reload, device-local viewport positions, account binding, conflict recovery snapshots, and visible cloud status. Recovery keeps up to twelve recent copies on the device where a choice was made. Local editing remains available when signed out or offline.

`supabase/setup.sql` creates one configured owner, private storage, anonymous-access denial and atomic version-checked save functions. It must be applied to the hosted project after creating the single Auth user and disabling public signup. The owner-only SQL setup was exercised against PostgreSQL through PGlite, including denied anonymous/other-user reads and writes, denied direct updates, stale-revision rejection and safe reapplication. `scripts/provision-supabase.mjs` can perform the hosted setup using temporary secure-input files; no admin access had been supplied at this verification point, so hosted provisioning and a real-account cross-device acceptance test remain pending. See `supabase/README.md` for the matching setup instructions.

Final sync-change checks: **44 passing unit/SQL tests**, **57 passing desktop/portrait browser tests with 25 input-specific skips**, lint, strict TypeScript/production build, and production IndexedDB/offline service-worker smoke all passed. Browser sync tests use independent device storage and mocked Supabase Auth/Data APIs. They cover first upload, another device pulling changes, conflicting offline edits surviving a reload, explicit conflict choice and retained recovery, local viewport preservation, and incorrect-password behavior. Runtime dependency audit: zero findings. No additional delegated review round was started.

The earlier implementation/review history below remains as a record of those checkpoints; its old local-only and deployment status notes are historical.

## Current mobile-usability revision — 2026-11-15

Implemented the owner-approved mobile adaptations: a simpler bottom action bar with More; a labelled, larger State button and explicit four-choice touch menu; Select more with tap-to-toggle membership and Finish selection; touch-accessible task/area title sizing with −/+ controls; first-tap selection before text editing; transparent inline editing with Done and visual-viewport/caret accommodation; bounded zoom compensation for selected resize handles; visible, occupancy-aware creation within a selected area; area focus with bottom-control clearance and mobile task focus at a readable width; Home/subtask reorder previews, insertion markers and edge scroll/pan; Home Move up/down actions; and a 9-pixel touch alignment tolerance matching preview and release.

Reorder drags explicitly prevent native touch scrolling while active, so the next tap reaches its control. The same protection applies to controlled canvas gestures. Popovers close on outside interaction. Mouse click patterns, document schema/version 3, and the existing spatial model remain intact. Subtask swipes are deferred; no swipe gesture competes with canvas task dragging.

The independent read-only design assessments completed before implementation: [Spatium mobile usability — Hydrogen XHigh](t3-thread://v2/571735f5-f3f7-49d1-bf77-b5f317459943/thread:delegated-task:command%3Amcp%3Ace75709a-692a-44c5-9a4d-a437acbac351%3Adelegate-task%3A77f6efc4-7007-4161-9a74-95132e04d341) and [Spatium mobile usability — Astra High](t3-thread://v2/571735f5-f3f7-49d1-bf77-b5f317459943/thread:delegated-task:command%3Amcp%3Ace75709a-692a-44c5-9a4d-a437acbac351%3Adelegate-task%3A815d30c8-5c6d-4299-b31d-814505db7bf5). Hydrogen's catalog now supports XHigh, so no downgrade was needed. No further delegated review round was started.

Verification: 33 passing unit tests; 53 passing desktop/portrait Chromium browser tests with 25 input-device-specific skips; lint, formatting, strict TypeScript/production build and the built CSS/hash-route/IndexedDB reload/offline service-worker smoke test pass. The eight new mobile browser scenarios cover selection/bulk typography, two-finger navigation plus group drag/undo, first-tap editing and commit grouping, a simulated keyboard-sized visual viewport, fixed action/handle dimensions at half zoom, visible non-stacking creation and area focus, subtask reorder/undo, and Home reorder with edge scrolling. Existing browser expectations were updated for the approved More menu and first-tap selection behavior.

The keyboard-sized viewport test is a deterministic geometry simulation, not an actual software keyboard. Physical iPhone Safari and installed Home Screen checks remain pending, especially native focus/keyboard presentation, selection/caret behavior, safe areas and page zoom. Changes remain local; nothing was deployed.

---

## Previous board and task-layout revision — 2026-11-15

The latest owner-approved decisions at the start of [PLAN.md](PLAN.md) supersede the earlier manual-height/no-reflow behavior and original Home design below. Implemented: shared task-title size with bulk right-click overrides/reset; the revised Done / In Progress / Blank / Delayed click mapping; larger state dots; new tasks collapsed by default; content-driven expanded heights; gap-preserving same-parent column movement with grouped undo; alignment snapping and transient guides; a wider responsive Settings screen with Back/Escape return to the originating panel; and an unboxed three-column Home board headed exactly **my Spatium**, with reorderable panel previews and a floating +.

Version-1/2 documents migrate to version 3. Content, nesting and existing collapsed flags are retained. Legacy expanded heights are fitted to their descriptions; following tasks move by the size difference to preserve stack gaps. No migration writes over an invalid or unsupported saved document. The stale-tab protection remains in place.

The focused browser tests cover live description growth, shrink/undo, untouched neighboring columns, bulk font overrides and default reset, Settings width/return behavior, snapping guide lifecycle, exact Home heading, board reordering and floating creation. Existing regression fixtures now explicitly expand tasks when testing expanded-only controls. Bringing an item forward now keeps DOM order stable, so the first click on its description opens the editor reliably.

Final checks: 29 unit tests and 45 desktop/portrait Chromium browser tests, with 17 input-device-specific skips; lint/formatting, strict TypeScript/production build, and production CSS/hash-route/IndexedDB/offline smoke checks. Real iPhone acceptance and remote deployment remain pending. No delegated review round was requested or launched for this revision.

---

## Previous interaction revision — 2026-11-14

The later owner-approved interaction revision is recorded at the start of [PLAN.md](PLAN.md). It supersedes the original grid, permanent-area-box, editing-cancellation and state-picker decisions described in this historical implementation/review record.

Implemented: heading-and-underline areas with transient boundaries, drag-resizable title fonts and gentler zoom scaling; area focus by button/action bar/double middle-click; no grid or snapping; title-only task collapse with progress rings; transparent editors that commit on Escape/click-away; pointer-position context creation; left-to-right containment/right-to-left crossing selection; and persisted click-pattern/visible-choice state-control modes. Touch and keyboard retain the explicit picker. Version-1 saved documents migrate without changing positions, content or nesting.

Current checks: 22 unit tests pass; 37 desktop/portrait Chromium browser tests pass with 15 input-device-specific skips; lint, strict TypeScript/production build and production offline/reload checks pass. Physical iPhone acceptance and remote deployment remain pending. No additional delegated review was requested or launched for this revision.

---

Date: 2026-11-14. Specification: [PLAN.md](PLAN.md).

## Implementation coverage

All phases have local implementations. The repository started with only the plan and Git metadata. No product features outside the specification were added.

| Phase | Implementation                                                                                                                                 | Verification                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 0     | Vite, React 19, strict TypeScript, ESLint/Prettier, Vitest, CSS tokens/modules, hash routes, `/Spatium/` base, Pages workflow                  | Build/lint pass; production hash-route smoke passes. Remote deployment is pending.                                 |
| 1     | Flat document model, Zustand/Immer actions, relative geometry, history, repository interface, IndexedDB validation/save                        | Unit tests cover nesting, growth, descendants, history, saves and failure paths; browser reload tests pass.        |
| 2     | Cursor-anchored wheel zoom, middle-drag pan, touch pan/pinch, remembered viewport, dot grid                                                    | Desktop and touch Chromium tests pass.                                                                             |
| 3     | Recursive items, selection, group movement, direct DOM drag/resize previews, snapping, front ordering, double-click creation, basic keys       | Model and browser manipulation tests pass.                                                                         |
| 4     | Positional nesting, ancestor growth including left/top compensation, collapse/counts, deletion confirmation, accents                           | Geometry tests and nested-item/collapse/resize browser tests pass.                                                 |
| 5     | Inline task fields, four-state picker, Important, subtasks and reordering, progress counters, Done styling                                     | Model and browser task/subtask/editing tests pass.                                                                 |
| 6     | OR highlight chips, glow/dim, collapsed-area badges, global Done visibility                                                                    | Browser tests verify filtering, hidden subtasks and unchanged positions.                                           |
| 7     | SVG mini-maps, panel CRUD, manual ordering, Home navigation                                                                                    | Panel-management and text-selection browser tests pass.                                                            |
| 8     | Floating creation menu, touch handles, bottom toolbar, compact filters, safe areas, manifest/icons, offline cache, storage persistence request | Portrait Chromium gesture tests and production offline reload pass. Real iPhone/Home Screen acceptance is pending. |
| 9     | State/Important color settings, grid size, empty states, subtle transitions, 500-item checks                                                   | Settings/history tests and 500-item unit/browser checks pass.                                                      |

## Review execution

The first round launched three independent T3 Code delegates concurrently, each with the complete plan and current filesystem implementation. They received identical read-only constraints and no other reviewer's findings. Source-file SHA-256 comparisons showed no changes throughout the round. All three completed.

- Hydrogen: `antigravity / gemini-4-hydrogen`, High. XHigh was unavailable in the provider catalog; the owner explicitly approved High. <t3-thread://v2/571735f5-f3f7-49d1-bf77-b5f317459943/thread:delegated-task:command%3Amcp%3A488a9f78-fbb4-4a38-b75c-1f42b851f920%3Adelegate-task%3A11192675-68a8-44fd-b8d6-6dc7ea4132c1>
- GPT-6.1 Sol: `codex / gpt-6.1-sol`, High. <t3-thread://v2/571735f5-f3f7-49d1-bf77-b5f317459943/thread:delegated-task:command%3Amcp%3A488a9f78-fbb4-4a38-b75c-1f42b851f920%3Adelegate-task%3A731ab6ab-46c4-4b3e-98e9-9f7639176cdb>
- GPT-6 Astra: `codex / gpt-6-astra`, High. <t3-thread://v2/571735f5-f3f7-49d1-bf77-b5f317459943/thread:delegated-task:command%3Amcp%3A488a9f78-fbb4-4a38-b75c-1f42b851f920%3Adelegate-task%3Ac44f9b63-a559-496b-aa8a-e7bd1d80912c>

After verified fixes, the owner explicitly requested one additional round with only Opus 5.5 Medium. T3 resolved `antigravity / claude-opus-5-5`, Medium; the native Claude provider was disabled. Source hashes remained unchanged during this review as well. Opus read the implementation but exhausted Antigravity quota before producing a final report. Its partial review was recovered and used; it was not retried or replaced, and no further review round was started. This is an incomplete review, not a clean verdict.

Opus attempt: <t3-thread://v2/571735f5-f3f7-49d1-bf77-b5f317459943/thread:delegated-task:command%3Amcp%3A488a9f78-fbb4-4a38-b75c-1f42b851f920%3Adelegate-task%3Aa4e3ac1f-caa6-4751-9fc4-e10a0e14d14a>

## Consolidated findings and disposition

The parent independently checked code evidence and added reproducing regressions before fixing the confirmed issues. Overlapping findings were merged. Thirteen concrete issues were fixed: ten from the initial round and three from the partial Opus review.

| Severity | Confirmed issue                                                             | Fix and evidence                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Active text drafts were absent from lifecycle saves                         | [persistence.ts](src/model/persistence.ts) commits the focused editor before taking the final snapshot. Browser regression types into a focused note, dispatches `pagehide`, checks IndexedDB and reloads.                                                                                                                                                                                                          |
| High     | An in-flight save deferred the final newer snapshot by another debounce     | [persistence.ts](src/model/persistence.ts) drains an urgent snapshot immediately after the active write. A deferred-repository unit regression reproduces the interleaving.                                                                                                                                                                                                                                         |
| High     | North/west area resizing moved descendants in world space                   | [store.ts](src/model/store.ts) compensates direct-child coordinates; [gestures.ts](src/canvas/gestures.ts) compensates the live content preview. Unit and browser checks verify stationary descendants during and after resize.                                                                                                                                                                                     |
| Medium   | Snapping a movement delta retained an old off-grid offset                   | [store.ts](src/model/store.ts) snaps the primary world destination and applies the resulting common delta to the group. Unit regression checks an off-grid primary and preserved relative spacing.                                                                                                                                                                                                                  |
| Medium   | Newly hidden tasks/descendants remained selected and actionable             | Document transactions in [store.ts](src/model/store.ts) prune invisible selection/editing IDs. Unit regression covers becoming Done while hidden and collapsing an ancestor.                                                                                                                                                                                                                                        |
| Medium   | Subtask lists/controls blocked wheel and multi-touch navigation             | [gestures.ts](src/canvas/gestures.ts) tracks touch contacts before single-pointer exclusions and separates wheel navigation from drag exclusions. Browser regressions exercise wheel over subtasks and pinch over subtasks/card controls.                                                                                                                                                                           |
| Medium   | A 56-unit task could not contain its controls                               | [TaskCard.tsx](src/canvas/TaskCard.tsx) and [App.module.css](src/styles/App.module.css) use compact padding/gaps and hide the description at small heights. Browser geometry checks cover collapsed and expanded subtasks. The specified minimum is retained.                                                                                                                                                       |
| Medium   | A pointer released outside the canvas before capture left an active gesture | [gestures.ts](src/canvas/gestures.ts) listens for movement/releases on the window and cancels a mouse gesture with no pressed buttons. A real mouse regression crosses the canvas boundary before the threshold, releases, and re-enters.                                                                                                                                                                           |
| Medium   | Continuous color changes consumed many undo entries                         | [ColorInput.tsx](src/settings/ColorInput.tsx) groups one focused color session into one store history entry. Browser regression changes the color repeatedly, then restores the original with one Undo.                                                                                                                                                                                                             |
| Low      | A draggable panel interfered with title text selection                      | [HomeScreen.tsx](src/home/HomeScreen.tsx) suspends native card dragging while its editor is focused/renaming. The mouse text-selection regression failed before the fix and passes afterward.                                                                                                                                                                                                                       |
| Medium   | A stale tab could overwrite another tab's newer saved document              | [IndexedDbRepository](src/model/persistence.ts) compares the loaded baseline and writes atomically in one IndexedDB transaction. A conflict stops that tab's writes, preserves the newer stored document and displays an explicit message. Two-tab browser regressions cover desktop and portrait configurations; a unit test checks that conflicts do not auto-retry. No tab synchronization or merging was added. |
| Medium   | Nested creation/resize used a different grid origin from movement           | [store.ts](src/model/store.ts) snaps world coordinates consistently and converts back to relative coordinates. A nested-item regression checks creation followed by resize under an off-grid parent.                                                                                                                                                                                                                |
| Medium   | Empty-space touch taps could not clear selection                            | [gestures.ts](src/canvas/gestures.ts) deselects on a touch pan gesture that never crosses the movement threshold. Browser regression verifies the toolbar disappears and the viewport stays fixed.                                                                                                                                                                                                                  |

Rejected or limited findings:

- Note text already inherits `overflow: hidden` through `.editable`; the reported non-editing spill was unsupported. No speculative note-layout change was made.
- Dev-server tests importing the source store are valid for their configured Vite dev server. A separate production smoke now verifies built assets, routing, reload and offline behavior without source imports.
- Canvas roots are already filtered by `panelId`; the tentative cross-panel rendering concern was unsupported.
- Prompt-mode PWA updates activate on a subsequent closed/reopened session; the partial review did not establish a broken update path. No new update UI was added.
- Page-level pinch behavior outside the canvas on real iOS remains an unverified device-specific concern. It is included in the outstanding iPhone acceptance check, not represented as a confirmed fixed defect.
- Cosmetic suggestions, per-panel history, extra shortcuts, synchronization, export/import and other changes outside the plan were not added.

## Final verification

All checks below passed after the final application changes:

| Check                     | Result                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run lint`            | Pass, zero warnings                                                                                  |
| `npm test`                | 17 passing tests across geometry, actions/history and persistence                                    |
| `npm run build`           | Strict TypeScript and production Vite/PWA build pass                                                 |
| `npm run test:e2e`        | 24 passing Chromium tests, 8 input-device-specific skips across desktop and portrait-mobile projects |
| `npm run test:production` | Built CSS, hash route, IndexedDB reload and offline service worker pass                              |
| `npm audit --omit=dev`    | Zero findings                                                                                        |

The 500-item checks verify indexing, counts, history, DOM rendering and viewport navigation. They are practical smoke checks, not a comprehensive performance benchmark. Portrait Chromium emulation does not substitute for Safari on physical hardware.

## Remaining work and limitations

- The Pages workflow is prepared, but these changes have not been committed, pushed or deployed. Repository Pages must use the GitHub Actions source. Remote availability at `https://brunohofstatter.github.io/Spatium/` has not been verified.
- Physical portrait iPhone/Safari and installed Home Screen acceptance remain pending, including native keyboard, safe areas, page-level zoom and storage retention behavior.
- The full dependency audit retains four low-severity package entries from the transitive `deepmerge` advisory chain in the build toolchain. Runtime dependencies have zero findings. The suggested forced audit fix downgrades the PWA plugin incompatibly; it was not applied.
- Storage is intentionally browser/device-local with no import/export or sync. Stale tabs cannot overwrite newer saves, but conflicting in-memory edits are not merged. Browser/OS termination can still interrupt an asynchronous save.
- Opus did not finish its review because of provider quota. Its concrete partial findings were verified and fixed, but no completed Opus verdict is claimed.
