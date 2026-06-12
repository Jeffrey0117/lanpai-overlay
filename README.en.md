<p align="center">
  <img src="assets/icon.png" alt="Lanpai Overlay" width="64" />
</p>
<h1 align="center">Lanpai Overlay</h1>
<p align="center">
  <strong>Pin text and images straight onto your screen. No window. No background. No fuss.</strong>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://img.shields.io/badge/electron-36-blue" alt="Electron 36" />
  <img src="https://img.shields.io/badge/framework-none-orange" alt="Zero Framework" />
</p>
<p align="center">
  <a href="README.md">繁體中文</a> | English
</p>

---

## Picture This

You're recording a short video. You keep forgetting your lines, and every teleprompter app is a giant window in the way.

You hit `Ctrl+Shift+Space`, type two lines, press Enter. Your script floats next to the camera — no background, just the words.
Drag it where you want, scale it up, give it a dark backdrop. Done recording? Press Del. Gone like it was never there.

Need your storyboard mid-shoot? `Win+Shift+S` to snip, `Ctrl+Shift+V` to pin. It's on screen.

At no point did a "window" appear.

---

## Why Not Snipaste / OBS?

| | Snipaste pin | OBS text source | Lanpai Overlay |
|---|---|---|---|
| Pin images on screen | ✅ | ❌ canvas only | ✅ |
| Type text onto screen | ❌ | ✅ but launch OBS first | ✅ **one hotkey** |
| Truly frameless & transparent | ⚠️ has border | — | ✅ |
| Click-through empty space | — | — | ✅ **never blocks you** |
| Text styles + templates | ❌ | ⚠️ buried in settings | ✅ **floating panel** |
| Setup weight | light | heavy | `npm start` |

---

## What It Does

### One key for everything
`Ctrl+Shift+Space` opens a smart input — type text, or paste an `https://` image URL and it becomes an image. No mode switch.

### Clipboard straight to screen
`Ctrl+Shift+V` pins whatever image is in your clipboard. Pairs with `Win+Shift+S` for a two-second see-it-pin-it flow. Image URL in clipboard? Also works.

### Hands-on elements, invisible everywhere else
Over an element: drag to move, pull the corner handle to scale, double-click to edit, right-click to duplicate, Del or the trash icon to remove.
Over empty space: the layer is fully click-through. Your clicks land on whatever is underneath.

### Style panel with shadows that never clash
Click any text: 7 color swatches, 3 weights, 4 shadow styles, and a backdrop that cycles through the same 7 colors (none → white → black → yellow…), padded wider than the text.
Shadow color auto-contrasts — dark text gets a white shadow, light text gets a black one. Zero settings.
Save styles as templates (T1, T2…) that survive restarts. Content survives restarts too — everything on the wall is back when you reopen, and `Ctrl+Shift+X` wipes the slate. No scene files to manage.

### Swap images in place
An image's panel is a URL field: paste, Enter, swapped — position and size preserved. Bad URL? It rolls back.

### Boards: group notes together
Type `#Today` in the input box to spawn a titled board. Drag loose notes onto it and they snap into a vertical list; drag them out to set them free again. Drag the title bar to move the whole group, double-click it to rename, recolor it from its panel, and `Del` removes the board with everything in it. Scroll over one item to resize just that line, or over the title bar to scale the whole board. Click the ▾ on the title bar to collapse the board down to a single line.

---

## Quick Start

**Fastest: just run it** — grab the installer or portable build from [Releases](https://github.com/Jeffrey0117/lanpai-overlay/releases/latest) (Windows x64, no Node.js needed).

Or from source:

```bash
git clone https://github.com/Jeffrey0117/lanpai-overlay.git
cd lanpai-overlay
npm install
npm start
```

Nothing appears on launch — that's by design. The blue dot in your system tray is the app.

### Hotkeys

| Key | Action |
|---|---|
| `Ctrl+Shift+Space` | Smart input (text / image URL) |
| `Ctrl+Shift+V` | Pin clipboard image |
| `Ctrl+Shift+X` | Clear everything |
| `Ctrl+Shift+↑` | Toggle topmost (pin to front ↔ let it be covered) |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo content changes (last 30 versions kept; older ones via tray → 還原較早版本) |
| `Del` | Delete selected element |
| `Esc` | Close input |

### Element actions

| Action | Effect |
|---|---|
| Drag element | Move |
| Pull corner handle | Scale (font size for text, proportional for images) |
| Hover + scroll wheel | Scale (the lazy way) |
| Click | Open style panel |
| Double-click text | Edit in place |
| `Alt`+drag | Drag out a duplicate (works on whole boards too) |
| Right-click element | Delete (`Ctrl+Z` if you slip) |
| Trash icon / `Del` | Delete |
| Right-click template chip | Delete that template |

---

## Architecture

Zero frameworks, zero build step, five files:

```
lanpai-overlay/
├── main.js       # transparent window, tray, global hotkeys, clipboard, dialogs
├── preload.js    # IPC bridge (8 lines)
├── overlay.html  # overlay shell + styles
├── overlay.js    # elements / drag / resize / mouse pass-through
└── toolbar.js    # style panel, templates (localStorage)
```

Core trick: `setIgnoreMouseEvents(true, { forward: true })` + `mousemove` tracking — interactive over elements, fully click-through everywhere else.

---

## Lineage

Successor to [lanpai-blueplan](https://github.com/Jeffrey0117/lanpai-blueplan) (Tauri + React), rebuilt from scratch: less code, no compile step, starts instantly.

---

## Roadmap

- [x] Transparent overlay + tray
- [x] Global hotkeys + clipboard pin
- [x] Style panel + templates
- [x] Color backdrops
- [x] Portable + installer packaging (electron-builder)
- [x] Crash / accidental-close recovery
- [ ] Multi-monitor support
- [ ] Custom hotkeys

---

## License

MIT
