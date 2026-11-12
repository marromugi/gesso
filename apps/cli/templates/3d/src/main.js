// Draws the game with three.js and runs it (see CLAUDE.md). The rules are in game.js.
import * as THREE from "three";
import { startGame } from "./gesso/runtime.js";
import { floorSize, init, size, update } from "./game.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#1d2330");
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(0, 8, 12);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight("#ffffff", "#3a4458", 2));

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(floorSize, floorSize),
  new THREE.MeshStandardMaterial({ color: "#3a4458" }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(size, size, size),
  new THREE.MeshStandardMaterial({ color: "#f2c94c" }),
);
scene.add(cube);

function fit() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", fit);
fit();

await startGame({
  init,
  update,
  render(state) {
    cube.position.set(state.player.x, state.player.y, state.player.z);
    renderer.render(scene, camera);
  },
});
