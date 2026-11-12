import { expect, test } from "vitest";
import { createGame, seededRandom } from "../templates/shared/src/gesso/runtime.js";

const controls = {
  format: 1 as const,
  actions: [{ id: "jump", label: "ジャンプ", keys: ["Space"] }],
};

/** Counts frames, jumps on the frame the action starts, and keeps a random number. */
function counter() {
  return createGame(
    {
      init: (random: () => number) => ({ frames: 0, jumps: 0, roll: random() }),
      update(
        state: { frames: number; jumps: number },
        input: { wasPressed: (a: string) => boolean },
      ) {
        state.frames += 1;
        if (input.wasPressed("jump")) state.jumps += 1;
      },
    },
    controls,
    { seed: 7 },
  );
}

/** The first five numbers from `seed`. */
function take(seed: number): number[] {
  return Array.from({ length: 5 }, seededRandom(seed));
}

test("the same seed gives the same numbers, and another seed others", () => {
  expect(take(7)).toEqual(take(7));
  expect(take(7)).not.toEqual(take(8));
  expect(take(7).every((n) => n >= 0 && n < 1)).toBe(true);
});

test("a press counts on the frame it starts, not while it is held", () => {
  const game = counter();
  game.press("jump");
  game.tick();
  game.press("jump");
  game.tick();
  game.release("jump");
  game.press("jump");
  game.tick();

  expect(game.state()).toMatchObject({ frames: 3, jumps: 2 });
  expect(game.frame()).toBe(3);
});

test("restart starts over from the first state, the same for the same seed", () => {
  const game = counter();
  const first = game.state();
  game.tick();

  game.restart();
  expect(game.state()).toEqual(first);
  expect(game.frame()).toBe(0);
  game.restart(8);
  expect(game.state()).not.toEqual(first);
  expect(game.seed()).toBe(8);
});

test("an action not in controls.json is refused", () => {
  expect(() => counter().press("fly")).toThrow(/fly/);
});

test("the state handed out is a copy", () => {
  const game = counter();
  const state = game.state() as { frames: number };
  state.frames = 99;
  expect(game.state()).toMatchObject({ frames: 0 });
});
