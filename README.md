# arras.io Paste Templates

Userscript for [arras.io](https://arras.io) (and mirrors) that replays
predefined key/mouse sequences ("schematics") in the sandbox.

## Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/)
   (Chrome/Edge/Firefox/Safari).
2. Open the Tampermonkey dashboard → **+** (new script).
3. Paste the contents of `script.js` into the editor.
4. Save (Ctrl+S). Reload arras.io.

The script auto-runs on `arras.io`, `arrax.io`, `arras.netlify.app`,
`arras.pages.dev`, and `arras-wwii.pages.dev`.

## UI

After the page loads, a small **☰** button appears in the top-right corner.
Click it to open the menu:

- **Load schematic** — pick a `.json` file (see format below).
- **Paste schematic** — replay the loaded schematic.
- **Wall size** — pixel size of one wall cell (default `64`, used for
  `unit: "wall"` coordinates).
- **Paste delay (ms)** — pause between commands (default `10`; raise it if
  the game drops commands).

The status line under the buttons shows the last action's result
(`Loading…`, `Schematic loaded`, `Pasting…`, `Pasted`, `Paste cancelled`, etc.).

**While pasting, tanks controls are blocked(moving and sandbox actions)**

## Hotkeys

| Hotkey    | Action                                   |
|-----------|------------------------------------------|
| `Alt + L` | Open the "load schematic" file dialog    |
| `Alt + V` | Start pasting / press again to cancel    |

Hotkeys are ignored while focus is inside a text/number input.

## Schematic format

A schematic is a JSON **array of command objects**. Commands are executed
sequentially, one every `paste_delay_ms` milliseconds.

### Commands
| Command           | Description |
|-------------------| ---------------------- |
| `move_mouse`      | moves "mouse". `x`, `y` is position relative to player. `unit` is unit of measurement, can be `grid` or `wall` |
| `press`/`release` | presses and releases sandbox keys. `keyCode` - key to press. "\`" is `Self`, keys a...z are `KeyA`...`KeyZ`, digits 0...9 are `Digit0`...`Digit9`. Backticks are required(just like you would press normally) |
