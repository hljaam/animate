# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Electron app with hot reload (electron-vite)
npm run build      # Compile and bundle (main + preload + renderer)
npm run package    # Build + create platform installer via electron-builder
npm run preview    # Preview the packaged build
```

There is no test runner configured. There is no lint script.

## Architecture

This is an **Electron desktop 2D animation editor** (Adobe Animate-style) with three processes:

### Process Boundaries

- **Main process** (`src/main/`) — Node.js, file I/O, FFmpeg export, IPC handler registration
- **Preload** (`src/preload/index.ts`) — `contextBridge` exposing `window.electronAPI` to the renderer
- **Renderer** (`src/renderer/`) — React + PixiJS + Zustand, no direct Node access

IPC is the only bridge between renderer and main. All file operations go through `window.electronAPI`. When adding new IPC methods, you must update all three layers: handler in `src/main/ipc/`, bridge in `src/preload/index.ts`, and type in `src/renderer/types/electronAPI.ts`.

All IPC handlers are registered centrally in `src/main/ipc/index.ts` via `registerAllHandlers()`.

Current IPC methods (kebab-case channel names): `import-asset`, `import-swf`, `import-psd`, `save-project`, `open-project`, `open-script`, `export-start`, `export-frame`, `export-finalize`, `export-progress` (event). Handlers are registered in five groups: `registerAssetHandlers()`, `registerProjectHandlers()`, `registerExportHandlers()`, `registerSwfHandlers()`, `registerPsdHandlers()`.

### State Management

Three Zustand stores:

- **`projectStore`** — project data (layers, assets, keyframes, tracks). Undo/redo uses Immer patches (hybrid approach). Key methods:
  - `applyAction(description, mutator)` — undoable mutation. Wraps the mutator in Immer's `produceWithPatches`, captures forward/inverse patches, and pushes to `CommandHistory`. Use this for all user-facing mutations.
  - `mutateProject(mutator)` — non-undoable mutation via Immer `produce()`. Use for live drag updates and other ephemeral changes.
  - `updateLayer(layerId, changes)` — non-undoable convenience method for simple layer property changes (name, visibility, lock).
- **`editorStore`** — ephemeral UI state: selectedLayerIds, currentFrame, isPlaying, zoom, panX/Y, activeTool (`'select'`|`'hand'`), selectedSpan, loopPlayback, onionSkin settings, timelineZoom (0.5–4.0), layerRowHeight (`'short'`|`'medium'`|`'tall'`), editingSymbolId/editingObjectId (nested editing), export state, dialog visibility.
- **`clipboardStore`** — clipboard for both layer copy/paste (Ctrl+C/V with deep clone, new IDs, center-offset) and frame-level keyframe value copy/paste.

**Critical convention:** All user-facing mutations to project data must go through `applyAction()`. `CommandHistory` (`src/renderer/store/commands/Command.ts`) stores `PatchEntry` objects (description + Immer patches + inverse patches). Undo applies inverse patches; redo re-applies forward patches. No per-operation Command classes needed — any mutation is automatically undoable. History is in-memory only; cleared on project load.

**Live vs. committed updates:** For drag operations and property panel inputs, use `mutateProject()` on every pointermove/input for immediate visual feedback, then `applyAction()` on pointerup/blur to commit the final state to undo history. This two-phase pattern prevents flooding the history with intermediate states.

**Store subscriptions:** Use Zustand selectors to avoid unnecessary re-renders:
```typescript
const zoom = useEditorStore((s) => s.zoom)        // Re-renders only when zoom changes
const project = useProjectStore.getState().project  // Immediate read, no subscription
```

### Frame/Keyframe Model

The timeline follows Adobe Animate's hold-by-default paradigm:

- **Default easing is `'step'`** — keyframes hold their value until the next keyframe (no interpolation). This is set via the `DEFAULT_EASING` constant in `src/renderer/types/project.ts`.
- **Span-based visualization** — the timeline renders colored blocks between keyframes: gray spans = hold (step easing), blue spans = tween (non-step easing, with arrow indicator).
- **Span selection** — clicking between keyframes selects a span, tracked in `editorStore.selectedSpan` (`{ layerId, startFrame, endFrame }`). This is distinct from keyframe selection.
- **Frame operations** — F5 inserts frames: if the playhead is past `endFrame`, extends to the playhead; otherwise extends by 1 frame. Shift+F5 shrinks by 1 frame (trims keyframes past new end). F6 converts the current frame to a keyframe (interpolated values, inherits span easing). F7 inserts a blank keyframe (default values, step easing). F5/F6/F7 all extend the layer if the playhead is past the current end. Also available via right-click context menu on the timeline.
- **Tween toggling** — right-click context menu on spans: "Create Classic Tween" sets easing to linear; "Remove Tween" reverts to step. Tween type submenu switches between linear/easeIn/easeOut/easeInOut.
- **Frame labels** — stored in `project.frameLabels`, rendered as gold flag markers on the TimeRuler.

### Rendering

`StageRenderer` (`src/renderer/pixi/StageRenderer.ts`) owns the PixiJS `Application` instance. It manages a `worldContainer` holding all sprites/text/shapes plus a `selectionOverlay` on top. It caches textures, text objects, and shape graphics to avoid recreation each frame. For `shapeObject` content, a `shapeObjectDataCache` maintains stable `ShapeData` references per object ID — this prevents the shape graphics cache (`_shapeDataRef` comparison) from invalidating every frame. The `usePixiStage` hook manages the PixiJS lifecycle and subscribes to store changes.

Keyframe interpolation lives in `src/renderer/pixi/interpolation.ts` — supports linear, easeIn, easeOut, easeInOut, and step easing. Step easing holds the previous value (no lerp).

Stage interactions: pointer down on empty stage starts marquee selection; pointer up selects all layers within rect bounds. Right-click on a layer shows a context menu with Copy, Paste, Delete, Save to Objects, Save to Unit (auto-converts to symbol if needed), Swap Object (for shape/symbol layers with available shape objects), Bring to Front, Send to Back.

### Data Model

```
Project → layers: Layer[] → contentItems: ContentItem[] + contentKeyframes: ContentKeyframe[]
                           → tracks: PropertyTrack[] → keyframes: Keyframe[]
Project → assets: Asset[]
Project → symbols?: SymbolDef[]
Project → shapeObjects?: ShapeObjectDef[]
Project → units?: UnitDef[]
Project → frameLabels?: Record<number, string>
```

**Core types** (defined in `src/renderer/types/project.ts`):
- `EasingType`: `'linear'` | `'easeIn'` | `'easeOut'` | `'easeInOut'` | `'step'`
- `TrackProperty`: `'x'` | `'y'` | `'scaleX'` | `'scaleY'` | `'rotation'` | `'opacity'`
- `LayerType`: `'image'` | `'text'` | `'shape'` | `'symbol'` (derived, not stored)
- `ContentPayload`: `{ type: 'shape'; shapeData }` | `{ type: 'shapeObject'; shapeObjectId }` | `{ type: 'symbol'; symbolId }` | `{ type: 'image'; assetId }`

**Content system:** Each layer has a `contentItems[]` palette (the pool of available content: shapes, images, symbols, shapeObjects) and `contentKeyframes[]` (which item is active at each frame, hold-by-default). This allows a single layer to display different content types at different frames (e.g., a symbol at frame 0, a shape at frame 30). Text layers use `textData` directly (not content-swappable).

Helper functions in `src/renderer/utils/layerContent.ts`: `getActiveContent(layer, frame)`, `getActiveContentPayload(layer, frame)`, `getLayerType(layer)`, `getLayerShapeData(layer, frame, shapeObjects?)`, `getLayerAssetId(layer, frame)`, `getLayerSymbolId(layer, frame)`, `getLayerShapeObjectId(layer, frame)`, `isTextLayer(layer)`. All UI and renderer code uses these helpers instead of reading layer fields directly. **Never read `layer.type`, `layer.assetId`, `layer.symbolId`, `layer.shapeData`, or `layer.shapeObjectId` directly** — these are deprecated legacy fields kept only for migration. Always use the helper functions.

Migration: `src/renderer/utils/migrateProject.ts` auto-converts old `.animate` files (with `layer.type`/`assetId`/`symbolId`) to the new content model on project load.

Layer factory functions in `src/renderer/utils/layerFactory.ts`: `createImageLayer()`, `createTextLayer()`, `createRectangleLayer()`, `createEllipseLayer()`, `createSymbolLayer()`, `createShapeObjectLayer()`. **When creating layers manually** (outside factories), always set `contentItems` and `contentKeyframes` — the renderer resolves what to draw via `getActiveContent()`, so layers without these fields render invisible.

Properties animated per layer: `x`, `y`, `scaleX`, `scaleY`, `rotation`, `opacity`. Each property has its own `PropertyTrack` with sorted keyframes.

Layers also support: `blendMode`, `tintColor`/`tintAmount`, `filters` (blur/dropShadow/glow via `FilterConfig[]`), `isMask`/`maskLayerId` (masking), `shapeKeyframes` (shape morphing), `outlineMode`/`outlineColor` (colored outline display), `semiTransparent` (reduced opacity preview via Shift+click eye icon).

Asset types: `image`, `sound`, `font`. Assets are stored as local file paths in `~/.userData/projects/{projectId}/.project_assets/`; layers reference them by `assetId` via content items. Sound infrastructure exists in the type system but playback is not yet wired up.

### Shape & Vector Support

`ShapeData` consists of `ShapePath[]`, each with `ShapeSegment[]` (move/line/cubic/quadratic/close). Supports sub-paths for even-odd fill holes, bitmap fills via `bitmapFillAssetId`, and origin points for transform anchoring.

`svgToShapeData.ts` parses SVG path notation (M/L/C/Q/Z), extracts fill/stroke, handles even-odd fill-rule. Used by the SWF import pipeline.

### Symbols

Symbols (`SymbolDef`) are reusable nested timelines containing their own layers. They live in `project.symbols` (an array of `SymbolDef`). Symbol layers reference a `symbolId` and render the symbol's nested timeline. The editor supports nested editing — `editorStore.editingSymbolId` tracks which symbol is being edited. "Convert to Symbol" wraps existing layers into a new symbol; "Edit Symbol" enters the nested timeline.

`ShapeObjectDef` (reusable shape definitions) live in `project.shapeObjects`. A `ShapeObjectDef` may have an optional `symbolId` linking it to an associated `SymbolDef` — this is set when the object was created from layers with independent animation (the symbol preserves per-layer animation, the shapeObject stores the combined static shape for thumbnails). `UnitDef` groups related symbols and shape objects together in `project.units`.

### Hooks

Key React hooks in `src/renderer/hooks/`:

- **`usePixiStage`** — PixiJS lifecycle, store subscriptions, renders scene on state changes
- **`usePlayback`** — Frame-based playback loop via requestAnimationFrame
- **`useExport`** — Creates off-screen StageRenderer for frame capture and export orchestration
- **`useKeyboardShortcuts`** — Global keyboard bindings (see Keyboard Shortcuts below)
- **`useClickOutside`** — Detect clicks outside an element (for closing menus/popovers). Uses `pointerdown` in the capture phase so it fires before PixiJS or other handlers can intercept.
- **`useContextMenuPosition`** — Calculate context menu position relative to cursor, clamped to viewport

### Command Console

`Ctrl+K` opens a text command console (`src/renderer/console/`). Parser (`commandParser.ts`) and executor (`commandExecutor.ts`) support commands: add-image, add-text, select, move, scale, rotate, opacity, frame, keyframe, duplicate, delete, hide, lock, export-mp4. Supports multi-word layer names, quoted strings, and batch execution via `runBatchScript(lines)`.

### Keyboard Shortcuts

Defined in `src/renderer/hooks/useKeyboardShortcuts.ts`:

| Key | Action |
|---|---|
| `Ctrl+0` | Fit to canvas |
| `Ctrl+1` | 100% zoom |
| `Ctrl+K` | Command console |
| `Ctrl+A` | Select all layers |
| `Ctrl+C` | Copy selected layers |
| `Ctrl+V` | Paste layers |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `H` | Hand (pan) tool |
| `V` | Select tool |
| `Delete` / `Backspace` | Remove selected layer |
| `Space+drag` | Pan (release without drag = play/pause toggle) |
| Middle-mouse drag | Pan |
| `Ctrl+wheel` | Zoom (centered on cursor) |
| `,` / `.` | Previous / Next frame |
| `←` / `→` | Previous / Next frame |
| `Shift+←` / `Shift+→` | Jump to previous / next keyframe on selected layer |
| `Enter` | Toggle play/pause |
| `F5` | Insert frame (extend to playhead if past end, otherwise +1) |
| `Shift+F5` | Remove frame (shrink layer end by 1) |
| `F6` | Convert frame to keyframe (interpolated values, extends if needed) |
| `F7` | Insert blank keyframe (default values, extends if needed) |

### Interaction Patterns

- **Keyframe dragging** — pointer down on keyframe diamond, global pointermove/pointerup listeners, updates frame number across all tracks, commits via `applyAction()`.
- **Layer toggle drag** — clicking visibility/lock icons and dragging across layer rows applies the toggle to all entered rows. Alt+click = solo, Shift+click eye = semi-transparent mode.
- **Stage pan inertia** — Space+drag tracks velocity over last 80ms; on release, inertia continues with 0.92 exponential friction decay.
- **Cursor-relative zoom** — computes world coordinates under cursor, applies zoom, recomputes pan to keep the same world point under cursor.

### SWF Import & FFDec Integration

SWF import uses JPEXS FFDec (`ffdec.jar`) to decompile SWFs. Key files in `src/main/ipc/`:

- **`ffdecService.ts`** — Wrapper around FFDec CLI. Resolves Java path (bundled JRE in `bin/jre/` for dev, `extraResources/ffdec/jre/` for prod, or system `java` as fallback). Exports `dumpSwf()` (XML structure) and `exportAssets()`.
- **`ffdecAssetExtractor.ts`** — Extracts images, shapes (SVG), sounds, fonts from SWF via FFDec. Maps SWF character IDs to extracted files.
- **`ffdecTimelineParser.ts`** — Parses FFDec XML dump to rebuild timeline. Tracks display list per frame via PlaceObject/RemoveObject tags, decomposes Flash matrices, builds PropertyTrack keyframes.
- **`matrixUtils.ts`** — Flash matrix decomposition utilities used by the timeline parser.
- **`svgToShapeData.ts`** — Converts JPEXS-exported SVG vector shapes into the app's `ShapeData` format.
- **`swfHandlers.ts`** — Registers `'import-swf'` IPC handler. Extracts assets and parses timeline directly via FFDec.
- **`psdHandler.ts`** — Registers `'import-psd'` IPC handler. Imports Photoshop PSD files using `@webtoon/psd`.

### Export Pipeline

Renderer captures frames as raw RGBA binary → sends to main via IPC (`exportFrame`) → main writes temp files as `frame_{000000}.raw` → FFmpeg encodes to MP4 (h264, yuv420p, faststart) via `fluent-ffmpeg` + `ffmpeg-static`. A separate `StageRenderer` instance is created off-screen for export to avoid disturbing the UI.

### Project Save/Load

Save writes project JSON to a `.animate` file via Electron save dialog. Load reads the file, parses JSON, and calls `setProject()` to replace state (undo history is cleared). Assets are stored as files in `~/.userData/projects/{projectId}/.project_assets/` with nanoid-based filenames.

### UI Layout

```
TopBar (file ops, zoom, undo/redo, export, tool select)
├── ToolSidebar │ LibraryPanel │ StageContainer │ PropertiesPanel
Timeline (playback controls, layer rows, keyframe tracks)
```

The three-column body uses `ResizeDivider` components for draggable panel resizing (left: 140–500px, right: 180–500px, timeline: min 100px). `ToolSidebar` switches between Library and Units panels.

`LibraryPanel` manages assets and symbols with search and type filtering (all/images/symbols). `UnitsPanel` manages reusable shape objects and symbols (distinct from Library — Units are saved groupings). Right-clicking timeline layers shows a context menu with: Duplicate, Delete, Hide/Show, Lock/Unlock, Convert to Symbol, Edit Symbol.

`StageContainer` handles pan (Space+drag or middle-mouse) and zoom (Ctrl+wheel, centered on cursor). Zoom value of 0 means fit-to-canvas.

Dialogs: `NewProjectDialog` (project presets), `ExportProgressModal` (real-time progress bar), `CreateObjectDialog` (save selected layers as shape object — for multi-layer objects with independent animation, creates both a `SymbolDef` and a `ShapeObjectDef` linked via `symbolId`; the outer layer's tracks are set to the combined center position with inner symbol layers made relative), `SaveToUnitDialog` (name & save symbol/object to a unit), `SwapObjectDialog` (swap a layer's content to a different shape object — searchable grid picker grouped by unit; if the selected object has an associated `symbolId`, swaps to the symbol to preserve internal animation, otherwise swaps to the static shapeObject).

`PropertiesPanel` has two tabs: PROPERTIES (DocumentTab — project name, canvas size, background color, FPS, duration) and LAYER (LayerTab — transform X/Y/scaleX/Y/rotation/opacity with live editing via `mutateProject()` and keyframe diamond indicators per property).

### Styling Convention

Hybrid approach — **Tailwind CSS** for layout/structure and **inline styles** for component-specific dynamic values:

- **Tailwind + CVA** — primary styling method. Classes applied directly in JSX. `cn()` helper in `src/renderer/lib/utils.ts` (clsx + tailwind-merge) for conditional class merging.
- **Inline `styles` objects** — some components still define a `styles` record at the bottom with `React.CSSProperties` values for non-Tailwind-friendly dynamic styles.
- **Design tokens** — CSS custom properties in `src/renderer/styles/global.css`, mapped through `tailwind.config.js`. Key variables: `--bg-primary` (#0D0D11), `--bg-secondary` (#16161C), `--accent` (#8B5CF6), `--text-primary` (#E8E8ED), `--topbar-height` (48px), `--timeline-height` (220px).
- **Tailwind config** — custom font sizes (xs=11px, sm=12px, base=13px, lg=16px), custom color palette mapping CSS variables, custom border-radius scale.

### UI Components

`src/renderer/components/ui/` contains shadcn-style components built on Radix UI primitives + Tailwind + CVA: `button`, `input`, `label`, `separator`, `dialog`, `tabs`, `progress`, `dropdown-menu`, `popover-menu`. Button has 7 variants (default, primary, destructive, outline, ghost, icon, export) and 4 sizes. All use `React.forwardRef` for composition.

### CSP

`src/renderer/index.html` has a Content-Security-Policy meta tag. Notable: `worker-src blob:` (PixiJS texture workers), `img-src file:` (local assets), `connect-src data: blob:` (PixiJS fetches). Changes to resource loading may require CSP updates.

## Key Config Files

- `electron.vite.config.ts` — Vite config with three build targets (main, preload, renderer)
- `tailwind.config.js` / `postcss.config.js` — Tailwind scans `src/renderer/**/*.{ts,tsx}`, custom color palette mapped to CSS variables
- `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` — separate TS configs for each process. Renderer uses path alias `@renderer/*` → `src/renderer/*`
- `package.json` `build` section — electron-builder packaging config (NSIS for Windows, DMG for Mac, AppImage for Linux)
- FFmpeg binary is bundled via `extraResources` in the electron-builder config
- FFDec (JPEXS): `bin/ffdec.jar` + `bin/jre/` in dev; `extraResources/ffdec/` in prod
- Build output goes to `out/` (main, preload, renderer bundles); packaged installers to `dist-electron/`
- BrowserWindow defaults: 1440×900 (min 1024×700), dark theme, context isolation enabled, no sandbox

## Other Documentation

- `FEATURES.md` — comprehensive feature list and UI behavior reference
- `COMMAND_CONSOLE.md` — full command console reference with examples
