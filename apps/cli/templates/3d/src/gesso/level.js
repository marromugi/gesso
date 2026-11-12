// Loads a level made in Blender (glTF) and finds its solid parts. See CLAUDE.md.
import { Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * The level at `url` (a .glb): its objects to add to the scene, and the solid shapes for
 * `createPhysics`. An object, or one it is inside, with the custom property `collider`
 * ("convex" or "mesh") is solid; one whose name ends in "-col" is solid but not drawn.
 * @param {string} url
 * @returns {Promise<{ scene: import("three").Group, shapes: import("./physics.js").Shape[] }>}
 */
export async function loadLevel(url) {
  const { scene } = await new GLTFLoader().loadAsync(url);
  scene.updateMatrixWorld(true);
  /** @type {import("./physics.js").Shape[]} */
  const shapes = [];
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const solid = solidOwner(object);
    if (solid === null) return;
    if (solid.name.endsWith("-col")) object.visible = false;
    shapes.push({ name: solid.name, kind: solid.kind, ...trianglesOf(object) });
  });
  return { scene, shapes };
}

/**
 * The object, `object` or one it is inside, whose `collider` property says how it collides.
 * @param {import("three").Object3D} object
 * @returns {{ name: string, kind: "convex" | "mesh" } | null}
 */
function solidOwner(object) {
  for (let at = object; at !== null; at = at.parent) {
    const kind = at.userData.collider;
    if (kind === "convex" || kind === "mesh") return { name: at.name, kind };
  }
  return null;
}

/**
 * `mesh`'s vertices in world space and its triangles.
 * @param {import("three").Mesh} mesh
 */
function trianglesOf(mesh) {
  const position = mesh.geometry.getAttribute("position");
  const e = mesh.matrixWorld.elements;
  /** @type {number[]} */
  const vertices = [];
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    vertices.push(
      e[0] * x + e[4] * y + e[8] * z + e[12],
      e[1] * x + e[5] * y + e[9] * z + e[13],
      e[2] * x + e[6] * y + e[10] * z + e[14],
    );
  }
  const index = mesh.geometry.getIndex();
  const indices = index
    ? Array.from(index.array)
    : Array.from({ length: position.count }, (_, i) => i);
  return { vertices, indices };
}
