// A box that runs and jumps: the starting point to change into the prototype. See CLAUDE.md.
import { startGame } from "./gesso/runtime.js";

const width = 800;
const height = 450;
const floorY = 380;
const size = 32;
const runSpeed = 260;
const jumpSpeed = 520;
const gravity = 1400;

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("index.html has no <canvas id=game>");
const context = canvas.getContext("2d");
if (!context) throw new Error("the browser gives no 2D canvas");

await startGame({
  init: () => ({
    player: { x: width / 2 - size / 2, y: floorY - size, vx: 0, vy: 0, onGround: true },
  }),

  update(state, input, dt) {
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
  },

  render(state) {
    context.fillStyle = "#1d2330";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#3a4458";
    context.fillRect(0, floorY, width, height - floorY);
    context.fillStyle = "#f2c94c";
    context.fillRect(state.player.x, state.player.y, size, size);
  },
});
