// The rules: the first state and one fixed step, with nothing of the browser (see CLAUDE.md).
// A box that runs and jumps: the starting point to change into the prototype.

export const width = 800;
export const height = 450;
export const floorY = 380;
export const size = 32;
const runSpeed = 260;
const jumpSpeed = 520;
const gravity = 1400;

/** @typedef {{ player: { x: number, y: number, vx: number, vy: number, onGround: boolean } }} State */

/** @returns {State} */
export function init() {
  return {
    player: { x: width / 2 - size / 2, y: floorY - size, vx: 0, vy: 0, onGround: true },
  };
}

/**
 * @param {State} state
 * @param {import("./gesso/runtime.js").Input} input
 * @param {number} dt
 */
export function update(state, input, dt) {
  const { player } = state;
  player.vx = (input.isDown("right") ? runSpeed : 0) - (input.isDown("left") ? runSpeed : 0);
  if (player.onGround && input.wasPressed("jump")) {
    player.vy = -jumpSpeed;
    player.onGround = false;
  }
  player.vy += gravity * dt;
  player.x = Math.min(Math.max(player.x + player.vx * dt, 0), width - size);
  player.y += player.vy * dt;
  if (player.y >= floorY - size) {
    player.y = floorY - size;
    player.vy = 0;
    player.onGround = true;
  }
}
