# Animate — Feature Overview

A desktop 2D animation editor built with Electron, React, PixiJS, and Zustand.

---

## Project & Document

- **New Project Dialog** — presets for YouTube (1920×1080), TikTok/Reels (1080×1920), Instagram (1080×1080), or custom dimensions. Configure FPS (24/30/60) and duration (1–600s).
- **Save/Open Project** — serialize full project state to JSON; reload later.
- **Document Settings** (Properties Panel → Document tab) — edit project name, canvas width/height, background color (picker + hex), FPS (1–120), and duration in frames.

---

## Canvas / Stage

- **PixiJS Rendering** — real-time 2D rendering of all layer types (images, text, shapes, symbols).
- **Zoom** — `Ctrl+Wheel` zooms centered on cursor (10%–800%). Preset levels: 25%, 50%, 75%, 100%, 150%, 200%. `Ctrl+0` fits to canvas, `Ctrl+1` resets to 100%.
- **Pan** — `Space+Drag`, middle-mouse drag, or scroll wheel (Shift+Wheel for horizontal). Includes momentum/inertia on quick drags.
- **Selection** — click a layer on canvas to select; Shift+Click for multi-select; `Ctrl+A` selects all.
- **Empty State** — first-run card with "Import Image", "Add Text" shortcuts, drag-and-drop hint, and step-by-step workflow guide.
- **Drag & Drop** — drop PNG, JPG, or SVG files directly onto the canvas to import as image layers.
- **Canvas Context Menu** (right-click) — Copy, Paste (at cursor position), Delete, Save to Objects, Bring to Front, Send to Back, Select All.

---

## Tools

| Shortcut | Tool | Description |
|----------|------|-------------|
| `V` | Select | Default tool — click to select layers |
| `H` | Hand | Pan the canvas by dragging |

---

## Layers

### Layer Types

| Type | Description |
|------|-------------|
| **Image** | References an imported image asset by ID |
| **Text** | Renders editable text (font, size, color) |
| **Shape** | Vector paths with fill/stroke (rectangles, ellipses, imported SVG shapes) |
| **Symbol** | Nested timeline — an instance of a reusable symbol definition |

### Layer Properties (Properties Panel → Layer tab)

- **Name** — editable layer name
- **Visible / Locked** — toggle visibility (eye icon) and editability (lock icon)
- **Transform** — X, Y, Scale X, Scale Y, Rotation (degrees), Opacity (0–1), each with per-property keyframe support
- **Blend Mode** — compositing blend mode
- **Tint** — tint color + tint amount overlay
- **Filters** — blur, drop shadow, glow (configurable via `FilterConfig[]`)
- **Asset Swaps** — frame-by-frame asset swapping for sprite-sheet-style animation
- **Masking** — `isMask` flag and `maskLayerId` to mask one layer by another
- **Shape Keyframes** — shape morphing between keyframes for shape layers

### Layer Creation

- **Import Image** — file dialog or drag-and-drop; auto-centers and fits to canvas
- **Add Text** — default "Edit me" text, 72pt Arial, white
- **Add Rectangle** — 200×150 blue rectangle, centered
- **Add Ellipse** — 200×150 blue ellipse (Bézier-approximated), centered
- **Add Symbol Instance** — click a symbol in the Library to place it

All new layers span the full project duration with default animation tracks for all 6 properties.

---

## Timeline

### Playback Controls

- **Play / Pause** (`Space` tap) — `requestAnimationFrame`-based loop respecting FPS setting; loops at project end.
- **Go to Start** — jump to frame 0.
- **Step Frame** — `←` / `→` arrows step one frame; `Shift+←` / `Shift+→` jump to previous/next keyframe on the selected layer.
- **Timecode Display** — shows current time in seconds and current frame number.
- **Timeline Ruler** — click to seek; drag to scrub.

### Layer Rows

Each row shows: visibility toggle, lock toggle, layer name, type indicator, and the keyframe track.

- **Select** — click to select; Shift+Click for multi-select.
- **Drag Reorder** — drag a layer row to reorder z-depth (undoable).
- **Context Menu** (right-click) — Copy, Paste, Delete, Hide/Show, Lock/Unlock, Convert to Symbol, Edit Symbol, Save to Objects.

### Keyframe Track

- **Keyframe Dots** — diamond markers at each keyframe position; hover to enlarge.
- **Click Keyframe** — jump playhead to that frame.
- **Drag Keyframe** — move keyframe to a new frame with ghost preview.
- **Keyframe Context Menu** (right-click) — Delete, change easing, copy/paste keyframe.
- Multi-property keyframes at the same frame move together.

### Interpolation & Easing

| Easing | Behavior |
|--------|----------|
| `linear` | Constant rate |
| `easeIn` | Slow start, fast end |
| `easeOut` | Fast start, slow end |
| `easeInOut` | Slow start & end |
| `step` | No interpolation — holds previous value |

---

## Library Panel

- **Search** — filter by name across images, symbols, and shape objects.
- **Type Filter** — all / images / symbols.
- **Import (+)** — add image assets via file dialog.
- **Asset Cards** — thumbnail, name, and type badge (IMG / symbol frame count / OBJ). Click to add as a new layer.

---

## Symbols & Nested Editing

- **Create Symbol** — right-click layer(s) → "Convert to Symbol" wraps them into a `SymbolDef` with its own timeline.
- **Edit Symbol** — double-click or right-click → "Edit Symbol" enters the nested timeline. `editorStore.editingSymbolId` tracks nesting.
- **Exit** — click project layers or use breadcrumb navigation to return.
- **Independent Timelines** — each symbol has its own FPS, duration, and layers.
- **Reference-Based** — multiple symbol instances share the same definition; edits propagate.

---

## Shape Objects

- **Save to Objects** — right-click shape layer(s) → "Save to Objects" opens a dialog to name and save a reusable `ShapeObjectDef`.
- **Auto Symbol Wrapping** — if the selected layers have independent animation, the system creates a symbol wrapper automatically.
- **Library Integration** — saved objects appear in the Library as "OBJ" cards; click to add instances.

---

## Clipboard & Multi-Selection

- **Copy** (`Ctrl+C`) — deep-clones selected layer(s) to an in-memory clipboard.
- **Paste** (`Ctrl+V`) — creates new instances with "copy" suffix at highest z-order.
- **Paste at Position** — right-click canvas → Paste places layers at the cursor location, preserving relative animation offsets.
- **Multi-Select** — `Shift+Click` or `Ctrl+A`; batch delete, copy, paste, and context menu actions.

---

## Undo / Redo

- **Immer Patch History** — every `applyAction()` call captures forward + inverse patches via `produceWithPatches`.
- **Undo** (`Ctrl+Z`) — applies inverse patches to restore previous state.
- **Redo** (`Ctrl+Y` / `Ctrl+Shift+Z`) — re-applies forward patches.
- **Scope** — covers layer CRUD, property changes, keyframe edits, reordering, symbol conversion, and paste operations.

---

## Command Console

Open with `Ctrl+K`. Autocomplete suggestions, command history (Up/Down), Tab to complete, Escape to close.

| Command | Example | Description |
|---------|---------|-------------|
| `add image <asset>` | `add image hero` | Add image layer from library |
| `add text "<text>"` | `add text "Hello"` | Add text layer |
| `select <layer>` | `select "My Layer"` | Select layer by name |
| `move <target> x <n> y <n>` | `move selected x 100 y 200` | Set position |
| `scale <target> <value>` | `scale selected 1.5` | Uniform scale |
| `rotate <target> <deg>` | `rotate selected 45` | Set rotation |
| `opacity <target> <0-100>` | `opacity selected 80` | Set opacity % |
| `frame <n>` | `frame 30` | Jump to frame |
| `keyframe <target> <prop>` | `keyframe selected x` | Add keyframe |
| `duplicate <target>` | `duplicate selected` | Clone layer |
| `delete <target>` | `delete selected` | Remove layer |
| `hide <target>` | `hide selected` | Hide layer |
| `lock <target>` | `lock selected` | Lock layer |
| `export mp4` | `export mp4` | Start MP4 export |
| `run` | `run` | Execute batch script from file |

Targets: `selected` (default), or layer name (quoted for multi-word).

---

## Import

| Format | Method |
|--------|--------|
| **PNG / JPG / SVG** | File dialog or drag-and-drop onto canvas |
| **SWF** | File → Open SWF — decompiles via JPEXS FFDec, rebuilds timeline, extracts assets/shapes/symbols |
| **PSD** | File → Open PSD — imports Photoshop layers via `@webtoon/psd` |
| **JSON** | File → Open Project — loads saved project state |

---

## Export

- **MP4 Video** — click "Export MP4" in the top bar.
  - Off-screen `StageRenderer` captures each frame as raw RGBA.
  - Frames sent to main process via IPC.
  - FFmpeg encodes h264 / yuv420p with faststart.
  - Progress modal shows real-time percentage with progress bar.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+0` | Fit to canvas |
| `Ctrl+1` | Zoom to 100% |
| `Ctrl+A` | Select all layers |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+K` | Command console |
| `V` | Select tool |
| `H` | Hand tool |
| `Space` (tap) | Play / Pause |
| `Space` (hold+drag) | Pan canvas |
| `←` / `→` | Previous / Next frame |
| `Shift+←` / `Shift+→` | Previous / Next keyframe |
| `Delete` / `Backspace` | Delete selected layer(s) |
| `Ctrl+Wheel` | Zoom (centered on cursor) |
| Middle mouse drag | Pan |
