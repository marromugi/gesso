// Loads a level made in Blender (glTF) and finds its solid parts. See CLAUDE.md.
import { Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** A name Blender gave a collider-only object: "-col", maybe numbered ("Rock-col.001"). */
const colliderOnlyName = /-col(?:[._]\d+)?$/u;

/**
 * The level at `url` (a .glb): its objects to add to the scene, and the solid shapes for
 * `createPhysics`, one per solid object. An object with the custom property `collider`
 * ("convex" or "mesh") is solid, with all it holds; one whose name ends in "-col" is solid
 * ("convex" unless it says otherwise) and not drawn.
 * @param {string} url
 * @returns {Promise<{ scene: import("three").Group, shapes: import("./physics.js").Shape[] }>}
 */
export async function loadLevel(url) {
  const { scene } = await new GLTFLoader().loadAsync(url);
  scene.updateMatrixWorld(true);
  /** @type {Map<import("three").Object3D, import("./physics.js").Shape>} */
  const byOwner = new Map();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const solid = solidOwner(object);
    if (solid === null) return;
    if (colliderOnlyName.test(solid.owner.name)) object.visible = false;
    const shape = byOwner.get(solid.owner) ?? {
      name: solid.owner.name,
      kind: solid.kind,
      vertices: [],
      indices: [],
    };
    addTriangles(shape, object);
    byOwner.set(solid.owner, shape);
  });
  return { scene, shapes: [...byOwner.values()] };
}

/**
 * The object, `object` or one it is inside, that is solid, and how it collides.
 * @param {import("three").Object3D} object
 * @returns {{ owner: import("three").Object3D, kind: "convex" | "mesh" } | null}
 */
function solidOwner(object) {
  for (let at = object; at !== null; at = at.parent) {
    const kind = at.userData.collider;
    if (kind === "convex" || kind === "mesh") return { owner: at, kind };
    if (colliderOnlyName.test(at.name)) return { owner: at, kind: "convex" };
  }
  return null;
}

/**
 * Adds `mesh`'s vertices, in world space, and its triangles to `shape`.
 * @param {import("./physics.js").Shape} shape
 * @param {import("three").Mesh} mesh
 */
function addTriangles(shape, mesh) {
  const first = shape.vertices.length / 3;
  const position = mesh.geometry.getAttribute("position");
  const e = mesh.matrixWorld.elements;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    shape.vertices.push(
      e[0] * x + e[4] * y + e[8] * z + e[12],
      e[1] * x + e[5] * y + e[9] * z + e[13],
      e[2] * x + e[6] * y + e[10] * z + e[14],
    );
  }
  const index = mesh.geometry.getIndex();
  for (let i = 0; i < (index ? index.count : position.count); i += 1) {
    shape.indices.push(first + (index ? index.getX(i) : i));
  }
}
