// ==UserScript==
// @name         Paste templates in arras.io
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Copies player name when double-clicking the profile button
// @author       slutcatf
// @match        https://arras.io/
// @match        https://arrax.io/
// @match        https://arras.netlify.app/
// @match        https://arras.pages.dev/
// @match        https://arras-wwii.pages.dev/
// @require      https://update.greasyfork.org/scripts/599561/Arras%20Packet%20Hook.user.js
// @icon         https://arras.io/favicon/64x64.png
// @grant        none
// ==/UserScript==


// UI shit
let ui = null; // populated by menu() after buildUI()
let paste_token = null;

const app_state = {
    schematic: null,                      // parsed object or null
    schematic_name: null,     // user-visible name (file name or data.name)
    status: { level: 'idle', text: '' },  // last user-facing status
    settings: {
        wall_size: 64,
        paste_delay_ms: 10, // so the game doesnt fucking crash
    },
};


// level: 'idle' | 'loading' | 'info' | 'success' | 'warning' | 'error'
// cause: optional technical error (logged with stack)
function set_status(level, text, cause) {
    // --- console ---
    if (level === 'error')        console.error(text);
    else if (level === 'warning') console.warn(text);
    else if (level === 'info' || level === 'loading') console.info(text);
    else if (level !== 'idle')    console.log(text);

    if (cause) console.error(cause);

    // --- state ---
    app_state.status = { level, text };

    // --- UI ---
    update_ui()
}

function render_status() {
    const el = document.getElementById('om-status');
    if (!el) return; // menu not built yet

    const { level, text } = app_state.status;
    el.textContent = text;
    el.className =
        level === 'error'   ? 'om-error' :
        level === 'warning' ? 'om-warn'  :
        level === 'success' ? 'om-ok'    :
        '';
}

function render_paste_button() {
    if (!ui || !ui.pasteBtn) return;
    ui.pasteBtn.disabled = !app_state.schematic || paste_token !== null;
}

function render_wall_size_input() {
    if (!ui || !ui.wallSizeInput) return;
    if (document.activeElement === ui.wallSizeInput) return; // don't fight the user
    ui.wallSizeInput.value = String(app_state.settings.wall_size);
}

function render_schematic_info() {
    if (!ui || !ui.schematicInfo) return;

    if (app_state.schematic) {
        const name = app_state.schematic_name || 'unnamed';
        ui.schematicInfo.textContent = `${TEXT.schematicLoadedPrefix} ${name}`;
        ui.schematicInfo.classList.remove('om-empty');
    } else {
        ui.schematicInfo.textContent = TEXT.noSchematic;
        ui.schematicInfo.classList.add('om-empty');
    }
}

function render_paste_delay_input() {
    if (!ui || !ui.pasteDelayInput) return;
    if (document.activeElement === ui.pasteDelayInput) return;
    ui.pasteDelayInput.value = String(app_state.settings.paste_delay_ms);
}

function update_ui() {
    render_status();
    render_paste_button();
    render_wall_size_input();
    render_schematic_info()
    render_paste_delay_input()
    // сюда добавляешь новые render_* по мере роста меню
}

const TEXT = {
    toggleOpen: '☰',
    toggleClose: '✕',
    menuTitle: 'Menu',
    loadSchematic: 'Load schematic',
    loadSchematicError: 'Invalid JSON file',
    loadSchematicOk: 'Schematic loaded',
    loadSchematicLoading: 'Loading…',
    errorNoSchematic: 'Schematic not loaded',
    pasteOk: 'Pasted',
    pasting: 'Pasting…',
    pasteFailed: 'Paste failed',
    pasteCancelled: 'Paste cancelled',
    pasteSchematic: 'Paste schematic',
    pasteDelay: 'Paste delay (ms)',
    wallSize: 'Wall size',
    noSchematic: 'No schematic loaded',
    schematicLoadedPrefix: 'Loaded:',
};

function make_number_field({ id, label, min, step, get, set }) {
    const row = document.createElement('div');
    row.className = 'om-field';

    const lbl = document.createElement('label');
    lbl.className = 'om-label';
    lbl.textContent = label;
    lbl.htmlFor = id;

    const input = document.createElement('input');
    input.id = id;
    input.className = 'om-input';
    input.type = 'number';
    input.min = String(min);
    input.step = String(step);

    input.addEventListener('input', () => {
        const v = Number(input.value);
        if (!Number.isInteger(v) || v < min) return;
        set(v);
    });
    input.addEventListener('blur', () => {
        if (document.activeElement === input) return;
        input.value = String(get());
    });

    row.appendChild(lbl);
    row.appendChild(input);
    return { row, input, refresh: () => {
        if (document.activeElement === input) return;
        input.value = String(get());
    }};
}

function menu() {
    'use strict';

    // ===== Config =====
    const CONFIG = {
        position: 'top-right', // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
        menuWidth: '260px',
        menuMaxHeight: '70vh',
        zIndex: 2147483647,
    };

    // ===== Styles =====
    const CSS = `
        #om-root {
            position: fixed;
            z-index: ${CONFIG.zIndex};
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            font-size: 13px;
            color: #eaeaea;
        }
        #om-root.om-tr { top: 12px; right: 12px; align-items: flex-end; }
        #om-root.om-tl { top: 12px; left: 12px;  align-items: flex-start; }
        #om-root.om-br { bottom: 12px; right: 12px; align-items: flex-end; }
        #om-root.om-bl { bottom: 12px; left: 12px;  align-items: flex-start; }

        #om-toggle {
            width: 40px; height: 40px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.15);
            background: rgba(30,30,30,0.9);
            color: #fff;
            font-size: 18px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            display: flex; align-items: center; justify-content: center;
            user-select: none;
            backdrop-filter: blur(6px);
        }
        #om-toggle:hover { background: rgba(50,50,50,0.95); }

        #om-panel {
            width: ${CONFIG.menuWidth};
            max-height: ${CONFIG.menuMaxHeight};
            overflow: auto;
            background: rgba(20,20,20,0.95);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.45);
            backdrop-filter: blur(8px);
            display: flex;
            flex-direction: column;
        }
        #om-panel.om-hidden { display: none; }

        #om-header {
            padding: 10px 12px;
            font-weight: 600;
            font-size: 13px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            letter-spacing: 0.3px;
            text-transform: uppercase;
            opacity: 0.85;
        }

        #om-body {
            padding: 12px;
            /* empty for now — content will be inserted here */
        }
        .om-button {
            width: 100%;
            padding: 8px 10px;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.15);
            background: rgba(50,50,50,0.9);
            color: #eaeaea;
            font: inherit;
            cursor: pointer;
            text-align: left;
        }
        .om-button:hover { background: rgba(70,70,70,0.95); }
        .om-button:disabled { opacity: 0.4; cursor: not-allowed; }

        #om-status {
            margin-top: 8px;
            font-size: 12px;
            opacity: 0.8;
            min-height: 1em;
            word-break: break-word;
        }
        #om-status.om-error { color: #ff7a7a; }
        #om-status.om-warn { color: #ffcf7a; }
        #om-status.om-ok    { color: #7aff9a; }

        .om-field {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 8px;
        }
        .om-label { opacity: 0.85; }
        .om-input {
            width: 80px;
            padding: 4px 6px;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.15);
            background: rgba(50,50,50,0.9);
            color: #eaeaea;
            font: inherit;
        }
        .om-input:focus { outline: 1px solid rgba(120,180,255,0.6); }

        #om-schematic-info {
            margin-bottom: 8px;
            padding: 6px 8px;
            border-radius: 6px;
            background: rgba(255,255,255,0.04);
            font-size: 12px;
            word-break: break-word;
            min-height: 1em;
        }
        #om-schematic-info.om-empty { opacity: 0.5; font-style: italic; }
    `;

    // ===== DOM building =====
    function buildUI() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const root = document.createElement('div');
        root.id = 'om-root';
        root.className = 'om-' + CONFIG.position
            .split('-')
            .map(s => s[0])
            .join('');

        const toggle = document.createElement('button');
        toggle.id = 'om-toggle';
        toggle.textContent = TEXT.toggleOpen;
        toggle.title = TEXT.menuTitle;

        const panel = document.createElement('div');
        panel.id = 'om-panel';

        const header = document.createElement('div');
        header.id = 'om-header';
        header.textContent = TEXT.menuTitle;

        const body = document.createElement('div');
        body.id = 'om-body';

        // ---- Load schematic button + hidden file input ----
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'om-button';
        loadBtn.textContent = TEXT.loadSchematic;
        loadBtn.title = format_hotkey(HOTKEYS.loadSchematic); // 'Alt+L'
        loadBtn.addEventListener('click', () => fileInput.click());

        const pasteBtn = document.createElement('button');
        pasteBtn.className = 'om-button';
        pasteBtn.textContent = TEXT.pasteSchematic;
        pasteBtn.title = format_hotkey(HOTKEYS.paste);      // "Alt+V"
        pasteBtn.addEventListener('click', () => paste());

        const status = document.createElement('div');
        status.id = 'om-status';

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;

            set_status('loading', TEXT.loadSchematicLoading);

            const reader = new FileReader();

            reader.onload = () => {
                let data;
                try {
                    data = JSON.parse(reader.result);
                } catch (err) {
                    set_status('error', TEXT.loadSchematicError, err);
                    return;
                }

                try {
                    on_schematic_loaded(data);
                    app_state.schematic = data;
                    app_state.schematic_name = (data && typeof data.name === 'string' && data.name) || file.name || null;
                    set_status('success', TEXT.loadSchematicOk);
                } catch (err) {
                    // ...
                }
            };

            reader.onerror = () => {
                set_status('error', 'Read error', reader.error);
            };

            reader.readAsText(file);
            fileInput.value = '';
        });

        const schematicInfo = document.createElement('div');
        schematicInfo.id = 'om-schematic-info';

        body.appendChild(schematicInfo)
        body.appendChild(loadBtn);
        body.appendChild(pasteBtn);
        body.appendChild(fileInput);
        body.appendChild(status);

        const wallSize = make_number_field({
            id: 'om-wall-size', label: TEXT.wallSize, min: 1, step: 1,
            get: () => app_state.settings.wall_size,
            set: v => { app_state.settings.wall_size = v; },
        });

        const pasteDelay = make_number_field({
            id: 'om-paste-delay', label: TEXT.pasteDelay, min: 0, step: 10,
            get: () => app_state.settings.paste_delay_ms,
            set: v => { app_state.settings.paste_delay_ms = v; },
        });

        body.appendChild(wallSize.row);
        body.appendChild(pasteDelay.row);

        panel.appendChild(header);
        panel.appendChild(body);

        root.appendChild(toggle);
        root.appendChild(panel);
        document.body.appendChild(root);

        // Toggle handler
        toggle.addEventListener('click', () => {
            const hidden = panel.classList.toggle('om-hidden');
            toggle.textContent = hidden ? TEXT.toggleOpen : TEXT.toggleClose;
        });

        return { root, toggle, panel, body, loadBtn, pasteBtn,
           wallSizeInput: wallSize.input,
           pasteDelayInput: pasteDelay.input,
           schematicInfo, fileInput, status };
    }
    ui = buildUI();
    update_ui();   // отрисовать стартовое состояние (кнопка disabled)
}



// Hotkey shit
const HOTKEYS = {
    paste:         { mods: ['alt'], code: 'KeyV', action: () => paste() },
    loadSchematic: { mods: ['alt'], code: 'KeyL', action: () => load_schematic_dialog() },
};

const MOD_LABELS = { alt: 'Alt', ctrl: 'Ctrl', shift: 'Shift', meta: 'Meta' };

function matches_hotkey(hk, e) {
    const need = { alt: false, ctrl: false, shift: false, meta: false };
    for (const m of hk.mods) need[m] = true;
    return (
        e.altKey   === need.alt   &&
        e.ctrlKey  === need.ctrl  &&
        e.shiftKey === need.shift &&
        e.metaKey  === need.meta  &&
        e.code     === hk.code
    );
}

function format_hotkey(hk) {
    const parts = hk.mods.map(m => MOD_LABELS[m] || m);
    const key = hk.code
        .replace(/^Key/, '')    // KeyV -> V
        .replace(/^Digit/, ''); // Digit1 -> 1
    parts.push(key);
    return parts.join('+');
}

function hotkeys_listener() {
    document.addEventListener('keydown', function (event) {
        const t = event.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

        for (const hk of Object.values(HOTKEYS)) {
            if (matches_hotkey(hk, event)) {
                event.preventDefault();
                hk.action();
                return;
            }
        }
    });
}

function shut_up_arras_warnings(){
  const act_logger = console.log
  const filter_strings = [
    "%cStop!",
    "%cHackers have been known to trick people into running malicious scripts here, which would give them full access to your account. Do not paste anything here, or you may lose access to your account."
  ]
  console.log = function log() {
    if (!filter_strings.includes(arguments[0])) {
      act_logger(...arguments)
    }
  }
}

const game = {
  entities: [],
  players: [],
  minimap: [],
  teamMinimap: [],
  leaderboard: [],
  mockups: {},
  player: {},
  body: {
    x: 0,
    y: 0,
    fov: 0,
  },
  target: {
    x: 0,
    y: 0
  },
  mspt: 0,
  speed: 0,
  mockupIndex: 0,
  color: 0,
  id: 0,
  score: 0,
  kills: {
    player: 0,
    assist: 0,
    boss: 0,
    food: 0
  },
  skillPoints: 0,
  maxSkills: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  skills: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  upgrades: [],
  notifications: [],
  messages: [],
};

function debug_listeners() {
  // client
  arras.client.on("k", p => {console.debug("client: key verification", p)});
  arras.client.on("T", p => {console.debug("client: Tracking", p); p.adblock = false; return p})
  //arras.client.on("p", p => {console.debug("client: ping", p)})
  arras.client.on("s", p => {console.debug("client: spawn", p)})
  arras.client.on("e", p => {console.debug("client: eval", p)})
  arras.client.on("R", p => {console.debug("client: proof of work", p)})
  arras.client.on("G", p => {console.debug("client: turnstile token", p)})
  arras.client.on("U", p => {console.debug("client: tank upgrade request", p)})
  arras.client.on("x", p => {console.debug("client: skill upgrade request", p)})
  //arras.client.on("C", p => {console.debug("client: tank command", p)})
  arras.client.on("t", p => {console.debug("client: toggle tank actions", p)})
  arras.client.on("L", p => {console.debug("client: level up", p)})
  arras.client.on("0", p => {console.debug("client: sandbox key press", p)})
  arras.client.on("M", p => {console.debug("client: chat message", p)})
  arras.client.on("P", p => {console.debug("client: sandbox player action", p)})
  arras.client.on("K", p => {console.debug("client: suicide", p)})
  arras.client.on("A", p => {console.debug("client: ability", p)})
  arras.client.on("D", p => {console.debug("client: pause score", p)})

  // server
  arras.server.on("R", p => {console.debug("server: room", p)})
  //arras.server.on("u", p => {console.debug("server: update", p)})
  arras.server.on("w", p => {console.debug("server: welcome", p)})
  arras.server.on("m", p => {console.debug("server: up message", p)})
  arras.server.on("J", p => {console.debug("server: mockups", p)})
  arras.server.on("C", p => {console.debug("server: proof of work", p)})
  arras.server.on("e", p => {console.debug("server: eval", p)})
  arras.server.on("G", p => {console.debug("server: turnstile request", p)})
  //arras.server.on("p", p => {console.debug("server: ping", p)})
  //arras.server.on("b", p => {console.debug("server: broadcast", p)})
  arras.server.on("c", p => {console.debug("server: camera", p)})
  arras.server.on("M", p => {console.debug("server: chat message", p)})
  arras.server.on("K", p => {console.debug("server: kick", p)})
  arras.server.on("F", p => {console.debug("server: death", p)})
  arras.server.on("r", p => {console.debug("server: travel", p)})
  arras.server.on("k", p => {console.debug("server: give token", p)})
}

function game_update_listeners() {
  arras.client.on("c", ({ bodyX, bodyY, bodyFov }) => {
    game.body.x = bodyX;
    game.body.y = bodyY;
    game.body.fov = bodyFov;
  });

  arras.server.on("u", p => {
    if (p.mspt) game.mspt = p.mspt;
    if (p.speed) game.speed = p.speed;
    if (p.mockupIndex) game.mockupIndex = p.mockupIndex;
    if (p.color) game.color = p.color;
    if (p.id) game.id = p.id;
    if (p.score) game.score = p.score;
    if (p.kills) game.kills = p.kills;
    if (p.skillPoints) game.skillPoints = p.skillPoints;
    if (p.maxSkills) game.maxSkills = p.maxSkills;
    if (p.skills) game.skills = p.skills;
    if (p.upgrades) game.upgrades = p.upgrades;

    for (const entity of p.dead) {
      const index = game.entities.findIndex(e => e.id == entity.id);
      if (index >= 0) game.entities.splice(index, 1);
    }

    for (const entity of p.removed) {
      const index = game.entities.findIndex(e => e.id == entity.id);
      if (index >= 0) game.entities.splice(index, 1);
    }

    for (const entity of p.changed) {
      const index = game.entities.findIndex(e => e.id == entity.id);
      if (index >= 0) {
        if (entity.deltaX) game.entities[index].x += entity.deltaX
        if (entity.deltaY) game.entities[index].y += entity.deltaY
        if (entity.deltaFacing) game.entities[index].facing += entity.deltaFacing;
      } else {
        entity.x = entity.deltaX;
        entity.y = entity.deltaY;
        entity.facing = entity.deltaFacing;
        game.entities.push(entity)
      }
      delete entity.deltaX
      delete entity.deltaY
      delete entity.deltaFacing
      if (game.entities[index] != undefined) {
        if (entity.id === game.id) {
          game.body = game.entities[index]
        }
      }
      if (typeof game.body != undefined) {
        game.body.x = p.bodyX;
        game.body.y = p.bodyY;
        game.body.fov = p.bodyFov;
      }
    }
  })

  arras.client.on("C", p => {
    game.target.x = p.x
    game.target.y = p.y
  })
}

function arras_do(cmd) {
  let action = cmd["action"]
  if (log_cmd) {
    console.debug(cmd)
  }
  if (["press", "release"].includes(action)) {
    if (!("keyCode" in cmd)) {
      console.error("No keyCode")
      return
    }
    let keyCode = cmd["keyCode"]
    let isKeyDown = (action == "press") ? 1 : 0
    arras.client.send("0", {keyCode: keyCode, isKeyDown: isKeyDown})
  } else if (action == "move_mouse") {
    if (!("x" in cmd) || !("y" in cmd)) {
      console.error("No x or y")
      return
    }
    if (!("unit" in cmd)) {
      console.error("No unit")
      return
    }
    let unit = cmd["unit"]
    if (!["grid", "wall"].includes(unit)) {
      console.error("Unknown unit")
    }
    let x = cmd["x"]
    let y = cmd["y"]
    if (unit == "wall") {
      [x, y] = wall_to_grid_unit(x, y)
    }
    arras.client.send("C", {x: x, y: y})
  } else {
    console.error("Unknown action")
  }
}

function on_schematic_loaded(schematic) {
  console.log('Schematic loaded:', schematic);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function paste_template(template, delay_ms = 0, token = null) {
    for (let i = 0; i < template.length; i++) {
        if (token && token.cancelled) return false;   // ← проверка отмены
        arras_do(template[i]);
        if (delay_ms > 0 && i < template.length - 1) {
            await sleep(delay_ms);
        }
    }
    return true;   // выполнили всё до конца
}

async function paste() {
    // ---- Toggle: второе нажатие = отмена ----
    if (paste_token) {
        paste_token.cancelled = true;
        paste_token = null;
        set_status('warning', TEXT.pasteCancelled);
        update_ui();
        return;
    }

    // ---- Первое нажатие: запуск ----
    if (!app_state.schematic) {
        set_status('error', TEXT.errorNoSchematic);
        return;
    }

    const token = { cancelled: false };
    paste_token = token;

    // Снимок state на старте — если пользователь поменяет delay
    // или загрузит новую схематику во время пасты, текущая доиграет
    // со старыми значениями.
    const template = app_state.schematic;
    const delay_ms = app_state.settings.paste_delay_ms;

    set_status('info', TEXT.pasting);
    update_ui();

    try {
        const finished = await paste_template(template, delay_ms, token);
        // Ставим success, ТОЛЬКО если доиграли до конца и наш токен
        // всё ещё «актуальный» (не отменён и не вытеснен новым запуском).
        if (finished && paste_token === token) {
            set_status('success', TEXT.pasteOk);
        }
    } catch (err) {
        if (paste_token === token) {
            set_status('error', TEXT.pasteFailed, err);
        }
    } finally {
        // Сбрасываем ссылку только если она всё ещё наша.
        // Если пользователь отменил (paste_token = null) или запустил
        // новую пасту (paste_token = другой_токен) — не трогаем.
        if (paste_token === token) paste_token = null;
        update_ui();
    }
}

function is_pasting() {
    return paste_token !== null;
}

function load_schematic_dialog() {
    if (!ui || !ui.fileInput) {
        console.error('UI is not ready yet');
        return;
    }
    ui.fileInput.click();
}

function wall_to_grid_unit(x, y) {
    const s = app_state.settings.wall_size;
    return [x * s, y * s];
}

// Calling shit
function on_connect() {
  console.log("CONNECTED")
  game_update_listeners()
  block_controls_when_pasting()
  // Has to be done even later for some reason
  shut_up_arras_warnings()
}

function on_load() {
  console.log("LOADED")
  menu()
  hotkeys_listener()
}

function block_controls_when_pasting() {
  arras.client.on("C", () => {
    if (is_pasting()) {
      return false
    }
  });
  arras.client.on("0", () => {
    if (is_pasting()) {
      return false
    }
  });
}

const log_cmd = false

// Start shit
debug_listeners(100)
if (!document.body) {
  window.addEventListener('DOMContentLoaded', on_load);
} else {
  on_load();
}
arras.client.on("e", on_connect)
