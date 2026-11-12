import { expect, test } from "vitest";
import { type Fetch, createApiClient } from "./api.ts";

const apiUrl = "https://gesso.test/api";

/** Answers every request with `response`, keeping what was sent in `sent`. */
function fakeFetch(response: () => Response) {
  const sent: Request[] = [];
  const fetchFn: Fetch = async (input, init) => {
    sent.push(new Request(input, init));
    return response();
  };
  return { fetchFn, sent };
}

test("every call sends the session token as Bearer, to the API's route", async () => {
  const api = fakeFetch(() => Response.json({ versions: [{ number: 2, createdAt: "x" }] }));

  await createApiClient(apiUrl, "token-1", api.fetchFn).listVersions("p 1");

  const [request] = api.sent;
  expect(request?.url).toBe(`${apiUrl}/prototypes/p%201/versions`);
  expect(request?.headers.get("authorization")).toBe("Bearer token-1");
});

test("a version with content not uploaded yet comes back as the hashes to upload", async () => {
  const api = fakeFetch(() =>
    Response.json({ error: "missing_content", hashes: ["a".repeat(64)] }, { status: 409 }),
  );

  const result = await createApiClient(apiUrl, "t", api.fetchFn).createVersion("p1", [
    { path: "index.html", hash: "a".repeat(64) },
  ]);

  expect(result).toEqual({ kind: "missingContent", hashes: ["a".repeat(64)] });
  expect(await api.sent[0]?.json()).toEqual({
    files: [{ path: "index.html", hash: "a".repeat(64) }],
  });
});

test("a session the API doesn't take says to sign in again", async () => {
  const api = fakeFetch(() => Response.json({ error: "unauthorized" }, { status: 401 }));
  await expect(createApiClient(apiUrl, "t", api.fetchFn).listPrototypes()).rejects.toThrow(
    /gesso login/,
  );
});

test("a file too large to upload says so", async () => {
  const api = fakeFetch(() => new Response(null, { status: 413 }));
  await expect(
    createApiClient(apiUrl, "t", api.fetchFn).saveContent("p1", "a".repeat(64), new Uint8Array(3)),
  ).rejects.toThrow(/10 MiB/);
});
