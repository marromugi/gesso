import { describe, expect, test } from "vitest";
import { hashContent, isFilePath, versionFilesProblem } from "./versionFiles.ts";

describe("isFilePath", () => {
  test.each(["index.html", "src/game.js", "assets/level 1/map.json", ".well-known/x"])(
    "takes %s",
    (path) => expect(isFilePath(path)).toBe(true),
  );

  test.each([
    "",
    "/index.html",
    "src/",
    "src//game.js",
    "./index.html",
    "src/../index.html",
    "..",
    "src\\game.js",
    "a\u0000b",
    "a".repeat(513),
  ])("refuses %j", (path) => expect(isFilePath(path)).toBe(false));
});

describe("versionFilesProblem", () => {
  const hash = "0".repeat(64);

  test("a list with index.html at the root can be saved", () => {
    expect(
      versionFilesProblem([
        { path: "index.html", hash },
        { path: "game.js", hash },
      ]),
    ).toBeNull();
  });

  test("a list without index.html at the root can't", () => {
    expect(versionFilesProblem([{ path: "src/index.html", hash }])).toBe(
      "no index.html at the root",
    );
  });

  test("a path listed twice can't", () => {
    expect(
      versionFilesProblem([
        { path: "index.html", hash },
        { path: "index.html", hash: "1".repeat(64) },
      ]),
    ).toBe("index.html is listed twice");
  });

  test("a file that is also a directory can't", () => {
    expect(
      versionFilesProblem([
        { path: "index.html", hash },
        { path: "lib", hash },
        { path: "lib/game.js", hash },
      ]),
    ).toBe("lib is a file and a directory of lib/game.js");
  });

  test("paths that differ only in case can't, as files or as directories", () => {
    expect(
      versionFilesProblem([
        { path: "index.html", hash },
        { path: "Index.html", hash },
      ]),
    ).toBe("index.html and Index.html differ only in case");
    expect(
      versionFilesProblem([
        { path: "index.html", hash },
        { path: "Lib", hash },
        { path: "lib/game.js", hash },
      ]),
    ).toBe("Lib is a file and a directory of lib/game.js");
  });

  test("more than 1000 files can't", () => {
    const files = Array.from({ length: 1001 }, (_, i) => ({ path: `f${i}`, hash }));
    expect(versionFilesProblem([{ path: "index.html", hash }, ...files])).toBe(
      "more than 1000 files",
    );
  });
});

test("hashContent gives SHA-256 as lowercase hex", async () => {
  expect(await hashContent(await new Blob(["abc"]).arrayBuffer())).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
