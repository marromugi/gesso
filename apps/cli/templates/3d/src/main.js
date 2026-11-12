// Loads the level, draws the game with three.js and runs it (see CLAUDE.md). The rules are in
// game.js.
import * as THREE from "three";
import { loadLevel } from "./gesso/level.js";
import { createPhysics } from "./gesso/physics.js";
import { startGame } from "./gesso/runtime.js";
import { character, createRules } from "./game.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#1d2330");
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight("#ffffff", "#3a4458", 1.5));
const sun = new THREE.DirectionalLight("#ffffff", 2);
sun.position.set(5, 10, 7);
scene.add(sun);

const level = await loadLevel("assets/level.glb");
scene.add(level.scene);
const physics = await createPhysics(level.shapes, character);
if (physics.skipped.length > 0) console.warn("these could not be made solid:", physics.skipped);

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(character.radius, character.halfHeight * 2),
  new THREE.MeshStandardMaterial({ color: "#f2c94c" }),
);
scene.add(player);

function fit() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", fit);
fit();

await startGame({
  ...createRules(physics),
  render(state) {
    const { x, y, z } = state.player;
    player.position.set(x, y, z);
    camera.position.set(x, y + 6, z + 10);
    camera.lookAt(x, y, z);
    renderer.render(scene, camera);
  },
});
