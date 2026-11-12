// The game loop, input and debug hooks every gesso prototype starts from. See CLAUDE.md.

/** Frames the game is updated at, per second, whatever the screen's refresh rate. */
const updatesPerSecond = 60;

/** The longest real time one animation frame catches up on, so a stalled tab doesn't spiral. */
const maxCatchUpSeconds = 0.25;

/** Who holds an action down when `window.gesso.press` does (not a key). */
const byHook = "gesso";

/**
 * @typedef {{ id: string, label: string, keys: string[] }} Action
 *   A thing the player does, the label gesso shows for it, and the keys (`KeyboardEvent.code`)
 *   that do it.
 * @typedef {{ format: 1, actions: Action[] }} Controls The contents of `controls.json`.
 * @typedef {{
 *   isDown: (action: string) => boolean,
 *   wasPressed: (action: string) => boolean,
 * }} Input
 *   What `update` reads: whether an action is held, and whether it started this frame.
 * @template State
 * @typedef {{
 *   init: (random: () => number) => State,
 *   update: (state: State, input: Input, dt: number, random: () => number) => void,
 *   render?: (state: State) => void,
 * }} GameDefinition
 *   A game: its first state, how one fixed step changes it, and how it is drawn.
 */

/**
 * Random numbers in [0, 1) from `seed`: the same seed gives the same numbers (mulberry32).
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `value` as the contents of `controls.json`; throws, saying what is wrong, for anything else.
 * @param {unknown} value
 * @returns {Controls}
 */
export function parseControls(value) {
  if (typeof value !== "object" || value === null) throw problem("not an object");
  const { format, actions } = /** @type {{ format?: unknown, actions?: unknown }} */ (value);
  if (format !== 1) throw problem(`format ${String(format)} is not 1`);
  if (!Array.isArray(actions)) throw problem("actions is not a list");
  /** @type {Set<string>} */
  const ids = new Set();
  /** @type {Set<string>} */
  const keys = new Set();
  /** @type {Action[]} */
  const checked = [];
  for (const action of actions) {
    const { id, label, keys: actionKeys } = action ?? {};
    if (typeof id !== "string" || typeof label !== "string" || !Array.isArray(actionKeys)) {
      throw problem(`each action needs an id, a label and keys: ${JSON.stringify(action)}`);
    }
    if (ids.has(id)) throw problem(`action ${id} is listed twice`);
    ids.add(id);
    /** @type {string[]} */
    const checkedKeys = [];
    for (const key of actionKeys) {
      if (typeof key !== "string") throw problem(`a key of ${id} is not a string`);
      if (keys.has(key)) throw problem(`key ${key} is given to two actions`);
      keys.add(key);
      checkedKeys.push(key);
    }
    checked.push({ id, label, keys: checkedKeys });
  }
  return { format: 1, actions: checked };
}

/**
 * @param {string} message
 * @returns {Error}
 */
function problem(message) {
  return new Error(`controls.json: ${message}`);
}

/**
 * A game that runs one fixed step at a time, with nothing of the browser: what `startGame` runs,
 * and what tests drive. An action is held while any of its holders (a key, or `byHook`) holds
 * it; one held while the game is paused doesn't count as just pressed.
 * @template State
 * @param {GameDefinition<State>} definition
 * @param {Controls} controls
 * @param {{ seed: number }} options
 */
export function createGame(definition, controls, { seed }) {
  const known = new Set(controls.actions.map((action) => action.id));
  /** @type {Map<string, Set<string>>} */
  const holders = new Map();
  /** @type {Set<string>} */
  let pressedThisFrame = new Set();
  let random = seededRandom(seed);
  let state = definition.init(random);
  let frame = 0;

  /** @param {string} action */
  function check(action) {
    if (!known.has(action)) throw new Error(`${action} is not an action in controls.json`);
  }

  /** @type {Input} */
  const input = {
    // A tap let go of before the next step still holds for that one step.
    isDown: (action) => {
      check(action);
      return (holders.get(action)?.size ?? 0) > 0 || pressedThisFrame.has(action);
    },
    wasPressed: (action) => {
      check(action);
      return pressedThisFrame.has(action);
    },
  };

  return {
    /** Updates the game by one fixed step. */
    tick() {
      definition.update(state, input, 1 / updatesPerSecond, random);
      pressedThisFrame = new Set();
      frame += 1;
    },
    render() {
      definition.render?.(state);
    },
    /**
     * `holder` starts holding `action`; it counts as pressed on the next step unless `quiet`.
     * @param {string} action
     * @param {string} [holder]
     * @param {{ quiet?: boolean }} [options]
     */
    press(action, holder = byHook, { quiet = false } = {}) {
      check(action);
      const held = holders.get(action) ?? new Set();
      if (held.size === 0 && !quiet) pressedThisFrame.add(action);
      held.add(holder);
      holders.set(action, held);
    },
    /**
     * @param {string} action
     * @param {string} [holder]
     */
    release(action, holder = byHook) {
      check(action);
      holders.get(action)?.delete(holder);
    },
    /** Lets go of every action, as when the page loses the keyboard. */
    releaseAll() {
      holders.clear();
    },
    /**
     * Starts over from the first state, with `seed` (or the same one), nothing held.
     * @param {number} [nextSeed]
     */
    restart(nextSeed = seed) {
      if (!Number.isInteger(nextSeed)) throw new Error(`a seed is a whole number: ${nextSeed}`);
      seed = nextSeed;
      random = seededRandom(seed);
      state = definition.init(random);
      frame = 0;
      holders.clear();
      pressedThisFrame = new Set();
    },
    /** A copy of the state, as plain data. */
    state: () => structuredClone(state),
    frame: () => frame,
    seed: () => seed,
  };
}

/**
 * Shows `message` over the page, for whoever plays it: the game stopped, and why.
 * @param {string} message
 */
function showError(message) {
  const box = document.createElement("pre");
  box.textContent = message;
  box.style.cssText =
    "position:fixed;inset:auto 0 0 0;margin:0;padding:12px;background:#400c;color:#fff;font:12px monospace;white-space:pre-wrap";
  document.body.append(box);
}

// An error before the game starts (a library that won't load, no WebGL) is shown on the page too.
if (typeof window !== "undefined") {
  addEventListener("error", (event) => showError(String(event.error ?? event.message)));
  addEventListener("unhandledrejection", (event) => showError(String(event.reason)));
}

/**
 * Runs the game in the page: keys from `controls.json`, a fixed step at 60 per second, and
 * `window.gesso` for whoever drives it (Claude Code, a test). The page's URL may say
 * `?seed=123` and `?paused`. An error in the game pauses it and is shown on the page.
 * @template State
 * @param {GameDefinition<State>} definition
 */
export async function startGame(definition) {
  const response = await fetch(new URL("controls.json", document.baseURI));
  if (!response.ok) throw new Error(`controls.json: ${response.status}`);
  const controls = parseControls(await response.json());
  const params = new URLSearchParams(location.search);
  const seedParam = Number.parseInt(params.get("seed") ?? "1", 10);
  const game = createGame(definition, controls, {
    seed: Number.isInteger(seedParam) ? seedParam : 1,
  });
  let paused = params.has("paused");
  /** @type {unknown} */
  let lastError = null;

  /** @param {() => void} work */
  function guarded(work) {
    try {
      work();
    } catch (error) {
      paused = true;
      lastError = error;
      console.error(error);
      showError(`ゲームが止まりました: ${error instanceof Error ? error.stack : String(error)}`);
    }
  }

  /** @type {Map<string, string>} */
  const actionByKey = new Map();
  for (const action of controls.actions) {
    for (const key of action.keys) actionByKey.set(key, action.id);
  }
  addEventListener("keydown", (event) => {
    const action = actionByKey.get(event.code);
    if (action === undefined) return;
    event.preventDefault();
    game.press(action, event.code, { quiet: paused });
  });
  addEventListener("keyup", (event) => {
    const action = actionByKey.get(event.code);
    if (action !== undefined) game.release(action, event.code);
  });
  // Keys let go of while the page didn't have the keyboard never send keyup here.
  addEventListener("blur", () => game.releaseAll());
  document.addEventListener("visibilitychange", () => game.releaseAll());

  let last = performance.now();
  let owed = 0;
  /** @param {number} now */
  function onFrame(now) {
    owed += Math.min((now - last) / 1000, maxCatchUpSeconds);
    last = now;
    while (owed >= 1 / updatesPerSecond) {
      if (!paused) guarded(() => game.tick());
      owed -= 1 / updatesPerSecond;
    }
    guarded(() => game.render());
    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);

  window.gesso = {
    controls,
    getState: () => game.state(),
    frame: () => game.frame(),
    seed: () => game.seed(),
    isPaused: () => paused,
    /** The error that stopped the game, or `null`. */
    lastError: () => lastError,
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    /** Pauses, then moves `frames` steps; gives the state after them. */
    step: (frames = 1) => {
      paused = true;
      for (let i = 0; i < frames; i += 1) game.tick();
      game.render();
      return game.state();
    },
    press: (action) => game.press(action),
    release: (action) => game.release(action),
    restart: (seed) => {
      game.restart(seed);
      game.render();
    },
  };
}
