# Command Console

Open with **Ctrl+K** (Windows) or **Cmd+K** (Mac). Press **Escape** to dismiss.

---

## Tips

- **Tab** — autocomplete the selected suggestion
- **Up/Down arrows** — navigate suggestions or command history
- **Enter** — execute the command
- All commands that modify layers are **undoable** with Ctrl+Z

---

## Commands

### Add a layer

| Command | Example |
|---------|---------|
| `add image <assetName>` | `add image logo.png` |
| `add text "<content>"` | `add text "Hello World"` |

> Image assets must be imported first via the **Assets panel** (left sidebar).

---

### Select a layer

```
select <layerName>
```

Example: `select Background`

---

### Transform a layer

All transform commands apply a keyframe at the **current frame**.
`<target>` can be a layer name or `selected` (uses the currently selected layer).

| Command | Description | Example |
|---------|-------------|---------|
| `move <target> x <n> y <n>` | Set position | `move selected x 200 y 300` |
| `scale <target> <value>` | Set scale (1 = 100%) | `scale selected 0.5` |
| `rotate <target> <degrees>` | Set rotation in degrees | `rotate Logo 45` |
| `opacity <target> <0-100>` | Set opacity (0–100) | `opacity selected 50` |

---

### Keyframes

```
keyframe <target> <property>
```

Adds a keyframe for the given property at the current frame, locking in the current interpolated value.

Valid properties: `x` `y` `scaleX` `scaleY` `rotation` `opacity`

Example: `keyframe selected opacity`

---

### Duplicate a layer

```
duplicate <target>
```

Creates a copy named `"<original> copy"` directly above the source layer.

Example: `duplicate Background`

---

### Delete a layer

```
delete <target>
```

Example: `delete Text Layer`

---

### Toggle visibility

```
hide <target>
```

Toggles the layer's visibility on/off.

Example: `hide Logo`

---

### Toggle lock

```
lock <target>
```

Toggles the layer's locked state on/off.

Example: `lock Background`

---

### Jump to frame

```
frame <n>
```

Moves the playhead to frame `n` (not undoable — navigation only).

Example: `frame 30`

---

### Export MP4

```
export mp4
```

Starts the MP4 export using the current project settings. Same as clicking **Export MP4** in the top bar.
