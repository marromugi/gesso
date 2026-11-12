/**
 * Waits until the API's `wrangler dev` (dev.port in wrangler.jsonc) answers, so that
 * `pnpm dev:play` starts after it: two `wrangler dev` started at the same moment can pick the
 * same port for miniflare's internal sockets, and one of them then fails with
 * "Address already in use".
 */
const healthUrl = "http://localhost:8787/health";
const timeoutMs = 120_000;
const retryMs = 500;

const deadline = Date.now() + timeoutMs;
for (;;) {
  try {
    if ((await fetch(healthUrl)).ok) break;
  } catch {
    // Not listening yet.
  }
  if (Date.now() > deadline) {
    console.error(`${healthUrl} did not answer within ${timeoutMs / 1000}s.`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, retryMs));
}
