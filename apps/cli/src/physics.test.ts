import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createPhysics } from "../templates/3d/src/gesso/physics.js";

const character = { radius: 0.4, halfHeight: 0.4 };
/** Where the character's center is when it stands on y = 0. */
const standing = character.radius + character.halfHeight;

type Point = [x: number, y: number, z: number];

/** An axis-aligned box from `min` to `max`, as `loadLevel` gives a solid shape. */
function box(name: string, min: Point, max: Point, kind: "convex" | "mesh" = "convex") {
  const vertices: number[] = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) vertices.push(x, y, z);
  // Two triangles per side, outward.
  const sides: [number, number, number, number][] = [
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    [0, 4, 5, 1],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 5, 7, 3],
  ];
  const indices = sides.flatMap(([a, b, c, d]) => [a, b, c, a, c, d]);
  return { name, kind, vertices, indices };
}

const ground = box("Ground", [-10, -0.5, -10], [10, 0, 10]);

/**
 * Moves the character from `from` by `step` each of `frames` sixtieths of a second, falling as
 * the 3d template's game does (gravity 20, the fall stopped when it stands).
 */
function walk(
  physics: Awaited<ReturnType<typeof createPhysics>>,
  from: { x: number; y: number; z: number },
  step: { x: number; z: number },
  frames: number,
) {
  let at = { ...from, grounded: false };
  let vy = 0;
  for (let i = 0; i < frames; i += 1) {
    vy -= 20 / 60;
    at = physics.moveCharacter(at, { ...step, y: vy / 60 });
    if (at.grounded && vy < 0) vy = 0;
  }
  return at;
}

test("the character stands on the ground and stops at a wall, convex or mesh", async () => {
  for (const kind of ["convex", "mesh"] as const) {
    const physics = await createPhysics(
      [ground, box("Wall", [2, 0, -5], [3, 3, 5], kind)],
      character,
    );
    expect(physics.skipped).toEqual([]);

    const landed = walk(physics, { x: 0, y: 2, z: 0 }, { x: 0, z: 0 }, 60);
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBeCloseTo(standing, 1);

    const atWall = walk(physics, landed, { x: 0.1, z: 0 }, 60);
    expect(atWall.x).toBeCloseTo(2 - character.radius, 1);
    expect(atWall.y).toBeCloseTo(standing, 1);
  }
});

test("the character walks up a low slope and a low step, but not a high step", async () => {
  // A ramp rising 1 over 4 (14°) from x 1 to 5, onto a block 1 high.
  const ramp = {
    name: "Ramp",
    kind: "convex" as const,
    vertices: [1, 0, -2, 5, 0, -2, 1, 0, 2, 5, 0, 2, 5, 1, -2, 5, 1, 2],
    indices: [0, 1, 2, 1, 3, 2, 1, 4, 5, 1, 5, 3, 0, 4, 1, 2, 3, 5, 0, 2, 5, 0, 5, 4],
  };
  const physics = await createPhysics(
    [ground, ramp, box("Block", [5, 0, -2], [8, 1, 2]), box("Step", [-4, 0, -2], [-3, 0.2, 2])],
    character,
  );

  const onBlock = walk(physics, { x: 0, y: standing, z: 0 }, { x: 0.1, z: 0 }, 75);
  expect(onBlock.x).toBeGreaterThan(5.5);
  expect(onBlock.x).toBeLessThan(8);
  expect(onBlock.y).toBeCloseTo(1 + standing, 1);

  const overStep = walk(physics, { x: 0, y: standing, z: 0 }, { x: -0.1, z: 0 }, 40);
  expect(overStep.x).toBeLessThan(-3.5);
  expect(overStep.y).toBeCloseTo(0.2 + standing, 1);

  const tall = await createPhysics([ground, box("Tall", [-4, 0, -2], [-3, 0.6, 2])], character);
  const atTall = walk(tall, { x: 0, y: standing, z: 0 }, { x: -0.1, z: 0 }, 40);
  expect(atTall.x).toBeCloseTo(-3 + character.radius, 1);
});

test("a character that starts touching the ground stays standing", async () => {
  const physics = await createPhysics([ground], character);
  const still = walk(physics, { x: 0, y: standing, z: 0 }, { x: 0, z: 0 }, 600);
  expect(still.y).toBeCloseTo(standing, 1);
  expect(still.grounded).toBe(true);
});

test("a shape that can't be made solid is named, and the rest are solid", async () => {
  const physics = await createPhysics(
    [ground, { name: "Empty", kind: "mesh", vertices: [0, 0, 0, 1, 0, 0], indices: [] }],
    character,
  );
  expect(physics.skipped).toEqual(["Empty"]);
  expect(walk(physics, { x: 0, y: 2, z: 0 }, { x: 0, z: 0 }, 60).y).toBeCloseTo(standing, 1);
});

test("the 3d template reads Rapier at the version the tests use", async () => {
  const html = await readFile(
    join(import.meta.dirname, "..", "templates", "3d", "index.html"),
    "utf8",
  );
  const pkg: { devDependencies: Record<string, string> } = JSON.parse(
    await readFile(join(import.meta.dirname, "..", "package.json"), "utf8"),
  );
  const version = pkg.devDependencies["@dimforge/rapier3d-compat"];
  expect(html).toContain(`@dimforge/rapier3d-compat@${version}/`);
});
