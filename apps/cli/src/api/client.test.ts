import { expect, test } from "vitest";
import { createApiClient } from "./client.ts";

const apiUrl = "https://gesso.test/api";

/** Answers every request with `response`, keeping what was sent in `sent`. */
function fakeApi(response: () => Response) {
  const sent: Request[] = [];
  const client = createApiClient({
    apiUrl,
    token: "token-1",
    fetch: async (input, init) => {
      sent.push(new Request(input, init));
      return response();
    },
  });
  return { client, sent };
}

test("every call sends the session token as Bearer, to the API's route", async () => {
  const api = fakeApi(() => Response.json({ versions: [] }));

  await api.client.listVersions("p 1");

  const [request] = api.sent;
  expect(request?.url).toBe(`${apiUrl}/prototypes/p%201/versions`);
  expect(request?.headers.get("authorization")).toBe("Bearer token-1");
});

test("a version is sent with the commit it came from", async () => {
  const api = fakeApi(() => Response.json({ number: 4 }, { status: 201 }));
  const files = [{ path: "index.html", hash: "a".repeat(64) }];
  const source = { commit: "b".repeat(40), branch: "main" };

  expect(await api.client.createVersion("p1", files, source)).toEqual({
    kind: "created",
    number: 4,
  });
  expect(await api.sent[0]?.json()).toEqual({ files, source });
});

test("a version with content not uploaded yet comes back as the hashes to upload", async () => {
  const api = fakeApi(() =>
    Response.json({ error: "missing_content", hashes: ["a".repeat(64)] }, { status: 409 }),
  );

  const result = await api.client.createVersion("p1", [], { commit: "b".repeat(40), branch: null });

  expect(result).toEqual({ kind: "missingContent", hashes: ["a".repeat(64)] });
});

test("content downloads as its bytes", async () => {
  const api = fakeApi(
    () => new Response("abc", { headers: { "content-type": "application/octet-stream" } }),
  );
  expect(new TextDecoder().decode(await api.client.readContent("p1", "a".repeat(64)))).toBe("abc");
});

test.each([
  [401, Response.json({ error: "unauthorized" }, { status: 401 }), /gesso login/],
  [404, Response.json({ error: "not_found" }, { status: 404 }), /見つかりません/],
])("a %i says what to do", async (_, response, message) => {
  await expect(fakeApi(() => response.clone()).client.listVersions("p1")).rejects.toThrow(message);
});

test("a file too large to upload says so", async () => {
  const api = fakeApi(() => new Response(null, { status: 413 }));
  await expect(api.client.saveContent("p1", "a".repeat(64), new Uint8Array(3))).rejects.toThrow(
    /10 MiB/,
  );
});
