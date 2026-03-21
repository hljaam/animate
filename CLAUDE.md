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

This is an **Electron desktop 2D animation editor** with three processes:

### Process Boundaries

- **Main process** (`src/main/`) — Node.js, file I/O, FFmpeg export, IPC handler registration
- **Preload** (`src/preload/index.ts`) — `contextBridge` exposing `window.electronAPI` to the renderer
- **Renderer** (`src/renderer/`) — React + PixiJS + Zustand, no direct Node access

IPC is the only bridge between renderer and main. All file operations go through `window.electronAPI`. When adding new IPC methods, you must update all three layers: handler in `src/main/ipc/`, bridge in `src/preload/index.ts`, and type in `src/renderer/types/electronAPI.ts`.

Current IPC methods: `importAsset`, `importFla`, `importXfl`, `importSwf`, `saveProject`, `openProject`, `exportStart`, `exportFrame`, `exportFinalize`, `onExportProgress`.

### State Management

Two Zustand stores:

- **`projectStore`** — project data (layers, assets, keyframes, tracks). Mutations go through Command classes for undo/redo. Direct mutators (`*Direct` methods like `addLayerDirect`, `removeLayerDirect`, `setKeyframeDirect`) are only called by Command classes — never from UI components.
- **`editorStore`** — ephemeral UI state (selectedLayerId, currentFrame, isPlaying, zoom, panX/Y, exportProgress)

**Critical convention:** All user-facing mutations to project data must go through a Command (`src/renderer/store/commands/`). Commands implement `ICommand` with `execute()`, `undo()`, and `description`. `CommandHistory` (inside projectStore) manages the undo/redo stack. Existing commands: AddLayer, RemoveLayer, UpdateLayer, AddKeyframe, UpdateKeyframe, DuplicateLayer.

### Rendering

`StageRenderer` (`src/renderer/pixi/StageRenderer.ts`) owns the PixiJS `Application` instance. It manages a `worldContainer` holding all sprites/text/shapes plus a `selectionOverlay` on top. It caches textures, text objects, and shape graphics to avoid recreation each frame. The `usePixiStage` hook manages the PixiJS lifecycle and subscribes to store changes.

Keyframe interpolation lives in `src/renderer/pixi/interpolation.ts` — supports linear, easeIn, easeOut, easeInOut, and step easing. Step easing holds the previous value (no lerp).

### Data Model

```
Project → layers: Layer[] → tracks: PropertyTrack[] → keyframes: Keyframe[]
Project → assets: Asset[]
```

Three layer types: `image` (references asset by `assetId`), `text` (has `textData`), `shape` (has `shapeData` with fill paths).

Properties animated per layer: `x`, `y`, `scaleX`, `scaleY`, `rotation`, `opacity`. Each property has its own `PropertyTrack` with sorted keyframes.

Asset images are stored as local file paths in `~/.userData/projects/{projectId}/.project_assets/`; layers reference them by `assetId`.

### .fla Import Pipeline

`src/main/ipc/flaHandlers.ts` (~660 lines) handles Adobe Animate .fla import:
1. .fla files are ZIP archives — extracted with `adm-zip`
2. Parses `DOMDocument.xml` for canvas settings and media references
3. Extracts bitmaps from `bin/` (zlib-compressed ARGB → converted to PNG via `pngjs`) or `LIBRARY/`
4. Parses timeline layers, resolves `DOMSymbolInstance` references recursively to find bitmaps
5. Decomposes Flash matrix (a,b,c,d,tx,ty) into scaleX, scaleY, rotation for keyframes
6. `flashShapeRasterizer.ts` handles vector shape parsing (moveTo/lineTo/quadratic Bezier from Flash edge format)

### Export Pipeline

Renderer captures frames as raw RGBA binary → sends to main via IPC (`exportFrame`) → main writes temp files as `frame_{000000}.raw` → FFmpeg encodes to MP4 (h264, yuv420p, faststart) via `fluent-ffmpeg` + `ffmpeg-static`. A separate `StageRenderer` instance is created off-screen for export to avoid disturbing the UI.

### UI Layout

```
TopBar (file ops, zoom, undo/redo, export)
├── AssetsPanel │ StageContainer │ PropertiesPanel
Timeline (playback controls, layer rows, keyframe tracks)
```

`StageContainer` handles pan (Space+drag or middle-mouse) and zoom (Ctrl+wheel, centered on cursor). Zoom value of 0 means fit-to-canvas.

### CSP

`src/renderer/index.html` has a Content-Security-Policy meta tag. Notable: `worker-src blob:` (PixiJS texture workers), `img-src file:` (local assets), `connect-src data: blob:` (PixiJS fetches). Changes to resource loading may require CSP updates.

## Key Config Files

- `electron.vite.config.ts` — Vite config with three build targets (main, preload, renderer)
- `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` — separate TS configs for each process
- `package.json` `build` section — electron-builder packaging config (NSIS for Windows, DMG for Mac, AppImage for Linux)
- FFmpeg binary is bundled via `extraResources` in the electron-builder config
