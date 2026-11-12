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
  const api = fakeApi(() => Response.json({ user: { name: "owner" } }));

  expect(await api.client.me()).toEqual({ name: "owner" });

  const [request] = api.sent;
  expect(request?.url).toBe(`${apiUrl}/me`);
  expect(request?.headers.get("authorization")).toBe("Bearer token-1");
});

test("an answer the CLI doesn't expect says what the API returned", async () => {
  const api = fakeApi(() => Response.json({ error: "boom" }, { status: 500 }));
  await expect(api.client.endSession()).rejects.toThrow(
    'DELETE /session: API が 500 を返しました。{"error":"boom"}',
  );
});
