// The rules: the first state and one fixed step, with nothing of the browser or three.js
// (see CLAUDE.md). A cube that moves on a floor and jumps: the starting point to change.

export const floorSize = 20;
export const size = 1;
const moveSpeed = 6;
const jumpSpeed = 7;
const gravity = 20;
const edge = floorSize / 2 - size / 2;

/**
 * `y` is the height above the floor (up is +), `z` grows toward the camera.
 * @typedef {{ player: { x: number, y: number, z: number, vy: number, onGround: boolean } }} State
 */

/** @returns {State} */
export function init() {
  return { player: { x: 0, y: size / 2, z: 0, vy: 0, onGround: true } };
}

/**
 * @param {State} state
 * @param {import("./gesso/runtime.js").Input} input
 * @param {number} dt
 */
export function update(state, input, dt) {
  const { player } = state;
  const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
  const dz = (input.isDown("back") ? 1 : 0) - (input.isDown("forward") ? 1 : 0);
  player.x = Math.min(Math.max(player.x + dx * moveSpeed * dt, -edge), edge);
  player.z = Math.min(Math.max(player.z + dz * moveSpeed * dt, -edge), edge);
  if (player.onGround && input.wasPressed("jump")) {
    player.vy = jumpSpeed;
    player.onGround = false;
  }
  player.vy -= gravity * dt;
  player.y += player.vy * dt;
  if (player.y <= size / 2) {
    player.y = size / 2;
    player.vy = 0;
    player.onGround = true;
  }
}
