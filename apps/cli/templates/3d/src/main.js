// A cube that moves on a floor and jumps: the starting point to change into the prototype.
// See CLAUDE.md.
import * as THREE from "three";
import { startGame } from "./gesso/runtime.js";

const floorSize = 20;
const size = 1;
const moveSpeed = 6;
const jumpSpeed = 7;
const gravity = 20;

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

const edge = floorSize / 2 - size / 2;

await startGame({
  init: () => ({ player: { x: 0, y: size / 2, z: 0, vy: 0, onGround: true } }),

  update(state, input, dt) {
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
  },

  render(state) {
    cube.position.set(state.player.x, state.player.y, state.player.z);
    renderer.render(scene, camera);
  },
});
