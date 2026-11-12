// The rules: the first state and one fixed step, with nothing of the browser or three.js
// (see CLAUDE.md). A capsule that walks and jumps around a level made in Blender, colliding with
// it through `physics`: the starting point to change.

/** The player's capsule: 1.6 tall, its center at its position. */
export const character = { radius: 0.4, halfHeight: 0.4 };
const moveSpeed = 6;
const jumpSpeed = 7;
const gravity = 20;
const start = { x: 1.5, y: 2, z: 8 };
/** Falling below this puts the player back at the start. */
const fallLimit = -10;

/**
 * `y` is up, `z` grows toward the camera.
 * @typedef {{ player: { x: number, y: number, z: number, vy: number, onGround: boolean } }} State
 */

/** @returns {State} */
function init() {
  return { player: { ...start, vy: 0, onGround: false } };
}

/**
 * The game's rules, colliding through `physics` (`createPhysics` with `character`).
 * @param {import("./gesso/physics.js").Physics} physics
 */
export function createRules(physics) {
  /**
   * @param {State} state
   * @param {import("./gesso/runtime.js").Input} input
   * @param {number} dt
   */
  function update(state, input, dt) {
    const { player } = state;
    const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    const dz = (input.isDown("back") ? 1 : 0) - (input.isDown("forward") ? 1 : 0);
    if (player.onGround && input.wasPressed("jump")) player.vy = jumpSpeed;
    player.vy -= gravity * dt;

    const wanted = player.vy * dt;
    const moved = physics.moveCharacter(player, {
      x: dx * moveSpeed * dt,
      y: wanted,
      z: dz * moveSpeed * dt,
    });
    // Rising into something stops the rise; landing stops the fall.
    if (wanted > 0 && moved.y - player.y < wanted / 2) player.vy = 0;
    if (moved.grounded && player.vy < 0) player.vy = 0;
    Object.assign(player, { x: moved.x, y: moved.y, z: moved.z, onGround: moved.grounded });

    if (player.y < fallLimit) Object.assign(player, start, { vy: 0, onGround: false });
  }

  return { init, update };
}
