// The game loop, input and debug hooks every gesso prototype starts from. See CLAUDE.md.

/** Frames the game is updated at, per second, whatever the screen's refresh rate. */
const updatesPerSecond = 60;

/** The longest real time one animation frame catches up on, so a stalled tab doesn't spiral. */
const maxCatchUpSeconds = 0.25;

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
 * A game that runs one fixed step at a time, with nothing of the browser: what `startGame` runs,
 * and what tests drive.
 * @template State
 * @param {GameDefinition<State>} definition
 * @param {Controls} controls
 * @param {{ seed: number }} options
 */
export function createGame(definition, controls, { seed }) {
  const known = new Set(controls.actions.map((action) => action.id));
  /** @type {Set<string>} */
  const held = new Set();
  /** @type {Set<string>} */
  let pressedThisFrame = new Set();
  let random = seededRandom(seed);
  let state = definition.init(random);
  let frame = 0;

  /** @type {Input} */
  const input = {
    isDown: (action) => held.has(action),
    wasPressed: (action) => pressedThisFrame.has(action),
  };

  /** @param {string} action */
  function check(action) {
    if (!known.has(action)) throw new Error(`${action} is not an action in controls.json`);
  }

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
    /** @param {string} action */
    press(action) {
      check(action);
      if (!held.has(action)) pressedThisFrame.add(action);
      held.add(action);
    },
    /** @param {string} action */
    release(action) {
      check(action);
      held.delete(action);
    },
    /** Starts over from the first state, with `seed` (or the same one). */
    restart(nextSeed = seed) {
      seed = nextSeed;
      random = seededRandom(seed);
      state = definition.init(random);
      frame = 0;
      held.clear();
      pressedThisFrame = new Set();
    },
    /** A copy of the state, as plain data. */
    state: () => structuredClone(state),
    frame: () => frame,
    seed: () => seed,
  };
}

/**
 * Loads `controls.json` next to the page.
 * @returns {Promise<Controls>}
 */
export async function loadControls() {
  const response = await fetch(new URL("controls.json", document.baseURI));
  if (!response.ok) throw new Error(`controls.json: ${response.status}`);
  return response.json();
}

/**
 * Runs the game in the page: keys from `controls.json`, a fixed step at 60 per second, and
 * `window.gesso` for whoever drives it (Claude Code, a test). The page's URL may say
 * `?seed=123` and `?paused`.
 * @template State
 * @param {GameDefinition<State>} definition
 */
export async function startGame(definition) {
  const controls = await loadControls();
  const params = new URLSearchParams(location.search);
  const game = createGame(definition, controls, { seed: Number(params.get("seed") ?? 1) });
  let paused = params.has("paused");

  /** @type {Map<string, string>} */
  const actionByKey = new Map();
  for (const action of controls.actions) {
    for (const key of action.keys) actionByKey.set(key, action.id);
  }
  addEventListener("keydown", (event) => {
    const action = actionByKey.get(event.code);
    if (action === undefined) return;
    event.preventDefault();
    if (!event.repeat) game.press(action);
  });
  addEventListener("keyup", (event) => {
    const action = actionByKey.get(event.code);
    if (action !== undefined) game.release(action);
  });

  let last = performance.now();
  let owed = 0;
  /** @param {number} now */
  function onFrame(now) {
    owed += Math.min((now - last) / 1000, maxCatchUpSeconds);
    last = now;
    while (owed >= 1 / updatesPerSecond) {
      if (!paused) game.tick();
      owed -= 1 / updatesPerSecond;
    }
    game.render();
    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);

  window.gesso = {
    controls,
    getState: () => game.state(),
    frame: () => game.frame(),
    seed: () => game.seed(),
    isPaused: () => paused,
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
