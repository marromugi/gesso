// Draws the game on the canvas and runs it (see CLAUDE.md). The rules are in game.js.
import { startGame } from "./gesso/runtime.js";
import { floorY, height, init, size, update, width } from "./game.js";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("index.html has no <canvas id=game>");
const context = canvas.getContext("2d");
if (!context) throw new Error("the browser gives no 2D canvas");

await startGame({
  init,
  update,
  render(state) {
    context.fillStyle = "#1d2330";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#3a4458";
    context.fillRect(0, floorY, width, height - floorY);
    context.fillStyle = "#f2c94c";
    context.fillRect(state.player.x, state.player.y, size, size);
  },
});
