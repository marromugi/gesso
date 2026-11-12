// Collisions for a character walking in a fixed level, with Rapier. See CLAUDE.md.
import { ColliderDesc, RigidBodyDesc, World, init } from "@dimforge/rapier3d-compat";

/**
 * @typedef {{ name: string, kind: "convex" | "mesh", vertices: number[], indices: number[] }} Shape
 *   A solid part of the level: `vertices` are x, y, z in world space (y up); `indices` three per
 *   triangle. "convex" collides as the convex hull of its vertices, "mesh" as its triangles.
 * @typedef {{ radius: number, halfHeight: number, maxSlopeDegrees?: number, stepHeight?: number }} Character
 *   The character's capsule (its center is its position; it is `2 * (halfHeight + radius)` tall),
 *   the steepest slope it walks up (50° when left out), and the highest step it climbs (0.3).
 * @typedef {{ x: number, y: number, z: number }} Vector
 * @typedef {{
 *   moveCharacter: (from: Vector, delta: Vector) => Vector & { grounded: boolean },
 *   skipped: string[],
 * }} Physics
 *   `moveCharacter`: where the character at `from` ends up when it tries to move by `delta`,
 *   sliding along what it meets, and whether it then stands on something. `skipped`: shapes that
 *   could not be made solid.
 */

/**
 * The fixed level made solid, and one character to move through it. The level never changes,
 * so the answers depend only on the arguments: the game's state stays the only thing that
 * changes.
 * @param {Shape[]} shapes
 * @param {Character} character
 * @returns {Promise<Physics>}
 */
export async function createPhysics(shapes, character) {
  await init();
  const world = new World({ x: 0, y: 0, z: 0 });
  /** @type {string[]} */
  const skipped = [];
  for (const shape of shapes) {
    const vertices = new Float32Array(shape.vertices);
    const desc =
      shape.kind === "mesh"
        ? ColliderDesc.trimesh(vertices, new Uint32Array(shape.indices))
        : ColliderDesc.convexHull(vertices);
    if (desc === null) skipped.push(shape.name);
    else world.createCollider(desc);
  }

  const body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased());
  const collider = world.createCollider(
    ColliderDesc.capsule(character.halfHeight, character.radius),
    body,
  );
  const controller = world.createCharacterController(0.01);
  controller.setMaxSlopeClimbAngle(((character.maxSlopeDegrees ?? 50) * Math.PI) / 180);
  controller.enableAutostep(character.stepHeight ?? 0.3, character.radius / 2, false);
  controller.enableSnapToGround(0.3);

  return {
    skipped,
    moveCharacter(from, delta) {
      body.setTranslation(from, true);
      world.step();
      controller.computeColliderMovement(collider, delta);
      const moved = controller.computedMovement();
      return {
        x: from.x + moved.x,
        y: from.y + moved.y,
        z: from.z + moved.z,
        grounded: controller.computedGrounded(),
      };
    },
  };
}
